import {
  resolveDirectoryUrl,
  resolveUrl,
  urlIsInsideOf,
  urlToRelativeUrl,
  urlToBasename,
  urlToFilename,
} from "@jsenv/util"
import { urlToContentType } from "@jsenv/server"

import { jsenvCoreDirectoryUrl } from "../jsenvCoreDirectoryUrl.js"
import {
  COMPILE_ID_BUILD_GLOBAL,
  COMPILE_ID_BUILD_GLOBAL_FILES,
  COMPILE_ID_BUILD_COMMONJS,
  COMPILE_ID_BUILD_COMMONJS_FILES,
  COMPILE_ID_OTHERWISE,
} from "../CONSTANTS.js"
import { buildUsingRollup } from "../building/buildUsingRollup.js"
import { buildToCompilationResult } from "../building/buildToCompilationResult.js"
import { transformResultToCompilationResult } from "./transformResultToCompilationResult.js"
import { transformJs } from "./js-compilation-service/transformJs.js"
import { compileIdToBabelPluginMap } from "./jsenvCompilerForJavaScript.js"

const compileDynamicBuildFile = ({ compileId, originalFileUrl, ...rest }) => {
  const contentType = urlToContentType(originalFileUrl)

  if (contentType !== "application/javascript" && contentType !== "text/javascript") {
    return null
  }

  if (compileId === COMPILE_ID_BUILD_GLOBAL || compileId === COMPILE_ID_BUILD_COMMONJS) {
    return handleDynamicBuild({
      compileId,
      originalFileUrl,
      ...rest,
    })
  }

  if (
    compileId === COMPILE_ID_BUILD_GLOBAL_FILES ||
    compileId === COMPILE_ID_BUILD_COMMONJS_FILES
  ) {
    return handleDynamicBuildFile({
      compileId,
      originalFileUrl,
      ...rest,
    })
  }

  return null
}

export const jsenvCompilerForDynamicBuild = {
  "jsenv-compiler-dynamic-build": compileDynamicBuildFile,
}

const handleDynamicBuild = ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  compileId,
  originalFileUrl,
  compiledFileUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,

  babelPluginMap,
}) => {
  const format = compileId === COMPILE_ID_BUILD_GLOBAL ? "global" : "commonjs"

  // might want to put this to false while working on jsenv
  // to that cache gets verified
  const isJenvInternalFile =
    false && urlIsInsideOf(originalFileUrl, resolveUrl("./src/internal/", jsenvCoreDirectoryUrl))

  return {
    writeOnFilesystem: true,
    useFilesystemAsCache: true,
    compileCacheSourcesValidation: !isJenvInternalFile,
    compileCacheAssetsValidation: !isJenvInternalFile,
    compile: async () => {
      const compileIdForFiles =
        format === "global" ? COMPILE_ID_BUILD_GLOBAL_FILES : COMPILE_ID_BUILD_COMMONJS_FILES

      const originalFileRelativeUrl = urlToRelativeUrl(originalFileUrl, projectDirectoryUrl)
      const buildRelativeUrl =
        format === "commonjs"
          ? `${urlToBasename(originalFileUrl)}.cjs`
          : urlToFilename(originalFileUrl)

      const entryPointMap = {
        [`./${originalFileRelativeUrl}`]: `./${buildRelativeUrl}`,
      }

      const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileIdForFiles}/`

      const build = await buildUsingRollup({
        cancellationToken,
        logger,

        entryPointMap,
        projectDirectoryUrl,
        compileDirectoryRelativeUrl,
        compileServerOrigin,
        externalImportSpecifiers: [],
        babelPluginMap,

        format,
        node: format === "commonjs",
        browser: format !== "commonjs",
        // buildDirectoryUrl is just theorical because of writeOnFileSystem: false
        // but still important to know where the files will be written
        buildDirectoryUrl: resolveDirectoryUrl("./", compiledFileUrl),
        writeOnFileSystem: false,
        sourcemapExcludeSources: true,
        assetManifestFile: false,
      })

      const sourcemapFileUrl = `${compiledFileUrl}.map`

      return buildToCompilationResult(build, {
        mainFileName: buildRelativeUrl,
        projectDirectoryUrl,
        originalFileUrl,
        compiledFileUrl,
        sourcemapFileUrl,
      })
    },
  }
}

const handleDynamicBuildFile = ({
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  compileId,
  groupMap,
  babelPluginMap,
  convertMap,
  transformTopLevelAwait,
  writeOnFilesystem,
  sourcemapExcludeSources,
}) => {
  return {
    compile: async (originalFileContent) => {
      const transformResult = await transformJs({
        projectDirectoryUrl,
        code: originalFileContent,
        url: originalFileUrl,
        urlAfterTransform: compiledFileUrl,
        babelPluginMap: compileIdToBabelPluginMap(getWorstCompileId(groupMap), {
          groupMap,
          babelPluginMap,
        }),
        convertMap,
        transformTopLevelAwait,
        // we are compiling for rollup, do not transform into systemjs format
        moduleOutFormat: "esmodule",
        importMetaFormat:
          // eslint-disable-next-line no-nested-ternary
          compileId === COMPILE_ID_BUILD_GLOBAL_FILES
            ? "global"
            : compileId === COMPILE_ID_BUILD_COMMONJS_FILES
            ? "commonjs"
            : "esmodule",
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

const getWorstCompileId = (groupMap) => {
  if (COMPILE_ID_OTHERWISE in groupMap) {
    return COMPILE_ID_OTHERWISE
  }
  return Object.keys(groupMap)[Object.keys(groupMap).length - 1]
}
