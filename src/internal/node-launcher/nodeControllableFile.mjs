import { uneval } from "@jsenv/uneval"

import { jsenvNodeSystemFileInfo } from "@jsenv/core/src/internal/jsenvInternalFiles.js"

const ACTIONS_AVAILABLE = {
  "execute-using-dynamic-import-fallback-on-systemjs": async (executeParams) => {
    const { execute } = await import(jsenvNodeSystemFileInfo.url)

    return execute(executeParams)
  },
  "execute-using-import": async ({ fileUrl }) => {
    const namespace = await import(fileUrl)

    const namespaceResolved = {}
    await Promise.all([
      ...Object.keys(namespace).map(async (key) => {
        const value = await namespace[key]
        namespaceResolved[key] = value
      }),
    ])

    return namespaceResolved
  },
  "execute-using-require": async ({ fileUrl }) => {
    const { createRequire } = await import("module")
    const { fileURLToPath } = await import("url")

    const filePath = fileURLToPath(fileUrl)
    const require = createRequire(fileUrl)

    // eslint-disable-next-line import/no-dynamic-require
    const namespace = require(filePath)

    const namespaceResolved = {}
    await Promise.all([
      ...Object.keys(namespace).map(async (key) => {
        const value = await namespace[key]
        namespaceResolved[key] = value
      }),
    ])
    return namespaceResolved
  },
}
const ACTION_REQUEST_EVENT_NAME = "action"
const ACTION_RESPONSE_EVENT_NAME = "action-result"
const ACTION_RESPONSE_STATUS_FAILED = "action-failed"
const ACTION_RESPONSE_STATUS_COMPLETED = "action-completed"

const sendActionFailed = (error) => {
  if (error.hasOwnProperty("toString")) {
    delete error.toString
  }
  sendToParent(
    ACTION_RESPONSE_EVENT_NAME,
    // process.send algorithm does not send non enumerable values
    // because it works with JSON.stringify I guess so use uneval

    uneval({
      status: ACTION_RESPONSE_STATUS_FAILED,
      value: error,
    }),
  )
}

const sendActionCompleted = (value) => {
  sendToParent(
    ACTION_RESPONSE_EVENT_NAME,
    // here we use JSON.stringify because we should not
    // have non enumerable value (unlike there is on Error objects)
    // otherwise uneval is quite slow to turn a giant object
    // into a string (and value can be giant when using coverage)
    JSON.stringify({
      status: ACTION_RESPONSE_STATUS_COMPLETED,
      value,
    }),
  )
}

const sendToParent = (type, data) => {
  // https://nodejs.org/api/process.html#process_process_connected
  // not connected anymore, cannot communicate with parent
  if (!process.connected) {
    return
  }

  // this can keep process alive longer than expected
  // when source is a long string.
  // It means node process may stay alive longer than expected
  // the time to send the data to the parent.
  process.send({
    type,
    data,
  })
}

const onceProcessMessage = (type, callback) => {
  const listener = (event) => {
    if (event.type === type) {
      // commenting line below keep this process alive
      removeListener()
      // eslint-disable-next-line no-eval
      callback(eval(`(${event.data})`))
    }
  }

  const removeListener = () => {
    process.removeListener("message", listener)
  }

  process.on("message", listener)
  return removeListener
}

const onceSIGTERM = (callback) => {
  process.once("SIGTERM", callback)
  return () => {
    process.removeListener("SIGTERM", callback)
  }
}

const removeActionRequestListener = onceProcessMessage(
  ACTION_REQUEST_EVENT_NAME,
  async ({ actionType, actionParams }) => {
    const action = ACTIONS_AVAILABLE[actionType]
    if (!action) {
      sendActionFailed(new Error(`unknown action ${actionType}`))
      return
    }

    let value
    let failed = false
    try {
      value = await action(actionParams)
    } catch (e) {
      failed = true
      value = e
    }

    if (failed) {
      sendActionFailed(value)
    } else {
      sendActionCompleted(value)
    }

    // removeActionRequestListener()
    if (actionParams.exitAfterAction) {
      // for some reason this fixes v8 coverage directory somtimes empty
      setTimeout(() => process.exit())
    }
  },
)

// remove listener to process.on('message')
// which is sufficient to let child process die
// assuming nothing else keeps it alive
onceSIGTERM(removeActionRequestListener)

setTimeout(() => sendToParent("ready"))
