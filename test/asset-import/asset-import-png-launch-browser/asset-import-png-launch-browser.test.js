import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl, resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "@jsenv/core/src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "@jsenv/core/src/internal/executing/launchAndExecute.js"
import { launchBrowsers } from "@jsenv/core/test/launchBrowsers.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "@jsenv/core/test/TEST_PARAMS_LAUNCH_BROWSER.js"
import { launchChromium, launchFirefox, launchWebkit } from "@jsenv/core"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv`
const filename = `${testDirectoryBasename}.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  compileGroupCount: 1, // ensure compileId always otherwise
})
const pngFileUrl = resolveUrl(`${testDirectoryRelativeUrl}jsenv.png`, compileServerOrigin)

await launchBrowsers([launchChromium, launchFirefox, launchWebkit], async (launchBrowser) => {
  const actual = await launchAndExecute({
    ...EXECUTION_TEST_PARAMS,
    fileRelativeUrl,
    // stopAfterExecute: false,
    launch: (options) =>
      launchBrowser({
        ...LAUNCH_TEST_PARAMS,
        ...options,
        outDirectoryRelativeUrl,
        compileServerOrigin,
        // headless: false,
      }),
  })
  const expected = {
    status: "completed",
    namespace: {
      [`./${testDirectoryBasename}.js`]: {
        status: "completed",
        namespace: {
          default: pngFileUrl,
        },
      },
    },
  }
  assert({ actual, expected })
})