import { assert } from "@jsenv/assert"
import {
  urlToBasename,
  resolveDirectoryUrl,
  urlToRelativeUrl,
  readFile,
  resolveUrl,
} from "@jsenv/util"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  getJavaScriptSourceMappingUrl,
  setJavaScriptSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import {
  findNodeByTagName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  minify: true,
})

const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)
const scriptNode = findNodeByTagName(htmlString, "script")

const textNode = getHtmlNodeTextNode(scriptNode)
const text = textNode.value

// ensure text content is correct
{
  const source = setJavaScriptSourceMappingUrl(text, null)
  const actual = source.trim()
  const expected = `const a=12;console.log(a);`
  assert({ actual, expected })
}

// now ensure sourcemap file content looks good
{
  const sourcemappingUrl = getJavaScriptSourceMappingUrl(text)
  const sourcemapUrl = resolveUrl(sourcemappingUrl, htmlBuildUrl)
  const sourcemapString = await readFile(sourcemapUrl)
  const sourcemap = JSON.parse(sourcemapString)
  const htmlUrl = resolveUrl(mainFilename, testDirectoryUrl)
  const htmlString = await readFile(htmlUrl)
  const scriptNode = findNodeByTagName(htmlString, "script")
  const textNode = getHtmlNodeTextNode(scriptNode)
  const sourceContent = textNode.value
  const actual = sourcemap
  const expected = {
    version: 3,
    sources: [`../../${testDirectoryname}.10.js`],
    names: actual.names,
    mappings: actual.mappings,
    sourcesContent: [sourceContent],
    file: actual.file,
  }
  assert({ actual, expected })
}
