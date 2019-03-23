import { assert } from "@dmail/assert"
import { projectFolder } from "../../../../../projectFolder.js"
import { launchNode } from "../../../../launchNode/index.js"
import { launchChromium } from "../../../../launchChromium/index.js"
import { executePlan } from "../../../../executePlan/index.js"
import { startCompileServer } from "../../../../server-compile/index.js"
import { executionPlanResultToCoverageMap } from "../../executionPlanResultToCoverageMap.js"

const testFolder = `${projectFolder}/src/executionPlanResultToCoverageMap/test/import-syntax-error`
const compileInto = ".dist"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelPluginDescription,
    verbose: false,
  })

  const nodeLaunch = (options) =>
    launchNode({ ...options, sourceOrigin, compileServerOrigin, compileInto })

  const chromiumLaunch = (options) =>
    launchChromium({ ...options, sourceOrigin, compileServerOrigin, compileInto })

  const executionPlan = {
    "import-syntax-error.js": {
      node: {
        launch: nodeLaunch,
      },
      chromium: {
        launch: chromiumLaunch,
      },
    },
  }

  const executionPlanResult = await executePlan(executionPlan, {
    cover: true,
  })

  const coverageMap = await executionPlanResultToCoverageMap(executionPlanResult, {
    projectFolder,
    arrayOfFilenameRelativeToCover: [],
  })

  assert({
    actual: coverageMap,
    expected: {
      "syntax-error.js": {
        ...coverageMap["syntax-error.js"],
        s: {},
      },
    },
  })
})()
