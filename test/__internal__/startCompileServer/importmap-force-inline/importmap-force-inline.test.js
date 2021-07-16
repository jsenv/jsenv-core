import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl, urlToBasename } from "@jsenv/util"
import { fetchUrl } from "@jsenv/server"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import {
  findNodeByTagName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"

import { COMPILE_SERVER_TEST_PARAMS } from "../TEST_PARAMS_COMPILE_SERVER.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const filename = `${testDirectoryname}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
// const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)

const { origin: compileServerOrigin } = await startCompileServer({
  ...COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const fileServerUrl = `${compileServerOrigin}/${fileRelativeUrl}`
const response = await fetchUrl(fileServerUrl, { ignoreHttpsError: true })
const responseBodyAsText = await response.text()
const importmapScriptNode = findNodeByTagName(responseBodyAsText, "script")
const importmapScriptContent = getHtmlNodeTextNode(importmapScriptNode).value
const importmapScriptContentAsJSON = JSON.parse(importmapScriptContent)

const actual = {
  status: response.status,
  statusText: response.statusText,
  contentType: response.headers.get("content-type"),
  importmapScriptContentAsJSON,
}
const expected = {
  status: 200,
  statusText: "OK",
  contentType: "text/html",
  importmapScriptContentAsJSON: {
    imports: {
      "./asset/file.js": "./asset/file-mapped.js",
    },
  },
}
assert({ actual, expected })
