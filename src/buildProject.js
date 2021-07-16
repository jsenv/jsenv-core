import { createLogger, createDetailedMessage } from "@jsenv/logger"
import { createCancellationTokenForProcess } from "@jsenv/cancellation"
import { resolveDirectoryUrl } from "@jsenv/util"
import { executeJsenvAsyncFunction } from "./internal/executeJsenvAsyncFunction.js"
import { COMPILE_ID_OTHERWISE } from "./internal/CONSTANTS.js"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "./internal/argUtils.js"
import { startCompileServer } from "./internal/compiling/startCompileServer.js"
import { buildUsingRollup } from "./internal/building/buildUsingRollup.js"
import { jsenvBabelPluginMap } from "./jsenvBabelPluginMap.js"

export const buildProject = async ({
  cancellationToken = createCancellationTokenForProcess(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  logger,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,

  format,

  browser = format === "global" || format === "systemjs" || format === "esmodule",
  node = format === "commonjs",
  entryPointMap,
  systemJsUrl = "/node_modules/systemjs/dist/s.min.js",
  globalName,
  globals = {},

  importResolutionMethod = format === "commonjs" ? "node" : "importmap",
  importMapFileRelativeUrl,
  importDefaultExtension,
  externalImportSpecifiers = [],
  externalImportUrlPatterns = format === "commonjs"
    ? {
        "node_modules/": true,
      }
    : {},

  env = {},

  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap = jsenvBabelPluginMap,

  sourcemapExcludeSources = false,

  buildDirectoryRelativeUrl,
  buildDirectoryClean = false,
  writeOnFileSystem = true,
  assetManifestFile = false,
  assetManifestFileRelativeUrl = "asset-manifest.json",

  urlVersioning = true,
  useImportMapToImproveLongTermCaching = format === "systemjs",
  preserveEntrySignatures,
  jsConcatenation = true,
  minify = process.env.NODE_ENV === "production",
  // https://github.com/kangax/html-minifier#options-quick-reference
  minifyHtmlOptions = { collapseWhitespace: true },
  // https://github.com/terser/terser#minify-options
  minifyJsOptions,
  // https://github.com/cssnano/cssnano/tree/master/packages/cssnano-preset-default
  minifyCssOptions,

  // when true .jsenv/out-build directory is generated
  // with all intermediated files used to produce the final build files.
  // it might improve buildProject speed for subsequent build generation
  // but this is to be proven and not absolutely required
  // When false intermediates files are transformed and served in memory
  // by the compile server
  // must be true by default otherwise rollup cannot find sourcemap files
  // when asking them to the compile server
  // (to fix that sourcemap could be inlined)
  filesystemCache = true,

  serviceWorkers = {},
  serviceWorkerFinalizer,

  ...rest
}) => {
  return executeJsenvAsyncFunction(async () => {
    logger = logger || createLogger({ logLevel })
    if (!["esmodule", "systemjs", "commonjs", "global"].includes(format)) {
      throw new TypeError(
        `unexpected format: ${format}. Must be "esmodule", "systemjs", "commonjs" or "global".`,
      )
    }

    if (!jsConcatenation) {
      throw new Error(
        `jsConcatenation cannot be disabled for now. See https://github.com/rollup/rollup/issues/3882`,
      )
    }

    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    assertEntryPointMap({ entryPointMap })

    if (Object.keys(entryPointMap).length === 0) {
      logger.error(`entryPointMap is an empty object`)
      return {
        rollupBuilds: {},
      }
    }

    assertBuildDirectoryRelativeUrl({ buildDirectoryRelativeUrl })
    const buildDirectoryUrl = resolveDirectoryUrl(buildDirectoryRelativeUrl, projectDirectoryUrl)
    assertBuildDirectoryInsideProject({ buildDirectoryUrl, projectDirectoryUrl })

    const compileServer = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      // build compiled files are written into a different directory
      // than exploring-server. This is because here we compile for rollup
      // that is expecting esmodule format, not systemjs
      // + some more differences like import.meta.dev
      outDirectoryName: "out-build",
      importDefaultExtension,
      moduleOutFormat: "esmodule", // rollup will transform into systemjs
      importMetaFormat: format, // but ensure import.meta are correctly transformed into the right format

      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      env,
      babelPluginMap,

      compileServerCanReadFromFileSystem: filesystemCache,
      compileServerCanWriteOnFilesystem: filesystemCache,
      // keep source html untouched
      // here we don't need to inline importmap
      // nor to inject jsenv script
      transformHtmlSourceFiles: false,

      // override with potential custom options
      ...rest,
    })

    const { outDirectoryRelativeUrl, origin: compileServerOrigin } = compileServer

    try {
      const result = await buildUsingRollup({
        cancellationToken,
        logger,

        entryPointMap,
        projectDirectoryUrl,
        compileServerOrigin,
        compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/`,

        importResolutionMethod,
        importMapFileRelativeUrl,
        importDefaultExtension,
        externalImportSpecifiers,
        externalImportUrlPatterns,

        babelPluginMap,
        node,
        browser,
        writeOnFileSystem,

        format,
        systemJsUrl,
        globalName,
        globals,
        sourcemapExcludeSources,

        buildDirectoryUrl,
        buildDirectoryClean,
        assetManifestFile,
        assetManifestFileRelativeUrl,

        urlVersioning,
        useImportMapToImproveLongTermCaching,
        preserveEntrySignatures,
        jsConcatenation,
        minify,
        minifyHtmlOptions,
        minifyJsOptions,
        minifyCssOptions,

        serviceWorkers,
        serviceWorkerFinalizer,
      })

      return result
    } finally {
      compileServer.stop("build generated")
    }
  })
}

const assertEntryPointMap = ({ entryPointMap }) => {
  if (typeof entryPointMap !== "object") {
    throw new TypeError(`entryPointMap must be an object, got ${entryPointMap}`)
  }
  const keys = Object.keys(entryPointMap)
  keys.forEach((key) => {
    if (!key.startsWith("./")) {
      throw new TypeError(
        `unexpected key in entryPointMap, all keys must start with ./ but found ${key}`,
      )
    }

    const value = entryPointMap[key]
    if (typeof value !== "string") {
      throw new TypeError(
        `unexpected value in entryPointMap, all values must be strings found ${value} for key ${key}`,
      )
    }
    if (!value.startsWith("./")) {
      throw new TypeError(
        `unexpected value in entryPointMap, all values must starts with ./ but found ${value} for key ${key}`,
      )
    }
  })
}

const assertBuildDirectoryRelativeUrl = ({ buildDirectoryRelativeUrl }) => {
  if (typeof buildDirectoryRelativeUrl !== "string") {
    throw new TypeError(
      `buildDirectoryRelativeUrl must be a string, received ${buildDirectoryRelativeUrl}`,
    )
  }
}

const assertBuildDirectoryInsideProject = ({ buildDirectoryUrl, projectDirectoryUrl }) => {
  if (!buildDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(
      createDetailedMessage(`build directory must be inside project directory`, {
        ["build directory url"]: buildDirectoryUrl,
        ["project directory url"]: projectDirectoryUrl,
      }),
    )
  }
}
