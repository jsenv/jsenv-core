/* eslint-disable import/max-dependencies */
import { urlIsInsideOf } from "@jsenv/util/src/urlIsInsideOf.js"
import { urlToRelativeUrl } from "@jsenv/util/src/urlToRelativeUrl.js"

import { fetchExploringJson } from "../exploring/fetchExploringJson.js"
import { startJavaScriptAnimation } from "../toolbar/util/animation.js"
import "./focus/toolbar.focus.js"
import { renderBackToListInToolbar } from "./backtolist/toolbar.backtolist.js"
import { getToolbarIframe, deactivateToolbarSection, setStyles } from "./util/dom.js"
import { createPreference } from "./util/preferences.js"
import { hideTooltip, hideAllTooltip } from "./tooltip/tooltip.js"
import { renderToolbarSettings, hideSettings } from "./settings/toolbar.settings.js"
import { renderToolbarNotification } from "./notification/toolbar.notification.js"
import { renderToolbarTheme } from "./theme/toolbar.theme.js"
import { renderToolbarAnimation } from "./animation/toolbar.animation.js"
import { renderExecutionInToolbar } from "./execution/toolbar.execution.js"
import { renderCompilationInToolbar } from "./compilation/toolbar.compilation.js"
import { initToolbarEventSource } from "./eventsource/toolbar.eventsource.js"
import { makeToolbarResponsive } from "./responsive/toolbar.responsive.js"

const toolbarVisibilityPreference = createPreference("toolbar")

const renderToolbar = async () => {
  const executedFileCompiledUrl = window.parent.location.href
  const compileServerOrigin = window.parent.location.origin
  // this should not block the whole toolbar rendering + interactivity
  const exploringConfig = await fetchExploringJson()
  const { outDirectoryRelativeUrl, livereloading } = exploringConfig
  const compileGroup = getCompileGroup({
    executedFileCompiledUrl,
    outDirectoryRelativeUrl,
    compileServerOrigin,
  })
  const executedFileRelativeUrl = compileGroup.fileRelativeUrl

  const toolbarOverlay = document.querySelector("#toolbar-overlay")
  toolbarOverlay.onclick = () => {
    hideAllTooltip()
    hideSettings()
  }

  const toolbarElement = document.querySelector("#toolbar")
  exposeOnParentWindow({
    toolbar: {
      element: toolbarElement,
      show: showToolbar,
      hide: () => hideToolbar(),
      toggle: toogleToolbar,
    },
  })

  const toolbarVisible = toolbarVisibilityPreference.has()
    ? toolbarVisibilityPreference.get()
    : true

  if (toolbarVisible) {
    showToolbar({ animate: false })
  } else {
    hideToolbar({ animate: false })
  }

  renderBackToListInToolbar({
    outDirectoryRelativeUrl,
    exploringHtmlFileRelativeUrl: exploringConfig.exploringHtmlFileRelativeUrl,
  })

  renderToolbarNotification()
  makeToolbarResponsive()
  renderToolbarSettings()
  renderToolbarAnimation()
  renderToolbarTheme()
  renderExecutionInToolbar({ executedFileRelativeUrl })
  renderCompilationInToolbar({ compileGroup })
  // this might become active but we need to detect this somehow
  deactivateToolbarSection(document.querySelector("#file-list-link"))
  initToolbarEventSource({ executedFileRelativeUrl, livereloading })

  // if user click enter or space quickly while closing toolbar
  // it will cancel the closing
  // that's why I used toggleToolbar and not hideToolbar
  document.querySelector("#button-close-toolbar").onclick = () => toogleToolbar()
}

const exposeOnParentWindow = (object) => {
  let { __jsenv__ } = window.parent
  if (!__jsenv__) {
    __jsenv__ = {}
    window.parent.__jsenv__ = {}
  }

  Object.assign(__jsenv__, object)
}

const toogleToolbar = () => {
  if (toolbarIsVisible()) {
    hideToolbar()
  } else {
    showToolbar()
  }
}

