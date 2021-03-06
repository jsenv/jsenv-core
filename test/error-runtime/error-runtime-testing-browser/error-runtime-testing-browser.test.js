import { assert } from "@jsenv/assert"
import { resolveDirectoryUrl, urlToRelativeUrl } from "@jsenv/util"

import { executeTestPlan, launchChromium } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { EXECUTE_TEST_PLAN_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_TESTING.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}file.spec.html`
const testPlan = {
  [htmlFileRelativeUrl]: {
    chromium: {
      launch: launchChromium,
      launchParams: {
        // headless: false
      },
      captureConsole: true,
      measureDuration: false,
    },
  },
}
const { testPlanSummary, testPlanReport } = await executeTestPlan({
  ...EXECUTE_TEST_PLAN_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  testPlan,
  launchAndExecuteLogLevel: "off",
  // stopAfterExecute: false,
})
const actual = {
  testPlanSummary,
  testPlanReport,
}
const expected = {
  testPlanSummary: {
    executionCount: 1,
    disconnectedCount: 0,
    timedoutCount: 0,
    erroredCount: 1,
    completedCount: 0,
    startMs: testPlanSummary.startMs,
    endMs: testPlanSummary.endMs,
  },
  testPlanReport: {
    [htmlFileRelativeUrl]: {
      chromium: {
        status: "errored",
        error: Object.assign(new Error(`ask() should return 42, got 40`), {
          filename: testPlanReport[htmlFileRelativeUrl].chromium.error.filename,
          lineno: testPlanReport[htmlFileRelativeUrl].chromium.error.lineno,
          columnno: testPlanReport[htmlFileRelativeUrl].chromium.error.columnno,
        }),
        namespace: testPlanReport[htmlFileRelativeUrl].chromium.namespace,
        consoleCalls: testPlanReport[htmlFileRelativeUrl].chromium.consoleCalls,
        runtimeName: "chromium",
        runtimeVersion: assert.any(String),
      },
    },
  },
}
assert({ actual, expected })
