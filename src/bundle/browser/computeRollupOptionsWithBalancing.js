import { isNativeBrowserModuleBareSpecifier } from "@jsenv/module-resolution/src/isNativeBrowserModuleBareSpecifier.js"
import { createImportFromGlobalRollupPlugin } from "../import-from-global-rollup-plugin/index.js"
import { createJsenvRollupPlugin } from "../jsenv-rollup-plugin/index.js"
import { createLogger } from "../../logger.js"

export const computeRollupOptionsWithBalancing = ({
  cancellationToken,
  projectFolder,
  importMapFilenameRelative,
  inlineSpecifierMap,
  into,
  entryPointMap,
  babelConfigMap,
  groupMap,
  minify,
  logLevel,
  compileId,
}) => {
  const { logTrace } = createLogger({ logLevel })

  const dir = `${projectFolder}/${into}/${compileId}`

  const importFromGlobalRollupPlugin = createImportFromGlobalRollupPlugin({
    platformGlobalName: "window",
  })

  const jsenvRollupPlugin = createJsenvRollupPlugin({
    cancellationToken,
    projectFolder,
    importMapFilenameRelative,
    inlineSpecifierMap,
    dir,
    featureNameArray: groupMap[compileId].incompatibleNameArray,
    babelConfigMap,
    minify,
    target: "browser",
    logLevel,
  })

  logTrace(`
bundle entry points for browser with balancing.
compileId: ${compileId}
entryPointArray: ${Object.keys(entryPointMap)}
dir: ${dir}
minify: ${minify}
`)

  return {
    rollupParseOptions: {
      input: entryPointMap,
      plugins: [importFromGlobalRollupPlugin, jsenvRollupPlugin],
      external: (id) => isNativeBrowserModuleBareSpecifier(id),
    },
    rollupGenerateOptions: {
      dir,
      format: "system",
      sourcemap: true,
      sourceMapExcludeSources: true,
    },
  }
}