const toolbarIsVisible = () => document.documentElement.hasAttribute("data-toolbar-visible")

let hideToolbar = () => {
  // toolbar hidden by default, nothing to do to hide it by default
  sendEventToParent("toolbar-visibility-change", false)
}

// (by the way it might be cool to have the toolbar auto show when)
// it has something to say (being disconnected from livereload server)
const showToolbar = ({ animate = true } = {}) => {
  toolbarVisibilityPreference.set(true)
  if (animate) {
    document.documentElement.setAttribute("data-toolbar-animation", "")
  } else {
    document.documentElement.removeAttribute("data-toolbar-animation")
  }
  document.documentElement.setAttribute("data-toolbar-visible", "")

  sendEventToParent("toolbar-visibility-change", true)

  const toolbarIframe = getToolbarIframe()
  const toolbarIframeParent = toolbarIframe.parentNode
  const parentWindow = window.parent
  const parentDocumentElement =
    parentWindow.document.compatMode === "CSS1Compat"
      ? parentWindow.document.documentElement
      : parentWindow.document.body

  const scrollYMax = parentDocumentElement.scrollHeight - parentWindow.innerHeight
  const scrollY = parentDocumentElement.scrollTop
  const scrollYRemaining = scrollYMax - scrollY

  setStyles(toolbarIframeParent, {
    "transition-property": "padding-bottom",
    "transition-duration": "300ms",
  })
  // maybe we should use js animation here because we would not conflict with css
  const restoreToolbarIframeParentStyles = setStyles(toolbarIframeParent, {
    "scroll-padding-bottom": "40px", // same here we should add 40px
    "padding-bottom": "40px", // if there is already one we should add 40px
  })
  const restoreToolbarIframeStyles = setStyles(toolbarIframe, {
    height: "40px",
    visibility: "visible",
  })

  if (scrollYRemaining < 40 && scrollYMax > 0) {
    const scrollEnd = scrollY + 40
    startJavaScriptAnimation({
      duration: 300,
      onProgress: ({ progress }) => {
        const value = scrollY + (scrollEnd - scrollY) * progress
        parentDocumentElement.scrollTop = value
      },
    })
  }

  hideToolbar = () => {
    restoreToolbarIframeParentStyles()
    restoreToolbarIframeStyles()

    hideTooltip(document.querySelector("#eventsource-indicator"))
    hideTooltip(document.querySelector("#execution-indicator"))
    toolbarVisibilityPreference.set(false)
    if (animate) {
      document.documentElement.setAttribute("data-toolbar-animation", "")
    } else {
      document.documentElement.removeAttribute("data-toolbar-animation")
    }
    document.documentElement.removeAttribute("data-toolbar-visible")
    sendEventToParent("toolbar-visibility-change", false)
  }
}

const getCompileGroup = ({
  executedFileCompiledUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
}) => {
  const outDirectoryRemoteUrl = String(new URL(outDirectoryRelativeUrl, compileServerOrigin))
  if (urlIsInsideOf(executedFileCompiledUrl, outDirectoryRemoteUrl)) {
    const afterCompileDirectory = urlToRelativeUrl(executedFileCompiledUrl, outDirectoryRemoteUrl)
    const slashIndex = afterCompileDirectory.indexOf("/")
    const fileRelativeUrl = afterCompileDirectory.slice(slashIndex + 1)
    return {
      fileRelativeUrl,
      outDirectoryRelativeUrl,
      compileId: afterCompileDirectory.slice(0, slashIndex),
    }
  }
  return {
    fileRelativeUrl: new URL(executedFileCompiledUrl).pathname.slice(1),
    outDirectoryRelativeUrl,
    compileId: null,
  }
}

const sendEventToParent = (type, value) => {
  window.parent.postMessage(
    {
      jsenv: true,
      type,
      value,
    },
    "*",
  )
}

window.renderToolbar = renderToolbar
