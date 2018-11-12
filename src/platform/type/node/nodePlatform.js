import { versionIsBelowOrEqual } from "@dmail/project-structure-compile-babel"
import { createImportTracker } from "../createImportTracker.js"
import https from "https"
import fetch from "node-fetch"
import { createNodeSystem } from "@dmail/module-loader"
import { valueInstall } from "./valueInstall.js"
import { createLocaters } from "../createLocaters.js"
import { cancellationNone } from "../../../cancel/index.js"

export const nodeVersionToCompileId = (version, compileMap) => {
  return Object.keys(compileMap).find((id) => {
    const { compatMap } = compileMap[id]
    if ("node" in compatMap === false) {
      return false
    }
    const versionForGroup = compatMap.node
    return versionIsBelowOrEqual(versionForGroup, version)
  })
}

export const createNodePlatform = ({
  cancellation = cancellationNone,
  localRoot,
  remoteRoot,
  compileInto,
  compileMap,
  hotreload,
  hotreloadSSERoot,
  hotreloadCallback,
}) => {
  const compileId = nodeVersionToCompileId(process.version.slice(1), compileMap) || "otherwise"

  const {
    fileToRemoteCompiledFile,
    fileToRemoteInstrumentedFile,
    fileToLocalFile,
    hrefToLocalFile,
  } = createLocaters({
    localRoot,
    remoteRoot,
    compileInto,
    compileId,
  })

  const { markFileAsImported, isFileImported } = createImportTracker()

  const nodeSystem = createNodeSystem({
    urlToFilename: (url) => {
      return hrefToLocalFile(url)
    },
  })

  cancellation.register(valueInstall(https.globalAgent.options, "rejectUnauthorized", false))
  cancellation.register(valueInstall(global, "fetch", fetch))
  cancellation.register(valueInstall(global, "System", nodeSystem))

  if (hotreload) {
    // we can be notified from file we don't care about, reload only if needed
    const hotreloadPredicate = (file) => {
      // isFileImported is useful in case the file was imported but is not
      // in System registry because it has a parse error or insantiate error
      if (isFileImported(file)) {
        return true
      }
      const remoteCompiledFile = fileToRemoteCompiledFile(file)
      if (global.System.get(remoteCompiledFile)) {
        return true
      }
      const remoteInstrumentedFile = fileToRemoteInstrumentedFile(file)
      if (global.System.get(remoteInstrumentedFile)) {
        return true
      }
      return false
    }
    cancellation.register(
      open(hotreloadSSERoot, (fileChanged) => {
        if (hotreloadPredicate(fileChanged)) {
          hotreloadCallback({ file: fileChanged })
        }
      }),
    )
  }

  const parentCancellation = cancellation

  const executeFile = async ({
    cancellation = parentCancellation,
    file,
    instrument = false,
    setup = () => {},
    teardown = () => {},
  }) => {
    await cancellation.toPromise()

    markFileAsImported(file)

    await setup()
    const fileURL = instrument ? fileToRemoteInstrumentedFile(file) : fileToRemoteCompiledFile(file)
    let namespace
    try {
      namespace = await global.System.import(fileURL)
    } catch (error) {
      if (error && error.status === 500 && error.reason === "parse error") {
        const data = JSON.parse(error.body)
        const parseError = new Error()
        Object.assign(parseError, data)
        parseError.message = data.message.replace(file, fileToLocalFile(file))
        throw parseError
      }
      if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
        throw error.error
      }
      throw error
    }
    const value = await teardown(namespace)

    return value
  }

  return { executeFile }
}
