import { getNotificationPreference, setNotificationPreference } from "./notification.js"
import { createPreference } from "./preferences.js"

const toolbarVisibilityPreference = createPreference("toolbar")

export const renderToolbar = (fileRelativeUrl) => {
  const toolbarVisible = toolbarVisibilityPreference.has()
    ? toolbarVisibilityPreference.get()
    : true

  if (toolbarVisible) {
    showToolbar()
  } else {
    hideToolbar()
  }

  const toolbarElement = document.querySelector("#toolbar")
  window.toolbar = {
    element: toolbarElement,
    show: showToolbar,
    hide: hideToolbar,
  }

  document.querySelector("#button-close-toolbar").onclick = () => {
    // if user click enter or space quickly while closing toolbar
    // it will cancel the closing
    if (isVisible()) {
      hideToolbar()
    } else {
      showToolbar()
    }
  }

  document.querySelector("#button-toggle-settings").onclick = () => toggleSettingsBox()
  const notifCheckbox = document.querySelector("#toggle-notifs")
  notifCheckbox.checked = getNotificationPreference()
  notifCheckbox.onchange = () => {
    setNotificationPreference(notifCheckbox.checked)
  }

  if (fileRelativeUrl) {
    document.querySelector("#button-state-indicator").onclick = () => toggleTooltip("serverState")
    document.querySelector("#button-state-indicator").style.display = ""

    const input = document.querySelector(".fileName")
    input.value = fileRelativeUrl
    resizeInput(input)

    document.querySelector(".fileNameContainer").style.display = "table-cell"
    document.querySelector("#button-execution-indicator").onclick = () =>
      toggleTooltip("fileExecution")
    document.querySelector("#button-execution-indicator").style.display = ""
    document.querySelector(".file-icon-wrapper").classList.remove("iconToolbar-selected")
  } else {
    document.querySelector(".fileNameContainer").style.display = "none"
    document.querySelector("#button-state-indicator").style.display = "none"
    document.querySelector("#button-execution-indicator").style.display = "none"
    document.querySelector(".file-icon-wrapper").classList.add("iconToolbar-selected")
  }
}

const isVisible = () => document.documentElement.hasAttribute("data-toolbar-visible")

export const applyStateIndicator = (state, { connect, abort, disconnect, reconnect }) => {
  const stateIndicator = document.getElementById("stateIndicatorCircle")
  const stateIndicatorRing = document.getElementById("stateIndicatorRing")
  const tooltiptext = document.querySelector(".tooltipTextServerState")
  const retryIcon = document.querySelector(".retryIcon")

  // remove all classes before applying the right ones
  stateIndicatorRing.classList.remove("loadingRing")
  stateIndicator.classList.remove("loadingCircle", "redCircle", "greenCircle")
  retryIcon.classList.remove("retryIconDisplayed")

  if (state === "off") {
    tooltiptext.innerHTML = `Livereloading disabled <a href="javascript:void(0);">connect</a>`
    tooltiptext.querySelector("a").onclick = connect
  } else if (state === "connecting") {
    stateIndicator.classList.add("loadingCircle")
    stateIndicatorRing.classList.add("loadingRing")
    tooltiptext.innerHTML = `Connecting to livereload event source... <a href="javascript:void(0);">cancel</a>`
    tooltiptext.querySelector("a").onclick = abort
  } else if (state === "connected") {
    stateIndicator.classList.add("greenCircle")
    tooltiptext.innerHTML = `Connected to livereload server <a href="javascript:void(0);">disconnect</a>`
    tooltiptext.querySelector("a").onclick = disconnect
  } else if (state === "disconnected") {
    stateIndicator.classList.add("redCircle")
    tooltiptext.innerHTML = `Disconnected from livereload server <a href="javascript:void(0);">reconnect</a>`
    tooltiptext.querySelector("a").onclick = reconnect
  }
}

export const applyFileExecutionIndicator = (state, duration) => {
  const checkIcon = document.getElementById("checkIconSvg")
  const crossIcon = document.getElementById("failIconSvg")
  const loader = document.getElementById("loaderSvg")
  const tooltiptext = document.querySelector(".tooltipTextFileExecution")

  // remove all classes before applying the right ones
  checkIcon.classList.remove("animateCheck")
  crossIcon.classList.remove("animateCross")
  loader.classList.remove("animateLoader")

  if (state === "loading") {
    loader.classList.add("animateLoader")
    tooltiptext.innerHTML = "Executing..."
  } else if (state === "success") {
    checkIcon.classList.add("animateCheck")
    tooltiptext.innerHTML = `Execution completed in ${duration}ms`
  } else if (state === "failure") {
    crossIcon.classList.add("animateCross")
    tooltiptext.innerHTML = `Execution failed in ${duration}ms`
  }
}

export const showToolbar = () => {
  document.querySelector("#toolbarTrigger").classList.remove("toolbarTriggerVisible")
  document.querySelector("#toolbar").removeAttribute("tabIndex")
  document.documentElement.setAttribute("data-toolbar-visible", "")
  toolbarVisibilityPreference.set(true)
}

export const hideToolbar = () => {
  document.querySelector("#toolbar").setAttribute("tabIndex", -1)
  document.querySelector(".serverState").classList.remove("tooltipVisible")
  document.querySelector(".fileExecution").classList.remove("tooltipVisible")
  document.documentElement.removeAttribute("data-toolbar-visible")
  toolbarVisibilityPreference.set(false)

  // toolbarTrigger: display and register onclick
  const toolbarTrigger = document.querySelector("#toolbarTrigger")
  toolbarTrigger.classList.add("toolbarTriggerVisible")
  var timer
  toolbarTrigger.onmouseover = () => {
    timer = setTimeout(() => {
      showJsenvLogo()
    }, 500)
  }
  toolbarTrigger.onmouseout = () => {
    clearTimeout(timer)
  }
}

const showJsenvLogo = () => {
  const toolbarTrigger = document.querySelector("#toolbarTrigger")
  toolbarTrigger.classList.add("toolbarTriggerUp")
  const jsenvLogo = document.querySelector("#jsenvLogo")
  jsenvLogo.classList.add("jsenvLogoVisible")
  // mouse leave to close
  jsenvLogo.onmouseleave = () => {
    console.log("mouseleave")
    hideJsenvLogo()
  }
  // click inside to open toolbar
  jsenvLogo.onclick = (event) => {
    event.stopPropagation()
    showToolbar()
  }
}

const hideJsenvLogo = () => {
  document.querySelector("#toolbarTrigger").classList.remove("toolbarTriggerUp")
  document.querySelector("#jsenvLogo").classList.remove("jsenvLogoVisible")
}

const resizeInput = (input) => {
  if (input.value.length > 40) {
    input.style.width = "40ch"
  } else {
    input.style.width = `${input.value.length}ch`
  }
}

const toggleTooltip = (name) => {
  document.querySelector(`.${name}`).classList.toggle("tooltipVisible")
}

const toggleSettingsBox = () => {
  document.querySelector(".settings-icon-wrapper").classList.toggle("iconToolbar-selected")
  document.querySelector(".settingsBox").classList.toggle("settingsBoxVisible")
}
