import { removeForceHideElement, activateToolbarSection } from "../util/dom.js"
import { createHorizontalBreakpoint } from "../util/responsive.js"
import { toggleTooltip } from "../tooltip/tooltip.js"

const WINDOW_MEDIUM_WIDTH = 570

export const renderExecutionInToolbar = ({ executedFileRelativeUrl }) => {
  // reset file execution indicator ui
  applyExecutionIndicator()
  removeForceHideElement(document.querySelector("#execution-indicator"))

  // apply responsive design on fileInput if needed + add listener on resize screen
  const input = document.querySelector("#file-input")
  const fileWidthBreakpoint = createHorizontalBreakpoint(WINDOW_MEDIUM_WIDTH)
  const handleFileWidthBreakpoint = () => {
    resizeInput(input, fileWidthBreakpoint)
  }
  handleFileWidthBreakpoint()
  fileWidthBreakpoint.changed.listen(handleFileWidthBreakpoint)
  input.value = executedFileRelativeUrl
  resizeInput(input, fileWidthBreakpoint)

  activateToolbarSection(document.querySelector("#file"))
  removeForceHideElement(document.querySelector("#file"))

  window.parent.__jsenv__.executionResultPromise.then(({ status, startTime, endTime }) => {
    applyExecutionIndicator({ status, startTime, endTime })
  })
}

const applyExecutionIndicator = ({ status = "running", startTime, endTime } = {}) => {
  const executionIndicator = document.querySelector("#execution-indicator")
  const variant = executionIndicator.querySelector(`[data-variant="${status}"]`).cloneNode(true)
  const variantContainer = executionIndicator.querySelector("[data-variant-container]")
  variantContainer.innerHTML = ""
  variantContainer.appendChild(variant)

  executionIndicator.querySelector("button").onclick = () => toggleTooltip(executionIndicator)
  executionIndicator.querySelector(".tooltip").textContent = computeText({
    status,
    startTime,
    endTime,
  })
}

const computeText = ({ status, startTime, endTime }) => {
  if (status === "completed") {
    return `Execution completed in ${endTime - startTime}ms`
  }

  if (status === "errored") {
    return `Execution failed in ${endTime - startTime}ms`
  }

  return ""
}

const resizeInput = (input, fileWidthBreakpoint) => {
  const size = fileWidthBreakpoint.isBelow() ? 20 : 40
  if (input.value.length > size) {
    input.style.width = `${size}ch`
  } else {
    input.style.width = `${input.value.length}ch`
  }
}
