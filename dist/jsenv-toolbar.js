(function () {
  'use strict';

  var urlIsInsideOf = function urlIsInsideOf(urlValue, otherUrlValue) {
    var url = new URL(urlValue);
    var otherUrl = new URL(otherUrlValue);

    if (url.origin !== otherUrl.origin) {
      return false;
    }

    var urlPathname = url.pathname;
    var otherUrlPathname = otherUrl.pathname;

    if (urlPathname === otherUrlPathname) {
      return false;
    }

    return urlPathname.startsWith(otherUrlPathname);
  };

  var getCommonPathname = function getCommonPathname(pathname, otherPathname) {
    var firstDifferentCharacterIndex = findFirstDifferentCharacterIndex(pathname, otherPathname); // pathname and otherpathname are exactly the same

    if (firstDifferentCharacterIndex === -1) {
      return pathname;
    }

    var commonString = pathname.slice(0, firstDifferentCharacterIndex + 1); // the first different char is at firstDifferentCharacterIndex

    if (pathname.charAt(firstDifferentCharacterIndex) === "/") {
      return commonString;
    }

    if (otherPathname.charAt(firstDifferentCharacterIndex) === "/") {
      return commonString;
    }

    var firstDifferentSlashIndex = commonString.lastIndexOf("/");
    return pathname.slice(0, firstDifferentSlashIndex + 1);
  };

  var findFirstDifferentCharacterIndex = function findFirstDifferentCharacterIndex(string, otherString) {
    var maxCommonLength = Math.min(string.length, otherString.length);
    var i = 0;

    while (i < maxCommonLength) {
      var char = string.charAt(i);
      var otherChar = otherString.charAt(i);

      if (char !== otherChar) {
        return i;
      }

      i++;
    }

    if (string.length === otherString.length) {
      return -1;
    } // they differ at maxCommonLength


    return maxCommonLength;
  };

  var pathnameToParentPathname = function pathnameToParentPathname(pathname) {
    var slashLastIndex = pathname.lastIndexOf("/");

    if (slashLastIndex === -1) {
      return "/";
    }

    return pathname.slice(0, slashLastIndex + 1);
  };

  var urlToRelativeUrl = function urlToRelativeUrl(urlArg, baseUrlArg) {
    var url = new URL(urlArg);
    var baseUrl = new URL(baseUrlArg);

    if (url.protocol !== baseUrl.protocol) {
      return urlArg;
    }

    if (url.username !== baseUrl.username || url.password !== baseUrl.password) {
      return urlArg.slice(url.protocol.length);
    }

    if (url.host !== baseUrl.host) {
      return urlArg.slice(url.protocol.length);
    }

    var pathname = url.pathname,
        hash = url.hash,
        search = url.search;

    if (pathname === "/") {
      return baseUrl.pathname.slice(1);
    }

    var basePathname = baseUrl.pathname;
    var commonPathname = getCommonPathname(pathname, basePathname);

    if (!commonPathname) {
      return urlArg;
    }

    var specificPathname = pathname.slice(commonPathname.length);
    var baseSpecificPathname = basePathname.slice(commonPathname.length);

    if (baseSpecificPathname.includes("/")) {
      var baseSpecificParentPathname = pathnameToParentPathname(baseSpecificPathname);
      var relativeDirectoriesNotation = baseSpecificParentPathname.replace(/.*?\//g, "../");
      return "".concat(relativeDirectoriesNotation).concat(specificPathname).concat(search).concat(hash);
    }

    return "".concat(specificPathname).concat(search).concat(hash);
  };

  var _defineProperty = (function (obj, key, value) {
    // Shortcircuit the slow defineProperty path when possible.
    // We are trying to avoid issues where setters defined on the
    // prototype cause side effects under the fast path of simple
    // assignment. By checking for existence of the property with
    // the in operator, we can optimize most of this overhead away.
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  });

  var createDetailedMessage = function createDetailedMessage(message) {
    var details = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var string = "".concat(message);
    Object.keys(details).forEach(function (key) {
      var value = details[key];
      string += "\n--- ".concat(key, " ---\n").concat(Array.isArray(value) ? value.join("\n") : value);
    });
    return string;
  };

  var objectWithoutPropertiesLoose = (function (source, excluded) {
    if (source === null) return {};
    var target = {};
    var sourceKeys = Object.keys(source);
    var key;
    var i;

    for (i = 0; i < sourceKeys.length; i++) {
      key = sourceKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      target[key] = source[key];
    }

    return target;
  });

  var _objectWithoutProperties = (function (source, excluded) {
    if (source === null) return {};
    var target = objectWithoutPropertiesLoose(source, excluded);
    var key;
    var i;

    if (Object.getOwnPropertySymbols) {
      var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

      for (i = 0; i < sourceSymbolKeys.length; i++) {
        key = sourceSymbolKeys[i];
        if (excluded.indexOf(key) >= 0) continue;
        if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
        target[key] = source[key];
      }
    }

    return target;
  });

  var createCancellationToken = function createCancellationToken() {
    var register = function register(callback) {
      if (typeof callback !== "function") {
        throw new Error("callback must be a function, got ".concat(callback));
      }

      return {
        callback: callback,
        unregister: function unregister() {}
      };
    };

    var throwIfRequested = function throwIfRequested() {
      return undefined;
    };

    return {
      register: register,
      cancellationRequested: false,
      throwIfRequested: throwIfRequested
    };
  };

  var nativeTypeOf = function nativeTypeOf(obj) {
    return typeof obj;
  };

  var customTypeOf = function customTypeOf(obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

  var isCancelError = function isCancelError(value) {
    return value && _typeof(value) === "object" && value.name === "CANCEL_ERROR";
  };

  /* eslint-disable no-eq-null, eqeqeq */
  function arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    var arr2 = new Array(len);

    for (var i = 0; i < len; i++) {
      arr2[i] = arr[i];
    }

    return arr2;
  }

  /* eslint-disable consistent-return */
  function unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
  }

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);

      if (enumerableOnly) {
        symbols = symbols.filter(function (sym) {
          return Object.getOwnPropertyDescriptor(object, sym).enumerable;
        });
      }

      keys.push.apply(keys, symbols);
    }

    return keys;
  }

  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};

      if (i % 2) {
        ownKeys(Object(source), true).forEach(function (key) {
          _defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }

    return target;
  }

  // fallback to this polyfill (or even use an existing polyfill would be better)
  // https://github.com/github/fetch/blob/master/fetch.js

  function _await$3(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _async$4(f) {
    return function () {
      for (var args = [], i = 0; i < arguments.length; i++) {
        args[i] = arguments[i];
      }

      try {
        return Promise.resolve(f.apply(this, args));
      } catch (e) {
        return Promise.reject(e);
      }
    };
  }

  function _call$2(body, then, direct) {
    if (direct) {
      return then ? then(body()) : body();
    }

    try {
      var result = Promise.resolve(body());
      return then ? result.then(then) : result;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  var fetchUsingXHR = _async$4(function (url) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$cancellationToke = _ref.cancellationToken,
        cancellationToken = _ref$cancellationToke === void 0 ? createCancellationToken() : _ref$cancellationToke,
        _ref$method = _ref.method,
        method = _ref$method === void 0 ? "GET" : _ref$method,
        _ref$credentials = _ref.credentials,
        credentials = _ref$credentials === void 0 ? "same-origin" : _ref$credentials,
        _ref$headers = _ref.headers,
        headers = _ref$headers === void 0 ? {} : _ref$headers,
        _ref$body = _ref.body,
        body = _ref$body === void 0 ? null : _ref$body;

    var headersPromise = createPromiseAndHooks$1();
    var bodyPromise = createPromiseAndHooks$1();
    var xhr = new XMLHttpRequest();

    var failure = function failure(error) {
      // if it was already resolved, we must reject the body promise
      if (headersPromise.settled) {
        bodyPromise.reject(error);
      } else {
        headersPromise.reject(error);
      }
    };

    var cleanup = function cleanup() {
      xhr.ontimeout = null;
      xhr.onerror = null;
      xhr.onload = null;
      xhr.onreadystatechange = null;
    };

    xhr.ontimeout = function () {
      cleanup();
      failure(new Error("xhr request timeout on ".concat(url, ".")));
    };

    xhr.onerror = function (error) {
      cleanup(); // unfortunately with have no clue why it fails
      // might be cors for instance

      failure(createRequestError(error, {
        url: url
      }));
    };

    xhr.onload = function () {
      cleanup();
      bodyPromise.resolve();
    };

    cancellationToken.register(function (cancelError) {
      xhr.abort();
      failure(cancelError);
    });

    xhr.onreadystatechange = function () {
      // https://developer.mozilla.org/fr/docs/Web/API/XMLHttpRequest/readyState
      var readyState = xhr.readyState;

      if (readyState === 2) {
        headersPromise.resolve();
      } else if (readyState === 4) {
        cleanup();
        bodyPromise.resolve();
      }
    };

    xhr.open(method, url, true);
    Object.keys(headers).forEach(function (key) {
      xhr.setRequestHeader(key, headers[key]);
    });
    xhr.withCredentials = computeWithCredentials({
      credentials: credentials,
      url: url
    });

    if ("responseType" in xhr && hasBlob) {
      xhr.responseType = "blob";
    }

    xhr.send(body);
    return _await$3(headersPromise, function () {
      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseURL
      var responseUrl = "responseURL" in xhr ? xhr.responseURL : headers["x-request-url"];
      var responseStatus = xhr.status;
      var responseStatusText = xhr.statusText;
      var responseHeaders = getHeadersFromXHR(xhr);

      var readBody = function readBody() {
        return _await$3(bodyPromise, function () {
          var status = xhr.status; // in Chrome on file:/// URLs, status is 0

          if (status === 0) {
            responseStatus = 200;
          }

          var body = "response" in xhr ? xhr.response : xhr.responseText;
          return {
            responseBody: body,
            responseBodyType: detectBodyType(body)
          };
        });
      };

      var text = function text() {
        return _call$2(readBody, function (_ref2) {
          var responseBody = _ref2.responseBody,
              responseBodyType = _ref2.responseBodyType;

          if (responseBodyType === "blob") {
            return blobToText(responseBody);
          }

          if (responseBodyType === "formData") {
            throw new Error("could not read FormData body as text");
          }

          return responseBodyType === "dataView" ? arrayBufferToText(responseBody.buffer) : responseBodyType === "arrayBuffer" ? arrayBufferToText(responseBody) : String(responseBody);
        });
      };

      var json = function json() {
        return _call$2(text, JSON.parse);
      };

      var blob = _async$4(function () {
        if (!hasBlob) {
          throw new Error("blob not supported");
        }

        return _call$2(readBody, function (_ref3) {
          var responseBody = _ref3.responseBody,
              responseBodyType = _ref3.responseBodyType;

          if (responseBodyType === "blob") {
            return responseBody;
          }

          if (responseBodyType === "dataView") {
            return new Blob([cloneBuffer(responseBody.buffer)]);
          }

          if (responseBodyType === "arrayBuffer") {
            return new Blob([cloneBuffer(responseBody)]);
          }

          if (responseBodyType === "formData") {
            throw new Error("could not read FormData body as blob");
          }

          return new Blob([String(responseBody)]);
        });
      });

      var arrayBuffer = function arrayBuffer() {
        return _call$2(readBody, function (_ref4) {
          var responseBody = _ref4.responseBody,
              responseBodyType = _ref4.responseBodyType;
          return responseBodyType === "arrayBuffer" ? cloneBuffer(responseBody) : _call$2(blob, blobToArrayBuffer);
        });
      };

      var formData = _async$4(function () {
        if (!hasFormData) {
          throw new Error("formData not supported");
        }

        return _call$2(text, textToFormData);
      });

      return {
        url: responseUrl,
        status: responseStatus,
        statusText: responseStatusText,
        headers: responseHeaders,
        text: text,
        json: json,
        blob: blob,
        arrayBuffer: arrayBuffer,
        formData: formData
      };
    });
  });

  var canUseBlob = function canUseBlob() {
    if (typeof window.FileReader !== "function") return false;
    if (typeof window.Blob !== "function") return false;

    try {
      // eslint-disable-next-line no-new
      new Blob();
      return true;
    } catch (e) {
      return false;
    }
  };

  var hasBlob = canUseBlob();
  var hasFormData = typeof window.FormData === "function";
  var hasArrayBuffer = typeof window.ArrayBuffer === "function";
  var hasSearchParams = typeof window.URLSearchParams === "function";

  var createRequestError = function createRequestError(error, _ref5) {
    var url = _ref5.url;
    return new Error(createDetailedMessage("error during xhr request on ".concat(url, "."), _defineProperty({}, "error stack", error.stack)));
  };

  var createPromiseAndHooks$1 = function createPromiseAndHooks() {
    var resolve;
    var reject;
    var promise = new Promise(function (res, rej) {
      resolve = function resolve(value) {
        promise.settled = true;
        res(value);
      };

      reject = function reject(value) {
        promise.settled = true;
        rej(value);
      };
    });
    promise.resolve = resolve;
    promise.reject = reject;
    return promise;
  }; // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch


  var computeWithCredentials = function computeWithCredentials(_ref6) {
    var credentials = _ref6.credentials,
        url = _ref6.url;

    if (credentials === "same-origin") {
      return originSameAsGlobalOrigin(url);
    }

    return credentials === "include";
  };

  var originSameAsGlobalOrigin = function originSameAsGlobalOrigin(url) {
    // if we cannot read globalOrigin from window.location.origin, let's consider it's ok
    if ((typeof window === "undefined" ? "undefined" : _typeof(window)) !== "object") return true;
    if (_typeof(window.location) !== "object") return true;
    var globalOrigin = window.location.origin;
    if (globalOrigin === "null") return true;
    return hrefToOrigin(url) === globalOrigin;
  };

  var detectBodyType = function detectBodyType(body) {
    if (!body) {
      return "";
    }

    if (typeof body === "string") {
      return "text";
    }

    if (hasBlob && Blob.prototype.isPrototypeOf(body)) {
      return "blob";
    }

    if (hasFormData && FormData.prototype.isPrototypeOf(body)) {
      return "formData";
    }

    if (hasArrayBuffer) {
      if (hasBlob && isDataView(body)) {
        return "dataView";
      }

      if (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body)) {
        return "arrayBuffer";
      }
    }

    if (hasSearchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
      return "searchParams";
    }

    return "";
  }; // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/getAllResponseHeaders#Example


  var getHeadersFromXHR = function getHeadersFromXHR(xhr) {
    var headerMap = {};
    var headersString = xhr.getAllResponseHeaders();
    if (headersString === "") return headerMap;
    var lines = headersString.trim().split(/[\r\n]+/);
    lines.forEach(function (line) {
      var parts = line.split(": ");
      var name = parts.shift();
      var value = parts.join(": ");
      headerMap[name.toLowerCase()] = value;
    });
    return headerMap;
  };

  var hrefToOrigin = function hrefToOrigin(href) {
    var scheme = hrefToScheme(href);

    if (scheme === "file") {
      return "file://";
    }

    if (scheme === "http" || scheme === "https") {
      var secondProtocolSlashIndex = scheme.length + "://".length;
      var pathnameSlashIndex = href.indexOf("/", secondProtocolSlashIndex);
      if (pathnameSlashIndex === -1) return href;
      return href.slice(0, pathnameSlashIndex);
    }

    return href.slice(0, scheme.length + 1);
  };

  var hrefToScheme = function hrefToScheme(href) {
    var colonIndex = href.indexOf(":");
    if (colonIndex === -1) return "";
    return href.slice(0, colonIndex);
  };

  var isDataView = function isDataView(obj) {
    return obj && DataView.prototype.isPrototypeOf(obj);
  };

  var isArrayBufferView = ArrayBuffer.isView || function () {
    var viewClasses = ["[object Int8Array]", "[object Uint8Array]", "[object Uint8ClampedArray]", "[object Int16Array]", "[object Uint16Array]", "[object Int32Array]", "[object Uint32Array]", "[object Float32Array]", "[object Float64Array]"];
    return function (value) {
      return value && viewClasses.includes(Object.prototype.toString.call(value));
    };
  }();

  var textToFormData = function textToFormData(text) {
    var form = new FormData();
    text.trim().split("&").forEach(function (bytes) {
      if (bytes) {
        var split = bytes.split("=");
        var name = split.shift().replace(/\+/g, " ");
        var value = split.join("=").replace(/\+/g, " ");
        form.append(decodeURIComponent(name), decodeURIComponent(value));
      }
    });
    return form;
  };

  var blobToArrayBuffer = _async$4(function (blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsArrayBuffer(blob);
    return promise;
  });

  var blobToText = function blobToText(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsText(blob);
    return promise;
  };

  var arrayBufferToText = function arrayBufferToText(arrayBuffer) {
    var view = new Uint8Array(arrayBuffer);
    var chars = new Array(view.length);
    var i = 0;

    while (i < view.length) {
      chars[i] = String.fromCharCode(view[i]);
      i++;
    }

    return chars.join("");
  };

  var fileReaderReady = function fileReaderReady(reader) {
    return new Promise(function (resolve, reject) {
      reader.onload = function () {
        resolve(reader.result);
      };

      reader.onerror = function () {
        reject(reader.error);
      };
    });
  };

  var cloneBuffer = function cloneBuffer(buffer) {
    if (buffer.slice) {
      return buffer.slice(0);
    }

    var view = new Uint8Array(buffer.byteLength);
    view.set(new Uint8Array(buffer));
    return view.buffer;
  };

  function _await$2(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  var fetchNative = _async$3(function (url) {

    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var _ref$cancellationToke = _ref.cancellationToken,
        cancellationToken = _ref$cancellationToke === void 0 ? createCancellationToken() : _ref$cancellationToke,
        _ref$mode = _ref.mode,
        mode = _ref$mode === void 0 ? "cors" : _ref$mode,
        options = _objectWithoutProperties(_ref, ["cancellationToken", "mode"]);

    var abortController = new AbortController();
    var cancelError;
    cancellationToken.register(function (reason) {
      cancelError = reason;
      abortController.abort(reason);
    });
    var response;
    return _continue(_catch$1(function () {
      return _await$2(window.fetch(url, _objectSpread2({
        signal: abortController.signal,
        mode: mode
      }, options)), function (_window$fetch) {
        response = _window$fetch;
      });
    }, function (e) {
      if (cancelError && e.name === "AbortError") {
        throw cancelError;
      }

      throw e;
    }), function (_result) {
      return {
        url: response.url,
        status: response.status,
        statusText: "",
        headers: responseToHeaders(response),
        text: function text() {
          return response.text();
        },
        json: function json() {
          return response.json();
        },
        blob: function blob() {
          return response.blob();
        },
        arrayBuffer: function arrayBuffer() {
          return response.arrayBuffer();
        },
        formData: function formData() {
          return response.formData();
        }
      };
    });
  });

  function _catch$1(body, recover) {
    try {
      var result = body();
    } catch (e) {
      return recover(e);
    }

    if (result && result.then) {
      return result.then(void 0, recover);
    }

    return result;
  }

  var responseToHeaders = function responseToHeaders(response) {
    var headers = {};
    response.headers.forEach(function (value, name) {
      headers[name] = value;
    });
    return headers;
  };

  function _continue(value, then) {
    return value && value.then ? value.then(then) : then(value);
  }

  function _async$3(f) {
    return function () {
      for (var args = [], i = 0; i < arguments.length; i++) {
        args[i] = arguments[i];
      }

      try {
        return Promise.resolve(f.apply(this, args));
      } catch (e) {
        return Promise.reject(e);
      }
    };
  }

  var fetchUrl = typeof window.fetch === "function" && typeof window.AbortController === "function" ? fetchNative : fetchUsingXHR;

  function _await$1(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _catch(body, recover) {
    try {
      var result = body();
    } catch (e) {
      return recover(e);
    }

    if (result && result.then) {
      return result.then(void 0, recover);
    }

    return result;
  }

  function _async$2(f) {
    return function () {
      for (var args = [], i = 0; i < arguments.length; i++) {
        args[i] = arguments[i];
      }

      try {
        return Promise.resolve(f.apply(this, args));
      } catch (e) {
        return Promise.reject(e);
      }
    };
  }

  var fetchExploringJson = _async$2(function () {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        cancellationToken = _ref.cancellationToken;

    return _catch(function () {
      return _await$1(fetchUrl("/.jsenv/exploring.json", {
        headers: {
          "x-jsenv": "1"
        },
        cancellationToken: cancellationToken
      }), function (exploringJsonResponse) {
        return _await$1(exploringJsonResponse.json());
      });
    }, function (e) {
      if (isCancelError(e)) {
        throw e;
      }

      throw new Error(createDetailedMessage("Cannot communicate with exploring server due to a network error", _defineProperty({}, "error stack", e.stack)));
    });
  });

  // handle data-last-interaction attr on html (focusring)
  window.addEventListener("mousedown", function (mousedownEvent) {
    if (mousedownEvent.defaultPrevented) {
      return;
    }

    document.documentElement.setAttribute("data-last-interaction", "mouse");
  });
  window.addEventListener("touchstart", function (touchstartEvent) {
    if (touchstartEvent.defaultPrevented) {
      return;
    }

    document.documentElement.setAttribute("data-last-interaction", "mouse");
  });
  window.addEventListener("keydown", function (keydownEvent) {
    if (keydownEvent.defaultPrevented) {
      return;
    }

    document.documentElement.setAttribute("data-last-interaction", "keyboard");
  });

  var renderBackToListInToolbar = function renderBackToListInToolbar(_ref) {
    var outDirectoryRelativeUrl = _ref.outDirectoryRelativeUrl,
        exploringHtmlFileRelativeUrl = _ref.exploringHtmlFileRelativeUrl;
    var exploringHtmlFileUrl = "/".concat(outDirectoryRelativeUrl, "otherwise/").concat(exploringHtmlFileRelativeUrl);
    document.querySelector("#file-list-link a").href = exploringHtmlFileUrl;

    document.querySelector("#file-list-link a").onclick = function (clickEvent) {
      if (clickEvent.defaultPrevented) {
        return;
      }

      if (isClickToOpenTab(clickEvent)) {
        return;
      }

      window.parent.location.href = exploringHtmlFileUrl;
    };
  };

  var isClickToOpenTab = function isClickToOpenTab(clickEvent) {
    if (clickEvent.button !== 0) {
      // Chrome < 55 fires a click event when the middle mouse button is pressed
      return true;
    }

    if (clickEvent.metaKey) {
      return true;
    }

    if (clickEvent.ctrlKey) {
      return true;
    }

    return false;
  };

  var updateIframeOverflowOnParentWindow = function updateIframeOverflowOnParentWindow() {
    var aTooltipIsOpened = document.querySelector("[data-tooltip-visible]") || document.querySelector("[data-tooltip-auto-visible]");
    var settingsAreOpened = document.querySelector("#settings[data-active]");

    if (aTooltipIsOpened || settingsAreOpened) {
      enableIframeOverflowOnParentWindow();
    } else {
      disableIframeOverflowOnParentWindow();
    }
  };
  var iframeOverflowEnabled = false;

  var enableIframeOverflowOnParentWindow = function enableIframeOverflowOnParentWindow() {
    if (iframeOverflowEnabled) return;
    iframeOverflowEnabled = true;
    var iframe = getToolbarIframe();
    var transitionDuration = iframe.style.transitionDuration;
    setStyles(iframe, {
      "height": "100%",
      "transition-duration": "0ms"
    });

    if (transitionDuration) {
      setTimeout(function () {
        setStyles(iframe, {
          "transition-duration": transitionDuration
        });
      });
    }
  };

  var disableIframeOverflowOnParentWindow = function disableIframeOverflowOnParentWindow() {
    if (!iframeOverflowEnabled) return;
    iframeOverflowEnabled = false;
    var iframe = getToolbarIframe();
    var transitionDuration = iframe.style.transitionDuration;
    setStyles(iframe, {
      "height": "40px",
      "transition-duration": "0ms"
    });

    if (transitionDuration) {
      setTimeout(function () {
        setStyles(iframe, {
          "transition-duration": transitionDuration
        });
      });
    }
  };

  var getToolbarIframe = function getToolbarIframe() {
    var iframes = Array.from(window.parent.document.querySelectorAll("iframe"));
    return iframes.find(function (iframe) {
      return iframe.contentWindow === window;
    });
  };
  var forceHideElement = function forceHideElement(element) {
    element.setAttribute("data-force-hide", "");
  };
  var removeForceHideElement = function removeForceHideElement(element) {
    element.removeAttribute("data-force-hide");
  };
  var setStyles = function setStyles(element, styles) {
    var elementStyle = element.style;
    var restoreStyles = Object.keys(styles).map(function (styleName) {
      var restore;

      if (styleName in elementStyle) {
        var currentStyle = elementStyle[styleName];

        restore = function restore() {
          elementStyle[styleName] = currentStyle;
        };
      } else {
        restore = function restore() {
          delete elementStyle[styleName];
        };
      }

      elementStyle[styleName] = styles[styleName];
      return restore;
    });
    return function () {
      restoreStyles.forEach(function (restore) {
        return restore();
      });
    };
  };
  var toolbarSectionIsActive = function toolbarSectionIsActive(element) {
    return element.hasAttribute("data-active");
  };
  var activateToolbarSection = function activateToolbarSection(element) {
    element.setAttribute("data-active", "");
  };
  var deactivateToolbarSection = function deactivateToolbarSection(element) {
    element.removeAttribute("data-active");
  };

  var startJavaScriptAnimation = function startJavaScriptAnimation(_ref6) {
    var _ref6$duration = _ref6.duration,
        duration = _ref6$duration === void 0 ? 300 : _ref6$duration,
        _ref6$timingFunction = _ref6.timingFunction,
        timingFunction = _ref6$timingFunction === void 0 ? function (t) {
      return t;
    } : _ref6$timingFunction,
        _ref6$onProgress = _ref6.onProgress,
        onProgress = _ref6$onProgress === void 0 ? function () {} : _ref6$onProgress,
        _ref6$onCancel = _ref6.onCancel,
        onCancel = _ref6$onCancel === void 0 ? function () {} : _ref6$onCancel,
        _ref6$onComplete = _ref6.onComplete,
        onComplete = _ref6$onComplete === void 0 ? function () {} : _ref6$onComplete;

    if (isNaN(duration)) {
      // console.warn(`duration must be a number, received ${duration}`)
      return function () {};
    }

    duration = parseInt(duration, 10);
    var startMs = performance.now();
    var currentRequestAnimationFrameId;
    var done = false;
    var rawProgress = 0;
    var progress = 0;

    var handler = function handler() {
      currentRequestAnimationFrameId = null;
      var nowMs = performance.now();
      rawProgress = Math.min((nowMs - startMs) / duration, 1);
      progress = timingFunction(rawProgress);
      done = rawProgress === 1;
      onProgress({
        done: done,
        rawProgress: rawProgress,
        progress: progress
      });

      if (done) {
        onComplete();
      } else {
        currentRequestAnimationFrameId = window.requestAnimationFrame(handler);
      }
    };

    handler();

    var stop = function stop() {
      if (currentRequestAnimationFrameId) {
        window.cancelAnimationFrame(currentRequestAnimationFrameId);
        currentRequestAnimationFrameId = null;
      }

      if (!done) {
        done = true;
        onCancel({
          rawProgress: rawProgress,
          progress: progress
        });
      }
    };

    return stop;
  };

  var createPreference = function createPreference(name) {
    return {
      has: function has() {
        return localStorage.hasOwnProperty(name);
      },
      get: function get() {
        return localStorage.hasOwnProperty(name) ? JSON.parse(localStorage.getItem(name)) : undefined;
      },
      set: function set(value) {
        return localStorage.setItem(name, JSON.stringify(value));
      }
    };
  };

  var toggleTooltip = function toggleTooltip(element) {
    if (element.hasAttribute("data-tooltip-visible")) {
      hideTooltip(element);
    } else {
      showTooltip(element);
    }
  };
  var hideTooltip = function hideTooltip(element) {
    element.removeAttribute("data-tooltip-visible");
    element.removeAttribute("data-tooltip-auto-visible");
    updateIframeOverflowOnParentWindow();
  };
  var showTooltip = function showTooltip(element) {
    element.setAttribute("data-tooltip-visible", "");
    updateIframeOverflowOnParentWindow();
  };
  var autoShowTooltip = function autoShowTooltip(element) {
    element.setAttribute("data-tooltip-auto-visible", "");
    updateIframeOverflowOnParentWindow();
  };
  var removeAutoShowTooltip = function removeAutoShowTooltip(element) {
    element.removeAttribute("data-tooltip-auto-visible");
    updateIframeOverflowOnParentWindow();
  };
  var hideAllTooltip = function hideAllTooltip() {
    var elementsWithTooltip = Array.from(document.querySelectorAll("[data-tooltip-visible]"));
    elementsWithTooltip.forEach(function (elementWithTooltip) {
      hideTooltip(elementWithTooltip);
    });
  };

  var renderToolbarSettings = function renderToolbarSettings() {
    document.querySelector("#settings-button").onclick = toggleSettings;
    document.querySelector("#button-close-settings").onclick = toggleSettings;
  };

  var toggleSettings = function toggleSettings() {
    if (settingsAreVisible()) {
      hideSettings();
    } else {
      showSettings();
    }
  };

  var settingsAreVisible = function settingsAreVisible() {
    return toolbarSectionIsActive(document.querySelector("#settings"));
  };
  var hideSettings = function hideSettings() {
    deactivateToolbarSection(document.querySelector("#settings"));
    updateIframeOverflowOnParentWindow();
  };
  var showSettings = function showSettings() {
    activateToolbarSection(document.querySelector("#settings"));
    updateIframeOverflowOnParentWindow();
  };

  function _call$1(body, then, direct) {
    if (direct) {
      return then ? then(body()) : body();
    }

    try {
      var result = Promise.resolve(body());
      return then ? result.then(then) : result;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  var notificationPreference = createPreference("notification");

  function _await(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  var arrayOfOpenedNotifications = [];

  function _async$1(f) {
    return function () {
      for (var args = [], i = 0; i < arguments.length; i++) {
        args[i] = arguments[i];
      }

      try {
        return Promise.resolve(f.apply(this, args));
      } catch (e) {
        return Promise.reject(e);
      }
    };
  }

  var renderToolbarNotification = function renderToolbarNotification() {
    var notifCheckbox = document.querySelector("#toggle-notifs");
    notifCheckbox.checked = getNotificationPreference();

    notifCheckbox.onchange = function () {
      setNotificationPreference(notifCheckbox.checked);

      if (notifCheckbox.checked) {
        // request permission early
        // especially useful on firefox where you can request permission
        // only inside a user generated event such as this onchange handler
        requestPermission();
      } else {
        // slice because arrayOfOpenedNotifications can be mutated while looping
        arrayOfOpenedNotifications.slice().forEach(function (notification) {
          notification.close();
        });
      }
    };
  };
  var notifyExecutionResult = function notifyExecutionResult(executedFileRelativeUrl, execution, previousExecution) {
    var notificationEnabled = getNotificationPreference();
    if (!notificationEnabled) return;
    var notificationOptions = {
      lang: "en",
      icon: getFaviconHref(),
      clickToFocus: true,
      clickToClose: true
    };

    if (execution.status === "errored") {
      if (previousExecution) {
        if (previousExecution.status === "completed") {
          notify("Broken", _objectSpread2(_objectSpread2({}, notificationOptions), {}, {
            body: "".concat(executedFileRelativeUrl, " execution now failing.")
          }));
        } else {
          notify("Still failing", _objectSpread2(_objectSpread2({}, notificationOptions), {}, {
            body: "".concat(executedFileRelativeUrl, " execution still failing.")
          }));
        }
      } else {
        notify("Failing", _objectSpread2(_objectSpread2({}, notificationOptions), {}, {
          body: "".concat(executedFileRelativeUrl, " execution failed.")
        }));
      }
    } else if (previousExecution && previousExecution.status === "errored") {
      notify("Fixed", _objectSpread2(_objectSpread2({}, notificationOptions), {}, {
        body: "".concat(executedFileRelativeUrl, " execution fixed.")
      }));
    }
  };
  var notificationAvailable = typeof window.Notification === "function";

  var getNotificationPreference = function getNotificationPreference() {
    return notificationPreference.has() ? notificationPreference.get() : true;
  };

  var setNotificationPreference = function setNotificationPreference(value) {
    return notificationPreference.set(value);
  };

  var getFaviconHref = function getFaviconHref() {
    var link = document.querySelector('link[rel="icon"]');
    return link ? link.href : undefined;
  };

  var notify = notificationAvailable ? function (title) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var _ref$clickToFocus = _ref.clickToFocus,
        clickToFocus = _ref$clickToFocus === void 0 ? false : _ref$clickToFocus,
        _ref$clickToClose = _ref.clickToClose,
        clickToClose = _ref$clickToClose === void 0 ? false : _ref$clickToClose,
        options = _objectWithoutProperties(_ref, ["clickToFocus", "clickToClose"]);

    return _call$1(requestPermission, function (permission) {
      if (permission === "granted") {
        var notification = new Notification(title, options);
        arrayOfOpenedNotifications.push(notification);

        notification.onclick = function () {
          // but if the user navigated inbetween
          // focusing window will show something else
          // in that case it could be great to do something
          // maybe like showing a message saying this execution
          // is no longer visible
          // we could also navigauate to this file execution but
          // there is no guarantee re-executing the file would give same output
          // and it would also trigger an other notification
          if (clickToFocus) window.focus();
          if (clickToClose) notification.close();
        };

        notification.onclose = function () {
          var index = arrayOfOpenedNotifications.indexOf(notification);

          if (index > -1) {
            arrayOfOpenedNotifications.splice(index, 1);
          }
        };

        return notification;
      }

      return null;
    });
  } : function () {};
  var permissionPromise;
  var requestPermission = notificationAvailable ? _async$1(function () {
    if (permissionPromise) return permissionPromise;
    permissionPromise = Notification.requestPermission();
    return _await(permissionPromise, function (permission) {
      permissionPromise = undefined;
      return permission;
    });
  }) : function () {
    return Promise.resolve("denied");
  };

  var DARK_THEME = "dark";
  var LIGHT_THEME = "light";
  var themePreference = createPreference("theme");
  var renderToolbarTheme = function renderToolbarTheme() {
    var theme = getThemePreference();
    var checkbox = document.querySelector("#checkbox-dark-theme");
    checkbox.checked = theme === DARK_THEME;
    setTheme(theme);

    checkbox.onchange = function () {
      if (checkbox.checked) {
        setThemePreference(DARK_THEME);
        setTheme(DARK_THEME);
      } else {
        setThemePreference(LIGHT_THEME);
        setTheme(LIGHT_THEME);
      }
    };
  };

  var getThemePreference = function getThemePreference() {
    return themePreference.has() ? themePreference.get() : DARK_THEME;
  };

  var setThemePreference = function setThemePreference(value) {
    themePreference.set(value);
    setTheme(value);
  };

  var setTheme = function setTheme(theme) {
    document.querySelector("html").setAttribute("data-theme", theme);
  };

  var animationPreference = createPreference("animation");
  var renderToolbarAnimation = function renderToolbarAnimation() {
    var animCheckbox = document.querySelector("#toggle-anims");
    animCheckbox.checked = getAnimationPreference();

    animCheckbox.onchange = function () {
      setAnimationPreference(animCheckbox.checked);
      onPreferenceChange(animCheckbox.checked);
    };

    onPreferenceChange(); // enable toolbar transition only after first render

    setTimeout(function () {
      document.querySelector("#toolbar").setAttribute("data-animate", "");
    });
  };

  var onPreferenceChange = function onPreferenceChange() {
    var value = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : getAnimationPreference();

    if (value) {
      enableAnimation();
    } else {
      disableAnimation();
    }
  };

  var getAnimationPreference = function getAnimationPreference() {
    return animationPreference.has() ? animationPreference.get() : true;
  };

  var setAnimationPreference = function setAnimationPreference(value) {
    return animationPreference.set(value);
  };

  var enableAnimation = function enableAnimation() {
    document.documentElement.removeAttribute("data-animation-disabled");
  };

  var disableAnimation = function disableAnimation() {
    document.documentElement.setAttribute("data-animation-disabled", "");
  };

  // eslint-disable-next-line consistent-return
  var arrayWithHoles = (function (arr) {
    if (Array.isArray(arr)) return arr;
  });

  function _iterableToArrayLimit(arr, i) {
    // this is an expanded form of \`for...of\` that properly supports abrupt completions of
    // iterators etc. variable names have been minimised to reduce the size of this massive
    // helper. sometimes spec compliance is annoying :(
    //
    // _n = _iteratorNormalCompletion
    // _d = _didIteratorError
    // _e = _iteratorError
    // _i = _iterator
    // _s = _step
    var _i = arr && (typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]);

    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;

    var _s, _e;

    try {
      for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  var nonIterableRest = (function () {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  });

  var _slicedToArray = (function (arr, i) {
    return arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || unsupportedIterableToArray(arr, i) || nonIterableRest();
  });

  var enableVariant = function enableVariant(rootNode, variables) {
    var nodesWithAttribute = Array.from(rootNode.querySelectorAll("[".concat(attributeName, "]")));
    var nodesWithActiveAttribute = Array.from(rootNode.querySelectorAll("[".concat(attributeNameWhenActive, "]")));
    Object.keys(variables).forEach(function (key) {
      var variableValue = variables[key];
      nodesWithAttribute = nodesWithAttribute.filter(function (node) {
        var _node$getAttribute$sp = node.getAttribute(attributeName).split(":"),
            _node$getAttribute$sp2 = _slicedToArray(_node$getAttribute$sp, 2),
            keyCandidate = _node$getAttribute$sp2[0],
            value = _node$getAttribute$sp2[1];

        if (keyCandidate !== key) return true;
        if (value !== variableValue) return true;
        renameAttribute(node, attributeName, attributeNameWhenActive);
        return false;
      });
      nodesWithActiveAttribute = nodesWithActiveAttribute.filter(function (node) {
        var _node$getAttribute$sp3 = node.getAttribute(attributeNameWhenActive).split(":"),
            _node$getAttribute$sp4 = _slicedToArray(_node$getAttribute$sp3, 2),
            keyCandidate = _node$getAttribute$sp4[0],
            value = _node$getAttribute$sp4[1];

        if (keyCandidate !== key) return true;
        if (value === variableValue) return true;
        renameAttribute(node, attributeNameWhenActive, attributeName);
        return false;
      });
    });
  };
  var attributeNameWhenActive = "data-when-active";
  var attributeName = "data-when";

  var renameAttribute = function renameAttribute(node, name, newName) {
    node.setAttribute(newName, node.getAttribute(name));
    node.removeAttribute(name);
  };

  var createHorizontalBreakpoint = function createHorizontalBreakpoint(breakpointValue) {
    return createBreakpoint(windowWidthMeasure, breakpointValue);
  };

  var createMeasure = function createMeasure(_ref) {
    var compute = _ref.compute,
        register = _ref.register;
    var currentValue = compute();

    var get = function get() {
      return compute();
    };

    var changed = createSignal();

    var unregister = function unregister() {};

    if (register) {
      unregister = register(function () {
        var value = compute();

        if (value !== currentValue) {
          var previousValue = value;
          currentValue = value;
          changed.notify(value, previousValue);
        }
      });
    }

    return {
      get: get,
      changed: changed,
      unregister: unregister
    };
  };

  var createSignal = function createSignal() {
    var callbackArray = [];

    var listen = function listen(callback) {
      callbackArray.push(callback);
      return function () {
        var index = callbackArray.indexOf(callback);

        if (index > -1) {
          callbackArray.splice(index, 1);
        }
      };
    };

    var notify = function notify() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      callbackArray.slice().forEach(function (callback) {
        callback.apply(void 0, args);
      });
    };

    return {
      listen: listen,
      notify: notify
    };
  };

  var windowWidthMeasure = createMeasure({
    name: "window-width",
    compute: function compute() {
      return window.innerWidth;
    },
    register: function register(onchange) {
      window.addEventListener("resize", onchange);
      window.addEventListener("orientationchange", onchange);
      return function () {
        window.removeEventListener("resize", onchange);
        window.removeEventListener("orientationchange", onchange);
      };
    }
  });

  var createBreakpoint = function createBreakpoint(measure, breakpointValue) {
    var getBreakpointState = function getBreakpointState() {
      var value = measure.get();

      if (value < breakpointValue) {
        return "below";
      }

      if (value > breakpointValue) {
        return "above";
      }

      return "equals";
    };

    var currentBreakpointState = getBreakpointState();

    var isAbove = function isAbove() {
      return measure.get() > breakpointValue;
    };

    var isBelow = function isBelow() {
      return measure.get() < breakpointValue;
    };

    var breakpointChanged = createSignal();
    measure.changed.listen(function () {
      var breakpointState = getBreakpointState();

      if (breakpointState !== currentBreakpointState) {
        var breakpointStatePrevious = currentBreakpointState;
        currentBreakpointState = breakpointState;
        breakpointChanged.notify(breakpointState, breakpointStatePrevious);
      }
    });
    return {
      isAbove: isAbove,
      isBelow: isBelow,
      changed: breakpointChanged
    };
  }; // const windowScrollTop = createMeasure({
  //   name: "window-scroll-top",
  //   compute: () => window.scrollTop,
  //   register: (onchange) => {
  //     window.addEventListener("scroll", onchange)
  //     return () => {
  //       window.removeEventListener("scroll", onchange)
  //     }
  //   },
  // })

  var WINDOW_MEDIUM_WIDTH = 570;
  var renderExecutionInToolbar = function renderExecutionInToolbar(_ref) {
    var executedFileRelativeUrl = _ref.executedFileRelativeUrl;
    // reset file execution indicator ui
    applyExecutionIndicator();
    removeForceHideElement(document.querySelector("#execution-indicator")); // apply responsive design on fileInput if needed + add listener on resize screen

    var input = document.querySelector("#file-input");
    var fileWidthBreakpoint = createHorizontalBreakpoint(WINDOW_MEDIUM_WIDTH);

    var handleFileWidthBreakpoint = function handleFileWidthBreakpoint() {
      resizeInput(input, fileWidthBreakpoint);
    };

    handleFileWidthBreakpoint();
    fileWidthBreakpoint.changed.listen(handleFileWidthBreakpoint);
    input.value = executedFileRelativeUrl;
    resizeInput(input, fileWidthBreakpoint);
    activateToolbarSection(document.querySelector("#file"));
    removeForceHideElement(document.querySelector("#file"));

    window.parent.__jsenv__.executionResultPromise.then(function (_ref2) {
      var status = _ref2.status,
          startTime = _ref2.startTime,
          endTime = _ref2.endTime;
      var execution = {
        status: status,
        startTime: startTime,
        endTime: endTime
      };
      applyExecutionIndicator(execution);
      var executionStorageKey = executedFileRelativeUrl;
      var previousExecution = sessionStorage.hasOwnProperty(executionStorageKey) ? JSON.parse(sessionStorage.getItem(executionStorageKey)) : undefined;
      notifyExecutionResult(executedFileRelativeUrl, execution, previousExecution);
      sessionStorage.setItem(executedFileRelativeUrl, JSON.stringify(execution));
    });
  };

  var applyExecutionIndicator = function applyExecutionIndicator() {
    var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref3$status = _ref3.status,
        status = _ref3$status === void 0 ? "running" : _ref3$status,
        startTime = _ref3.startTime,
        endTime = _ref3.endTime;

    var executionIndicator = document.querySelector("#execution-indicator");
    enableVariant(executionIndicator, {
      execution: status
    });
    var variantNode = executionIndicator.querySelector("[data-when-active]");

    variantNode.querySelector("button").onclick = function () {
      return toggleTooltip(executionIndicator);
    };

    variantNode.querySelector(".tooltip").textContent = computeText({
      status: status,
      startTime: startTime,
      endTime: endTime
    });
  };

  var computeText = function computeText(_ref4) {
    var status = _ref4.status,
        startTime = _ref4.startTime,
        endTime = _ref4.endTime;

    if (status === "completed") {
      return "Execution completed in ".concat(endTime - startTime, "ms");
    }

    if (status === "errored") {
      return "Execution failed in ".concat(endTime - startTime, "ms");
    }

    return "";
  };

  var resizeInput = function resizeInput(input, fileWidthBreakpoint) {
    var size = fileWidthBreakpoint.isBelow() ? 20 : 40;

    if (input.value.length > size) {
      input.style.width = "".concat(size, "ch");
    } else {
      input.style.width = "".concat(input.value.length, "ch");
    }
  };

  var createPromiseAndHooks = function createPromiseAndHooks() {
    var resolve;
    var reject;
    var promise = new Promise(function (res, rej) {
      resolve = res;
      reject = rej;
    });
    promise.resolve = resolve;
    promise.reject = reject;
    return promise;
  };

  var connectEventSource$1 = function connectEventSource(eventSourceUrl) {
    var events = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
        _ref$connecting = _ref.connecting,
        connecting = _ref$connecting === void 0 ? function () {} : _ref$connecting,
        _ref$connected = _ref.connected,
        connected = _ref$connected === void 0 ? function () {} : _ref$connected,
        _ref$cancelled = _ref.cancelled,
        cancelled = _ref$cancelled === void 0 ? function () {} : _ref$cancelled,
        _ref$failed = _ref.failed,
        failed = _ref$failed === void 0 ? function () {} : _ref$failed,
        _ref$retryMaxAttempt = _ref.retryMaxAttempt,
        retryMaxAttempt = _ref$retryMaxAttempt === void 0 ? Infinity : _ref$retryMaxAttempt,
        _ref$retryAllocatedMs = _ref.retryAllocatedMs,
        retryAllocatedMs = _ref$retryAllocatedMs === void 0 ? Infinity : _ref$retryAllocatedMs,
        lastEventId = _ref.lastEventId;

    var _window = window,
        EventSource = _window.EventSource;

    if (typeof EventSource !== "function") {
      return function () {};
    }

    var eventSourceOrigin = new URL(eventSourceUrl).origin; // will be either abort, disconnect or a third function calling cancelled
    // depending on connectionStatus

    var cancelCurrentConnection = function cancelCurrentConnection() {};

    var reconnect = function reconnect() {
      attemptConnection(lastEventId ? addLastEventIdIntoUrlSearchParams(eventSourceUrl, lastEventId) : eventSourceUrl);
    };

    var attemptConnection = function attemptConnection(url) {
      var eventSource = new EventSource(url, {
        withCredentials: true
      });
      var connectionStatus = "connecting";

      var abort = function abort() {
        if (connectionStatus !== "connecting") {
          console.warn("abort ignored because connection is ".concat(connectionStatus));
          return;
        }

        connectionStatus = "aborted";
        eventSource.onerror = undefined;
        eventSource.close();
        cancelled({
          connect: reconnect
        });
      };

      cancelCurrentConnection = abort;
      connecting({
        cancel: abort
      });

      eventSource.onopen = function () {
        connectionStatus = "connected";

        var disconnect = function disconnect() {
          if (connectionStatus !== "connected") {
            console.warn("disconnect ignored because connection is ".concat(connectionStatus));
            return;
          }

          connectionStatus = "disconnected";
          eventSource.onerror = undefined;
          eventSource.close();
          cancelled({
            connect: reconnect
          });
        };

        cancelCurrentConnection = disconnect;
        connected({
          cancel: disconnect
        });
      };

      var retryCount = 0;
      var firstRetryMs = Date.now();

      eventSource.onerror = function (errorEvent) {
        var considerFailed = function considerFailed() {
          connectionStatus = "disconnected";
          failed({
            cancel: function cancel() {
              if (connectionStatus !== "failed") {
                console.warn("disable ignored because connection is ".concat(connectionStatus));
                return;
              }

              connectionStatus = "disabled";
              cancelled({
                connect: reconnect
              });
            },
            connect: reconnect
          });
        };

        if (errorEvent.target.readyState === EventSource.CONNECTING) {
          if (retryCount > retryMaxAttempt) {
            console.info("could not connect after ".concat(retryMaxAttempt, " attempt"));
            eventSource.onerror = undefined;
            eventSource.close();
            considerFailed();
            return;
          }

          if (retryCount === 0) {
            firstRetryMs = Date.now();
          } else {
            var allRetryDuration = Date.now() - firstRetryMs;

            if (retryAllocatedMs && allRetryDuration > retryAllocatedMs) {
              console.info("could not connect in less than ".concat(retryAllocatedMs, " ms"));
              eventSource.onerror = undefined;
              eventSource.close();
              considerFailed();
              return;
            }
          }

          connectionStatus = "connecting";
          retryCount++;
          connecting({
            cancel: abort
          });
          return;
        }

        if (errorEvent.target.readyState === EventSource.CLOSED) {
          considerFailed();
          return;
        }
      };

      Object.keys(events).forEach(function (eventName) {
        eventSource.addEventListener(eventName, function (e) {
          if (e.origin === eventSourceOrigin) {
            if (e.lastEventId) {
              lastEventId = e.lastEventId;
            }

            events[eventName](e);
          }
        });
      });

      if (!events.hasOwnProperty("welcome")) {
        eventSource.addEventListener("welcome", function (e) {
          if (e.origin === eventSourceOrigin && e.lastEventId) {
            lastEventId = e.lastEventId;
          }
        });
      }
    };

    attemptConnection(eventSourceUrl);

    var disconnect = function disconnect() {
      cancelCurrentConnection();
    };

    var removePageUnloadListener = listenPageUnload(function () {
      disconnect();
    });
    return function () {
      removePageUnloadListener();
      disconnect();
    };
  };

  var addLastEventIdIntoUrlSearchParams = function addLastEventIdIntoUrlSearchParams(url, lastEventId) {
    if (url.indexOf("?") === -1) {
      url += "?";
    } else {
      url += "&";
    }

    return "".concat(url, "last-event-id=").concat(encodeURIComponent(lastEventId));
  }; // const listenPageMightFreeze = (callback) => {
  //   const removePageHideListener = listenEvent(window, "pagehide", (pageHideEvent) => {
  //     if (pageHideEvent.persisted === true) {
  //       callback(pageHideEvent)
  //     }
  //   })
  //   return removePageHideListener
  // }
  // const listenPageFreeze = (callback) => {
  //   const removeFreezeListener = listenEvent(document, "freeze", (freezeEvent) => {
  //     callback(freezeEvent)
  //   })
  //   return removeFreezeListener
  // }
  // const listenPageIsRestored = (callback) => {
  //   const removeResumeListener = listenEvent(document, "resume", (resumeEvent) => {
  //     removePageshowListener()
  //     callback(resumeEvent)
  //   })
  //   const removePageshowListener = listenEvent(window, "pageshow", (pageshowEvent) => {
  //     if (pageshowEvent.persisted === true) {
  //       removePageshowListener()
  //       removeResumeListener()
  //       callback(pageshowEvent)
  //     }
  //   })
  //   return () => {
  //     removeResumeListener()
  //     removePageshowListener()
  //   }
  // }


  var listenPageUnload = function listenPageUnload(callback) {
    var removePageHideListener = listenEvent(window, "pagehide", function (pageHideEvent) {
      if (pageHideEvent.persisted !== true) {
        callback(pageHideEvent);
      }
    });
    return removePageHideListener;
  };

  var listenEvent = function listenEvent(emitter, event, callback) {
    emitter.addEventListener(event, callback);
    return function () {
      emitter.removeEventListener(event, callback);
    };
  };

  var connectCompileServerEventSource = function connectCompileServerEventSource(fileRelativeUrl, _ref) {
    var onFileModified = _ref.onFileModified,
        onFileRemoved = _ref.onFileRemoved,
        onConnecting = _ref.onConnecting,
        onConnectionCancelled = _ref.onConnectionCancelled,
        onConnectionFailed = _ref.onConnectionFailed,
        onConnected = _ref.onConnected,
        lastEventId = _ref.lastEventId;
    var eventSourceUrl = "".concat(window.origin, "/").concat(fileRelativeUrl);

    var cancel = function cancel() {};

    var connect = function connect() {
      return new Promise(function (resolve) {
        cancel = connectEventSource$1(eventSourceUrl, {
          "file-modified": function fileModified(_ref2) {
            var data = _ref2.data;
            onFileModified(data);
          },
          "file-removed": function fileRemoved(_ref3) {
            var data = _ref3.data;
            onFileRemoved(data);
          }
        }, {
          connecting: function connecting(_ref4) {
            var _cancel = _ref4.cancel;
            onConnecting({
              cancel: function cancel() {
                _cancel();
              }
            });
          },
          connected: function connected(_ref5) {
            var _cancel2 = _ref5.cancel;
            resolve(true);
            onConnected({
              cancel: function cancel() {
                _cancel2();
              }
            });
          },
          cancelled: function cancelled(_ref6) {
            var connect = _ref6.connect;
            resolve(false);
            onConnectionCancelled({
              connect: connect
            });
          },
          failed: function failed(_ref7) {
            var connect = _ref7.connect;
            resolve(false);
            onConnectionFailed({
              connect: connect
            });
          },
          retryMaxAttempt: Infinity,
          retryAllocatedMs: 20 * 1000,
          lastEventId: lastEventId
        });
      });
    };

    return {
      connect: connect,
      disconnect: function disconnect() {
        return cancel();
      }
    };
  };

  var livereloadingPreference = createPreference("livereloading");
  var initToolbarEventSource = function initToolbarEventSource(_ref) {
    var executedFileRelativeUrl = _ref.executedFileRelativeUrl;
    removeForceHideElement(document.querySelector("#eventsource-indicator"));
    connectEventSource(executedFileRelativeUrl);
    var livereloadCheckbox = document.querySelector("#toggle-livereload");
    livereloadCheckbox.checked = getLivereloadingPreference();

    livereloadCheckbox.onchange = function () {
      livereloadingPreference.set(livereloadCheckbox.checked);
      updateEventSourceIndicator();
    };

    updateEventSourceIndicator();
  };

  var parentEventSource = window.parent.__jsenv_eventsource__();

  var latestChangeMap = parentEventSource.latestChangeMap;
  var eventSourceState = "default";
  var eventSourceHooks = {};
  var eventSourceConnection;
  var connectionReadyPromise;

  var handleFileChange = function handleFileChange(file, type) {
    latestChangeMap[file] = type;
    updateEventSourceIndicator();
    var livereloadingEnabled = getLivereloadingPreference();

    if (livereloadingEnabled) {
      if (file.endsWith(".css") || file.endsWith(".scss") || file.endsWith(".sass")) {
        reloadAllCss();
        delete latestChangeMap[file];
        updateEventSourceIndicator();
      } else {
        reloadPage();
      }
    }
  };

  var reloadAllCss = function reloadAllCss() {
    var links = Array.from(window.parent.document.getElementsByTagName("link"));
    links.forEach(function (link) {
      if (link.rel === "stylesheet") {
        var url = new URL(link.href);
        url.searchParams.set("t", Date.now());
        link.href = String(url);
      }
    });
  };

  var reloadPage = function reloadPage() {
    window.parent.location.reload(true);
  };

  var reloadChanges = function reloadChanges() {
    var fullReloadRequired = Object.keys(latestChangeMap).some(function (key) {
      return !key.endsWith(".css");
    });

    if (fullReloadRequired) {
      reloadPage();
      return;
    }

    var cssReloadRequired = Object.keys(latestChangeMap).some(function (key) {
      return key.endsWith(".css");
    });

    if (cssReloadRequired) {
      reloadAllCss();
      Object.keys(latestChangeMap).forEach(function (key) {
        if (key.endsWith(".css")) {
          delete latestChangeMap[key];
        }

        updateEventSourceIndicator();
      });
    }
  };

  var connectEventSource = function connectEventSource(executedFileRelativeUrl) {
    updateEventSourceIndicator();
    connectionReadyPromise = createPromiseAndHooks();
    eventSourceConnection = connectCompileServerEventSource(executedFileRelativeUrl, {
      onFileModified: function onFileModified(file) {
        handleFileChange(file, "modified");
      },
      onFileRemoved: function onFileRemoved(file) {
        handleFileChange(file, "removed");
      },
      onFileAdded: function onFileAdded(file) {
        handleFileChange(file, "added");
      },
      onConnecting: function onConnecting(_ref2) {
        var cancel = _ref2.cancel;
        eventSourceState = "connecting";
        eventSourceHooks = {
          abort: cancel
        };
        updateEventSourceIndicator();
      },
      onConnectionCancelled: function onConnectionCancelled(_ref3) {
        var connect = _ref3.connect;
        eventSourceState = "disabled";
        eventSourceHooks = {
          connect: connect
        };
        updateEventSourceIndicator();
      },
      onConnectionFailed: function onConnectionFailed(_ref4) {
        var connect = _ref4.connect;
        eventSourceState = "failed";
        eventSourceHooks = {
          reconnect: connect
        };
        updateEventSourceIndicator();
      },
      onConnected: function onConnected(_ref5) {
        var cancel = _ref5.cancel;
        eventSourceState = "connected";
        eventSourceHooks = {
          disconnect: cancel
        };
        updateEventSourceIndicator();
        connectionReadyPromise.resolve();
        parentEventSource.disconnect();
      },
      lastEventId: parentEventSource.lastEventId
    });
    eventSourceConnection.connect();
  };

  var getLivereloadingPreference = function getLivereloadingPreference() {
    return livereloadingPreference.has() ? livereloadingPreference.get() : true;
  };

  var updateEventSourceIndicator = function updateEventSourceIndicator() {
    var _eventSourceHooks = eventSourceHooks,
        connect = _eventSourceHooks.connect,
        abort = _eventSourceHooks.abort,
        reconnect = _eventSourceHooks.reconnect;
    var eventSourceIndicator = document.querySelector("#eventsource-indicator");
    var changeCount = Object.keys(latestChangeMap).length;
    enableVariant(eventSourceIndicator, {
      eventsource: eventSourceState,
      livereload: getLivereloadingPreference() ? "on" : "off",
      changes: changeCount > 0 ? "yes" : "no"
    });
    var variantNode = document.querySelector("#eventsource-indicator > [data-when-active]");

    variantNode.querySelector("button").onclick = function () {
      toggleTooltip(eventSourceIndicator);
    };

    if (eventSourceState === "disabled") {
      variantNode.querySelector("a").onclick = connect;
    } else if (eventSourceState === "connecting") {
      variantNode.querySelector("a").onclick = abort;
    } else if (eventSourceState === "connected") {
      removeAutoShowTooltip(eventSourceIndicator);

      if (changeCount) {
        var changeLink = variantNode.querySelector(".eventsource-changes-link");
        changeLink.innerHTML = changeCount;

        changeLink.onclick = function () {
          console.log(JSON.stringify(latestChangeMap, null, "  "), latestChangeMap); // eslint-disable-next-line no-alert

          window.parent.alert(JSON.stringify(latestChangeMap, null, "  "));
        };

        variantNode.querySelector(".eventsource-reload-link").onclick = reloadChanges;
      }
    } else if (eventSourceState === "failed") {
      autoShowTooltip(eventSourceIndicator);
      variantNode.querySelector("a").onclick = reconnect;
    }
  };

  var WINDOW_SMALL_WIDTH = 420;
  var makeToolbarResponsive = function makeToolbarResponsive() {
    // apply responsive design on toolbar icons if needed + add listener on resize screen
    // ideally we should listen breakpoint once, for now restore toolbar
    var overflowMenuBreakpoint = createHorizontalBreakpoint(WINDOW_SMALL_WIDTH);

    var handleOverflowMenuBreakpoint = function handleOverflowMenuBreakpoint() {
      responsiveToolbar(overflowMenuBreakpoint);
    };

    handleOverflowMenuBreakpoint();
    overflowMenuBreakpoint.changed.listen(handleOverflowMenuBreakpoint); // overflow menu

    document.querySelector("#overflow-menu-button").onclick = function () {
      return toggleOverflowMenu();
    };
  };

  var responsiveToolbar = function responsiveToolbar(overflowMenuBreakpoint) {
    // close all tooltips in case opened
    hideTooltip(document.querySelector("#eventsource-indicator"));
    hideTooltip(document.querySelector("#execution-indicator")); // close settings box in case opened

    deactivateToolbarSection(document.querySelector("#settings"));

    if (overflowMenuBreakpoint.isBelow()) {
      enableOverflow();
    } else {
      disableOverflow();
    }
  };

  var moves = [];

  var enableOverflow = function enableOverflow() {
    // move elements from toolbar to overflow menu
    var responsiveToolbarElements = document.querySelectorAll("[data-responsive-toolbar-element]");
    var overflowMenu = document.querySelector("#overflow-menu"); // keep a placeholder element to know where to move them back

    moves = Array.from(responsiveToolbarElements).map(function (element) {
      var placeholder = document.createElement("div");
      placeholder.style.display = "none";
      placeholder.setAttribute("data-placeholder", "");
      element.parentNode.replaceChild(placeholder, element);
      overflowMenu.appendChild(element);
      return {
        element: element,
        placeholder: placeholder
      };
    });
    document.querySelector("#toolbar").setAttribute("data-overflow-menu-enabled", "");
    removeForceHideElement(document.querySelector("#overflow-menu-button"));
  };

  var disableOverflow = function disableOverflow() {
    // close overflow menu in case it's open & unselect toggleOverflowMenu button in case it's selected
    hideOverflowMenu();
    deactivateToolbarSection(document.querySelector("#overflow-menu"));
    moves.forEach(function (_ref) {
      var element = _ref.element,
          placeholder = _ref.placeholder;
      placeholder.parentNode.replaceChild(element, placeholder);
    });
    moves = [];
    document.querySelector("#toolbar").removeAttribute("data-overflow-menu-enabled");
    forceHideElement(document.querySelector("#overflow-menu-button"));
  };

  var toggleOverflowMenu = function toggleOverflowMenu() {
    if (overflowMenuIsVisible()) {
      hideOverflowMenu();
    } else {
      showOverflowMenu();
    }
  };

  var overflowMenuIsVisible = function overflowMenuIsVisible() {
    var toolbar = document.querySelector("#toolbar");
    return toolbar.hasAttribute("data-overflow-menu-visible");
  };

  var showOverflowMenu = function showOverflowMenu() {
    var toolbar = document.querySelector("#toolbar");
    document.querySelector("#overflow-menu").setAttribute("data-animate", "");
    toolbar.setAttribute("data-overflow-menu-visible", "");
  };

  var hideOverflowMenu = function hideOverflowMenu() {
    var toolbar = document.querySelector("#toolbar");
    toolbar.removeAttribute("data-overflow-menu-visible");
    document.querySelector("#overflow-menu").removeAttribute("data-animate");
  };

  /* eslint-disable import/max-dependencies */

  function _call(body, then, direct) {
    if (direct) {
      return then ? then(body()) : body();
    }

    try {
      var result = Promise.resolve(body());
      return then ? result.then(then) : result;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  var toolbarVisibilityPreference = createPreference("toolbar");

  function _async(f) {
    return function () {
      for (var args = [], i = 0; i < arguments.length; i++) {
        args[i] = arguments[i];
      }

      try {
        return Promise.resolve(f.apply(this, args));
      } catch (e) {
        return Promise.reject(e);
      }
    };
  }

  var renderToolbar = _async(function () {
    var executedFileCompiledUrl = window.parent.location.href;
    var compileServerOrigin = window.parent.location.origin; // this should not block the whole toolbar rendering + interactivity

    return _call(fetchExploringJson, function (exploringConfig) {
      var outDirectoryRelativeUrl = exploringConfig.outDirectoryRelativeUrl;
      var outDirectoryRemoteUrl = String(new URL(outDirectoryRelativeUrl, compileServerOrigin));
      var executedFileRelativeUrl = urlToOriginalRelativeUrl(executedFileCompiledUrl, outDirectoryRemoteUrl);
      var toolbarOverlay = document.querySelector("#toolbar-overlay");

      toolbarOverlay.onclick = function () {
        hideAllTooltip();
        hideSettings();
      };

      var toolbarElement = document.querySelector("#toolbar");
      exposeOnParentWindow({
        toolbar: {
          element: toolbarElement,
          show: showToolbar,
          hide: function hide() {
            return hideToolbar();
          },
          toggle: toogleToolbar
        }
      });
      var toolbarVisible = toolbarVisibilityPreference.has() ? toolbarVisibilityPreference.get() : true;

      if (toolbarVisible) {
        showToolbar({
          animate: false
        });
      } else {
        hideToolbar({
          animate: false
        });
      }

      renderBackToListInToolbar({
        outDirectoryRelativeUrl: outDirectoryRelativeUrl,
        exploringHtmlFileRelativeUrl: exploringConfig.exploringHtmlFileRelativeUrl
      });
      renderToolbarNotification();
      makeToolbarResponsive();
      renderToolbarSettings();
      renderToolbarAnimation();
      renderToolbarTheme();
      renderExecutionInToolbar({
        executedFileRelativeUrl: executedFileRelativeUrl
      }); // this might become active but we need to detect this somehow

      deactivateToolbarSection(document.querySelector("#file-list-link"));
      initToolbarEventSource({
        executedFileRelativeUrl: executedFileRelativeUrl
      }); // if user click enter or space quickly while closing toolbar
      // it will cancel the closing
      // that's why I used toggleToolbar and not hideToolbar

      document.querySelector("#button-close-toolbar").onclick = function () {
        return toogleToolbar();
      };
    });
  });

  var exposeOnParentWindow = function exposeOnParentWindow(object) {
    var __jsenv__ = window.parent.__jsenv__;

    if (!__jsenv__) {
      __jsenv__ = {};
      window.parent.__jsenv__ = {};
    }

    Object.assign(__jsenv__, object);
  };

  var toogleToolbar = function toogleToolbar() {
    if (toolbarIsVisible()) {
      hideToolbar();
    } else {
      showToolbar();
    }
  };

  var toolbarIsVisible = function toolbarIsVisible() {
    return document.documentElement.hasAttribute("data-toolbar-visible");
  };

  var hideToolbar = function hideToolbar() {
    // toolbar hidden by default, nothing to do to hide it by default
    sendEventToParent("toolbar-visibility-change", false);
  }; // (by the way it might be cool to have the toolbar auto show when)
  // it has something to say (being disconnected from livereload server)


  var showToolbar = function showToolbar() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$animate = _ref.animate,
        animate = _ref$animate === void 0 ? true : _ref$animate;

    toolbarVisibilityPreference.set(true);

    if (animate) {
      document.documentElement.setAttribute("data-toolbar-animation", "");
    } else {
      document.documentElement.removeAttribute("data-toolbar-animation");
    }

    document.documentElement.setAttribute("data-toolbar-visible", "");
    sendEventToParent("toolbar-visibility-change", true);
    var toolbarIframe = getToolbarIframe();
    var toolbarIframeParent = toolbarIframe.parentNode;
    var parentWindow = window.parent;
    var parentDocumentElement = parentWindow.document.compatMode === "CSS1Compat" ? parentWindow.document.documentElement : parentWindow.document.body;
    var scrollYMax = parentDocumentElement.scrollHeight - parentWindow.innerHeight;
    var scrollY = parentDocumentElement.scrollTop;
    var scrollYRemaining = scrollYMax - scrollY;
    setStyles(toolbarIframeParent, {
      "transition-property": "padding-bottom",
      "transition-duration": "300ms"
    }); // maybe we should use js animation here because we would not conflict with css

    var restoreToolbarIframeParentStyles = setStyles(toolbarIframeParent, {
      "scroll-padding-bottom": "40px",
      // same here we should add 40px
      "padding-bottom": "40px" // if there is already one we should add 40px

    });
    var restoreToolbarIframeStyles = setStyles(toolbarIframe, {
      height: "40px",
      visibility: "visible"
    });

    if (scrollYRemaining < 40 && scrollYMax > 0) {
      var scrollEnd = scrollY + 40;
      startJavaScriptAnimation({
        duration: 300,
        onProgress: function onProgress(_ref2) {
          var progress = _ref2.progress;
          var value = scrollY + (scrollEnd - scrollY) * progress;
          parentDocumentElement.scrollTop = value;
        }
      });
    }

    hideToolbar = function hideToolbar() {
      restoreToolbarIframeParentStyles();
      restoreToolbarIframeStyles();
      hideTooltip(document.querySelector("#eventsource-indicator"));
      hideTooltip(document.querySelector("#execution-indicator"));
      toolbarVisibilityPreference.set(false);

      if (animate) {
        document.documentElement.setAttribute("data-toolbar-animation", "");
      } else {
        document.documentElement.removeAttribute("data-toolbar-animation");
      }

      document.documentElement.removeAttribute("data-toolbar-visible");
      sendEventToParent("toolbar-visibility-change", false);
    };
  };

  var urlToOriginalRelativeUrl = function urlToOriginalRelativeUrl(url, outDirectoryRemoteUrl) {
    if (urlIsInsideOf(url, outDirectoryRemoteUrl)) {
      var afterCompileDirectory = urlToRelativeUrl(url, outDirectoryRemoteUrl);
      var fileRelativeUrl = afterCompileDirectory.slice(afterCompileDirectory.indexOf("/") + 1);
      return fileRelativeUrl;
    }

    return new URL(url).pathname.slice(1);
  };

  var sendEventToParent = function sendEventToParent(type, value) {
    window.parent.postMessage({
      jsenv: true,
      type: type,
      value: value
    }, "*");
  };

  window.renderToolbar = renderToolbar;

}());

//# sourceMappingURL=jsenv-toolbar.js.map