import {
  resolveFileUrl,
  fileUrlToPath,
  pathToFileUrl,
  urlToRelativeUrl,
} from "internal/urlUtils.js"
import { fetchUsingHttp } from "./fetchUsingHttp.js"
import { createRequireFromFilePath } from "./createRequireFromFilePath.js"

export const execute = async ({
  compileServerOrigin,
  projectDirectoryUrl,
  compileDirectoryUrl,
  fileRelativeUrl,
  collectNamespace,
  collectCoverage,
  executionId,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching node process
  // it avoids seeing error in platform logs during testing
  errorExposureInConsole = false,
}) => {
  process.once("unhandledRejection", (valueRejected) => {
    throw valueRejected
  })

  const fileServerUrl = `${compileServerOrigin}/${fileRelativeUrl}`
  const fileUrl = resolveFileUrl(fileRelativeUrl, projectDirectoryUrl)
  const filePath = fileUrlToPath(fileUrl)

  // ça ne fixera pas le fait que require se fera ou mauvais endroit
  // process.chdir(executionFilePath)
  const executionRequire = createRequireFromFilePath(filePath)

  const { SourceMapConsumer } = executionRequire("source-map")
  const { installNodeErrorStackRemapping } = executionRequire("@jsenv/error-stack-sourcemap")

  const compileDirectoryRelativeUrl = urlToRelativeUrl(compileDirectoryUrl, projectDirectoryUrl)
  const nodePlatformCompiledFileRelativeUrl = `${compileDirectoryRelativeUrl}.jsenv/node-platform.js`
  const nodePlatformCompiledServerUrl = `${compileServerOrigin}/${nodePlatformCompiledFileRelativeUrl}`
  const nodePlatformCompiledFileUrl = resolveFileUrl(
    nodePlatformCompiledFileRelativeUrl,
    projectDirectoryUrl,
  )
  const nodePlatformCompiledFilePath = fileUrlToPath(nodePlatformCompiledFileUrl)

  await fetchUsingHttp(nodePlatformCompiledServerUrl)
  // eslint-disable-next-line import/no-dynamic-require
  const { nodePlatform } = require(nodePlatformCompiledFilePath)
  const { relativeUrlToCompiledUrl, executeFile } = nodePlatform.create({
    compileServerOrigin,
    projectDirectoryUrl,
  })

  const fileCompiledServerUrl = relativeUrlToCompiledUrl(fileRelativeUrl)
  const fileCompiledFileUrl = resolveFileUrl(
    fileCompiledServerUrl.slice(compileServerOrigin.length),
    projectDirectoryUrl,
  )

  const { getErrorOriginalStackString } = installNodeErrorStackRemapping({
    resolveHref: ({ type, specifier, importer }) => {
      if (type === "source" || type === "file-original" || type === "source-map") {
        const importerUrl = importer
          ? filePathToServerOrFileUrl(importer, { projectDirectoryUrl, compileServerOrigin })
          : fileServerUrl
        const specifierUrl = resolveFileUrl(specifier, importerUrl)
        if (specifierUrl.startsWith(`${compileServerOrigin}/`)) {
          return `${projectDirectoryUrl}${specifierUrl.slice(`${compileServerOrigin}/`.length)}`
        }
        return specifierUrl
      }

      return resolveFileUrl(specifier, importer || fileCompiledFileUrl)
    },
    SourceMapConsumer,
  })

  return executeFile(fileCompiledServerUrl, {
    collectNamespace,
    collectCoverage,
    executionId,
    errorTransform: async (error) => {
      // code can throw something else than an error
      // in that case return it unchanged
      if (!error || !(error instanceof Error)) return error

      const originalStack = await getErrorOriginalStackString(error)
      error.stack = originalStack
      return error
    },
    errorExposureInConsole,
  })
}

const filePathToServerOrFileUrl = (filePath, { projectDirectoryUrl, compileServerOrigin }) => {
  const fileUrl = filePath.startsWith("file://") ? filePath : pathToFileUrl(filePath)
  if (fileUrl.startsWith(projectDirectoryUrl)) {
    const fileRelativeUrl = urlToRelativeUrl(fileUrl, projectDirectoryUrl)
    return `${compileServerOrigin}/${fileRelativeUrl}`
  }
  return fileUrl
}