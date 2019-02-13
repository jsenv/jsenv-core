import {
  resolveNodeModuleSpecifier,
  filenameToFileHref,
  fileHrefToFilename,
} from "@jsenv/module-resolution"
import { createCancellationToken } from "@dmail/cancellation"
import { requestToFileResponse } from "../requestToFileResponse/index.js"
import {
  startServer,
  requestToAccessControlHeaders,
  serviceCompose,
  responseCompose,
} from "../server/index.js"
import { projectFolder as selfProjectFolder } from "../projectFolder.js"
import { createJsCompileService } from "./createJsCompileService.js"

export const startCompileServer = async ({
  cancellationToken = createCancellationToken(),
  projectFolder,
  compileInto,
  compileGroupCount,
  babelPluginDescription,
  locate,
  localCacheStrategy,
  localCacheTrackHit,
  cacheStrategy,
  instrumentPredicate,
  watch,
  watchPredicate,
  sourceCacheStrategy = "etag",
  sourceCacheIgnore = false,
  preventCors = false,
  protocol,
  ip,
  port,
  signature,
  verbose,
}) => {
  const jsCompileService = await createJsCompileService({
    cancellationToken,
    projectFolder,
    compileInto,
    compileGroupCount,
    babelPluginDescription,
    locate,
    localCacheStrategy,
    localCacheTrackHit,
    cacheStrategy,
    instrumentPredicate,
    watch,
    watchPredicate,
  })

  const service = serviceCompose(jsCompileService, (request) =>
    requestToFileResponse(request, {
      projectFolder,
      locate: locateFileSystem,
      cacheIgnore: sourceCacheIgnore,
      cacheStrategy: sourceCacheStrategy,
    }),
  )

  const requestToResponse = preventCors
    ? service
    : async (request) => {
        const accessControlHeaders = requestToAccessControlHeaders(request)

        if (request.method === "OPTIONS") {
          return {
            status: 200,
            headers: {
              ...accessControlHeaders,
              "content-length": 0,
            },
          }
        }

        const response = await service(request)

        return responseCompose({ headers: accessControlHeaders }, response)
      }

  const compileServer = await startServer({
    cancellationToken,
    protocol,
    ip,
    port,
    signature,
    requestToResponse,
    verbose,
    startedMessage: ({ origin }) => `compile server started for ${projectFolder} at ${origin}`,
    stoppedMessage: (reason) => `compile server stopped because ${reason}`,
  })
  // https://nodejs.org/api/net.html#net_server_unref
  // but while debugging it may close the server too soon, to be tested
  compileServer.nodeServer.unref()

  return compileServer
}

const locateFileSystem = ({ rootHref, requestPathname }) => {
  // future consumer of dev-server will use
  // 'node_modules/dev-server/dist/browserSystemImporter.js'
  // to get file from dev-server module
  // in order to test this behaviour, when we are working on this module
  // 'node_modules/dev-server` is an alias to localRoot
  if (
    rootHref === filenameToFileHref(selfProjectFolder) &&
    requestPathname.startsWith("node_modules/@dmail/dev-server/")
  ) {
    requestPathname = requestPathname.slice("node_modules/@dmail/dev-server/".length)
  }

  if (requestPathname.startsWith("node_modules/")) {
    const moduleSpecifier = requestPathname.slice("node_modules/".length)
    const nodeModuleHref = resolveNodeModuleSpecifier({
      specifier: moduleSpecifier,
      importer: `${rootHref}/${requestPathname}`,
    })
    return fileHrefToFilename(nodeModuleHref)
  }

  return `${rootHref}/${requestPathname}`
}
