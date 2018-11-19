import { firstMatch, userAgentToVersion } from "./util.js"

const userAgentToBrowser = (userAgent) => {
  // opera below 13
  if (/opera/i.test(userAgent)) {
    return {
      name: "opera",
      version:
        userAgentToVersion(userAgent) || firstMatch(/(?:opera)[\s/](\d+(\.?_?\d+)+)/i, userAgent),
    }
  }

  // opera above 13
  if (/opr\/|opios/i.test(userAgent)) {
    return {
      name: "opera",
      version: firstMatch(/(?:opr|opios)[\s/](\S+)/i, userAgent) || userAgentToVersion(userAgent),
    }
  }

  return null
}

export const detect = () => userAgentToBrowser(window.navigator.userAgent)
