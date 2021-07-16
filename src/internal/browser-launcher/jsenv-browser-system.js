/* eslint-env browser */

import { unevalException } from "../unevalException.js"
import { createBrowserRuntime } from "../runtime/createBrowserRuntime/createBrowserRuntime.js"
import { installBrowserErrorStackRemapping } from "../error-stack-remapping/installBrowserErrorStackRemapping.js"
import { fetchUrl } from "../browser-utils/fetch-browser.js"
import { fetchAndEvalUsingFetch } from "../browser-utils/fetchAndEvalUsingFetch.js"
import { memoize } from "../memoize.js"

const getNavigationStartTime = () => {
  try {
    return window.performance.timing.navigationStart
  } catch (e) {
    return Date.now()
  }
}

const navigationStartTime = getNavigationStartTime()

const readyPromise = new Promise((resolve) => {
  if (document.readyState === "complete") {
    resolve()
  } else {
    const loadCallback = () => {
      window.removeEventListener("load", loadCallback)
      resolve()
    }
    window.addEventListener("load", loadCallback)
  }
})

const fileExecutionMap = {}

const executionResultPromise = readyPromise.then(async () => {
  const fileExecutionResultMap = {}
  const fileExecutionResultPromises = []
  let status = "completed"
  let exceptionSource = ""
  Object.keys(fileExecutionMap).forEach((key) => {
    fileExecutionResultMap[key] = null // to get always same order for Object.keys(executionResult)
    const fileExecutionResultPromise = fileExecutionMap[key]
    fileExecutionResultPromises.push(fileExecutionResultPromise)
    fileExecutionResultPromise.then((fileExecutionResult) => {
      fileExecutionResultMap[key] = fileExecutionResult
      if (fileExecutionResult.status === "errored") {
        status = "errored"
        exceptionSource = fileExecutionResult.exceptionSource
      }
    })
  })
  await Promise.all(fileExecutionResultPromises)

  return {
    status,
    ...(status === "errored" ? { exceptionSource } : {}),
    startTime: navigationStartTime,
    endTime: Date.now(),
    fileExecutionResultMap,
  }
})

const executeFileUsingDynamicImport = async (specifier) => {
  const { currentScript } = document
  const fileExecutionResultPromise = (async () => {
    try {
      const url = new URL(specifier, document.location.href).href
      const namespace = await import(url)
      const executionResult = {
        status: "completed",
        namespace,
      }
      return executionResult
    } catch (e) {
      const executionResult = {
        status: "errored",
        exceptionSource: unevalException(e),
      }
      onExecutionError(executionResult, { currentScript })
      return executionResult
    }
  })()
  fileExecutionMap[specifier] = fileExecutionResultPromise
  return fileExecutionResultPromise
}

const executeFileUsingSystemJs = (specifier) => {
  // si on a déja importer ce fichier ??
  // if (specifier in fileExecutionMap) {

  // }

  const { currentScript } = document

  const fileExecutionResultPromise = (async () => {
    const browserRuntime = await getBrowserRuntime()
    const executionResult = await browserRuntime.executeFile(specifier, {
      measurePerformance: true,
      collectPerformance: true,
    })
    if (executionResult.status === "errored") {
      onExecutionError(executionResult, { currentScript })
    }
    return executionResult
  })()
  fileExecutionMap[specifier] = fileExecutionResultPromise
  return fileExecutionResultPromise
}

const onExecutionError = (executionResult, { currentScript }) => {
  // eslint-disable-next-line no-eval
  const originalError = window.eval(executionResult.exceptionSource)
  if (originalError.code === "NETWORK_FAILURE") {
    if (currentScript) {
      const errorEvent = new Event("error")
      currentScript.dispatchEvent(errorEvent)
    }
  } else {
    const { parsingError } = originalError
    const globalErrorEvent = new Event("error")
    if (parsingError) {
      globalErrorEvent.filename = parsingError.filename
      globalErrorEvent.lineno = parsingError.lineNumber
      globalErrorEvent.message = parsingError.message
      globalErrorEvent.colno = parsingError.columnNumber
    } else {
      globalErrorEvent.filename = originalError.filename
      globalErrorEvent.lineno = originalError.lineno
      globalErrorEvent.message = originalError.message
      globalErrorEvent.colno = originalError.columnno
    }
    window.dispatchEvent(globalErrorEvent)
  }
}

const getBrowserRuntime = memoize(async () => {
  const compileServerOrigin = document.location.origin
  const compileMetaResponse = await fetchUrl(`${compileServerOrigin}/.jsenv/compile-meta.json`)
  const compileMeta = await compileMetaResponse.json()
  const { outDirectoryRelativeUrl, errorStackRemapping } = compileMeta
  const outDirectoryUrl = `${compileServerOrigin}/${outDirectoryRelativeUrl}`
  const afterOutDirectory = document.location.href.slice(outDirectoryUrl.length)
  const parts = afterOutDirectory.split("/")
  const compileId = parts[0]
  const remaining = parts.slice(1).join("/")
  const htmlFileRelativeUrl = remaining

  const browserRuntime = await createBrowserRuntime({
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileId,
    htmlFileRelativeUrl,
  })

  if (errorStackRemapping && Error.captureStackTrace) {
    const { sourcemapMainFileRelativeUrl, sourcemapMappingFileRelativeUrl } = compileMeta

    await fetchAndEvalUsingFetch(`${compileServerOrigin}/${sourcemapMainFileRelativeUrl}`)
    const { SourceMapConsumer } = window.sourceMap
    SourceMapConsumer.initialize({
      "lib/mappings.wasm": `${compileServerOrigin}/${sourcemapMappingFileRelativeUrl}`,
    })
    const { getErrorOriginalStackString } = installBrowserErrorStackRemapping({
      SourceMapConsumer,
    })

    const errorTransform = async (error) => {
      // code can throw something else than an error
      // in that case return it unchanged
      if (!error || !(error instanceof Error)) return error
      const originalStack = await getErrorOriginalStackString(error)
      error.stack = originalStack
      return error
    }

    const executeFile = browserRuntime.executeFile
    browserRuntime.executeFile = (file, options = {}) => {
      return executeFile(file, { errorTransform, ...options })
    }
  }

  return browserRuntime
})

window.__jsenv__ = {
  executionResultPromise,
  executeFileUsingDynamicImport,
  executeFileUsingSystemJs,
}
