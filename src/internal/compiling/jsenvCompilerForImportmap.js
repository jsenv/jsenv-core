import { urlToContentType } from "@jsenv/server"
import { transformImportmap } from "./transformImportmap.js"

const compileImportmapFile = ({ originalFileUrl }) => {
  const contentType = urlToContentType(originalFileUrl)

  if (contentType !== "application/importmap+json") {
    return null
  }

  return {
    compile: (importmapBeforeTransformation) => {
      return transformImportmap(importmapBeforeTransformation, {
        originalFileUrl,
      })
    },
  }
}

export const jsenvCompilerForImportmap = {
  "jsenv-compiler-importmap": compileImportmapFile,
}
