// import { resolveUrl } from "@jsenv/util"
import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  jsenvBrowserSystemFileInfo,
  jsenvCompileProxyFileInfo,
  jsenvExploringRedirectorJsFileInfo,
  jsenvExploringIndexJsFileInfo,
  jsenvToolbarInjectorFileInfo,
  jsenvToolbarJsFileInfo,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"

const commonParams = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  importMapFileRelativeUrl: "./import-map.importmap",
  buildDirectoryRelativeUrl: "dist",
}

const buildsToGenerate = [
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvBrowserSystemFileInfo.jsenvRelativeUrl]:
        jsenvBrowserSystemFileInfo.jsenvBuildRelativeUrl,
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvCompileProxyFileInfo.jsenvRelativeUrl]: jsenvCompileProxyFileInfo.jsenvBuildRelativeUrl,
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvExploringRedirectorJsFileInfo.jsenvRelativeUrl]:
        jsenvExploringRedirectorJsFileInfo.jsenvBuildRelativeUrl,
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvExploringIndexJsFileInfo.jsenvRelativeUrl]:
        jsenvExploringIndexJsFileInfo.jsenvBuildRelativeUrl,
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvToolbarInjectorFileInfo.jsenvRelativeUrl]:
        jsenvToolbarInjectorFileInfo.jsenvBuildRelativeUrl,
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvToolbarJsFileInfo.jsenvRelativeUrl]: jsenvToolbarJsFileInfo.jsenvBuildRelativeUrl,
    },
  },
]

await buildsToGenerate.reduce(async (previous, buildToGenerate) => {
  await previous
  await buildProject(buildToGenerate)
}, Promise.resolve())
