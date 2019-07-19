import { babelCompatMap, browserScoreMap, nodeVersionScoreMap } from "@jsenv/grouping"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

export const DEFAULT_COMPILE_INTO_RELATIVE_PATH = "/.dist"

export const DEFAULT_IMPORT_MAP_RELATIVE_PATH = "/importMap.json"

export const DEFAULT_BABEL_PLUGIN_MAP = jsenvBabelPluginMap

export const DEFAULT_BABEL_COMPAT_MAP = babelCompatMap

export const DEFAULT_BROWSER_SCORE_MAP = browserScoreMap

export const DEFAULT_NODE_VERSION_SCORE_MAP = nodeVersionScoreMap
