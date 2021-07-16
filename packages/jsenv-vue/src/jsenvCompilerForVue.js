import { createRequire } from "module"

import { urlToRelativeUrl, resolveUrl } from "@jsenv/util"

import { transformResultToCompilationResult } from "@jsenv/core/src/internal/compiling/transformResultToCompilationResult.js"
import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
import { compileIdToBabelPluginMap } from "@jsenv/core/src/internal/compiling/jsenvCompilerForJavaScript.js"

const require = createRequire(import.meta.url)

const VueComponentCompiler = require("@vue/component-compiler")

const VueCompiler = VueComponentCompiler.createDefaultCompiler()

const compileVueFile = ({
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
  if (!originalFileUrl.endsWith(".vue")) {
    return null
  }

  return {
    compile: async (originalFileContent) => {
      const vueComponent = VueCompiler.compileToDescriptor(
        originalFileUrl,
        originalFileContent,
        "utf8",
      )
      const assembledComponent = VueComponentCompiler.assemble(
        vueComponent,
        originalFileUrl,
        vueComponent,
      )
      const { code, map } = assembledComponent
      const sourcemapFileUrl = `${compiledFileUrl}.map`
      map.sources = map.sources.map((source) => {
        const sourceUrl = resolveUrl(source, sourcemapFileUrl)
        return urlToRelativeUrl(sourceUrl, sourcemapFileUrl)
      })

      const transformResult = await transformJs({
        projectDirectoryUrl,
        code,
        map,
        url: originalFileUrl,
        urlAfterTransform: compiledFileUrl,
        babelPluginMap: compileIdToBabelPluginMap(compileId, { groupMap, babelPluginMap }),
        convertMap,
        transformTopLevelAwait,
        moduleOutFormat,
        importMetaFormat,
      })

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

export const jsenvCompilerForVue = {
  "jsenv-compiler-vue": compileVueFile,
}
