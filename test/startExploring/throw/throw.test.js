import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../../index.js"
import { openBrowserPage } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativePath = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryBasename = basename(testDirectoryRelativePath)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativePath}.jsenv/`
const htmlFileUrl = import.meta.resolve("../template.html")
const htmlFileRelativeUrl = urlToRelativeUrl(htmlFileUrl, jsenvCoreDirectoryUrl)
const filename = `${testDirectoryBasename}.main.js`
const fileRelativeUrl = `${testDirectoryRelativePath}${filename}`

const { origin: browserExplorerServerOrigin, compileServerOrigin } = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  htmlFileUrl,
})
const { browser, pageLogs, pageErrors, executionResult } = await openBrowserPage(
  `${browserExplorerServerOrigin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`,
  { headless: false },
)
const actual = { pageLogs, pageErrors, executionResult }
const expected = {
  pageLogs: [{ type: "error", text: "JSHandle@error" }],
  pageErrors: [],
  executionResult: {
    status: "errored",
    error: new Error("error"),
  },
}
assert({ actual, expected })

{
  const actual = executionResult.error.stack
  const expected = `Error: error
  at triggerError (${compileServerOrigin}/test/startExploring/throw/trigger-error.js:2:9)
  at Object.triggerError (${compileServerOrigin}/test/startExploring/throw/throw.main.js:3:1)
  at call (${compileServerOrigin}/test/startExploring/src/internal/platform/s.js:358:34)
  at doExec (${compileServerOrigin}/test/startExploring/src/internal/platform/s.js:354:12)
  at postOrderExec (${compileServerOrigin}/test/startExploring/src/internal/platform/s.js:317:14)`
  assert({ actual, expected })
}

browser.close()