import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  resolveUrl,
  readFile,
  urlToBasename,
} from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  findNodeByTagName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import {
  getCssSourceMappingUrl,
  setCssSourceMappingUrl,
} from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { GENERATE_SYSTEMJS_BUILD_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_BUILD_SYSTEMJS.js"
import { buildProject } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryUrl.slice(0, -1))
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/systemjs/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

const { buildMappings } = await buildProject({
  ...GENERATE_SYSTEMJS_BUILD_TEST_PARAMS,
  // logLevel: "debug",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  minify: true,
})

const getBuildRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const buildRelativeUrl = buildMappings[relativeUrl]
  return buildRelativeUrl
}

const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const htmlBuildUrl = resolveUrl("main.html", buildDirectoryUrl)
const htmlString = await readFile(htmlBuildUrl)
const styleNode = findNodeByTagName(htmlString, "style")
const depBuildRelativeUrl = getBuildRelativeUrl("dep.css")
const depBuildUrl = resolveUrl(depBuildRelativeUrl, buildDirectoryUrl)
const textNode = getHtmlNodeTextNode(styleNode)
const text = textNode.value

// ensure style text is correct
{
  const source = setCssSourceMappingUrl(text, null)
  const actual = source.trim()
  const expected = `@import "${depBuildRelativeUrl}";body{padding:10px}`
  assert({ actual, expected })
}

// now ensure sourcemap file content looks good
{
  const sourcemappingUrl = getCssSourceMappingUrl(text)
  const sourcemapUrl = resolveUrl(sourcemappingUrl, htmlBuildUrl)
  const sourcemapString = await readFile(sourcemapUrl)
  const sourcemap = JSON.parse(sourcemapString)
  const htmlUrl = resolveUrl(mainFilename, testDirectoryUrl)
  const htmlString = await readFile(htmlUrl)
  const styleNode = findNodeByTagName(htmlString, "style")
  const textNode = getHtmlNodeTextNode(styleNode)
  const sourceContent = textNode.value
  const actual = sourcemap
  const expected = {
    version: 3,
    sources: [`../../${testDirectoryname}.7.css`],
    names: actual.names,
    mappings: actual.mappings,
    file: actual.file,
    sourcesContent: [sourceContent],
  }
  assert({ actual, expected })
}

// ensure dep file content is correct
const depFileContent = await readFile(depBuildUrl)
{
  const actual = setCssSourceMappingUrl(depFileContent, null).trim()
  const expected = `body{color:red}`
  assert({ actual, expected })
}
// ensure dep souremap is correct too
{
  const sourcemappingUrl = getCssSourceMappingUrl(depFileContent)
  const sourcemapUrl = resolveUrl(sourcemappingUrl, depBuildUrl)
  const sourcemapString = await readFile(sourcemapUrl)
  const sourcemap = JSON.parse(sourcemapString)
  const depUrl = resolveUrl("dep.css", testDirectoryUrl)
  const depSource = await readFile(depUrl)
  const actual = sourcemap
  const expected = {
    version: 3,
    sources: ["../../../dep.css"],
    names: actual.names,
    mappings: actual.mappings,
    file: actual.file,
    sourcesContent: [depSource],
  }
  assert({ actual, expected })
}
