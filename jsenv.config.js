const { launchNode } = require("@jsenv/core")
const { jsenvBabelPluginMap } = require("./node_modules/@jsenv/babel-plugin-map/index.js")

const projectPath = __dirname
exports.projectPath = projectPath

const testDescription = {
  "/test/**/*.test.js": {
    node: {
      launch: launchNode,
    },
  },
}
exports.testDescription = testDescription

const coverDescription = {
  "/index.js": true,
  "/src/**/*.js": true,
  "/**/*.test.*": false, // contains .test. -> nope
  "/**/test/": false, // inside a test folder -> nope
}
exports.coverDescription = coverDescription

exports.babelPluginMap = jsenvBabelPluginMap
