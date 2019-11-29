import { basename } from "path"
import { startServer } from "@jsenv/server"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, resolveUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { bundleToCompilationResult } from "internal/bundling/bundleToCompilationResult.js"
import { generateCommonJsBundle } from "../../../index.js"
import { requireCommonJsBundle } from "../requireCommonJsBundle.js"
import {
  GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativePath)
const bundleDirectoryRelativeUrl = `${testDirectoryRelativePath}dist/commonjs/`
const mainFilename = `${testDirectoryname}.js`

const server = await startServer({
  protocol: "http",
  ip: "127.0.0.1",
  port: 9999,
  requestToResponse: () => {
    const body = `export default 42`

    return {
      status: 200,
      headers: {
        "content-type": "application/javascript",
        "content-length": Buffer.byteLength(body),
      },
      body,
    }
  },
  logLevel: "off",
})

const bundle = await generateCommonJsBundle({
  ...GENERATE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
  entryPointMap: {
    main: `./${testDirectoryRelativePath}${mainFilename}`,
  },
})

{
  const actual = bundleToCompilationResult(bundle, {
    projectDirectoryUrl: testDirectoryUrl,
    compiledFileUrl: resolveUrl(`${bundleDirectoryRelativeUrl}main.js`, testDirectoryUrl),
    sourcemapFileUrl: resolveUrl(`${bundleDirectoryRelativeUrl}main.js.map`, testDirectoryUrl),
  })
  const expected = {
    contentType: "application/javascript",
    compiledSource: actual.compiledSource,
    sources: [],
    sourcesContent: [],
    assets: ["../main.js.map"],
    assetsContent: [actual.assetsContent[0]],
  }
  assert({ actual, expected })

  {
    const actual = JSON.parse(actual.assetsContent[0])
    const expected = {
      version: actual.version,
      file: "main.js",
      sources: ["http://127.0.0.1:9999/file.js"],
      sourcesContent: null,
      names: actual.names,
      mappings: actual.mappings,
    }
    assert({ actual, expected })
  }
}

const { namespace: actual } = await requireCommonJsBundle({
  ...REQUIRE_COMMONJS_BUNDLE_TEST_PARAMS,
  bundleDirectoryRelativeUrl,
})
const expected = 42
assert({ actual, expected })

server.stop()
