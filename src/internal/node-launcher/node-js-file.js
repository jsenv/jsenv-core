import { nodeRuntime } from "../../nodeRuntime.js"
import { PerformanceObserver, performance } from "perf_hooks"

export const execute = async ({
  projectDirectoryUrl,
  fileRelativeUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  executionId,
  // do not log in the console
  // because error handling becomes responsability
  // of node code launching node process
  // it avoids seeing error in runtime logs during testing
  errorExposureInConsole = false,
  collectCoverage,
  measurePerformance,
  collectPerformance,
  canUseNativeModuleSystem,
}) => {
  let finalizeExecutionResult = (result) => result

  if (collectPerformance) {
    const measureEntries = []
    // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html
    const perfObserver = new PerformanceObserver(
      (
        // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceobserverentrylist
        list,
      ) => {
        const perfMeasureEntries = list.getEntriesByType("measure")
        measureEntries.push(...perfMeasureEntries)
      },
    )
    perfObserver.observe({
      entryTypes: ["measure"],
    })

    finalizeExecutionResult = async (executionResult) => {
      // wait for node to call the performance observer
      await new Promise((resolve) => {
        setTimeout(resolve)
      })
      performance.clearMarks()
      perfObserver.disconnect()
      return {
        ...executionResult,
        performance: {
          ...readNodePerformance(),
          measures: measuresFromMeasureEntries(measureEntries),
        },
      }
    }
  }

  const { executeFile } = await nodeRuntime.create({
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    canUseNativeModuleSystem,
  })

  const executionResult = await executeFile(fileRelativeUrl, {
    executionId,
    errorExposureInConsole,
    measurePerformance,
    collectCoverage,
  })

  return finalizeExecutionResult({
    ...executionResult,
    indirectCoverage: global.__indirectCoverage__,
  })
}

const readNodePerformance = () => {
  const nodePerformance = {
    nodeTiming: asPlainObject(performance.nodeTiming),
    timeOrigin: performance.timeOrigin,
    eventLoopUtilization: performance.eventLoopUtilization(),
  }
  return nodePerformance
}

// remove getters that cannot be stringified
const asPlainObject = (objectWithGetters) => {
  const objectWithoutGetters = {}
  Object.keys(objectWithGetters).forEach((key) => {
    objectWithoutGetters[key] = objectWithGetters[key]
  })
  return objectWithoutGetters
}

const measuresFromMeasureEntries = (measureEntries) => {
  const measures = {}
  // Sort to ensure measures order is predictable
  // It seems to be already predictable on Node 16+ but
  // it's not the case on Node 14.
  measureEntries.sort((a, b) => {
    return a.startTime - b.startTime
  })
  measureEntries.forEach(
    (
      // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceentry
      perfMeasureEntry,
    ) => {
      measures[perfMeasureEntry.name] = perfMeasureEntry.duration
    },
  )
  return measures
}
