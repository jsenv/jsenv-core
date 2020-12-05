import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl, urlToFileSystemPath } from "@jsenv/util"
import { buildProject } from "@jsenv/core/index.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { require } from "@jsenv/core/src/internal/require.js"
import { GENERATE_ESMODULE_BUILD_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const buildDirectoryRelativeUrl = `${testDirectoryRelativeUrl}dist/esmodule/`
const mainFilename = `${testDirectoryname}.html`
const entryPointMap = {
  [`./${testDirectoryRelativeUrl}${mainFilename}`]: "./main.html",
}

await buildProject({
  ...GENERATE_ESMODULE_BUILD_TEST_PARAMS,
  // logLevel: "info",
  jsenvDirectoryRelativeUrl,
  buildDirectoryRelativeUrl,
  entryPointMap,
  serviceWorkers: {
    [`${testDirectoryRelativeUrl}sw.js`]: "sw.cjs",
  },
  // minify: true,
})

const buildDirectoryUrl = resolveUrl(buildDirectoryRelativeUrl, jsenvCoreDirectoryUrl)
const serviceWorkerBuildUrl = resolveUrl("sw.cjs", buildDirectoryUrl)
global.self = {}
// eslint-disable-next-line import/no-dynamic-require
require(urlToFileSystemPath(serviceWorkerBuildUrl))
const actual = global.self
const expected = {
  // these urls will be put into browser cache
  jsenvBuildUrls: [
    "assets/style-b126d686.css",
    "html-with-service-worker.11-4f59ed7a.js",
    "main.html",
  ],
  // because when html file is modified, it's url is not
  // if you update only the html file, browser won't update the service worker.
  // To ensure worker is still updated, jsenv adds a jsenvStaticUrlsHash
  // to include a hash for the html file.
  // -> when html file changes -> hash changes -> worker updates
  jsenvStaticUrlsHash: {
    "main.html": "c690629a",
  },
}
assert({ actual, expected })