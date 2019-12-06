import { urlToFilePath } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { testBabelPluginMap } from "../testBabelPluginMap.js"

export const EXECUTE_TEST_PARAMS = {
  logLevel: "off",
  projectDirectoryPath: urlToFilePath(jsenvCoreDirectoryUrl),
  babelPluginMap: testBabelPluginMap,
  jsenvDirectoryClean: true,
  inheritCoverage: process.env.COVERAGE_ENABLED === "true",
}
