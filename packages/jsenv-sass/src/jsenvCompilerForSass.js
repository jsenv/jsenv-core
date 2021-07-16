import { createRequire } from "module"

import { urlToContentType } from "@jsenv/server"
import { urlToFileSystemPath } from "@jsenv/util"

import { transformResultToCompilationResult } from "@jsenv/core/src/internal/compiling/transformResultToCompilationResult.js"

const require = createRequire(import.meta.url)

const sass = require("sass")

const compileSassFile = ({
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  writeOnFilesystem,
  sourcemapExcludeSources,
}) => {
  const contentType = urlToContentType(originalFileUrl)

  if (contentType !== "text/x-sass" && contentType !== "text/x-scss") {
    return null
  }

  return {
    compile: (originalFileContent) => {
      const result = sass.renderSync({
        file: urlToFileSystemPath(originalFileUrl),
        data: originalFileContent,
        outFile: urlToFileSystemPath(compiledFileUrl),
        sourceMap: true,
        sourceMapContents: true,
      })
      const css = String(result.css)
      const map = JSON.parse(String(result.map))

      const sourcemapFileUrl = `${compiledFileUrl}.map`
      return transformResultToCompilationResult(
        {
          code: css,
          map,
          contentType: "text/css",
        },
        {
          projectDirectoryUrl,
          originalFileContent,
          originalFileUrl,
          compiledFileUrl,
          sourcemapFileUrl,
          sourcemapMethod: writeOnFilesystem ? "comment" : "inline",
          sourcemapExcludeSources,
        },
      )
    },
  }
}

export const jsenvCompilerForSass = {
  "jsenv-compiler-sass": compileSassFile,
}
