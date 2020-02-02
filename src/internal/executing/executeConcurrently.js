/* eslint-disable import/max-dependencies */
import { cpus } from "os"
import { stat } from "fs"
import readline from "readline"
import {
  createConcurrentOperations,
  createCancellationSource,
  composeCancellationToken,
} from "@jsenv/cancellation"
import { loggerToLevels } from "@jsenv/logger"
import { urlToFileSystemPath } from "@jsenv/util"
import { launchAndExecute } from "../executing/launchAndExecute.js"
import { reportToCoverageMap } from "./coverage/reportToCoverageMap.js"
import { createExecutionResultLog } from "./executionLogs.js"
import { createSummaryLog } from "./createSummaryLog.js"

export const executeConcurrently = async (
  executionSteps,
  {
    cancellationToken,
    logger,
    launchLogger,
    executeLogger,

    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    compileServerOrigin,

    babelPluginMap,

    measurePlanExecutionDuration,
    concurrencyLimit = Math.max(cpus.length - 1, 1),
    executionDefaultOptions = {},
    stopPlatformAfterExecute,
    logSummary,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,

    coverage,
    coverageConfig,
    coverageIncludeMissing,
  },
) => {
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }

  const executionOptionsFromDefault = {
    allocatedMs: 30000,
    measureDuration: true,
    // mirrorConsole: false because file will be executed in parallel
    // so log would be a mess to read
    mirrorConsole: false,
    captureConsole: true,
    collectPlatformName: true,
    collectPlatformVersion: true,
    collectNamespace: false,
    collectCoverage: coverage,

    mainFileNotFoundCallback: ({ fileRelativeUrl }) => {
      logger.error(
        new Error(`an execution main file does not exists.
--- file relative path ---
${fileRelativeUrl}`),
      )
    },
    beforeExecutionCallback: () => {},
    afterExecutionCallback: () => {},
    ...executionDefaultOptions,
  }

  let startMs
  if (measurePlanExecutionDuration) {
    startMs = Date.now()
  }

  const allExecutionDoneCancellationSource = createCancellationSource()
  const executionCancellationToken = composeCancellationToken(
    cancellationToken,
    allExecutionDoneCancellationSource.token,
  )

  const report = {}
  const executionCount = executionSteps.length

  let previousExecutionResult
  let previousExecutionLog
  let disconnectedCount = 0
  let timedoutCount = 0
  let erroredCount = 0
  let completedCount = 0

  await createConcurrentOperations({
    cancellationToken,
    concurrencyLimit,
    array: executionSteps,
    start: async (executionOptionsFromStep) => {
      const executionIndex = executionSteps.indexOf(executionOptionsFromStep)
      const executionOptions = {
        ...executionOptionsFromDefault,
        ...executionOptionsFromStep,
      }

      const {
        name,
        executionId,
        fileRelativeUrl,
        launch,
        allocatedMs,
        measureDuration,
        mirrorConsole,
        captureConsole,
        collectPlatformName,
        collectPlatformVersion,
        collectCoverage,
        collectNamespace,

        mainFileNotFoundCallback,
        beforeExecutionCallback,
        afterExecutionCallback,
        gracefulStopAllocatedMs,
      } = executionOptions

      const beforeExecutionInfo = {
        allocatedMs,
        name,
        executionId,
        fileRelativeUrl,
        executionIndex,
      }

      const filePath = urlToFileSystemPath(`${projectDirectoryUrl}${fileRelativeUrl}`)
      const fileExists = await pathLeadsToFile(filePath)
      if (!fileExists) {
        mainFileNotFoundCallback(beforeExecutionInfo)
        return
      }

      beforeExecutionCallback(beforeExecutionInfo)
      const executionResult = await launchAndExecute({
        cancellationToken: executionCancellationToken,
        launchLogger,
        executeLogger,
        launch: (params) =>
          launch({
            projectDirectoryUrl,
            outDirectoryRelativeUrl,
            compileServerOrigin,
            ...params,
          }),
        allocatedMs,
        measureDuration,
        collectPlatformName,
        collectPlatformVersion,
        mirrorConsole,
        captureConsole,
        gracefulStopAllocatedMs,
        stopPlatformAfterExecute,
        stopPlatformAfterExecuteReason:
          executionIndex === executionCount - 1
            ? "last-execution-done"
            : "intermediate-execution-done",
        executionId,
        fileRelativeUrl,
        collectCoverage,
        collectNamespace,
      })
      const afterExecutionInfo = {
        ...beforeExecutionInfo,
        ...executionResult,
      }
      afterExecutionCallback(afterExecutionInfo)

      if (executionResult.status === "timedout") {
        timedoutCount++
      } else if (executionResult.status === "disconnected") {
        disconnectedCount++
      } else if (executionResult.status === "errored") {
        erroredCount++
      } else if (executionResult.status === "completed") {
        completedCount++
      }

      if (
        completedExecutionLogMerging &&
        previousExecutionResult &&
        previousExecutionResult.status === "completed" &&
        executionResult.status === "completed"
      ) {
        if (loggerToLevels(logger).info) {
          readline.moveCursor(process.stdout, 0, -previousExecutionLog.split(/\r\n|\r|\n/).length)
          readline.cursorTo(process.stdout, 0)
        }
      }
      const log = createExecutionResultLog(afterExecutionInfo, {
        completedExecutionLogAbbreviation,
        executionCount,
        disconnectedCount,
        timedoutCount,
        erroredCount,
        completedCount,
      })
      logger.info(log)

      if (fileRelativeUrl in report === false) {
        report[fileRelativeUrl] = {}
      }
      report[fileRelativeUrl][name] = executionResult
      previousExecutionResult = executionResult
      previousExecutionLog = log
    },
  })

  // tell everyone we are done
  // (used to stop potential chrome browser still opened to be reused)
  if (stopPlatformAfterExecute) {
    allExecutionDoneCancellationSource.cancel("all execution done")
  }

  const summary = reportToSummary(report)
  if (measurePlanExecutionDuration) {
    summary.startMs = startMs
    summary.endMs = Date.now()
  }

  if (logSummary) {
    logger.info(createSummaryLog(summary))
  }

  return {
    summary,
    report,
    ...(coverage
      ? {
          coverageMap: await reportToCoverageMap(report, {
            cancellationToken,
            projectDirectoryUrl,
            babelPluginMap,
            coverageConfig,
            coverageIncludeMissing,
          }),
        }
      : {}),
  }
}

const pathLeadsToFile = (path) =>
  new Promise((resolve, reject) => {
    stat(path, (error, stats) => {
      if (error) {
        if (error.code === "ENOENT") {
          resolve(false)
        } else {
          reject(error)
        }
      } else {
        resolve(stats.isFile())
      }
    })
  })

const reportToSummary = (report) => {
  const fileNames = Object.keys(report)
  const executionCount = fileNames.reduce((previous, fileName) => {
    return previous + Object.keys(report[fileName]).length
  }, 0)

  const countResultMatching = (predicate) => {
    return fileNames.reduce((previous, fileName) => {
      const fileExecutionResult = report[fileName]

      return (
        previous +
        Object.keys(fileExecutionResult).filter((executionName) => {
          const fileExecutionResultForPlatform = fileExecutionResult[executionName]
          return predicate(fileExecutionResultForPlatform)
        }).length
      )
    }, 0)
  }

  const disconnectedCount = countResultMatching(({ status }) => status === "disconnected")
  const timedoutCount = countResultMatching(({ status }) => status === "timedout")
  const erroredCount = countResultMatching(({ status }) => status === "errored")
  const completedCount = countResultMatching(({ status }) => status === "completed")

  return {
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount,
  }
}
