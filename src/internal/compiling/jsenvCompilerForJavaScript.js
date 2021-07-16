import { urlToContentType } from "@jsenv/server"
import { transformJs } from "./js-compilation-service/transformJs.js"
import { transformResultToCompilationResult } from "./transformResultToCompilationResult.js"

const compileJsFile = ({
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  compileId,
  groupMap,
  babelPluginMap,
  convertMap,
  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,
  writeOnFilesystem,
  sourcemapExcludeSources,
}) => {
  const contentType = urlToContentType(originalFileUrl)

  if (contentType !== "application/javascript" && contentType !== "text/javascript") {
    return null
  }

  return {
    compile: async (originalFileContent) => {
      const transformResult = await transformJs({
        projectDirectoryUrl,
        code: originalFileContent,
        url: originalFileUrl,
        urlAfterTransform: compiledFileUrl,
        babelPluginMap: compileIdToBabelPluginMap(compileId, { groupMap, babelPluginMap }),
        convertMap,
        transformTopLevelAwait,
        moduleOutFormat,
        importMetaFormat,
      })
      const sourcemapFileUrl = `${compiledFileUrl}.map`

      return transformResultToCompilationResult(transformResult, {
        projectDirectoryUrl,
        originalFileContent,
        originalFileUrl,
        compiledFileUrl,
        sourcemapFileUrl,
        sourcemapMethod: writeOnFilesystem ? "comment" : "inline",
        sourcemapExcludeSources,
      })
    },
  }
}

export const jsenvCompilerForJavaScript = {
  "jsenv-compiler-js": compileJsFile,
}

export const compileIdToBabelPluginMap = (compileId, { babelPluginMap, groupMap }) => {
  const babelPluginMapForGroupMap = {}

  const groupBabelPluginMap = {}
  groupMap[compileId].babelPluginRequiredNameArray.forEach((babelPluginRequiredName) => {
    if (babelPluginRequiredName in babelPluginMap) {
      groupBabelPluginMap[babelPluginRequiredName] = babelPluginMap[babelPluginRequiredName]
    }
  })

  return {
    ...groupBabelPluginMap,
    ...babelPluginMapForGroupMap,
  }
}
