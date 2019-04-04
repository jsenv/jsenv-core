import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleNode } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/dynamic-import`

;(async () => {
  await bundleNode({
    projectFolder: testFolder,
    into: "dist/node",
    entryPointMap: {
      main: "dynamic-import.js",
    },
    babelConfigMap: {},
    compileGroupCount: 1,
    verbose: false,
  })

  // eslint-disable-next-line import/no-dynamic-require
  const actual = await import.meta.require(`${testFolder}/dist/node/main.js`)
  const expected = 42
  assert({ actual, expected })
})()
