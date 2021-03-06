(function () {
  'use strict';

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

  var createDetailedMessage = function createDetailedMessage(message) {
    var details = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var string = "".concat(message);
    Object.keys(details).forEach(function (key) {
      var value = details[key];
      string += "\n--- ".concat(key, " ---\n").concat(Array.isArray(value) ? value.join("\n") : value);
    });
    return string;
  };

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

  var fetchUsingXHR = _async$3(function (url) {
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

    var headersPromise = createPromiseAndHooks();
    var bodyPromise = createPromiseAndHooks();
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
        return _call$1(readBody, function (_ref2) {
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
        return _call$1(text, JSON.parse);
      };

      var blob = _async$3(function () {
        if (!hasBlob) {
          throw new Error("blob not supported");
        }

        return _call$1(readBody, function (_ref3) {
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
        return _call$1(readBody, function (_ref4) {
          var responseBody = _ref4.responseBody,
              responseBodyType = _ref4.responseBodyType;
          return responseBodyType === "arrayBuffer" ? cloneBuffer(responseBody) : _call$1(blob, blobToArrayBuffer);
        });
      };

      var formData = _async$3(function () {
        if (!hasFormData) {
          throw new Error("formData not supported");
        }

        return _call$1(text, textToFormData);
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

  var createPromiseAndHooks = function createPromiseAndHooks() {
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

  var blobToArrayBuffer = _async$3(function (blob) {
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

  var fetchNative = _async$2(function (url) {

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

  var fetchExploringJson = _async$1(function () {
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

  var COMPILE_ID_OTHERWISE = "otherwise";

  var computeCompileIdFromGroupId = function computeCompileIdFromGroupId(_ref) {
    var groupId = _ref.groupId,
        groupMap = _ref.groupMap;

    if (typeof groupId === "undefined") {
      if (COMPILE_ID_OTHERWISE in groupMap) {
        return COMPILE_ID_OTHERWISE;
      }

      var keys = Object.keys(groupMap);

      if (keys.length === 1) {
        return keys[0];
      }

      throw new Error(createUnexpectedGroupIdMessage({
        groupMap: groupMap
      }));
    }

    if (groupId in groupMap === false) {
      throw new Error(createUnexpectedGroupIdMessage({
        groupId: groupId,
        groupMap: groupMap
      }));
    }

    return groupId;
  };

  var createUnexpectedGroupIdMessage = function createUnexpectedGroupIdMessage(_ref2) {
    var _createDetailedMessag;

    var compileId = _ref2.compileId,
        groupMap = _ref2.groupMap;
    return createDetailedMessage("unexpected groupId.", (_createDetailedMessag = {}, _defineProperty(_createDetailedMessag, "expected compiled id", Object.keys(groupMap)), _defineProperty(_createDetailedMessag, "received compile id", compileId), _createDetailedMessag));
  };

  var firstMatch = function firstMatch(regexp, string) {
    var match = string.match(regexp);
    return match && match.length > 0 ? match[1] || undefined : undefined;
  };
  var secondMatch = function secondMatch(regexp, string) {
    var match = string.match(regexp);
    return match && match.length > 1 ? match[2] || undefined : undefined;
  };
  var userAgentToVersion = function userAgentToVersion(userAgent) {
    return firstMatch(/version\/(\d+(\.?_?\d+)+)/i, userAgent) || undefined;
  };

  var detectAndroid = function detectAndroid() {
    return navigatorToBrowser$1(window.navigator);
  };

  var navigatorToBrowser$1 = function navigatorToBrowser(_ref) {
    var userAgent = _ref.userAgent,
        appVersion = _ref.appVersion;

    if (/(android)/i.test(userAgent)) {
      return {
        name: "android",
        version: firstMatch(/Android (\d+(\.?_?\d+)+)/i, appVersion)
      };
    }

    return null;
  };

  var detectInternetExplorer = function detectInternetExplorer() {
    return userAgentToBrowser$5(window.navigator.userAgent);
  };

  var userAgentToBrowser$5 = function userAgentToBrowser(userAgent) {
    if (/msie|trident/i.test(userAgent)) {
      return {
        name: "ie",
        version: firstMatch(/(?:msie |rv:)(\d+(\.?_?\d+)+)/i, userAgent)
      };
    }

    return null;
  };

  var detectOpera = function detectOpera() {
    return userAgentToBrowser$4(window.navigator.userAgent);
  };

  var userAgentToBrowser$4 = function userAgentToBrowser(userAgent) {
    // opera below 13
    if (/opera/i.test(userAgent)) {
      return {
        name: "opera",
        version: userAgentToVersion(userAgent) || firstMatch(/(?:opera)[\s/](\d+(\.?_?\d+)+)/i, userAgent)
      };
    } // opera above 13


    if (/opr\/|opios/i.test(userAgent)) {
      return {
        name: "opera",
        version: firstMatch(/(?:opr|opios)[\s/](\S+)/i, userAgent) || userAgentToVersion(userAgent)
      };
    }

    return null;
  };

  var detectEdge = function detectEdge() {
    return userAgentToBrowser$3(window.navigator.userAgent);
  };

  var userAgentToBrowser$3 = function userAgentToBrowser(userAgent) {
    if (/edg([ea]|ios)/i.test(userAgent)) {
      return {
        name: "edge",
        version: secondMatch(/edg([ea]|ios)\/(\d+(\.?_?\d+)+)/i, userAgent)
      };
    }

    return null;
  };

  var detectFirefox = function detectFirefox() {
    return userAgentToBrowser$2(window.navigator.userAgent);
  };

  var userAgentToBrowser$2 = function userAgentToBrowser(userAgent) {
    if (/firefox|iceweasel|fxios/i.test(userAgent)) {
      return {
        name: "firefox",
        version: firstMatch(/(?:firefox|iceweasel|fxios)[\s/](\d+(\.?_?\d+)+)/i, userAgent)
      };
    }

    return null;
  };

  var detectChrome = function detectChrome() {
    return userAgentToBrowser$1(window.navigator.userAgent);
  };

  var userAgentToBrowser$1 = function userAgentToBrowser(userAgent) {
    if (/chromium/i.test(userAgent)) {
      return {
        name: "chrome",
        version: firstMatch(/(?:chromium)[\s/](\d+(\.?_?\d+)+)/i, userAgent) || userAgentToVersion(userAgent)
      };
    }

    if (/chrome|crios|crmo/i.test(userAgent)) {
      return {
        name: "chrome",
        version: firstMatch(/(?:chrome|crios|crmo)\/(\d+(\.?_?\d+)+)/i, userAgent)
      };
    }

    return null;
  };

  var detectSafari = function detectSafari() {
    return userAgentToBrowser(window.navigator.userAgent);
  };

  var userAgentToBrowser = function userAgentToBrowser(userAgent) {
    if (/safari|applewebkit/i.test(userAgent)) {
      return {
        name: "safari",
        version: userAgentToVersion(userAgent)
      };
    }

    return null;
  };

  var detectElectron = function detectElectron() {
    return null;
  }; // TODO

  var detectIOS = function detectIOS() {
    return navigatorToBrowser(window.navigator);
  };

  var navigatorToBrowser = function navigatorToBrowser(_ref) {
    var userAgent = _ref.userAgent,
        appVersion = _ref.appVersion;

    if (/iPhone;/.test(userAgent)) {
      return {
        name: "ios",
        version: firstMatch(/OS (\d+(\.?_?\d+)+)/i, appVersion)
      };
    }

    if (/iPad;/.test(userAgent)) {
      return {
        name: "ios",
        version: firstMatch(/OS (\d+(\.?_?\d+)+)/i, appVersion)
      };
    }

    return null;
  };

  // https://github.com/Ahmdrza/detect-browser/blob/26254f85cf92795655a983bfd759d85f3de850c6/detect-browser.js#L1

  var detectorCompose = function detectorCompose(detectors) {
    return function () {
      var i = 0;

      while (i < detectors.length) {
        var _detector = detectors[i];
        i++;

        var result = _detector();

        if (result) {
          return result;
        }
      }

      return null;
    };
  };

  var detector = detectorCompose([detectOpera, detectInternetExplorer, detectEdge, detectFirefox, detectChrome, detectSafari, detectElectron, detectIOS, detectAndroid]);
  var detectBrowser = function detectBrowser() {
    var _ref = detector() || {},
        _ref$name = _ref.name,
        name = _ref$name === void 0 ? "other" : _ref$name,
        _ref$version = _ref.version,
        version = _ref$version === void 0 ? "unknown" : _ref$version;

    return {
      name: normalizeName(name),
      version: normalizeVersion(version)
    };
  };

  var normalizeName = function normalizeName(name) {
    return name.toLowerCase();
  };

  var normalizeVersion = function normalizeVersion(version) {
    if (version.indexOf(".") > -1) {
      var parts = version.split("."); // remove extraneous .

      return parts.slice(0, 3).join(".");
    }

    if (version.indexOf("_") > -1) {
      var _parts = version.split("_"); // remove extraneous _


      return _parts.slice(0, 3).join("_");
    }

    return version;
  };

  var valueToVersion = function valueToVersion(value) {
    if (typeof value === "number") {
      return numberToVersion(value);
    }

    if (typeof value === "string") {
      return stringToVersion(value);
    }

    throw new TypeError(createValueErrorMessage({
      version: value
    }));
  };

  var numberToVersion = function numberToVersion(number) {
    return {
      major: number,
      minor: 0,
      patch: 0
    };
  };

  var stringToVersion = function stringToVersion(string) {
    if (string.indexOf(".") > -1) {
      var parts = string.split(".");
      return {
        major: Number(parts[0]),
        minor: parts[1] ? Number(parts[1]) : 0,
        patch: parts[2] ? Number(parts[2]) : 0
      };
    }

    if (isNaN(string)) {
      return {
        major: 0,
        minor: 0,
        patch: 0
      };
    }

    return {
      major: Number(string),
      minor: 0,
      patch: 0
    };
  };

  var createValueErrorMessage = function createValueErrorMessage(_ref) {
    var value = _ref.value;
    return "value must be a number or a string.\nvalue: ".concat(value);
  };

  var versionCompare = function versionCompare(versionA, versionB) {
    var semanticVersionA = valueToVersion(versionA);
    var semanticVersionB = valueToVersion(versionB);
    var majorDiff = semanticVersionA.major - semanticVersionB.major;

    if (majorDiff > 0) {
      return majorDiff;
    }

    if (majorDiff < 0) {
      return majorDiff;
    }

    var minorDiff = semanticVersionA.minor - semanticVersionB.minor;

    if (minorDiff > 0) {
      return minorDiff;
    }

    if (minorDiff < 0) {
      return minorDiff;
    }

    var patchDiff = semanticVersionA.patch - semanticVersionB.patch;

    if (patchDiff > 0) {
      return patchDiff;
    }

    if (patchDiff < 0) {
      return patchDiff;
    }

    return 0;
  };

  var versionIsBelow = function versionIsBelow(versionSupposedBelow, versionSupposedAbove) {
    return versionCompare(versionSupposedBelow, versionSupposedAbove) < 0;
  };

  var findHighestVersion = function findHighestVersion() {
    for (var _len = arguments.length, values = new Array(_len), _key = 0; _key < _len; _key++) {
      values[_key] = arguments[_key];
    }

    if (values.length === 0) throw new Error("missing argument");
    return values.reduce(function (highestVersion, value) {
      if (versionIsBelow(highestVersion, value)) {
        return value;
      }

      return highestVersion;
    });
  };

  var resolveGroup = function resolveGroup(_ref, groupMap) {
    var name = _ref.name,
        version = _ref.version;
    return Object.keys(groupMap).find(function (compileIdCandidate) {
      var runtimeCompatMap = groupMap[compileIdCandidate].runtimeCompatMap;

      if (name in runtimeCompatMap === false) {
        return false;
      }

      var versionForGroup = runtimeCompatMap[name];
      var highestVersion = findHighestVersion(version, versionForGroup);
      return highestVersion === version;
    });
  };

  var resolveBrowserGroup = function resolveBrowserGroup(groupMap) {
    return resolveGroup(detectBrowser(), groupMap);
  };

  function _await(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  var redirect = function redirect() {
    return _call(fetchExploringJson, function (_ref) {
      var outDirectoryRelativeUrl = _ref.outDirectoryRelativeUrl,
          exploringHtmlFileRelativeUrl = _ref.exploringHtmlFileRelativeUrl;
      return _await(decideExploringIndexUrl({
        outDirectoryRelativeUrl: outDirectoryRelativeUrl,
        exploringHtmlFileRelativeUrl: exploringHtmlFileRelativeUrl
      }), function (_decideExploringIndex) {
        window.location.href = _decideExploringIndex;
      });
    });
  };

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

  var decideExploringIndexUrl = _async(function (_ref2) {
    var outDirectoryRelativeUrl = _ref2.outDirectoryRelativeUrl,
        exploringHtmlFileRelativeUrl = _ref2.exploringHtmlFileRelativeUrl;
    // for now it's not possible to avoid compilation
    // I need to list what is needed to support that
    // for instance it means we should collect coverage from chrome devtools
    // instead of instrumenting source code.
    // It also means we should be able somehow to collect namespace of module imported
    // by the html page
    var canAvoidCompilation = false;
    return _await(canAvoidCompilation , function (_browserSupportsAllFe) {
      if (_browserSupportsAllFe) {
        return "/".concat(exploringHtmlFileRelativeUrl);
      }

      return _await(decideCompileId({
        outDirectoryRelativeUrl: outDirectoryRelativeUrl
      }), function (compileId) {
        return "/".concat(outDirectoryRelativeUrl).concat(compileId, "/").concat(exploringHtmlFileRelativeUrl);
      });
    }, !canAvoidCompilation);
  });

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

  var decideCompileId = _async(function (_ref4) {
    var outDirectoryRelativeUrl = _ref4.outDirectoryRelativeUrl;
    var compileServerGroupMapUrl = "/".concat(outDirectoryRelativeUrl, "groupMap.json");
    return _await(fetchUrl(compileServerGroupMapUrl), function (compileServerGroupMapResponse) {
      return _await(compileServerGroupMapResponse.json(), function (compileServerGroupMap) {
        var compileId = computeCompileIdFromGroupId({
          groupId: resolveBrowserGroup(compileServerGroupMap),
          groupMap: compileServerGroupMap
        });
        return compileId;
      });
    });
  });

  redirect();

}());

//# sourceMappingURL=jsenv-exploring-redirector.js.map