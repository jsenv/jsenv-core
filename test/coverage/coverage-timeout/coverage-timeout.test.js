import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { executeTestPlan, launchNode } from "@jsenv/core"
import { EXECUTE_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TEST_PLAN.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.js`
const testPlan = {
  [fileRelativeUrl]: {
    node: {
      launch: (options) =>
        launchNode({
          ...options,
          env: { AWAIT_FOREVER: true },
        }),
      allocatedMs: 8000,
      gracefulStopAllocatedMs: 1000,
    },
  },
}

const { coverageMap: actual } = await executeTestPlan({
  ...EXECUTE_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  coverage: true,
  coverageAndExecutionAllowed: true,
  coverageConfig: {
    [fileRelativeUrl]: true,
  },
})
const expected = {
  [fileRelativeUrl]: {
    ...actual[fileRelativeUrl],
    s: { 0: 0, 1: 0 },
  },
}
assert({ actual, expected })