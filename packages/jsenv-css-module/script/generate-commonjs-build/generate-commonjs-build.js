import { buildProject, getBabelPluginMapForNode } from "../../../../main.js"
import * as jsenvConfig from "../../../../jsenv.config.js"

buildProject({
  ...jsenvConfig,
  format: "commonjs",
  babelPluginMap: getBabelPluginMapForNode(),
  buildDirectoryRelativeUrl: "packages/jsenv-cssmodule/dist/commonjs",
  entryPointMap: {
    "./packages/jsenv-css-module/main.js": "./main.cjs",
  },
  buildDirectoryClean: true,
})
