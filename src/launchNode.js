/* eslint-disable import/max-dependencies */
import { Script } from "vm"

import { loggerToLogLevel } from "@jsenv/logger"
import { createCancellationToken } from "@jsenv/cancellation"
import {
  writeDirectory,
  resolveUrl,
  urlToFileSystemPath,
  removeFileSystemNode,
  moveDirectoryContent,
} from "@jsenv/util"

import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { escapeRegexpSpecialCharacters } from "./internal/escapeRegexpSpecialCharacters.js"
import { createControllableNodeProcess } from "./internal/node-launcher/createControllableNodeProcess.js"
import { v8CoverageFromNodeV8Directory } from "./internal/executing/coverage/v8CoverageFromNodeV8Directory.js"

const cuid = require("cuid")

export const launchNode = async ({
  logger,
  logProcessCommand,
  cancellationToken = createCancellationToken(),

  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,

  measurePerformance,
  collectPerformance,
  collectCoverage = false,
  coverageConfig,
  coverageForceIstanbul,

  debugPort,
  debugMode,
  debugModeInheritBreak,
  env,
  inheritProcessEnv,
  commandLineOptions = [],
  stdin,
  stdout,
  stderr,
  stopAfterExecute,
  canUseNativeModuleSystem,

  remap = true,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }
  if (typeof outDirectoryRelativeUrl !== "string") {
    throw new TypeError(`outDirectoryRelativeUrl must be a string, got ${outDirectoryRelativeUrl}`)
  }

  env = {
    ...env,
    COVERAGE_ENABLED: collectCoverage,
    JSENV: true,
  }

  let finalizeExecutionResult

  if (collectCoverage) {
    // v8 coverage is written in a directoy and auto propagate to subprocesses
    // through process.env.NODE_V8_COVERAGE.

    if (coverageForceIstanbul) {
      // if we want to force istanbul, we will set process.env.NODE_V8_COVERAGE = ''
      // into the child_process
      env.NODE_V8_COVERAGE = ""
    }
    // } else if (process.env.NODE_V8_COVERAGE) {
    //   // The V8_COVERAGE was already set by a parent process or command line.
    //   // It's the caller that is interested into coverage, it's not anymore this script
    //   // responsability to set process.env.NODE_V8_COVERAGE nor to read
    //   // coverage files in the v8 directory.
    // }
    // In fact it is so that it's possible to go coverageception:
    // jsenv collect coverage for tests
    // which are testing that coverage can be collected for tests
    // this is possible because we overriding the child process NODE_V8_COVERAGE
    else {
      const NODE_V8_COVERAGE = await getNodeV8CoverageDir({ projectDirectoryUrl })
      env.NODE_V8_COVERAGE = NODE_V8_COVERAGE

      // the v8 coverage directory is available once the child process is disconnected
      finalizeExecutionResult = async (executionResult) => {
        const coverage = await ensureV8CoverageDirClean(async () => {
          // prefer istanbul if available
          if (executionResult.coverage) {
            return executionResult.coverage
          }

          await new Promise((resolve) => {
            controllableNodeProcess.onceChildProcessEvent("exit", resolve)
            // controllableNodeProcess.gracefulStop()
          })
          await new Promise((resolve) => {
            setTimeout(resolve)
          })
          const v8Coverage = await v8CoverageFromNodeV8Directory({
            projectDirectoryUrl,
            NODE_V8_COVERAGE,
            coverageConfig,
          })
          return v8Coverage
        }, NODE_V8_COVERAGE)
        executionResult.coverage = coverage
        return executionResult
      }
    }
  }

  commandLineOptions = ["--experimental-import-meta-resolve", ...commandLineOptions]

  const logLevel = loggerToLogLevel(logger)
  const controllableNodeProcess = await createControllableNodeProcess({
    cancellationToken,
    logLevel,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    env,
    inheritProcessEnv,
    commandLineOptions,
    stdin,
    stdout,
    stderr,
    logProcessCommand,
  })

  const execute = async ({ fileRelativeUrl, executionId }) => {
    const executeParams = {
      projectDirectoryUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,
      jsenvCoreDirectoryUrl,

      fileRelativeUrl,
      executionId,
      canUseNativeModuleSystem,
      exitAfterAction: stopAfterExecute,

      measurePerformance,
      collectPerformance,
      collectCoverage,
      coverageConfig,

      remap,
    }

    let executionResult = await controllableNodeProcess.requestActionOnChildProcess({
      actionType: "execute-using-dynamic-import-fallback-on-systemjs",
      actionParams: executeParams,
    })

    executionResult = transformExecutionResult(executionResult, {
      compileServerOrigin,
      projectDirectoryUrl,
    })

    return executionResult
  }

  return {
    ...controllableNodeProcess,
    options: {
      execArgv: controllableNodeProcess.execArgv,
      // for now do not pass env, it make debug logs to verbose
      // because process.env is very big
      // env,
    },
    execute,
    finalizeExecutionResult,
  }
}

const ensureV8CoverageDirClean = async (fn, NODE_V8_COVERAGE) => {
  try {
    return await fn()
  } finally {
    if (process.env.NODE_V8_COVERAGE === NODE_V8_COVERAGE) {
      // do not try to remove or copy coverage
    } else if (process.env.NODE_V8_COVERAGE) {
      await moveDirectoryContent(NODE_V8_COVERAGE, process.env.NODE_V8_COVERAGE)
      await removeFileSystemNode(NODE_V8_COVERAGE)
    } else {
      await removeFileSystemNode(NODE_V8_COVERAGE, {
        recursive: true,
      })
    }
  }
}

const getNodeV8CoverageDir = async ({ projectDirectoryUrl }) => {
  const v8CoverageDirectory = resolveUrl(`./coverage-v8/${cuid()}`, projectDirectoryUrl)
  await writeDirectory(v8CoverageDirectory, { allowUseless: true })
  return urlToFileSystemPath(v8CoverageDirectory)
}

const transformExecutionResult = (
  executionResult,
  { compileServerOrigin, projectDirectoryUrl },
) => {
  const { status } = executionResult

  if (status === "errored") {
    const { exceptionSource, ...rest } = executionResult
    const error = evalSource(exceptionSource)
    const errorTransformed = transformError(error, { compileServerOrigin, projectDirectoryUrl })
    return {
      status,
      error: errorTransformed,
      ...rest,
    }
  }

  return executionResult
}

const transformError = (error, { compileServerOrigin, projectDirectoryUrl }) => {
  if (!error) {
    return error
  }

  if (!(error instanceof Error)) {
    return error
  }

  const compileServerOriginRegexp = new RegExp(
    escapeRegexpSpecialCharacters(`${compileServerOrigin}/`),
    "g",
  )
  // const serverUrlRegExp = new RegExp(
  //   `(${escapeRegexpSpecialCharacters(`${compileServerOrigin}/`)}[^\\s]+)`,
  //   "g",
  // )
  error.message = error.message.replace(compileServerOriginRegexp, projectDirectoryUrl)
  error.stack = error.stack.replace(compileServerOriginRegexp, projectDirectoryUrl)
  // const projectDirectoryPath = urlToFileSystemPath(projectDirectoryUrl)
  // const projectDirectoryPathRegexp = new RegExp(
  //   `(?<!file:\/\/)${escapeRegexpSpecialCharacters(projectDirectoryPath)}`,
  //   "g",
  // )
  // error.stack = error.stack.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
  // error.message = error.message.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
  return error
}

const evalSource = (code, href) => {
  const script = new Script(code, { filename: href })
  return script.runInThisContext()
}
