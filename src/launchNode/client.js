import fs from "fs"
import path from "path"
import { resolveImport, hrefToPathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { createCancellationSource } from "/node_modules/@dmail/cancellation/index.js"
import { uneval } from "/node_modules/@dmail/uneval/index.js"
import { executeCompiledFile } from "../platform/node/executeCompiledFile.js"
import { registerProcessInterruptCallback } from "../process-signal/index.js"
import { readSourceMappingURL } from "../replaceSourceMappingURL.js"

const sourceMapSupport = import.meta.require("source-map-support")

const execute = async ({
  compileInto,
  compileIdOption,
  sourceOrigin,
  compileServerOrigin,
  filenameRelative,
  collectNamespace,
  collectCoverage,
  remap,
}) => {
  /*
  sourcemap generated by compile server are like that:
  {
    sources: [
      '/src/file.js'
    ]
  }

  to have proper file path it should either be
  {
    sources: [
      'Users/src/file.js'
    ]
  }

  or specify a sourceRoot like
  {
    sourceRoot: 'Users',
    sources: [
      '/src/file.js'
    ]
  }

  but it would certainly break sourcemap inside vscode or chrome
  to fix this I changed the sourcemap readed by source-map-support
  to ensure sources are absolute.
  See the following issue which talk about same problem
  // https://github.com/evanw/node-source-map-support/issues/120

  It works for now but nust be tested on many use case
  i'm pretty sure it would fail on file inside node_modules for instance
  */
  if (remap) {
    sourceMapSupport.install({
      retrieveSourceMap: (source) => {
        let content
        try {
          content = fs.readFileSync(source, "utf8")
        } catch (e) {
          if (e && e.code === "ENOENT") return null
          throw e
        }

        const sourceMappingURL = readSourceMappingURL(content)
        if (!sourceMappingURL) return null
        const sourceMapFile = path.resolve(path.dirname(source), sourceMappingURL)

        let sourceMap
        try {
          const sourceMapContent = fs.readFileSync(sourceMapFile, "utf8")
          sourceMap = JSON.parse(sourceMapContent)
        } catch (e) {
          if (e && e.code === "ENOENT") {
            return null
          }
          if (e && e.name === "SyntaxError") {
            return null
          }
          throw e
        }

        const absoluteSourceMap = {
          ...sourceMap,
          sources: sourceMap.sources.map((source) => {
            if (source[0] === "/") {
              return hrefToPathname(`${sourceOrigin}/${source.slice(1)}`)
            }

            const resolvedImport = resolveImport({
              importer: `file://${sourceMapFile}`,
              specifier: source,
            })
            return hrefToPathname(resolvedImport)
          }),
        }

        return {
          url: source,
          map: absoluteSourceMap,
        }
      },
    })
  }

  // process.once("uncaughtException", (valueThrowed) => {
  //   emitError(valueThrowed)
  //   process.exit(1)
  // })

  process.once("unhandledRejection", (valueRejected) => {
    throw valueRejected
    // emitError(valueRejected)
    // process.exit(1)
  })

  const { status, coverageMap, error, namespace } = await executeCompiledFile({
    compileInto,
    compileIdOption,
    sourceOrigin,
    compileServerOrigin,
    filenameRelative,
    collectNamespace,
    collectCoverage,
  })
  if (status === "rejected") {
    sendToParent("execute-result", {
      status,
      error: exceptionToObject(error),
      coverageMap,
    })
    return
  }
  sendToParent("execute-result", {
    status,
    namespace,
    coverageMap,
  })
}

const exceptionToObject = (exception) => {
  if (exception && exception instanceof Error) {
    const object = {}
    // indirectly this read exception.stack
    // which will ensure it leads to the right file path
    // thanks to sourceMapSupport
    // we may want to have something more explicit but for now it's cool
    Object.getOwnPropertyNames(exception).forEach((name) => {
      object[name] = exception[name]
    })
    return object
  }

  return {
    message: exception,
  }
}

const sendToParent = (type, data) => {
  // https://nodejs.org/api/process.html#process_process_connected
  // not connected anymore, cannot communicate with parent
  if (!process.connected) return

  // process.send algorithm does not send non enumerable values
  // because it works with JSON.stringify I guess so use uneval
  const source = uneval(data)

  process.send({
    type,
    data: source,
  })
}

const onceExecutionRequested = (callback) => listenParentOnce("execute", callback)

const listenParentOnce = (type, callback) => {
  const listener = (event) => {
    if (event.type === type) {
      // commenting line below keep this process alive
      removeListener()
      callback(eval(`(${event.data})`))
    }
  }

  const removeListener = () => {
    process.removeListener("message", listener)
  }

  process.on("message", listener)
  return removeListener
}

const { token, cancel } = createCancellationSource()
token.register(
  registerProcessInterruptCallback(() => {
    // cancel will remove listener to process.on('message')
    // which is sufficient to let child process die
    // assuming nothing else keeps it alive
    cancel("process interrupt")

    // if something keeps it alive the process won't die
    // but this is the responsability of the code
    // to properly cancel stuff on 'SIGINT'
    // If code does not do that, a process forced exit
    // like process.exit() or child.kill() from parent
    // will ensure process dies
  }),
)
token.register(onceExecutionRequested(execute))
