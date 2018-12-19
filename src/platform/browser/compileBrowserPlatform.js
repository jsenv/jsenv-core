import path from "path"
import { rollup } from "rollup"
import babel from "rollup-plugin-babel"
import nodeResolve from "rollup-plugin-node-resolve"
import {
  pluginOptionMapToPluginMap,
  pluginMapToPluginsForPlatform,
  fileWriteFromString,
} from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../localRoot.js"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"

const inputRessource = `src/platform/browser/browserPlatform.js`
const outputFolder = `${localRoot}/dist`
const outputRessource = `browserPlatform.js`
const inputFile = `${localRoot}/${inputRessource}`
const outputFile = `${outputFolder}/${outputRessource}`
const globalName = "__platform__"
const pluginMap = pluginOptionMapToPluginMap({
  "syntax-dynamic-import": {},
  "proposal-json-strings": {},
  "proposal-object-rest-spread": {},
  "proposal-optional-catch-binding": {},
  "proposal-unicode-property-regex": {},
  "transform-arrow-functions": {},
  "transform-block-scoped-functions": {},
  "transform-block-scoping": {},
  "transform-classes": {},
  "transform-computed-properties": {},
  "transform-destructuring": {},
  "transform-dotall-regex": {},
  "transform-duplicate-keys": {},
  "transform-exponentiation-operator": {},
  "transform-for-of": {},
  "transform-function-name": {},
  "transform-literals": {},
  "transform-new-target": {},
  "transform-object-super": {},
  "transform-parameters": {},
  "transform-shorthand-properties": {},
  "transform-spread": {},
  "transform-sticky-regex": {},
  "transform-template-literals": {},
  "transform-typeof-symbol": {},
  "transform-unicode-regex": {},
})
pluginMap["transform-async-to-promises"] = [transformAsyncToPromises, {}]

export const compileBrowserPlatform = async () => {
  const plugins = pluginMapToPluginsForPlatform(pluginMap, "unknown", "0.0.0")

  const bundle = await rollup({
    input: inputFile,
    plugins: [
      nodeResolve({
        module: true,
      }),
      babel({
        babelrc: false,
        exclude: "node_modules/**",
        plugins,
      }),
    ],
    // comment line below to skip rollup warnings
    // onwarn: () => {},
  })

  const { code, map } = await bundle.generate({
    format: "iife",
    // intro: `var compileMap = ${JSON.stringify(compileMap)};`,
    name: globalName,
    sourcemap: true,
  })

  map.sources = map.sources.map((source) => {
    return `${path.relative(outputFolder, localRoot)}/${source}`
  })
  delete map.sourcesContent

  await Promise.all([
    fileWriteFromString(outputFile, appendSourceMappingURL(code, "./browserPlatform.js.map")),
    fileWriteFromString(`${outputFolder}/browserPlatform.js.map`, JSON.stringify(map, null, "  ")),
  ])

  console.log(`${inputFile} -> ${outputFolder}/${inputRessource}`)
}

const appendSourceMappingURL = (code, sourceMappingURL) => {
  return `${code}
//# ${"sourceMappingURL"}=${sourceMappingURL}`
}
