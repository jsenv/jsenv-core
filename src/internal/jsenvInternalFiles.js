import { resolveUrl, fileSystemPathToUrl } from "@jsenv/util"
import { require } from "./require.js"
import { jsenvCoreDirectoryUrl } from "./jsenvCoreDirectoryUrl.js"

export const jsenvNodeSystemFileInfo = {
  jsenvRelativeUrl: "./src/internal/node-launcher/node-js-file.js",
  url: resolveUrl("./src/internal/node-launcher/node-js-file.js", jsenvCoreDirectoryUrl),
}

export const jsenvBrowserSystemFileInfo = {
  jsenvRelativeUrl: "./src/internal/browser-launcher/jsenv-browser-system.js",
  jsenvBuildRelativeUrl: "./jsenv_browser_system.js",
  jsenvBuildUrl: resolveUrl("./dist/jsenv_browser_system.js", jsenvCoreDirectoryUrl),
}

export const jsenvCompileProxyHtmlFileInfo = {
  jsenvRelativeUrl: "./src/internal/browser-launcher/jsenv_compile_proxy.html",
  url: resolveUrl(
    "./src/internal/browser-launcher/jsenv_compile_proxy.html",
    jsenvCoreDirectoryUrl,
  ),
}

export const jsenvCompileProxyFileInfo = {
  jsenvRelativeUrl: "./src/internal/browser-launcher/jsenv_compile_proxy.js",
  jsenvBuildRelativeUrl: "./jsenv_compile_proxy.js",
  jsenvBuildUrl: resolveUrl("./dist/jsenv_compile_proxy.js", jsenvCoreDirectoryUrl),
}

export const sourcemapMainFileInfo = {
  url: fileSystemPathToUrl(require.resolve("source-map/dist/source-map.js")),
}

export const sourcemapMappingFileInfo = {
  url: fileSystemPathToUrl(require.resolve("source-map/lib/mappings.wasm")),
}

// Exploring redirection
// (auto redirection to a compile group depending on browser capabilities)
export const jsenvExploringRedirectorHtmlFileInfo = {
  url: resolveUrl("./src/internal/exploring/exploring.redirector.html", jsenvCoreDirectoryUrl),
}

export const jsenvExploringRedirectorJsFileInfo = {
  jsenvRelativeUrl: "./src/internal/exploring/exploring.redirector.js",
  jsenvBuildRelativeUrl: "./jsenv_exploring_redirector.js",
  url: resolveUrl("./src/internal/exploring/exploring.redirector.js", jsenvCoreDirectoryUrl),
  jsenvBuildUrl: resolveUrl("./dist/jsenv_exploring_redirector.js", jsenvCoreDirectoryUrl),
}

// Exploring index and toolbar
export const jsenvExploringIndexJsFileInfo = {
  jsenvRelativeUrl: "./src/internal/exploring/exploring.js",
  jsenvBuildRelativeUrl: "./jsenv_exploring_index.js",
  jsenvBuildUrl: resolveUrl("./dist/jsenv_exploring_index.js", jsenvCoreDirectoryUrl),
}
export const jsenvExploringIndexHtmlFileInfo = {
  url: resolveUrl("./src/internal/exploring/exploring.html", jsenvCoreDirectoryUrl),
}
export const jsenvToolbarHtmlFileInfo = {
  url: resolveUrl("./src/internal/toolbar/toolbar.html", jsenvCoreDirectoryUrl),
}
export const jsenvToolbarInjectorFileInfo = {
  jsenvRelativeUrl: "./src/internal/toolbar/toolbar.injector.js",
  jsenvBuildRelativeUrl: "./jsenv_toolbar_injector.js",
  jsenvBuildUrl: resolveUrl("./dist/jsenv_toolbar_injector.js", jsenvCoreDirectoryUrl),
}
export const jsenvToolbarJsFileInfo = {
  jsenvRelativeUrl: "./src/internal/toolbar/toolbar.main.js",
  jsenvBuildRelativeUrl: "./jsenv_toolbar.js",
  url: resolveUrl("./src/internal/toolbar/toolbar.main.js", jsenvCoreDirectoryUrl),
  jsenvBuildUrl: resolveUrl("./dist/jsenv_toolbar.js", jsenvCoreDirectoryUrl),
  sourcemapFilename: "jsenv_toolbar.js.map",
}
