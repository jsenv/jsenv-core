import { createCancellationTokenForProcess } from "@jsenv/cancellation"
import { normalizeStructuredMetaMap, collectFiles, urlToRelativeUrl } from "@jsenv/util"
import { executeJsenvAsyncFunction } from "./internal/executeJsenvAsyncFunction.js"
import { jsenvCoreDirectoryUrl } from "./internal/jsenvCoreDirectoryUrl.js"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "./internal/argUtils.js"
import {
  startCompileServer,
  computeOutDirectoryRelativeUrl,
} from "./internal/compiling/startCompileServer.js"
import { jsenvExplorableConfig } from "./jsenvExplorableConfig.js"
import {
  sourcemapMainFileInfo,
  sourcemapMappingFileInfo,
  jsenvExploringRedirectorHtmlFileInfo,
  jsenvExploringRedirectorJsFileInfo,
  jsenvExploringIndexHtmlFileInfo,
  jsenvExploringIndexJsFileInfo,
  jsenvToolbarJsFileInfo,
} from "./internal/jsenvInternalFiles.js"

export const startExploring = async ({
  cancellationToken = createCancellationTokenForProcess(),
  explorableConfig = jsenvExplorableConfig,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryName,
  jsenvToolbar = true,
  livereloading = true,
  inlineImportMapIntoHTML = true,
  ...rest
}) => {
  return executeJsenvAsyncFunction(async () => {
    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    const outDirectoryRelativeUrl = computeOutDirectoryRelativeUrl({
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      outDirectoryName,
    })

    const redirectFiles = createRedirectFilesService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
    })
    const serveExploringData = createExploringDataService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      explorableConfig,
      livereloading,
    })
    const serveExplorableListAsJson = createExplorableListAsJsonService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      explorableConfig,
    })

    const compileServer = await startCompileServer({
      cancellationToken,
      projectDirectoryUrl,
      keepProcessAlive: true,
      cors: true,
      livereloadSSE: livereloading,
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
      stopOnPackageVersionChange: true,
      watchAndSyncImportMap: true,
      compileGroupCount: 2,
      jsenvToolbarInjection: jsenvToolbar,
      customServices: {
        "service:exploring-redirect": (request) => redirectFiles(request),
        "service:exploring-data": (request) => serveExploringData(request),
        "service:explorables": (request) => serveExplorableListAsJson(request),
      },
      jsenvDirectoryRelativeUrl,
      outDirectoryName,
      inlineImportMapIntoHTML,
      ...rest,
    })

    return compileServer
  })
}

const createRedirectFilesService = ({ projectDirectoryUrl }) => {
  const jsenvExploringRedirectorHtmlRelativeUrlForProject = urlToRelativeUrl(
    jsenvExploringRedirectorHtmlFileInfo.url,
    projectDirectoryUrl,
  )
  const jsenvExploringRedirectorJsBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvExploringRedirectorJsFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )
  const jsenvExploringJsBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvExploringIndexJsFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )
  const jsenvToolbarJsBuildRelativeUrlForProject = urlToRelativeUrl(
    jsenvToolbarJsFileInfo.jsenvBuildUrl,
    projectDirectoryUrl,
  )

  return (request) => {
    // exploring redirection
    if (request.ressource === "/") {
      const jsenvExploringRedirectorHtmlServerUrl = `${request.origin}/${jsenvExploringRedirectorHtmlRelativeUrlForProject}`
      return {
        status: 307,
        headers: {
          location: jsenvExploringRedirectorHtmlServerUrl,
        },
      }
    }
    if (request.ressource === "/.jsenv/exploring.redirector.js") {
      const jsenvExploringRedirectorBuildServerUrl = `${request.origin}/${jsenvExploringRedirectorJsBuildRelativeUrlForProject}`
      return {
        status: 307,
        headers: {
          location: jsenvExploringRedirectorBuildServerUrl,
        },
      }
    }

    // exploring index
    if (request.ressource === "/.jsenv/exploring.index.js") {
      const jsenvExploringJsBuildServerUrl = `${request.origin}/${jsenvExploringJsBuildRelativeUrlForProject}`
      return {
        status: 307,
        headers: {
          location: jsenvExploringJsBuildServerUrl,
        },
      }
    }

    // toolbar
    if (request.ressource === "/.jsenv/toolbar.main.js") {
      const jsenvToolbarJsBuildServerUrl = `${request.origin}/${jsenvToolbarJsBuildRelativeUrlForProject}`
      return {
        status: 307,
        headers: {
          location: jsenvToolbarJsBuildServerUrl,
        },
      }
    }
    // unfortunately browser don't resolve sourcemap to url after redirection
    // but to url before. It means browser tries to load source map from
    // "/.jsenv/jsenv-toolbar.js.map"
    // we could also inline sourcemap but it's not yet possible
    // inside buildProject
    if (request.ressource === `/.jsenv/${jsenvToolbarJsFileInfo.sourcemapFilename}`) {
      const jsenvToolbarJsBuildSourcemapServerUrl = `${request.origin}/${jsenvToolbarJsBuildRelativeUrlForProject}.map`
      return {
        status: 307,
        headers: {
          location: jsenvToolbarJsBuildSourcemapServerUrl,
        },
      }
    }

    return null
  }
}

const createExploringDataService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  explorableConfig,
  livereloading,
}) => {
  return (request) => {
    if (request.ressource === "/.jsenv/exploring.json" && request.method === "GET") {
      const data = {
        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        jsenvDirectoryRelativeUrl: urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl),
        exploringHtmlFileRelativeUrl: urlToRelativeUrl(
          jsenvExploringIndexHtmlFileInfo.url,
          projectDirectoryUrl,
        ),
        sourcemapMainFileRelativeUrl: urlToRelativeUrl(
          sourcemapMainFileInfo.url,
          jsenvCoreDirectoryUrl,
        ),
        sourcemapMappingFileRelativeUrl: urlToRelativeUrl(
          sourcemapMappingFileInfo.url,
          jsenvCoreDirectoryUrl,
        ),
        explorableConfig,
        livereloading,
      }
      const json = JSON.stringify(data)
      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(json),
        },
        body: json,
      }
    }
    return null
  }
}

const createExplorableListAsJsonService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  explorableConfig,
}) => {
  return async (request) => {
    if (request.ressource === "/.jsenv/explorables.json" && request.method === "GET") {
      const structuredMetaMapRelativeForExplorable = {}
      Object.keys(explorableConfig).forEach((explorableGroup) => {
        const explorableGroupConfig = explorableConfig[explorableGroup]
        structuredMetaMapRelativeForExplorable[explorableGroup] = {
          "**/.jsenv/": false, // temporary (in theory) to avoid visting .jsenv directory in jsenv itself
          ...explorableGroupConfig,
          [outDirectoryRelativeUrl]: false,
        }
      })
      const structuredMetaMapForExplorable = normalizeStructuredMetaMap(
        structuredMetaMapRelativeForExplorable,
        projectDirectoryUrl,
      )
      const matchingFileResultArray = await collectFiles({
        directoryUrl: projectDirectoryUrl,
        structuredMetaMap: structuredMetaMapForExplorable,
        predicate: (meta) =>
          Object.keys(meta).some((explorableGroup) => Boolean(meta[explorableGroup])),
      })
      const explorableFiles = matchingFileResultArray.map(({ relativeUrl, meta }) => ({
        relativeUrl,
        meta,
      }))
      const json = JSON.stringify(explorableFiles)
      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(json),
        },
        body: json,
      }
    }
    return null
  }
}
