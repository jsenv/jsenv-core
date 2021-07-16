import { resolveBrowserGroup } from "../runtime/resolveBrowserGroup.js"
import { computeCompileIdFromGroupId } from "../runtime/computeCompileIdFromGroupId.js"
import { fetchUrl } from "../toolbar/util/fetching.js"
import { createPreference } from "../toolbar/util/preferences.js"
import { startJavaScriptAnimation } from "../toolbar/util/animation.js"
import { fetchExploringJson } from "./fetchExploringJson.js"

const fetchJSON = async (url, options) => {
  const response = await fetchUrl(url, options)
  const json = await response.json()
  return json
}

const groupPreference = createPreference("group")

const run = async () => {
  const { projectDirectoryUrl, explorableConfig, outDirectoryRelativeUrl } =
    await fetchExploringJson()

  const files = await fetchJSON(`/.jsenv/explorables.json`, {
    method: "GET",
  })

  const compileServerOrigin = document.location.origin
  const outDirectoryUrl = String(new URL(outDirectoryRelativeUrl, compileServerOrigin))
  const groupMapUrl = String(new URL("groupMap.json", outDirectoryUrl))
  const groupMap = await fetchJSON(groupMapUrl)
  const compileId = computeCompileIdFromGroupId({
    groupId: resolveBrowserGroup(groupMap),
    groupMap,
  })

  const renderHtml = () => {
    const fileListElement = document.querySelector(`[data-page="file-list"]`).cloneNode(true)
    const directoryName = directoryUrlToDirectoryName(projectDirectoryUrl)
    const span = fileListElement.querySelector("h2 span")
    span.title = projectDirectoryUrl
    span.textContent = directoryName

    const h4 = fileListElement.querySelector("h4")

    const ul = fileListElement.querySelector("ul")
    ul.innerHTML = files
      .map(
        (file) =>
          `<li>
          <a
            class="execution-link"
            data-relative-url=${file.relativeUrl}
            href=${relativeUrlToCompiledUrl(file.relativeUrl)}
          >
            ${file.relativeUrl}
          </a>
        </li>`,
      )
      .join("")

    const groupFieldset = fileListElement.querySelector("#filter-group-set")
    const groupNames = Object.keys(explorableConfig)
    groupFieldset.innerHTML = groupNames
      .map(
        (key) => `<label data-contains-hidden-input class="item">
  <input type="radio" name="filter-group" value="${key}"/>
  <span>${key}</span>
</label>`,
      )
      .join("")

    const currentGroup = groupPreference.has() ? groupPreference.get() : groupNames[0]
    Array.from(groupFieldset.querySelectorAll("input")).forEach((inputRadio) => {
      inputRadio.checked = inputRadio.value === currentGroup
      inputRadio.onchange = () => {
        if (inputRadio.checked) {
          groupPreference.set(inputRadio.value)
          enableGroup(inputRadio.value)
        }
      }
    })

    const enableGroup = (groupName) => {
      const arrayOfElementToShow = []
      const arrayOfElementToHide = []
      files.forEach((file) => {
        const fileLink = fileListElement.querySelector(`a[data-relative-url="${file.relativeUrl}"]`)
        const fileLi = fileLink.parentNode
        if (file.meta[groupName]) {
          arrayOfElementToShow.push(fileLi)
        } else {
          arrayOfElementToHide.push(fileLi)
        }
      })
      arrayOfElementToShow.forEach((element) => {
        element.removeAttribute("data-force-hide")
      })
      arrayOfElementToHide.forEach((element) => {
        element.setAttribute("data-force-hide", "")
      })

      h4.innerHTML =
        arrayOfElementToShow.length === 0
          ? `No file found.
              Config for this section: <pre>${JSON.stringify(
                explorableConfig[groupName],
                null,
                "  ",
              )}</pre>`
          : `${arrayOfElementToShow.length} files found. Click on the one you want to execute`
    }
    enableGroup(currentGroup)

    document.querySelector("main").appendChild(fileListElement)
    makeMenuScrollable()
  }

  const relativeUrlToCompiledUrl = (relativeUrl) => {
    return `${compileServerOrigin}/${outDirectoryRelativeUrl}${compileId}/${relativeUrl}`
  }

  const makeMenuScrollable = () => {
    const getMenuWrapperSize = () => {
      return document.querySelector(".menu-wrapper").getBoundingClientRect().width
    }
    let menuWrapperSize = getMenuWrapperSize()

    const getMenuSize = () => {
      return document.querySelector(".menu").getBoundingClientRect().width
    }
    let menuSize = getMenuSize()

    const menuVisibleSize = menuWrapperSize
    let menuInvisibleSize = menuSize - menuVisibleSize

    const getMenuPosition = () => {
      return document.querySelector(".menu-wrapper").scrollLeft
    }

    const scrollDuration = 300
    const leftPaddle = document.querySelector(".left-paddle")
    const rightPaddle = document.querySelector(".right-paddle")

    const handleMenuScroll = () => {
      menuInvisibleSize = menuSize - menuWrapperSize
      const menuPosition = getMenuPosition()
      const menuEndOffset = menuInvisibleSize

      // show & hide the paddles, depending on scroll position
      if (menuPosition <= 0 && menuEndOffset <= 0) {
        // hide both paddles if the window is large enough to display all tabs
        leftPaddle.classList.add("hidden")
        rightPaddle.classList.add("hidden")
      } else if (menuPosition <= 0) {
        leftPaddle.classList.add("hidden")
        rightPaddle.classList.remove("hidden")
      } else if (menuPosition < Math.floor(menuEndOffset)) {
        // show both paddles in the middle
        leftPaddle.classList.remove("hidden")
        rightPaddle.classList.remove("hidden")
      } else if (menuPosition >= Math.floor(menuEndOffset)) {
        leftPaddle.classList.remove("hidden")
        rightPaddle.classList.add("hidden")
      }
    }
    handleMenuScroll()

    window.onresize = () => {
      menuWrapperSize = getMenuWrapperSize()
      menuSize = getMenuSize()
      handleMenuScroll()
    }

    // finally, what happens when we are actually scrolling the menu
    document.querySelector(".menu-wrapper").onscroll = () => {
      handleMenuScroll()
    }

    // scroll to left
    rightPaddle.onclick = () => {
      const scrollStart = document.querySelector(".menu-wrapper").scrollLeft
      const scrollEnd = scrollStart + menuWrapperSize
      startJavaScriptAnimation({
        duration: scrollDuration,
        onProgress: ({ progress }) => {
          document.querySelector(".menu-wrapper").scrollLeft =
            scrollStart + (scrollEnd - scrollStart) * progress
        },
      })
    }

    // scroll to right
    leftPaddle.onclick = () => {
      const scrollStart = document.querySelector(".menu-wrapper").scrollLeft
      const scrollEnd = scrollStart - menuWrapperSize
      startJavaScriptAnimation({
        duration: scrollDuration,
        onProgress: ({ progress }) => {
          document.querySelector(".menu-wrapper").scrollLeft =
            scrollStart + (scrollEnd - scrollStart) * progress
        },
      })
    }
  }

  const directoryUrlToDirectoryName = (directoryUrl) => {
    const slashLastIndex = directoryUrl.lastIndexOf(
      "/",
      // ignore last slash
      directoryUrl.length - 2,
    )
    if (slashLastIndex === -1) return ""

    return directoryUrl.slice(slashLastIndex + 1)
  }

  renderHtml()
}

run()
