import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToBasename,
  resolveUrl,
  readFile,
} from "@jsenv/util"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { parseCssUrls } from "@jsenv/core/src/internal/building/css/parseCssUrls.js"
import {
  GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  BROWSER_IMPORT_BUILD_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_BUILD_ESMODULE.js"
import { browserImportEsModuleBuild } from "@jsenv/core/test/browserImportEsModuleBuild.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = urlToBasename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

const { buildMappings } = await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  // minify: true,
})
const getBuildRelativeUrl = (urlRelativeToTestDirectory) => {
  const relativeUrl = `${testDirectoryRelativeUrl}${urlRelativeToTestDirectory}`
  const buildRelativeUrl = buildMappings[relativeUrl]
  return buildRelativeUrl
}

const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const jsBuildRelativeUrl = getBuildRelativeUrl(`${testDirectoryname}.js`)
const imgRemapBuildRelativeUrl = getBuildRelativeUrl("img-remap.png")
const imgBuildRelativeUrl = getBuildRelativeUrl("img.png")

// check importmap content
{
  const importmapBuildRelativeUrl = getBuildRelativeUrl("import-map.importmap")
  const importmapBuildUrl = resolveUrl(importmapBuildRelativeUrl, buildDirectoryUrl)
  const importmapString = await readFile(importmapBuildUrl)
  const importmap = JSON.parse(importmapString)
  const actual = importmap
  // importmap is the same because non js files are remapped
  const expected = {
    imports: {
      "./img.png": "./img-remap.png",
    },
  }
  assert({ actual, expected })
}

// assert asset url is correct for css (hashed)
{
  const cssBuildRelativeUrl = getBuildRelativeUrl("style.css")
  const cssBuildUrl = resolveUrl(cssBuildRelativeUrl, buildDirectoryUrl)
  const imgBuildUrl = resolveUrl(imgBuildRelativeUrl, buildDirectoryUrl)
  const cssString = await readFile(cssBuildUrl)
  const cssUrls = await parseCssUrls(cssString, cssBuildUrl)
  const actual = cssUrls.urlDeclarations[0].specifier
  const expected = urlToRelativeUrl(imgBuildUrl, cssBuildUrl)
  assert({ actual, expected })
}

// assert asset url is correct for javascript (remapped + hashed)
{
  const { namespace, serverOrigin } = await browserImportEsModuleBuild({
    ...BROWSER_IMPORT_BUILD_TEST_PARAMS,
    testDirectoryRelativeUrl,
    mainRelativeUrl: `./dist/esmodule/${jsBuildRelativeUrl}`,
    // debug: true,
  })
  const actual = {
    urlFromStaticImport: namespace.urlFromStaticImport,
    urlFromDynamicImport: namespace.urlFromDynamicImport,
    urlFromImportMetaNotation: namespace.urlFromImportMetaNotation,
  }
  const expected = {
    urlFromStaticImport: resolveUrl(`dist/esmodule/${imgRemapBuildRelativeUrl}`, serverOrigin),
    urlFromDynamicImport: {
      default: resolveUrl(`dist/esmodule/${imgRemapBuildRelativeUrl}`, serverOrigin),
    },
    urlFromImportMetaNotation: resolveUrl(`dist/esmodule/${imgBuildRelativeUrl}`, serverOrigin),
  }
  assert({ actual, expected })
}
