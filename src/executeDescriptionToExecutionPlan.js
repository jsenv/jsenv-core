import { filenameToFileHref } from "@jsenv/module-resolution"
import { patternGroupToMetaMap, forEachRessourceMatching } from "@dmail/project-structure"
import { startCompileServer } from "./server-compile/index.js"

export const executeDescriptionToExecutionPlan = async ({
  cancellationToken,
  rootname,
  compileInto,
  pluginMap,
  executeDescription,
  verbose = false,
}) => {
  const sourceRootHref = filenameToFileHref(rootname)

  const { origin: compiledRootHref } = await startCompileServer({
    cancellationToken,
    rootname,
    compileInto,
    pluginMap,
    verbose,
  })

  const metaMap = patternGroupToMetaMap({
    execute: executeDescription,
  })

  const executionPlan = {}
  await forEachRessourceMatching({
    cancellationToken,
    localRoot: rootname,
    metaMap,
    predicate: ({ execute }) => execute,
    callback: (ressource, meta) => {
      const executionMeta = meta.execute
      const fileExecutionPlan = {}
      Object.keys(executionMeta).forEach((platformName) => {
        const platformExecutionPlan = executionMeta[platformName]
        const { launch, allocatedMs } = platformExecutionPlan
        fileExecutionPlan[platformName] = {
          launch: (options) =>
            launch({
              ...options,
              cancellationToken,
              compileInto,
              sourceRootHref,
              compiledRootHref,
            }),
          allocatedMs,
        }
      })

      executionPlan[ressource] = fileExecutionPlan
    },
  })
  return executionPlan
}
