/**
 * Send a modified version of the html files instead of serving
 * the source html files
 * - force inlining of importmap
 * - inject a script into html head to have window.__jsenv__
 * - <script type="module" src="file.js">
 *   into
 *   <script type="module">
 *      window.__jsenv__.executeFileUsingDynamicImport('file.js')
 *   </script>
 */

import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"
import { moveImportMap } from "@jsenv/import-map"
import { createDetailedMessage } from "@jsenv/logger"

import { stringifyDataUrl } from "@jsenv/core/src/internal/dataUrl.utils.js"
import {
  jsenvToolbarHtmlFileInfo,
  jsenvBrowserSystemFileInfo,
  jsenvToolbarInjectorFileInfo,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import {
  parseHtmlString,
  parseHtmlAstRessources,
  getHtmlNodeAttributeByName,
  replaceHtmlNode,
  stringifyHtmlAst,
  manipulateHtmlAst,
  removeHtmlNodeAttribute,
  getHtmlNodeTextNode,
  setHtmlNodeText,
} from "./compileHtml.js"

export const transformHTMLSourceFile = async ({
  logger,
  projectDirectoryUrl,
  fileUrl,
  fileContent,
  inlineImportMapIntoHTML,
  jsenvScriptInjection,
  jsenvToolbarInjection,
}) => {
  const htmlAst = parseHtmlString(fileContent)
  if (inlineImportMapIntoHTML) {
    await inlineImportmapScripts({
      logger,
      htmlAst,
      fileUrl,
      projectDirectoryUrl,
    })
  }

  const jsenvBrowserBuildUrlRelativeToProject = urlToRelativeUrl(
    jsenvBrowserSystemFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )
  const jsenvToolbarInjectorBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvToolbarInjectorFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )
  manipulateHtmlAst(htmlAst, {
    scriptInjections: [
      ...(jsenvScriptInjection
        ? [
            {
              src: `/${jsenvBrowserBuildUrlRelativeToProject}`,
            },
          ]
        : []),
      ...(jsenvToolbarInjection && fileUrl !== jsenvToolbarHtmlFileInfo.url
        ? [
            {
              src: `/${jsenvToolbarInjectorBuildRelativeUrlForProject}`,
            },
          ]
        : []),
    ],
  })

  if (jsenvScriptInjection) {
    const { scripts } = parseHtmlAstRessources(htmlAst)
    scripts.forEach((script) => {
      const typeAttribute = getHtmlNodeAttributeByName(script, "type")
      const srcAttribute = getHtmlNodeAttributeByName(script, "src")

      // remote
      if (typeAttribute && typeAttribute.value === "module" && srcAttribute) {
        removeHtmlNodeAttribute(script, srcAttribute)
        setHtmlNodeText(
          script,
          `window.__jsenv__.executeFileUsingDynamicImport(${JSON.stringify(srcAttribute.value)})`,
        )
        return
      }
      // inline
      const textNode = getHtmlNodeTextNode(script)
      if (typeAttribute && typeAttribute.value === "module" && textNode) {
        const specifierAsBase64 = stringifyDataUrl({
          mediaType: "application/javascript",
          data: textNode.value,
        })
        setHtmlNodeText(
          script,
          `window.__jsenv__.executeFileUsingDynamicImport(${JSON.stringify(specifierAsBase64)})`,
        )
        return
      }
    })
  }

  return stringifyHtmlAst(htmlAst)
}

const inlineImportmapScripts = async ({ logger, htmlAst, fileUrl }) => {
  const { scripts } = parseHtmlAstRessources(htmlAst)
  const remoteImportmapScripts = scripts.filter((script) => {
    const typeAttribute = getHtmlNodeAttributeByName(script, "type")
    const srcAttribute = getHtmlNodeAttributeByName(script, "src")
    if (typeAttribute && typeAttribute.value === "importmap" && srcAttribute) {
      return true
    }
    return false
  })

  await Promise.all(
    remoteImportmapScripts.map(async (remoteImportmapScript) => {
      const srcAttribute = getHtmlNodeAttributeByName(remoteImportmapScript, "src")
      const importMapUrl = resolveUrl(srcAttribute.value, fileUrl)
      const importMapResponse = await fetchUrl(importMapUrl)
      if (importMapResponse.status !== 200) {
        logger.warn(
          createDetailedMessage(
            importMapResponse.status === 404
              ? `Cannot inline importmap script because file cannot be found.`
              : `Cannot inline importmap script due to unexpected response status (${importMapResponse.status}).`,
            {
              "importmap script src": srcAttribute.value,
              "importmap url": importMapUrl,
              "html url": fileUrl,
            },
          ),
        )

        return
      }

      const importMapContent = await importMapResponse.json()
      const importMapInlined = moveImportMap(importMapContent, importMapUrl, fileUrl)
      replaceHtmlNode(
        remoteImportmapScript,
        `<script type="importmap">${JSON.stringify(importMapInlined, null, "  ")}</script>`,
      )
    }),
  )
}
