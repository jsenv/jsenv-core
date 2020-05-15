import { getLivereloadingPreference, createLivereloading } from "../livereloading/livereloading.js"
import { applyLivereloadIndicator } from "./livereload-indicator.js"
import { createPromiseAndHooks } from "../util/util.js"

let livereloadConnection
let livereloadReadyPromise
let livereloadFile

export const connectLivereload = ({ url, replaceState }) => {
  const fileRelativeUrl = new URL(url).pathname.slice(1)
  if (livereloadFile === fileRelativeUrl) {
    return
  }
  livereloadFile = fileRelativeUrl

  // reset livereload indicator ui
  applyLivereloadIndicator()
  livereloadReadyPromise = createPromiseAndHooks()

  let connectedOnce = false
  livereloadConnection = createLivereloading(fileRelativeUrl, {
    onFileChanged: () => {
      replaceState()
    },
    onFileRemoved: () => {
      replaceState()
    },
    onConnecting: ({ abort }) => {
      applyLivereloadIndicator("connecting", { abort })
    },
    onAborted: ({ connect }) => {
      applyLivereloadIndicator("off", { connect })
    },
    onConnectionFailed: ({ reconnect }) => {
      // make ui indicate the failure providing a way to reconnect manually
      applyLivereloadIndicator("disconnected", { reconnect })
    },
    onConnected: ({ disconnect }) => {
      applyLivereloadIndicator("connected", { disconnect })
      if (connectedOnce) {
        // we have lost connection to the server, we might have missed some file changes
        // let's re-execute the file
        replaceState()
      } else {
        connectedOnce = true
        livereloadReadyPromise.resolve()
      }
    },
  })

  if (getLivereloadingPreference()) {
    livereloadConnection.connect()
  } else {
    applyLivereloadIndicator("off", { connect: livereloadConnection.connect })
    connectedOnce = true
    livereloadReadyPromise.resolve()
  }
}

export const disconnectLivereload = () => {
  livereloadFile = undefined
  if (livereloadConnection) {
    livereloadConnection.disconnect()
    livereloadConnection = undefined
  }
}

export const waitLivereloadReady = () => livereloadReadyPromise