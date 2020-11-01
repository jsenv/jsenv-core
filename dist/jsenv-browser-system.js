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

  function _objectSpread (target) {
    for (var i = 1; i < arguments.length; i++) {
      // eslint-disable-next-line prefer-rest-params
      var source = arguments[i] === null ? {} : arguments[i];

      if (i % 2) {
        // eslint-disable-next-line no-loop-func
        ownKeys(Object(source), true).forEach(function (key) {
          _defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        // eslint-disable-next-line no-loop-func
        ownKeys(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }

    return target;
  } // This function is different to "Reflect.ownKeys". The enumerableOnly
  // filters on symbol properties only. Returned string properties are always
  // enumerable. It is good to use in objectSpread.

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      if (enumerableOnly) symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      }); // eslint-disable-next-line prefer-spread

      keys.push.apply(keys, symbols);
    }

    return keys;
  }

  /* eslint-disable no-eq-null, eqeqeq */
  function arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    var arr2 = new Array(len);

    for (var i = 0; i < len; i++) {
      arr2[i] = arr[i];
    }

    return arr2;
  }

  var arrayWithoutHoles = (function (arr) {
    if (Array.isArray(arr)) return arrayLikeToArray(arr);
  });

  // eslint-disable-next-line consistent-return
  var iterableToArray = (function (iter) {
    if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
  });

  /* eslint-disable consistent-return */
  function unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
  }

  var nonIterableSpread = (function () {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  });

  var _toConsumableArray = (function (arr) {
    return arrayWithoutHoles(arr) || iterableToArray(arr) || unsupportedIterableToArray(arr) || nonIterableSpread();
  });

  var nativeTypeOf = function nativeTypeOf(obj) {
    return typeof obj;
  };

  var customTypeOf = function customTypeOf(obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  };

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? nativeTypeOf : customTypeOf;

  var assertImportMap = function assertImportMap(value) {
    if (value === null) {
      throw new TypeError("an importMap must be an object, got null");
    }

    var type = _typeof(value);

    if (type !== "object") {
      throw new TypeError("an importMap must be an object, received ".concat(value));
    }

    if (Array.isArray(value)) {
      throw new TypeError("an importMap must be an object, received array ".concat(value));
    }
  };

  var hasScheme = function hasScheme(string) {
    return /^[a-zA-Z]{2,}:/.test(string);
  };

  var urlToScheme = function urlToScheme(urlString) {
    var colonIndex = urlString.indexOf(":");
    if (colonIndex === -1) return "";
    return urlString.slice(0, colonIndex);
  };

  var urlToPathname = function urlToPathname(urlString) {
    return ressourceToPathname(urlToRessource(urlString));
  };

  var urlToRessource = function urlToRessource(urlString) {
    var scheme = urlToScheme(urlString);

    if (scheme === "file") {
      return urlString.slice("file://".length);
    }

    if (scheme === "https" || scheme === "http") {
      // remove origin
      var afterProtocol = urlString.slice(scheme.length + "://".length);
      var pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
      return afterProtocol.slice(pathnameSlashIndex);
    }

    return urlString.slice(scheme.length + 1);
  };

  var ressourceToPathname = function ressourceToPathname(ressource) {
    var searchSeparatorIndex = ressource.indexOf("?");
    return searchSeparatorIndex === -1 ? ressource : ressource.slice(0, searchSeparatorIndex);
  };

  var urlToOrigin = function urlToOrigin(urlString) {
    var scheme = urlToScheme(urlString);

    if (scheme === "file") {
      return "file://";
    }

    if (scheme === "http" || scheme === "https") {
      var secondProtocolSlashIndex = scheme.length + "://".length;
      var pathnameSlashIndex = urlString.indexOf("/", secondProtocolSlashIndex);
      if (pathnameSlashIndex === -1) return urlString;
      return urlString.slice(0, pathnameSlashIndex);
    }

    return urlString.slice(0, scheme.length + 1);
  };

  var pathnameToParentPathname = function pathnameToParentPathname(pathname) {
    var slashLastIndex = pathname.lastIndexOf("/");

    if (slashLastIndex === -1) {
      return "/";
    }

    return pathname.slice(0, slashLastIndex + 1);
  };

  // could be useful: https://url.spec.whatwg.org/#url-miscellaneous
  var resolveUrl = function resolveUrl(specifier, baseUrl) {
    if (baseUrl) {
      if (typeof baseUrl !== "string") {
        throw new TypeError(writeBaseUrlMustBeAString({
          baseUrl: baseUrl,
          specifier: specifier
        }));
      }

      if (!hasScheme(baseUrl)) {
        throw new Error(writeBaseUrlMustBeAbsolute({
          baseUrl: baseUrl,
          specifier: specifier
        }));
      }
    }

    if (hasScheme(specifier)) {
      return specifier;
    }

    if (!baseUrl) {
      throw new Error(writeBaseUrlRequired({
        baseUrl: baseUrl,
        specifier: specifier
      }));
    } // scheme relative


    if (specifier.slice(0, 2) === "//") {
      return "".concat(urlToScheme(baseUrl), ":").concat(specifier);
    } // origin relative


    if (specifier[0] === "/") {
      return "".concat(urlToOrigin(baseUrl)).concat(specifier);
    }

    var baseOrigin = urlToOrigin(baseUrl);
    var basePathname = urlToPathname(baseUrl);

    if (specifier === ".") {
      var baseDirectoryPathname = pathnameToParentPathname(basePathname);
      return "".concat(baseOrigin).concat(baseDirectoryPathname);
    } // pathname relative inside


    if (specifier.slice(0, 2) === "./") {
      var _baseDirectoryPathname = pathnameToParentPathname(basePathname);

      return "".concat(baseOrigin).concat(_baseDirectoryPathname).concat(specifier.slice(2));
    } // pathname relative outside


    if (specifier.slice(0, 3) === "../") {
      var unresolvedPathname = specifier;
      var importerFolders = basePathname.split("/");
      importerFolders.pop();

      while (unresolvedPathname.slice(0, 3) === "../") {
        unresolvedPathname = unresolvedPathname.slice(3); // when there is no folder left to resolved
        // we just ignore '../'

        if (importerFolders.length) {
          importerFolders.pop();
        }
      }

      var resolvedPathname = "".concat(importerFolders.join("/"), "/").concat(unresolvedPathname);
      return "".concat(baseOrigin).concat(resolvedPathname);
    } // bare


    if (basePathname === "") {
      return "".concat(baseOrigin, "/").concat(specifier);
    }

    if (basePathname[basePathname.length] === "/") {
      return "".concat(baseOrigin).concat(basePathname).concat(specifier);
    }

    return "".concat(baseOrigin).concat(pathnameToParentPathname(basePathname)).concat(specifier);
  };

  var writeBaseUrlMustBeAString = function writeBaseUrlMustBeAString(_ref) {
    var baseUrl = _ref.baseUrl,
        specifier = _ref.specifier;
    return "baseUrl must be a string.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBaseUrlMustBeAbsolute = function writeBaseUrlMustBeAbsolute(_ref2) {
    var baseUrl = _ref2.baseUrl,
        specifier = _ref2.specifier;
    return "baseUrl must be absolute.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBaseUrlRequired = function writeBaseUrlRequired(_ref3) {
    var baseUrl = _ref3.baseUrl,
        specifier = _ref3.specifier;
    return "baseUrl required to resolve relative specifier.\n--- base url ---\n".concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var tryUrlResolution = function tryUrlResolution(string, url) {
    var result = resolveUrl(string, url);
    return hasScheme(result) ? result : null;
  };

  var resolveSpecifier = function resolveSpecifier(specifier, importer) {
    if (specifier === "." || specifier[0] === "/" || specifier.startsWith("./") || specifier.startsWith("../")) {
      return resolveUrl(specifier, importer);
    }

    if (hasScheme(specifier)) {
      return specifier;
    }

    return null;
  };

  var sortImports = function sortImports(imports) {
    var importsSorted = {};
    Object.keys(imports).sort(compareLengthOrLocaleCompare).forEach(function (name) {
      importsSorted[name] = imports[name];
    });
    return importsSorted;
  };
  var sortScopes = function sortScopes(scopes) {
    var scopesSorted = {};
    Object.keys(scopes).sort(compareLengthOrLocaleCompare).forEach(function (scopeName) {
      scopesSorted[scopeName] = sortImports(scopes[scopeName]);
    });
    return scopesSorted;
  };

  var compareLengthOrLocaleCompare = function compareLengthOrLocaleCompare(a, b) {
    return b.length - a.length || a.localeCompare(b);
  };

  var normalizeImportMap = function normalizeImportMap(importMap, baseUrl) {
    assertImportMap(importMap);

    if (typeof baseUrl !== "string") {
      throw new TypeError(formulateBaseUrlMustBeAString({
        baseUrl: baseUrl
      }));
    }

    var imports = importMap.imports,
        scopes = importMap.scopes;
    return {
      imports: imports ? normalizeImports(imports, baseUrl) : undefined,
      scopes: scopes ? normalizeScopes(scopes, baseUrl) : undefined
    };
  };

  var normalizeImports = function normalizeImports(imports, baseUrl) {
    var importsNormalized = {};
    Object.keys(imports).forEach(function (specifier) {
      var address = imports[specifier];

      if (typeof address !== "string") {
        console.warn(formulateAddressMustBeAString({
          address: address,
          specifier: specifier
        }));
        return;
      }

      var specifierResolved = resolveSpecifier(specifier, baseUrl) || specifier;
      var addressUrl = tryUrlResolution(address, baseUrl);

      if (addressUrl === null) {
        console.warn(formulateAdressResolutionFailed({
          address: address,
          baseUrl: baseUrl,
          specifier: specifier
        }));
        return;
      }

      if (specifier.endsWith("/") && !addressUrl.endsWith("/")) {
        console.warn(formulateAddressUrlRequiresTrailingSlash({
          addressUrl: addressUrl,
          address: address,
          specifier: specifier
        }));
        return;
      }

      importsNormalized[specifierResolved] = addressUrl;
    });
    return sortImports(importsNormalized);
  };

  var normalizeScopes = function normalizeScopes(scopes, baseUrl) {
    var scopesNormalized = {};
    Object.keys(scopes).forEach(function (scope) {
      var scopeValue = scopes[scope];
      var scopeUrl = tryUrlResolution(scope, baseUrl);

      if (scopeUrl === null) {
        console.warn(formulateScopeResolutionFailed({
          scope: scope,
          baseUrl: baseUrl
        }));
        return;
      }

      var scopeValueNormalized = normalizeImports(scopeValue, baseUrl);
      scopesNormalized[scopeUrl] = scopeValueNormalized;
    });
    return sortScopes(scopesNormalized);
  };

  var formulateBaseUrlMustBeAString = function formulateBaseUrlMustBeAString(_ref) {
    var baseUrl = _ref.baseUrl;
    return "baseUrl must be a string.\n--- base url ---\n".concat(baseUrl);
  };

  var formulateAddressMustBeAString = function formulateAddressMustBeAString(_ref2) {
    var specifier = _ref2.specifier,
        address = _ref2.address;
    return "Address must be a string.\n--- address ---\n".concat(address, "\n--- specifier ---\n").concat(specifier);
  };

  var formulateAdressResolutionFailed = function formulateAdressResolutionFailed(_ref3) {
    var address = _ref3.address,
        baseUrl = _ref3.baseUrl,
        specifier = _ref3.specifier;
    return "Address url resolution failed.\n--- address ---\n".concat(address, "\n--- base url ---\n").concat(baseUrl, "\n--- specifier ---\n").concat(specifier);
  };

  var formulateAddressUrlRequiresTrailingSlash = function formulateAddressUrlRequiresTrailingSlash(_ref4) {
    var addressURL = _ref4.addressURL,
        address = _ref4.address,
        specifier = _ref4.specifier;
    return "Address must end with /.\n--- address url ---\n".concat(addressURL, "\n--- address ---\n").concat(address, "\n--- specifier ---\n").concat(specifier);
  };

  var formulateScopeResolutionFailed = function formulateScopeResolutionFailed(_ref5) {
    var scope = _ref5.scope,
        baseUrl = _ref5.baseUrl;
    return "Scope url resolution failed.\n--- scope ---\n".concat(scope, "\n--- base url ---\n").concat(baseUrl);
  };

  // https://developer.mozilla.org/en-US/docs/Glossary/Primitive
  var isComposite = function isComposite(value) {
    if (value === null) return false;

    var type = _typeof(value);

    if (type === "object") return true;
    if (type === "function") return true;
    return false;
  };

  var compositeWellKnownMap = new WeakMap();
  var primitiveWellKnownMap = new Map();
  var getCompositeGlobalPath = function getCompositeGlobalPath(value) {
    return compositeWellKnownMap.get(value);
  };
  var getPrimitiveGlobalPath = function getPrimitiveGlobalPath(value) {
    return primitiveWellKnownMap.get(value);
  };

  var visitGlobalObject = function visitGlobalObject(value) {
    var visitValue = function visitValue(value, path) {
      if (isComposite(value)) {
        if (compositeWellKnownMap.has(value)) return; // prevent infinite recursion

        compositeWellKnownMap.set(value, path);

        var visitProperty = function visitProperty(property) {
          var descriptor;

          try {
            descriptor = Object.getOwnPropertyDescriptor(value, property);
          } catch (e) {
            if (e.name === "SecurityError") {
              return;
            }

            throw e;
          }

          if (!descriptor) {
            // it's apparently possible to have getOwnPropertyNames returning
            // a property that later returns a null descriptor
            // for instance window.showModalDialog in webkit 13.0
            return;
          } // do not trigger getter/setter


          if ("value" in descriptor) {
            var propertyValue = descriptor.value;
            visitValue(propertyValue, [].concat(_toConsumableArray(path), [property]));
          }
        };

        Object.getOwnPropertyNames(value).forEach(function (name) {
          return visitProperty(name);
        });
        Object.getOwnPropertySymbols(value).forEach(function (symbol) {
          return visitProperty(symbol);
        });
      }

      primitiveWellKnownMap.set(value, path);
      return;
    };

    visitValue(value, []);
  };

  if ((typeof window === "undefined" ? "undefined" : _typeof(window)) === "object") visitGlobalObject(window);
  if ((typeof global === "undefined" ? "undefined" : _typeof(global)) === "object") visitGlobalObject(global);

  var decompose = function decompose(mainValue, _ref) {
    var functionAllowed = _ref.functionAllowed,
        prototypeStrict = _ref.prototypeStrict;
    var valueMap = {};
    var recipeArray = [];

    var valueToIdentifier = function valueToIdentifier(value) {
      var path = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

      if (!isComposite(value)) {
        var _existingIdentifier = identifierForPrimitive(value);

        if (_existingIdentifier !== undefined) return _existingIdentifier;

        var _identifier = identifierForNewValue(value);

        recipeArray[_identifier] = primitiveToRecipe(value);
        return _identifier;
      }

      if (typeof Promise === "function" && value instanceof Promise) throw new Error(createPromiseAreNotSupportedMessage({
        path: path
      }));
      if (typeof WeakSet === "function" && value instanceof WeakSet) throw new Error(createWeakSetAreNotSupportedMessage({
        path: path
      }));
      if (typeof WeakMap === "function" && value instanceof WeakMap) throw new Error(createWeakMapAreNotSupportedMessage({
        path: path
      }));
      if (typeof value === "function" && !functionAllowed) throw new Error(createForbiddenFunctionMessage({
        path: path
      }));
      var existingIdentifier = identifierForComposite(value);
      if (existingIdentifier !== undefined) return existingIdentifier;
      var identifier = identifierForNewValue(value);
      var compositeGlobalPath = getCompositeGlobalPath(value);

      if (compositeGlobalPath) {
        recipeArray[identifier] = createGlobalReferenceRecipe(compositeGlobalPath);
        return identifier;
      }

      var propertyDescriptionArray = [];
      Object.getOwnPropertyNames(value).forEach(function (propertyName) {
        var propertyDescriptor = Object.getOwnPropertyDescriptor(value, propertyName);
        var propertyNameIdentifier = valueToIdentifier(propertyName, [].concat(_toConsumableArray(path), [propertyName]));
        var propertyDescription = computePropertyDescription(propertyDescriptor, propertyName, path);
        propertyDescriptionArray.push({
          propertyNameIdentifier: propertyNameIdentifier,
          propertyDescription: propertyDescription
        });
      });
      var symbolDescriptionArray = [];
      Object.getOwnPropertySymbols(value).forEach(function (symbol) {
        var propertyDescriptor = Object.getOwnPropertyDescriptor(value, symbol);
        var symbolIdentifier = valueToIdentifier(symbol, [].concat(_toConsumableArray(path), ["[".concat(symbol.toString(), "]")]));
        var propertyDescription = computePropertyDescription(propertyDescriptor, symbol, path);
        symbolDescriptionArray.push({
          symbolIdentifier: symbolIdentifier,
          propertyDescription: propertyDescription
        });
      });
      var methodDescriptionArray = computeMethodDescriptionArray(value, path);
      var extensible = Object.isExtensible(value);
      recipeArray[identifier] = createCompositeRecipe({
        propertyDescriptionArray: propertyDescriptionArray,
        symbolDescriptionArray: symbolDescriptionArray,
        methodDescriptionArray: methodDescriptionArray,
        extensible: extensible
      });
      return identifier;
    };

    var computePropertyDescription = function computePropertyDescription(propertyDescriptor, propertyNameOrSymbol, path) {
      if (propertyDescriptor.set && !functionAllowed) throw new Error(createForbiddenPropertySetterMessage({
        path: path,
        propertyNameOrSymbol: propertyNameOrSymbol
      }));
      if (propertyDescriptor.get && !functionAllowed) throw new Error(createForbiddenPropertyGetterMessage({
        path: path,
        propertyNameOrSymbol: propertyNameOrSymbol
      }));
      return {
        configurable: propertyDescriptor.configurable,
        writable: propertyDescriptor.writable,
        enumerable: propertyDescriptor.enumerable,
        getIdentifier: "get" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.get, [].concat(_toConsumableArray(path), [String(propertyNameOrSymbol), "[[descriptor:get]]"])) : undefined,
        setIdentifier: "set" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.set, [].concat(_toConsumableArray(path), [String(propertyNameOrSymbol), "[[descriptor:set]]"])) : undefined,
        valueIdentifier: "value" in propertyDescriptor ? valueToIdentifier(propertyDescriptor.value, [].concat(_toConsumableArray(path), [String(propertyNameOrSymbol), "[[descriptor:value]]"])) : undefined
      };
    };

    var computeMethodDescriptionArray = function computeMethodDescriptionArray(value, path) {
      var methodDescriptionArray = [];

      if (typeof Set === "function" && value instanceof Set) {
        var callArray = [];
        value.forEach(function (entryValue, index) {
          var entryValueIdentifier = valueToIdentifier(entryValue, [].concat(_toConsumableArray(path), ["[[SetEntryValue]]", index]));
          callArray.push([entryValueIdentifier]);
        });
        methodDescriptionArray.push({
          methodNameIdentifier: valueToIdentifier("add"),
          callArray: callArray
        });
      }

      if (typeof Map === "function" && value instanceof Map) {
        var _callArray = [];
        value.forEach(function (entryValue, entryKey) {
          var entryKeyIdentifier = valueToIdentifier(entryKey, [].concat(_toConsumableArray(path), ["[[MapEntryKey]]", entryKey]));
          var entryValueIdentifier = valueToIdentifier(entryValue, [].concat(_toConsumableArray(path), ["[[MapEntryValue]]", entryValue]));

          _callArray.push([entryKeyIdentifier, entryValueIdentifier]);
        });
        methodDescriptionArray.push({
          methodNameIdentifier: valueToIdentifier("set"),
          callArray: _callArray
        });
      }

      return methodDescriptionArray;
    };

    var identifierForPrimitive = function identifierForPrimitive(value) {
      return Object.keys(valueMap).find(function (existingIdentifier) {
        var existingValue = valueMap[existingIdentifier];
        if (Object.is(value, existingValue)) return true;
        return value === existingValue;
      });
    };

    var identifierForComposite = function identifierForComposite(value) {
      return Object.keys(valueMap).find(function (existingIdentifier) {
        var existingValue = valueMap[existingIdentifier];
        return value === existingValue;
      });
    };

    var identifierForNewValue = function identifierForNewValue(value) {
      var identifier = nextIdentifier();
      valueMap[identifier] = value;
      return identifier;
    };

    var currentIdentifier = -1;

    var nextIdentifier = function nextIdentifier() {
      var identifier = String(parseInt(currentIdentifier) + 1);
      currentIdentifier = identifier;
      return identifier;
    };

    var mainIdentifier = valueToIdentifier(mainValue); // prototype, important to keep after the whole structure was visited
    // so that we discover if any prototype is part of the value

    var prototypeValueToIdentifier = function prototypeValueToIdentifier(prototypeValue) {
      // prototype is null
      if (prototypeValue === null) return valueToIdentifier(prototypeValue); // prototype found somewhere already

      var prototypeExistingIdentifier = identifierForComposite(prototypeValue);
      if (prototypeExistingIdentifier !== undefined) return prototypeExistingIdentifier; // mark prototype as visited

      var prototypeIdentifier = identifierForNewValue(prototypeValue); // prototype is a global reference ?

      var prototypeGlobalPath = getCompositeGlobalPath(prototypeValue);

      if (prototypeGlobalPath) {
        recipeArray[prototypeIdentifier] = createGlobalReferenceRecipe(prototypeGlobalPath);
        return prototypeIdentifier;
      } // otherwise prototype is unknown


      if (prototypeStrict) {
        throw new Error(createUnknownPrototypeMessage({
          prototypeValue: prototypeValue
        }));
      }

      return prototypeValueToIdentifier(Object.getPrototypeOf(prototypeValue));
    };

    var identifierForValueOf = function identifierForValueOf(value) {
      var path = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
      if (value instanceof Array) return valueToIdentifier(value.length, [].concat(_toConsumableArray(path), ["length"]));
      if ("valueOf" in value === false) return undefined;
      if (typeof value.valueOf !== "function") return undefined;
      var valueOfReturnValue = value.valueOf();
      if (!isComposite(valueOfReturnValue)) return valueToIdentifier(valueOfReturnValue, [].concat(_toConsumableArray(path), ["valueOf()"]));
      if (valueOfReturnValue === value) return undefined;
      throw new Error(createUnexpectedValueOfReturnValueMessage());
    };

    recipeArray.slice().forEach(function (recipe, index) {
      if (recipe.type === "composite") {
        var value = valueMap[index];

        if (typeof value === "function") {
          var valueOfIdentifier = nextIdentifier();
          recipeArray[valueOfIdentifier] = {
            type: "primitive",
            value: value
          };
          recipe.valueOfIdentifier = valueOfIdentifier;
          return;
        }

        if (value instanceof RegExp) {
          var _valueOfIdentifier = nextIdentifier();

          recipeArray[_valueOfIdentifier] = {
            type: "primitive",
            value: value
          };
          recipe.valueOfIdentifier = _valueOfIdentifier;
          return;
        } // valueOf, mandatory to uneval new Date(10) for instance.


        recipe.valueOfIdentifier = identifierForValueOf(value);
        var prototypeValue = Object.getPrototypeOf(value);
        recipe.prototypeIdentifier = prototypeValueToIdentifier(prototypeValue);
      }
    });
    return {
      recipeArray: recipeArray,
      mainIdentifier: mainIdentifier,
      valueMap: valueMap
    };
  };

  var primitiveToRecipe = function primitiveToRecipe(value) {
    if (_typeof(value) === "symbol") return symbolToRecipe(value);
    return createPimitiveRecipe(value);
  };

  var symbolToRecipe = function symbolToRecipe(symbol) {
    var globalSymbolKey = Symbol.keyFor(symbol);
    if (globalSymbolKey !== undefined) return createGlobalSymbolRecipe(globalSymbolKey);
    var symbolGlobalPath = getPrimitiveGlobalPath(symbol);
    if (!symbolGlobalPath) throw new Error(createUnknownSymbolMessage({
      symbol: symbol
    }));
    return createGlobalReferenceRecipe(symbolGlobalPath);
  };

  var createPimitiveRecipe = function createPimitiveRecipe(value) {
    return {
      type: "primitive",
      value: value
    };
  };

  var createGlobalReferenceRecipe = function createGlobalReferenceRecipe(path) {
    var recipe = {
      type: "global-reference",
      path: path
    };
    return recipe;
  };

  var createGlobalSymbolRecipe = function createGlobalSymbolRecipe(key) {
    return {
      type: "global-symbol",
      key: key
    };
  };

  var createCompositeRecipe = function createCompositeRecipe(_ref2) {
    var prototypeIdentifier = _ref2.prototypeIdentifier,
        valueOfIdentifier = _ref2.valueOfIdentifier,
        propertyDescriptionArray = _ref2.propertyDescriptionArray,
        symbolDescriptionArray = _ref2.symbolDescriptionArray,
        methodDescriptionArray = _ref2.methodDescriptionArray,
        extensible = _ref2.extensible;
    return {
      type: "composite",
      prototypeIdentifier: prototypeIdentifier,
      valueOfIdentifier: valueOfIdentifier,
      propertyDescriptionArray: propertyDescriptionArray,
      symbolDescriptionArray: symbolDescriptionArray,
      methodDescriptionArray: methodDescriptionArray,
      extensible: extensible
    };
  };

  var createPromiseAreNotSupportedMessage = function createPromiseAreNotSupportedMessage(_ref3) {
    var path = _ref3.path;
    if (path.length === 0) return "promise are not supported.";
    return "promise are not supported.\npromise found at: ".concat(path.join(""));
  };

  var createWeakSetAreNotSupportedMessage = function createWeakSetAreNotSupportedMessage(_ref4) {
    var path = _ref4.path;
    if (path.length === 0) return "weakSet are not supported.";
    return "weakSet are not supported.\nweakSet found at: ".concat(path.join(""));
  };

  var createWeakMapAreNotSupportedMessage = function createWeakMapAreNotSupportedMessage(_ref5) {
    var path = _ref5.path;
    if (path.length === 0) return "weakMap are not supported.";
    return "weakMap are not supported.\nweakMap found at: ".concat(path.join(""));
  };

  var createForbiddenFunctionMessage = function createForbiddenFunctionMessage(_ref6) {
    var path = _ref6.path;
    if (path.length === 0) return "function are not allowed.";
    return "function are not allowed.\nfunction found at: ".concat(path.join(""));
  };

  var createForbiddenPropertyGetterMessage = function createForbiddenPropertyGetterMessage(_ref7) {
    var path = _ref7.path,
        propertyNameOrSymbol = _ref7.propertyNameOrSymbol;
    return "property getter are not allowed.\ngetter found on property: ".concat(String(propertyNameOrSymbol), "\nat: ").concat(path.join(""));
  };

  var createForbiddenPropertySetterMessage = function createForbiddenPropertySetterMessage(_ref8) {
    var path = _ref8.path,
        propertyNameOrSymbol = _ref8.propertyNameOrSymbol;
    return "property setter are not allowed.\nsetter found on property: ".concat(String(propertyNameOrSymbol), "\nat: ").concat(path.join(""));
  };

  var createUnexpectedValueOfReturnValueMessage = function createUnexpectedValueOfReturnValueMessage() {
    return "valueOf() must return a primitive of the object itself.";
  };

  var createUnknownSymbolMessage = function createUnknownSymbolMessage(_ref9) {
    var symbol = _ref9.symbol;
    return "symbol must be global, like Symbol.iterator, or created using Symbol.for().\nsymbol: ".concat(symbol.toString());
  };

  var createUnknownPrototypeMessage = function createUnknownPrototypeMessage(_ref10) {
    var prototypeValue = _ref10.prototypeValue;
    return "prototype must be global, like Object.prototype, or somewhere in the value.\nprototype constructor name: ".concat(prototypeValue.constructor.name);
  };

  // be carefull because this function is mutating recipe objects inside the recipeArray.
  // this is not an issue because each recipe object is not accessible from the outside
  // when used internally by uneval
  var sortRecipe = function sortRecipe(recipeArray) {
    var findInRecipePrototypeChain = function findInRecipePrototypeChain(recipe, callback) {
      var currentRecipe = recipe; // eslint-disable-next-line no-constant-condition

      while (true) {
        if (currentRecipe.type !== "composite") break;
        var prototypeIdentifier = currentRecipe.prototypeIdentifier;
        if (prototypeIdentifier === undefined) break;
        currentRecipe = recipeArray[prototypeIdentifier];
        if (callback(currentRecipe, prototypeIdentifier)) return prototypeIdentifier;
      }

      return undefined;
    };

    var recipeArrayOrdered = recipeArray.slice();
    recipeArrayOrdered.sort(function (leftRecipe, rightRecipe) {
      var leftType = leftRecipe.type;
      var rightType = rightRecipe.type;

      if (leftType === "composite" && rightType === "composite") {
        var rightRecipeIsInLeftRecipePrototypeChain = findInRecipePrototypeChain(leftRecipe, function (recipeCandidate) {
          return recipeCandidate === rightRecipe;
        }); // if left recipe requires right recipe, left must be after right

        if (rightRecipeIsInLeftRecipePrototypeChain) return 1;
        var leftRecipeIsInRightRecipePrototypeChain = findInRecipePrototypeChain(rightRecipe, function (recipeCandidate) {
          return recipeCandidate === leftRecipe;
        }); // if right recipe requires left recipe, right must be after left

        if (leftRecipeIsInRightRecipePrototypeChain) return -1;
      }

      if (leftType !== rightType) {
        // if left is a composite, left must be after right
        if (leftType === "composite") return 1; // if right is a composite, right must be after left

        if (rightType === "composite") return -1;
      }

      var leftIndex = recipeArray.indexOf(leftRecipe);
      var rightIndex = recipeArray.indexOf(rightRecipe); // left was before right, don't change that

      if (leftIndex < rightIndex) return -1; // right was after left, don't change that

      return 1;
    });
    return recipeArrayOrdered;
  };

  // https://github.com/joliss/js-string-escape/blob/master/index.js
  // http://javascript.crockford.com/remedial.html
  var escapeString = function escapeString(value) {
    var string = String(value);
    var i = 0;
    var j = string.length;
    var escapedString = "";

    while (i < j) {
      var char = string[i];
      var escapedChar = void 0;

      if (char === '"' || char === "'" || char === "\\") {
        escapedChar = "\\".concat(char);
      } else if (char === "\n") {
        escapedChar = "\\n";
      } else if (char === "\r") {
        escapedChar = "\\r";
      } else if (char === "\u2028") {
        escapedChar = "\\u2028";
      } else if (char === "\u2029") {
        escapedChar = "\\u2029";
      } else {
        escapedChar = char;
      }

      escapedString += escapedChar;
      i++;
    }

    return escapedString;
  };

  var uneval = function uneval(value) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$functionAllowed = _ref.functionAllowed,
        functionAllowed = _ref$functionAllowed === void 0 ? false : _ref$functionAllowed,
        _ref$prototypeStrict = _ref.prototypeStrict,
        prototypeStrict = _ref$prototypeStrict === void 0 ? false : _ref$prototypeStrict;

    var _decompose = decompose(value, {
      functionAllowed: functionAllowed,
      prototypeStrict: prototypeStrict
    }),
        recipeArray = _decompose.recipeArray,
        mainIdentifier = _decompose.mainIdentifier,
        valueMap = _decompose.valueMap;

    var recipeArraySorted = sortRecipe(recipeArray);
    var source = "(function () {\nvar globalObject\ntry {\n  globalObject = Function('return this')() || (42, eval)('this');\n} catch(e) {\n  globalObject = window;\n}\n\nfunction safeDefineProperty(object, propertyNameOrSymbol, descriptor) {\n  var currentDescriptor = Object.getOwnPropertyDescriptor(object, propertyNameOrSymbol);\n  if (currentDescriptor && !currentDescriptor.configurable) return\n  Object.defineProperty(object, propertyNameOrSymbol, descriptor)\n};\n";
    var variableNameMap = {};
    recipeArray.forEach(function (recipe, index) {
      var indexSorted = recipeArraySorted.indexOf(recipe);
      variableNameMap[index] = "_".concat(indexSorted);
    });

    var identifierToVariableName = function identifierToVariableName(identifier) {
      return variableNameMap[identifier];
    };

    var recipeToSetupSource = function recipeToSetupSource(recipe) {
      if (recipe.type === "primitive") return primitiveRecipeToSetupSource(recipe);
      if (recipe.type === "global-symbol") return globalSymbolRecipeToSetupSource(recipe);
      if (recipe.type === "global-reference") return globalReferenceRecipeToSetupSource(recipe);
      return compositeRecipeToSetupSource(recipe);
    };

    var primitiveRecipeToSetupSource = function primitiveRecipeToSetupSource(_ref2) {
      var value = _ref2.value;
      if (typeof value === "string") return "\"".concat(escapeString(value), "\";");
      if (Object.is(value, -0)) return "-0;";
      return "".concat(String(value), ";");
    };

    var globalSymbolRecipeToSetupSource = function globalSymbolRecipeToSetupSource(recipe) {
      return "Symbol.for(\"".concat(escapeString(recipe.key), "\");");
    };

    var globalReferenceRecipeToSetupSource = function globalReferenceRecipeToSetupSource(recipe) {
      var pathSource = recipe.path.map(function (part) {
        return "[\"".concat(escapeString(part), "\"]");
      }).join("");
      return "globalObject".concat(pathSource, ";");
    };

    var compositeRecipeToSetupSource = function compositeRecipeToSetupSource(_ref3) {
      var prototypeIdentifier = _ref3.prototypeIdentifier,
          valueOfIdentifier = _ref3.valueOfIdentifier;
      if (prototypeIdentifier === undefined) return identifierToVariableName(valueOfIdentifier);
      var prototypeValue = valueMap[prototypeIdentifier];
      if (prototypeValue === null) return "Object.create(null);";
      var prototypeConstructor = prototypeValue.constructor;
      if (prototypeConstructor === Object) return "Object.create(".concat(identifierToVariableName(prototypeIdentifier), ");");
      if (valueOfIdentifier === undefined) return "new ".concat(prototypeConstructor.name, "();");
      return "new ".concat(prototypeConstructor.name, "(").concat(identifierToVariableName(valueOfIdentifier), ");");
    };

    recipeArraySorted.forEach(function (recipe) {
      var recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
      source += "var ".concat(recipeVariableName, " = ").concat(recipeToSetupSource(recipe), "\n");
    });

    var recipeToMutateSource = function recipeToMutateSource(recipe, recipeVariableName) {
      if (recipe.type === "composite") return compositeRecipeToMutateSource(recipe, recipeVariableName);
      return "";
    };

    var compositeRecipeToMutateSource = function compositeRecipeToMutateSource(_ref4, recipeVariableName) {
      var propertyDescriptionArray = _ref4.propertyDescriptionArray,
          symbolDescriptionArray = _ref4.symbolDescriptionArray,
          methodDescriptionArray = _ref4.methodDescriptionArray,
          extensible = _ref4.extensible;
      var mutateSource = "";
      propertyDescriptionArray.forEach(function (_ref5) {
        var propertyNameIdentifier = _ref5.propertyNameIdentifier,
            propertyDescription = _ref5.propertyDescription;
        mutateSource += generateDefinePropertySource(recipeVariableName, propertyNameIdentifier, propertyDescription);
      });
      symbolDescriptionArray.forEach(function (_ref6) {
        var symbolIdentifier = _ref6.symbolIdentifier,
            propertyDescription = _ref6.propertyDescription;
        mutateSource += generateDefinePropertySource(recipeVariableName, symbolIdentifier, propertyDescription);
      });
      methodDescriptionArray.forEach(function (_ref7) {
        var methodNameIdentifier = _ref7.methodNameIdentifier,
            callArray = _ref7.callArray;
        mutateSource += generateMethodCallSource(recipeVariableName, methodNameIdentifier, callArray);
      });

      if (!extensible) {
        mutateSource += generatePreventExtensionSource(recipeVariableName);
      }

      return mutateSource;
    };

    var generateDefinePropertySource = function generateDefinePropertySource(recipeVariableName, propertyNameOrSymbolIdentifier, propertyDescription) {
      var propertyOrSymbolVariableName = identifierToVariableName(propertyNameOrSymbolIdentifier);
      var propertyDescriptorSource = generatePropertyDescriptorSource(propertyDescription);
      return "safeDefineProperty(".concat(recipeVariableName, ", ").concat(propertyOrSymbolVariableName, ", ").concat(propertyDescriptorSource, ");");
    };

    var generatePropertyDescriptorSource = function generatePropertyDescriptorSource(_ref8) {
      var configurable = _ref8.configurable,
          writable = _ref8.writable,
          enumerable = _ref8.enumerable,
          getIdentifier = _ref8.getIdentifier,
          setIdentifier = _ref8.setIdentifier,
          valueIdentifier = _ref8.valueIdentifier;

      if (valueIdentifier === undefined) {
        return "{\n  configurable: ".concat(configurable, ",\n  enumerable: ").concat(enumerable, ",\n  get: ").concat(getIdentifier === undefined ? undefined : identifierToVariableName(getIdentifier), ",\n  set: ").concat(setIdentifier === undefined ? undefined : identifierToVariableName(setIdentifier), ",\n}");
      }

      return "{\n  configurable: ".concat(configurable, ",\n  writable: ").concat(writable, ",\n  enumerable: ").concat(enumerable, ",\n  value: ").concat(valueIdentifier === undefined ? undefined : identifierToVariableName(valueIdentifier), "\n}");
    };

    var generateMethodCallSource = function generateMethodCallSource(recipeVariableName, methodNameIdentifier, callArray) {
      var methodCallSource = "";
      var methodVariableName = identifierToVariableName(methodNameIdentifier);
      callArray.forEach(function (argumentIdentifiers) {
        var argumentVariableNames = argumentIdentifiers.map(function (argumentIdentifier) {
          return identifierToVariableName(argumentIdentifier);
        });
        methodCallSource += "".concat(recipeVariableName, "[").concat(methodVariableName, "](").concat(argumentVariableNames.join(","), ");");
      });
      return methodCallSource;
    };

    var generatePreventExtensionSource = function generatePreventExtensionSource(recipeVariableName) {
      return "Object.preventExtensions(".concat(recipeVariableName, ");");
    };

    recipeArraySorted.forEach(function (recipe) {
      var recipeVariableName = identifierToVariableName(recipeArray.indexOf(recipe));
      source += "".concat(recipeToMutateSource(recipe, recipeVariableName));
    });
    source += "return ".concat(identifierToVariableName(mainIdentifier), "; })()");
    return source;
  };

  var memoize = function memoize(compute) {
    var memoized = false;
    var memoizedValue;

    var fnWithMemoization = function fnWithMemoization() {
      if (memoized) {
        return memoizedValue;
      } // if compute is recursive wait for it to be fully done before storing the lockValue
      // so set locked later


      memoizedValue = compute.apply(void 0, arguments);
      memoized = true;
      return memoizedValue;
    };

    fnWithMemoization.forget = function () {
      var value = memoizedValue;
      memoized = false;
      memoizedValue = undefined;
      return value;
    };

    return fnWithMemoization;
  };

  var pathnameToExtension = function pathnameToExtension(pathname) {
    var slashLastIndex = pathname.lastIndexOf("/");

    if (slashLastIndex !== -1) {
      pathname = pathname.slice(slashLastIndex + 1);
    }

    var dotLastIndex = pathname.lastIndexOf(".");
    if (dotLastIndex === -1) return ""; // if (dotLastIndex === pathname.length - 1) return ""

    return pathname.slice(dotLastIndex);
  };

  var applyImportMap = function applyImportMap(_ref) {
    var importMap = _ref.importMap,
        specifier = _ref.specifier,
        importer = _ref.importer;
    assertImportMap(importMap);

    if (typeof specifier !== "string") {
      throw new TypeError(writeSpecifierMustBeAString({
        specifier: specifier,
        importer: importer
      }));
    }

    if (importer) {
      if (typeof importer !== "string") {
        throw new TypeError(writeImporterMustBeAString({
          importer: importer,
          specifier: specifier
        }));
      }

      if (!hasScheme(importer)) {
        throw new Error(writeImporterMustBeAbsolute({
          importer: importer,
          specifier: specifier
        }));
      }
    }

    var specifierUrl = resolveSpecifier(specifier, importer);
    var specifierNormalized = specifierUrl || specifier;
    var scopes = importMap.scopes;

    if (scopes && importer) {
      var scopeKeyMatching = Object.keys(scopes).find(function (scopeKey) {
        return scopeKey === importer || specifierIsPrefixOf(scopeKey, importer);
      });

      if (scopeKeyMatching) {
        var scopeValue = scopes[scopeKeyMatching];
        var remappingFromScopeImports = applyImports(specifierNormalized, scopeValue);

        if (remappingFromScopeImports !== null) {
          return remappingFromScopeImports;
        }
      }
    }

    var imports = importMap.imports;

    if (imports) {
      var remappingFromImports = applyImports(specifierNormalized, imports);

      if (remappingFromImports !== null) {
        return remappingFromImports;
      }
    }

    if (specifierUrl) {
      return specifierUrl;
    }

    throw new Error(writeBareSpecifierMustBeRemapped({
      specifier: specifier,
      importer: importer
    }));
  };

  var applyImports = function applyImports(specifier, imports) {
    var importKeyArray = Object.keys(imports);
    var i = 0;

    while (i < importKeyArray.length) {
      var importKey = importKeyArray[i];
      i++;

      if (importKey === specifier) {
        var importValue = imports[importKey];
        return importValue;
      }

      if (specifierIsPrefixOf(importKey, specifier)) {
        var _importValue = imports[importKey];
        var afterImportKey = specifier.slice(importKey.length);
        return tryUrlResolution(afterImportKey, _importValue);
      }
    }

    return null;
  };

  var specifierIsPrefixOf = function specifierIsPrefixOf(specifierHref, href) {
    return specifierHref[specifierHref.length - 1] === "/" && href.startsWith(specifierHref);
  };

  var writeSpecifierMustBeAString = function writeSpecifierMustBeAString(_ref2) {
    var specifier = _ref2.specifier,
        importer = _ref2.importer;
    return "specifier must be a string.\n--- specifier ---\n".concat(specifier, "\n--- importer ---\n").concat(importer);
  };

  var writeImporterMustBeAString = function writeImporterMustBeAString(_ref3) {
    var importer = _ref3.importer,
        specifier = _ref3.specifier;
    return "importer must be a string.\n--- importer ---\n".concat(importer, "\n--- specifier ---\n").concat(specifier);
  };

  var writeImporterMustBeAbsolute = function writeImporterMustBeAbsolute(_ref4) {
    var importer = _ref4.importer,
        specifier = _ref4.specifier;
    return "importer must be an absolute url.\n--- importer ---\n".concat(importer, "\n--- specifier ---\n").concat(specifier);
  };

  var writeBareSpecifierMustBeRemapped = function writeBareSpecifierMustBeRemapped(_ref5) {
    var specifier = _ref5.specifier,
        importer = _ref5.importer;
    return "Unmapped bare specifier.\n--- specifier ---\n".concat(specifier, "\n--- importer ---\n").concat(importer);
  };

  var resolveImport = function resolveImport(_ref) {
    var specifier = _ref.specifier,
        importer = _ref.importer,
        importMap = _ref.importMap,
        _ref$defaultExtension = _ref.defaultExtension,
        defaultExtension = _ref$defaultExtension === void 0 ? true : _ref$defaultExtension;
    return applyDefaultExtension({
      url: importMap ? applyImportMap({
        importMap: importMap,
        specifier: specifier,
        importer: importer
      }) : resolveUrl(specifier, importer),
      importer: importer,
      defaultExtension: defaultExtension
    });
  };

  var applyDefaultExtension = function applyDefaultExtension(_ref2) {
    var url = _ref2.url,
        importer = _ref2.importer,
        defaultExtension = _ref2.defaultExtension;

    if (urlToPathname(url).endsWith("/")) {
      return url;
    }

    if (typeof defaultExtension === "string") {
      var extension = pathnameToExtension(url);

      if (extension === "") {
        return "".concat(url).concat(defaultExtension);
      }

      return url;
    }

    if (defaultExtension === true) {
      var _extension = pathnameToExtension(url);

      if (_extension === "" && importer) {
        var importerPathname = urlToPathname(importer);
        var importerExtension = pathnameToExtension(importerPathname);
        return "".concat(url).concat(importerExtension);
      }
    }

    return url;
  };

  /*
  * SJS 6.6.1
  * Minimal SystemJS Build
  */
  (function () {
    function errMsg(errCode, msg) {
      return (msg || "") + " (SystemJS https://git.io/JvFET#" + errCode + ")";
    }

    var hasSymbol = typeof Symbol !== 'undefined';
    var hasSelf = typeof self !== 'undefined';
    var hasDocument = typeof document !== 'undefined';
    var envGlobal = hasSelf ? self : global;
    var baseUrl;

    if (hasDocument) {
      var baseEl = document.querySelector('base[href]');
      if (baseEl) baseUrl = baseEl.href;
    }

    if (!baseUrl && typeof location !== 'undefined') {
      baseUrl = location.href.split('#')[0].split('?')[0];
      var lastSepIndex = baseUrl.lastIndexOf('/');
      if (lastSepIndex !== -1) baseUrl = baseUrl.slice(0, lastSepIndex + 1);
    }

    var backslashRegEx = /\\/g;

    function resolveIfNotPlainOrUrl(relUrl, parentUrl) {
      if (relUrl.indexOf('\\') !== -1) relUrl = relUrl.replace(backslashRegEx, '/'); // protocol-relative

      if (relUrl[0] === '/' && relUrl[1] === '/') {
        return parentUrl.slice(0, parentUrl.indexOf(':') + 1) + relUrl;
      } // relative-url
      else if (relUrl[0] === '.' && (relUrl[1] === '/' || relUrl[1] === '.' && (relUrl[2] === '/' || relUrl.length === 2 && (relUrl += '/')) || relUrl.length === 1 && (relUrl += '/')) || relUrl[0] === '/') {
          var parentProtocol = parentUrl.slice(0, parentUrl.indexOf(':') + 1); // Disabled, but these cases will give inconsistent results for deep backtracking
          //if (parentUrl[parentProtocol.length] !== '/')
          //  throw Error('Cannot resolve');
          // read pathname from parent URL
          // pathname taken to be part after leading "/"

          var pathname;

          if (parentUrl[parentProtocol.length + 1] === '/') {
            // resolving to a :// so we need to read out the auth and host
            if (parentProtocol !== 'file:') {
              pathname = parentUrl.slice(parentProtocol.length + 2);
              pathname = pathname.slice(pathname.indexOf('/') + 1);
            } else {
              pathname = parentUrl.slice(8);
            }
          } else {
            // resolving to :/ so pathname is the /... part
            pathname = parentUrl.slice(parentProtocol.length + (parentUrl[parentProtocol.length] === '/'));
          }

          if (relUrl[0] === '/') return parentUrl.slice(0, parentUrl.length - pathname.length - 1) + relUrl; // join together and split for removal of .. and . segments
          // looping the string instead of anything fancy for perf reasons
          // '../../../../../z' resolved to 'x/y' is just 'z'

          var segmented = pathname.slice(0, pathname.lastIndexOf('/') + 1) + relUrl;
          var output = [];
          var segmentIndex = -1;

          for (var i = 0; i < segmented.length; i++) {
            // busy reading a segment - only terminate on '/'
            if (segmentIndex !== -1) {
              if (segmented[i] === '/') {
                output.push(segmented.slice(segmentIndex, i + 1));
                segmentIndex = -1;
              }
            } // new segment - check if it is relative
            else if (segmented[i] === '.') {
                // ../ segment
                if (segmented[i + 1] === '.' && (segmented[i + 2] === '/' || i + 2 === segmented.length)) {
                  output.pop();
                  i += 2;
                } // ./ segment
                else if (segmented[i + 1] === '/' || i + 1 === segmented.length) {
                    i += 1;
                  } else {
                    // the start of a new segment as below
                    segmentIndex = i;
                  }
              } // it is the start of a new segment
              else {
                  segmentIndex = i;
                }
          } // finish reading out the last segment


          if (segmentIndex !== -1) output.push(segmented.slice(segmentIndex));
          return parentUrl.slice(0, parentUrl.length - pathname.length) + output.join('');
        }
    }
    /*
     * Import maps implementation
     *
     * To make lookups fast we pre-resolve the entire import map
     * and then match based on backtracked hash lookups
     *
     */


    function resolveUrl(relUrl, parentUrl) {
      return resolveIfNotPlainOrUrl(relUrl, parentUrl) || (relUrl.indexOf(':') !== -1 ? relUrl : resolveIfNotPlainOrUrl('./' + relUrl, parentUrl));
    }

    function resolveAndComposePackages(packages, outPackages, baseUrl, parentMap, parentUrl) {
      for (var p in packages) {
        var resolvedLhs = resolveIfNotPlainOrUrl(p, baseUrl) || p;
        var rhs = packages[p]; // package fallbacks not currently supported

        if (typeof rhs !== 'string') continue;
        var mapped = resolveImportMap(parentMap, resolveIfNotPlainOrUrl(rhs, baseUrl) || rhs, parentUrl);

        if (!mapped) {
          targetWarning('W1', p, rhs);
        } else outPackages[resolvedLhs] = mapped;
      }
    }

    function resolveAndComposeImportMap(json, baseUrl, outMap) {
      if (json.imports) resolveAndComposePackages(json.imports, outMap.imports, baseUrl, outMap, null);
      var u;

      for (u in json.scopes || {}) {
        var resolvedScope = resolveUrl(u, baseUrl);
        resolveAndComposePackages(json.scopes[u], outMap.scopes[resolvedScope] || (outMap.scopes[resolvedScope] = {}), baseUrl, outMap, resolvedScope);
      }

      for (u in json.depcache || {}) {
        outMap.depcache[resolveUrl(u, baseUrl)] = json.depcache[u];
      }

      for (u in json.integrity || {}) {
        outMap.integrity[resolveUrl(u, baseUrl)] = json.integrity[u];
      }
    }

    function getMatch(path, matchObj) {
      if (matchObj[path]) return path;
      var sepIndex = path.length;

      do {
        var segment = path.slice(0, sepIndex + 1);
        if (segment in matchObj) return segment;
      } while ((sepIndex = path.lastIndexOf('/', sepIndex - 1)) !== -1);
    }

    function applyPackages(id, packages) {
      var pkgName = getMatch(id, packages);

      if (pkgName) {
        var pkg = packages[pkgName];
        if (pkg === null) return;

        if (id.length > pkgName.length && pkg[pkg.length - 1] !== '/') {
          targetWarning('W2', pkgName, pkg);
        } else return pkg + id.slice(pkgName.length);
      }
    }

    function targetWarning(code, match, target, msg) {
      console.warn(errMsg(code, [target, match].join(', ')));
    }

    function resolveImportMap(importMap, resolvedOrPlain, parentUrl) {
      var scopes = importMap.scopes;
      var scopeUrl = parentUrl && getMatch(parentUrl, scopes);

      while (scopeUrl) {
        var packageResolution = applyPackages(resolvedOrPlain, scopes[scopeUrl]);
        if (packageResolution) return packageResolution;
        scopeUrl = getMatch(scopeUrl.slice(0, scopeUrl.lastIndexOf('/')), scopes);
      }

      return applyPackages(resolvedOrPlain, importMap.imports) || resolvedOrPlain.indexOf(':') !== -1 && resolvedOrPlain;
    }
    /*
     * SystemJS Core
     *
     * Provides
     * - System.import
     * - System.register support for
     *     live bindings, function hoisting through circular references,
     *     reexports, dynamic import, import.meta.url, top-level await
     * - System.getRegister to get the registration
     * - Symbol.toStringTag support in Module objects
     * - Hookable System.createContext to customize import.meta
     * - System.onload(err, id, deps) handler for tracing / hot-reloading
     *
     * Core comes with no System.prototype.resolve or
     * System.prototype.instantiate implementations
     */


    var toStringTag = hasSymbol && Symbol.toStringTag;
    var REGISTRY = hasSymbol ? Symbol() : '@';

    function SystemJS() {
      this[REGISTRY] = {};
    }

    var systemJSPrototype = SystemJS.prototype;

    systemJSPrototype.import = function (id, parentUrl) {
      var loader = this;
      return Promise.resolve(loader.prepareImport()).then(function () {
        return loader.resolve(id, parentUrl);
      }).then(function (id) {
        var load = getOrCreateLoad(loader, id);
        return load.C || topLevelLoad(loader, load);
      });
    }; // Hookable createContext function -> allowing eg custom import meta


    systemJSPrototype.createContext = function (parentId) {
      var loader = this;
      return {
        url: parentId,
        resolve: function resolve(id, parentUrl) {
          return Promise.resolve(loader.resolve(id, parentUrl || parentId));
        }
      };
    };

    function loadToId(load) {
      return load.id;
    }

    function triggerOnload(loader, load, err, isErrSource) {
      loader.onload(err, load.id, load.d && load.d.map(loadToId), !!isErrSource);
      if (err) throw err;
    }

    var lastRegister;

    systemJSPrototype.register = function (deps, declare) {
      lastRegister = [deps, declare];
    };
    /*
     * getRegister provides the last anonymous System.register call
     */


    systemJSPrototype.getRegister = function () {
      var _lastRegister = lastRegister;
      lastRegister = undefined;
      return _lastRegister;
    };

    function getOrCreateLoad(loader, id, firstParentUrl) {
      var load = loader[REGISTRY][id];
      if (load) return load;
      var importerSetters = [];
      var ns = Object.create(null);
      if (toStringTag) Object.defineProperty(ns, toStringTag, {
        value: 'Module'
      });
      var instantiatePromise = Promise.resolve().then(function () {
        return loader.instantiate(id, firstParentUrl);
      }).then(function (registration) {
        if (!registration) throw Error(errMsg(2, id));

        function _export(name, value) {
          // note if we have hoisted exports (including reexports)
          load.h = true;
          var changed = false;

          if (_typeof(name) !== 'object') {
            if (!(name in ns) || ns[name] !== value) {
              ns[name] = value;
              changed = true;
            }
          } else {
            for (var p in name) {
              var value = name[p];

              if (!(p in ns) || ns[p] !== value) {
                ns[p] = value;
                changed = true;
              }
            }

            if (name.__esModule) {
              ns.__esModule = name.__esModule;
            }
          }

          if (changed) for (var i = 0; i < importerSetters.length; i++) {
            var setter = importerSetters[i];
            if (setter) setter(ns);
          }
          return value;
        }

        var declared = registration[1](_export, registration[1].length === 2 ? {
          import: function _import(importId) {
            return loader.import(importId, id);
          },
          meta: loader.createContext(id)
        } : undefined);

        load.e = declared.execute || function () {};

        return [registration[0], declared.setters || []];
      });
      var linkPromise = instantiatePromise.then(function (instantiation) {
        return Promise.all(instantiation[0].map(function (dep, i) {
          var setter = instantiation[1][i];
          return Promise.resolve(loader.resolve(dep, id)).then(function (depId) {
            var depLoad = getOrCreateLoad(loader, depId, id); // depLoad.I may be undefined for already-evaluated

            return Promise.resolve(depLoad.I).then(function () {
              if (setter) {
                depLoad.i.push(setter); // only run early setters when there are hoisted exports of that module
                // the timing works here as pending hoisted export calls will trigger through importerSetters

                if (depLoad.h || !depLoad.I) setter(depLoad.n);
              }

              return depLoad;
            });
          });
        })).then(function (depLoads) {
          load.d = depLoads;
        }, !true);
      });
      linkPromise.catch(function (err) {
        load.e = null;
        load.er = err;
      }); // Capital letter = a promise function

      return load = loader[REGISTRY][id] = {
        id: id,
        // importerSetters, the setters functions registered to this dependency
        // we retain this to add more later
        i: importerSetters,
        // module namespace object
        n: ns,
        // instantiate
        I: instantiatePromise,
        // link
        L: linkPromise,
        // whether it has hoisted exports
        h: false,
        // On instantiate completion we have populated:
        // dependency load records
        d: undefined,
        // execution function
        // set to NULL immediately after execution (or on any failure) to indicate execution has happened
        // in such a case, C should be used, and E, I, L will be emptied
        e: undefined,
        // On execution we have populated:
        // the execution error if any
        er: undefined,
        // in the case of TLA, the execution promise
        E: undefined,
        // On execution, L, I, E cleared
        // Promise for top-level completion
        C: undefined
      };
    }

    function instantiateAll(loader, load, loaded) {
      if (!loaded[load.id]) {
        loaded[load.id] = true; // load.L may be undefined for already-instantiated

        return Promise.resolve(load.L).then(function () {
          return Promise.all(load.d.map(function (dep) {
            return instantiateAll(loader, dep, loaded);
          }));
        });
      }
    }

    function topLevelLoad(loader, load) {
      return load.C = instantiateAll(loader, load, {}).then(function () {
        return postOrderExec(loader, load, {});
      }).then(function () {
        return load.n;
      });
    } // the closest we can get to call(undefined)


    var nullContext = Object.freeze(Object.create(null)); // returns a promise if and only if a top-level await subgraph
    // throws on sync errors

    function postOrderExec(loader, load, seen) {
      if (seen[load.id]) return;
      seen[load.id] = true;

      if (!load.e) {
        if (load.er) throw load.er;
        if (load.E) return load.E;
        return;
      } // deps execute first, unless circular


      var depLoadPromises;
      load.d.forEach(function (depLoad) {
        try {
          var depLoadPromise = postOrderExec(loader, depLoad, seen);
          if (depLoadPromise) (depLoadPromises = depLoadPromises || []).push(depLoadPromise);
        } catch (err) {
          load.e = null;
          load.er = err;
          throw err;
        }
      });
      if (depLoadPromises) return Promise.all(depLoadPromises).then(doExec, function (err) {
        load.e = null;
        load.er = err;
        throw err;
      });
      return doExec();

      function doExec() {
        try {
          var execPromise = load.e.call(nullContext);

          if (execPromise) {
            execPromise = execPromise.then(function () {
              load.C = load.n;
              load.E = null; // indicates completion

              if (!true) ;
            }, function (err) {
              load.er = err;
              load.E = null;
              if (!true) ;else throw err;
            });
            return load.E = load.E || execPromise;
          } // (should be a promise, but a minify optimization to leave out Promise.resolve)


          load.C = load.n;
          if (!true) ;
        } catch (err) {
          load.er = err;
          throw err;
        } finally {
          load.L = load.I = undefined;
          load.e = null;
        }
      }
    }

    envGlobal.System = new SystemJS();
    /*
     * SystemJS browser attachments for script and import map processing
     */

    var importMapPromise = Promise.resolve();
    var importMap = {
      imports: {},
      scopes: {},
      depcache: {},
      integrity: {}
    }; // Scripts are processed immediately, on the first System.import, and on DOMReady.
    // Import map scripts are processed only once (by being marked) and in order for each phase.
    // This is to avoid using DOM mutation observers in core, although that would be an alternative.

    var processFirst = hasDocument;

    systemJSPrototype.prepareImport = function (doProcessScripts) {
      if (processFirst || doProcessScripts) {
        processScripts();
        processFirst = false;
      }

      return importMapPromise;
    };

    if (hasDocument) {
      processScripts();
      window.addEventListener('DOMContentLoaded', processScripts);
    }

    function processScripts() {
      [].forEach.call(document.querySelectorAll('script'), function (script) {
        if (script.sp) // sp marker = systemjs processed
          return; // TODO: deprecate systemjs-module in next major now that we have auto import

        if (script.type === 'systemjs-module') {
          script.sp = true;
          if (!script.src) return;
          System.import(script.src.slice(0, 7) === 'import:' ? script.src.slice(7) : resolveUrl(script.src, baseUrl));
        } else if (script.type === 'systemjs-importmap') {
          script.sp = true;
          var fetchPromise = script.src ? fetch(script.src).then(function (res) {
            return res.text();
          }) : script.innerHTML;
          importMapPromise = importMapPromise.then(function () {
            return fetchPromise;
          }).then(function (text) {
            extendImportMap(importMap, text, script.src || baseUrl);
          });
        }
      });
    }

    function extendImportMap(importMap, newMapText, newMapUrl) {
      try {
        var newMap = JSON.parse(newMapText);
      } catch (err) {
        throw Error(errMsg(1));
      }

      resolveAndComposeImportMap(newMap, newMapUrl, importMap);
    }
    /*
     * Script instantiation loading
     */


    if (hasDocument) {
      window.addEventListener('error', function (evt) {
        lastWindowErrorUrl = evt.filename;
        lastWindowError = evt.error;
      });
      var baseOrigin = location.origin;
    }

    systemJSPrototype.createScript = function (url) {
      var script = document.createElement('script');
      script.async = true; // Only add cross origin for actual cross origin
      // this is because Safari triggers for all
      // - https://bugs.webkit.org/show_bug.cgi?id=171566

      if (url.indexOf(baseOrigin + '/')) script.crossOrigin = 'anonymous';
      var integrity = importMap.integrity[url];
      if (integrity) script.integrity = integrity;
      script.src = url;
      return script;
    }; // Auto imports -> script tags can be inlined directly for load phase


    var lastAutoImportDeps, lastAutoImportTimeout;
    var autoImportCandidates = {};
    var systemRegister = systemJSPrototype.register;

    systemJSPrototype.register = function (deps, declare) {
      if (hasDocument && document.readyState === 'loading' && typeof deps !== 'string') {
        var scripts = document.getElementsByTagName('script');
        var lastScript = scripts[scripts.length - 1];
        var url = lastScript && lastScript.src;

        if (url) {
          lastAutoImportDeps = deps; // if this is already a System load, then the instantiate has already begun
          // so this re-import has no consequence

          var loader = this;
          lastAutoImportTimeout = setTimeout(function () {
            autoImportCandidates[url] = [deps, declare];
            loader.import(url);
          });
        }
      } else {
        lastAutoImportDeps = undefined;
      }

      return systemRegister.call(this, deps, declare);
    };

    var lastWindowErrorUrl, lastWindowError;

    systemJSPrototype.instantiate = function (url, firstParentUrl) {
      var autoImportRegistration = autoImportCandidates[url];

      if (autoImportRegistration) {
        delete autoImportCandidates[url];
        return autoImportRegistration;
      }

      var loader = this;
      return new Promise(function (resolve, reject) {
        var script = systemJSPrototype.createScript(url);
        script.addEventListener('error', function () {
          reject(Error(errMsg(3, [url, firstParentUrl].join(', '))));
        });
        script.addEventListener('load', function () {
          document.head.removeChild(script); // Note that if an error occurs that isn't caught by this if statement,
          // that getRegister will return null and a "did not instantiate" error will be thrown.

          if (lastWindowErrorUrl === url) {
            reject(lastWindowError);
          } else {
            var register = loader.getRegister(); // Clear any auto import registration for dynamic import scripts during load

            if (register && register[0] === lastAutoImportDeps) clearTimeout(lastAutoImportTimeout);
            resolve(register);
          }
        });
        document.head.appendChild(script);
      });
    };

    systemJSPrototype.resolve = function (id, parentUrl) {
      parentUrl = parentUrl || !true || baseUrl;
      return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl) || throwUnresolved(id, parentUrl);
    };

    function throwUnresolved(id, parentUrl) {
      throw Error(errMsg(8, [id, parentUrl].join(', ')));
    }

    var systemInstantiate = systemJSPrototype.instantiate;

    systemJSPrototype.instantiate = function (url, firstParentUrl) {
      var preloads = importMap.depcache[url];

      if (preloads) {
        for (var i = 0; i < preloads.length; i++) {
          getOrCreateLoad(this, this.resolve(preloads[i], url), url);
        }
      }

      return systemInstantiate.call(this, url, firstParentUrl);
    };
    /*
     * Supports loading System.register in workers
     */


    if (hasSelf && typeof importScripts === 'function') systemJSPrototype.instantiate = function (url) {
      var loader = this;
      return Promise.resolve().then(function () {
        importScripts(url);
        return loader.getRegister();
      });
    };
  })();

  var valueInstall = function valueInstall(object, name, value) {
    var has = (name in object);
    var previous = object[name];
    object[name] = value;
    return function () {
      if (has) {
        object[name] = previous;
      } else {
        delete object[name];
      }
    };
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

  function _invoke(body, then) {
    var result = body();

    if (result && result.then) {
      return result.then(then);
    }

    return then(result);
  }

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

  var fromFunctionReturningNamespace = function fromFunctionReturningNamespace(fn, data) {
    return fromFunctionReturningRegisteredModule(function () {
      // should we compute the namespace here
      // or as it is done below, defer to execute ?
      // I think defer to execute is better
      return [[], function (_export) {
        return {
          execute: function execute() {
            var namespace = fn();

            _export(namespace);
          }
        };
      }];
    }, data);
  };

  var fromFunctionReturningRegisteredModule = function fromFunctionReturningRegisteredModule(fn, data) {
    try {
      return fn();
    } catch (error) {
      throw new Error("Module instantiation error.\n--- instantiation error stack ---\n".concat(error.stack).concat(getModuleDetails(data)));
    }
  };

  var fromUrl = _async(function (_ref) {
    var url = _ref.url,
        importerUrl = _ref.importerUrl,
        fetchSource = _ref.fetchSource,
        instantiateJavaScript = _ref.instantiateJavaScript,
        compileServerOrigin = _ref.compileServerOrigin,
        outDirectoryRelativeUrl = _ref.outDirectoryRelativeUrl;
    return _await(fetchSource(url, {
      importerUrl: importerUrl
    }), function (moduleResponse) {

      if (moduleResponse.status === 404) {
        throw new Error("Module file cannot be found.\n".concat(getModuleDetails({
          url: url,
          importerUrl: importerUrl,
          compileServerOrigin: compileServerOrigin,
          outDirectoryRelativeUrl: outDirectoryRelativeUrl,
          notFound: true
        })));
      }

      var contentType = moduleResponse.headers["content-type"] || "";
      return _invoke(function () {
        if (moduleResponse.status === 500 && contentType === "application/json") {
          return _await(moduleResponse.json(), function (bodyAsJson) {
            if (bodyAsJson.message && bodyAsJson.filename && "columnNumber" in bodyAsJson) {
              var error = new Error("Module file cannot be parsed.\n--- parsing error message ---\n".concat(bodyAsJson.message, "\n").concat(getModuleDetails({
                url: url,
                importerUrl: importerUrl,
                compileServerOrigin: compileServerOrigin,
                outDirectoryRelativeUrl: outDirectoryRelativeUrl
              })));
              error.parsingError = bodyAsJson;
              throw error;
            }
          });
        }
      }, function (_result) {
        var _exit2 = false;

        if (moduleResponse.status < 200 || moduleResponse.status >= 300) {
          throw new Error("Module file response status is unexpected.\n--- status ---\n".concat(moduleResponse.status, "\n--- allowed status\n200 to 299\n--- statusText ---\n").concat(moduleResponse.statusText, "\n").concat(getModuleDetails({
            url: url,
            importerUrl: importerUrl,
            compileServerOrigin: compileServerOrigin,
            outDirectoryRelativeUrl: outDirectoryRelativeUrl
          })));
        } // don't forget to keep it close to https://github.com/systemjs/systemjs/blob/9a15cfd3b7a9fab261e1848b1b2fa343d73afedb/src/extras/module-types.js#L21
        // and in sync with loadModule in createJsenvRollupPlugin.js


        return _invoke(function () {
          if (contentType === "application/javascript" || contentType === "text/javascript") {
            return _await(moduleResponse.text(), function (bodyAsText) {
              _exit2 = true;
              return fromFunctionReturningRegisteredModule(function () {
                return instantiateJavaScript(bodyAsText, moduleResponse.url);
              }, {
                url: moduleResponse.url,
                importerUrl: importerUrl,
                compileServerOrigin: compileServerOrigin,
                outDirectoryRelativeUrl: outDirectoryRelativeUrl
              });
            });
          }
        }, function (_result2) {
          var _exit3 = false;
          if (_exit2) return _result2;
          return _invoke(function () {
            if (contentType === "application/json" || contentType === "application/importmap+json") {
              return _await(moduleResponse.json(), function (bodyAsJson) {
                _exit3 = true;
                return fromFunctionReturningNamespace(function () {
                  return {
                    default: bodyAsJson
                  };
                }, {
                  url: moduleResponse.url,
                  importerUrl: importerUrl,
                  compileServerOrigin: compileServerOrigin,
                  outDirectoryRelativeUrl: outDirectoryRelativeUrl
                });
              });
            }
          }, function (_result3) {
            if (_exit3) return _result3;

            if (contentTypeShouldBeReadAsText(contentType)) {
              return fromFunctionReturningNamespace(function () {
                return {
                  default: moduleResponse.url
                };
              }, {
                url: moduleResponse.url,
                importerUrl: importerUrl,
                compileServerOrigin: compileServerOrigin,
                outDirectoryRelativeUrl: outDirectoryRelativeUrl
              });
            }

            if (contentType) ; else {
              console.warn("Module content-type is missing.\n--- allowed content-type ---\napplication/javascript\napplication/json\ntext/*\n".concat(getModuleDetails({
                url: url,
                importerUrl: importerUrl,
                compileServerOrigin: compileServerOrigin,
                outDirectoryRelativeUrl: outDirectoryRelativeUrl
              })));
            }

            return fromFunctionReturningNamespace(function () {
              return {
                default: moduleResponse.url
              };
            }, {
              url: moduleResponse.url,
              importerUrl: importerUrl,
              compileServerOrigin: compileServerOrigin,
              outDirectoryRelativeUrl: outDirectoryRelativeUrl
            });
          });
        });
      });
    });
  });

  var contentTypeShouldBeReadAsText = function contentTypeShouldBeReadAsText(contentType) {
    if (contentType.startsWith("text/")) {
      return true;
    }

    if (contentType === "image/svg+xml") {
      return true;
    }

    return false;
  }; // const textToBase64 =
  //   typeof window === "object"
  //     ? (text) => window.btoa(window.unescape(window.encodeURIComponent(text)))
  //     : (text) => Buffer.from(text, "utf8").toString("base64")


  var getModuleDetails = function getModuleDetails(_ref2) {
    var url = _ref2.url,
        importerUrl = _ref2.importerUrl,
        compileServerOrigin = _ref2.compileServerOrigin,
        outDirectoryRelativeUrl = _ref2.outDirectoryRelativeUrl,
        _ref2$notFound = _ref2.notFound,
        notFound = _ref2$notFound === void 0 ? false : _ref2$notFound;
    var relativeUrl = tryToFindProjectRelativeUrl(url, {
      compileServerOrigin: compileServerOrigin,
      outDirectoryRelativeUrl: outDirectoryRelativeUrl
    });
    var importerRelativeUrl = tryToFindProjectRelativeUrl(importerUrl, {
      compileServerOrigin: compileServerOrigin,
      outDirectoryRelativeUrl: outDirectoryRelativeUrl
    });
    var details = notFound ? _objectSpread(_objectSpread(_objectSpread({}, importerUrl ? _defineProperty({}, "import declared in", importerRelativeUrl || importerUrl) : {}), relativeUrl ? {
      file: relativeUrl
    } : {}), {}, _defineProperty({}, "file url", url)) : _objectSpread(_objectSpread({}, relativeUrl ? {
      file: relativeUrl
    } : {}), {}, _defineProperty({}, "file url", url), importerUrl ? _defineProperty({}, "imported by", importerRelativeUrl || importerUrl) : {});
    return Object.keys(details).map(function (key) {
      return "--- ".concat(key, " ---\n").concat(details[key]);
    }).join("\n");
  };

  var tryToFindProjectRelativeUrl = function tryToFindProjectRelativeUrl(url, _ref5) {
    var compileServerOrigin = _ref5.compileServerOrigin,
        outDirectoryRelativeUrl = _ref5.outDirectoryRelativeUrl;

    if (!url) {
      return null;
    }

    if (!url.startsWith("".concat(compileServerOrigin, "/"))) {
      return null;
    }

    if (url === compileServerOrigin) {
      return null;
    }

    var afterOrigin = url.slice("".concat(compileServerOrigin, "/").length);

    if (!afterOrigin.startsWith(outDirectoryRelativeUrl)) {
      return null;
    }

    var afterCompileDirectory = afterOrigin.slice(outDirectoryRelativeUrl.length);
    var nextSlashIndex = afterCompileDirectory.indexOf("/");

    if (nextSlashIndex === -1) {
      return null;
    }

    var afterCompileId = afterCompileDirectory.slice(nextSlashIndex + 1);
    return afterCompileId;
  };

  // eslint-disable-next-line no-eval
  var evalSource = function evalSource(code, href) {
    return window.eval(appendSourceURL(code, href));
  };

  var appendSourceURL = function appendSourceURL(code, sourceURL) {
    return "".concat(code, "\n", "//#", " sourceURL=").concat(sourceURL);
  };

  var GLOBAL_SPECIFIER = "global";
  var createBrowserSystem = function createBrowserSystem(_ref) {
    var compileServerOrigin = _ref.compileServerOrigin,
        outDirectoryRelativeUrl = _ref.outDirectoryRelativeUrl,
        importMap = _ref.importMap,
        importDefaultExtension = _ref.importDefaultExtension,
        fetchSource = _ref.fetchSource;

    if (typeof window.System === "undefined") {
      throw new Error("window.System is undefined");
    }

    var browserSystem = new window.System.constructor();

    var _resolve = function resolve(specifier) {
      var importer = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : document.location.href;
      if (specifier === GLOBAL_SPECIFIER) return specifier;
      return resolveImport({
        specifier: specifier,
        importer: importer,
        importMap: importMap,
        defaultExtension: importDefaultExtension
      });
    };

    browserSystem.resolve = _resolve;

    browserSystem.instantiate = function (url, importerUrl) {
      if (url === GLOBAL_SPECIFIER) {
        return fromFunctionReturningNamespace(function () {
          return window;
        }, {
          url: url,
          importerUrl: importerUrl,
          compileServerOrigin: compileServerOrigin,
          outDirectoryRelativeUrl: outDirectoryRelativeUrl
        });
      }

      return fromUrl({
        url: url,
        importerUrl: importerUrl,
        fetchSource: fetchSource,
        instantiateJavaScript: function instantiateJavaScript(source, responseUrl) {
          var uninstallSystemGlobal = valueInstall(window, "System", browserSystem);

          try {
            evalSource(source, responseUrl);
          } finally {
            uninstallSystemGlobal();
          }

          return browserSystem.getRegister();
        },
        compileServerOrigin: compileServerOrigin,
        outDirectoryRelativeUrl: outDirectoryRelativeUrl
      });
    };

    browserSystem.createContext = function (importerUrl) {
      return {
        url: importerUrl,
        resolve: function resolve(specifier) {
          return _resolve(specifier, importerUrl);
        }
      };
    };

    return browserSystem;
  };

  var displayErrorInDocument = function displayErrorInDocument(error) {
    var title = "An error occured";
    var theme;
    var message;

    if (error && error.parsingError) {
      theme = "light";
      var parsingError = error.parsingError;
      message = errorToHTML(parsingError.messageHTML || parsingError.message);
    } else {
      theme = "dark";
      message = errorToHTML(error);
    }

    var css = "\n    .jsenv-console pre {\n      overflow: auto;\n      /* avoid scrollbar to hide the text behind it */\n      padding-top: 20px;\n      padding-right: 20px;\n      padding-bottom: 20px;\n    }\n\n    .jsenv-console pre[data-theme=\"dark\"] {\n      background: transparent;\n      border: 1px solid black;\n    }\n\n    .jsenv-console pre[data-theme=\"light\"] {\n      background: #1E1E1E;\n      border: 1px solid white;\n      color: #EEEEEE;\n    }\n\n    .jsenv-console pre[data-theme=\"light\"] a {\n      color: inherit;\n    }\n    "; // it could be a sort of dialog on top of document with
    // a slight opacity
    // or it should replace what is inside the document.
    // To know what to do we must test with some code having UI
    // and ensure error are still visible

    var html = "\n      <style type=\"text/css\">".concat(css, "></style>\n      <div class=\"jsenv-console\">\n        <h1>").concat(title, "</h1>\n        <pre data-theme=\"").concat(theme, "\">").concat(message, "</pre>\n      </div>\n      ");
    appendHMTLInside(html, document.body);
  };

  var errorToHTML = function errorToHTML(error) {
    var html;

    if (error && error instanceof Error) {
      //  stackTrace formatted by V8
      if (Error.captureStackTrace) {
        html = error.stack;
      } else {
        // other stack trace such as firefox do not contain error.message
        html = "".concat(error.message, "\n  ").concat(error.stack);
      }
    } else if (typeof error === "string") {
      html = error;
    } else {
      html = JSON.stringify(error);
    }

    var htmlWithCorrectLineBreaks = html.replace(/\n/g, "\n");
    var htmlWithLinks = stringToStringWithLink(htmlWithCorrectLineBreaks, {
      transform: function transform(url) {
        return {
          href: url,
          text: url
        };
      }
    });
    return htmlWithLinks;
  }; // `Error: yo
  // at Object.execute (http://127.0.0.1:57300/build/src/__test__/file-throw.js:9:13)
  // at doExec (http://127.0.0.1:3000/src/__test__/file-throw.js:452:38)
  // at postOrderExec (http://127.0.0.1:3000/src/__test__/file-throw.js:448:16)
  // at http://127.0.0.1:3000/src/__test__/file-throw.js:399:18`.replace(/(?:https?|ftp|file):\/\/(.*+)$/gm, (...args) => {
  //   debugger
  // })


  var stringToStringWithLink = function stringToStringWithLink(source) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$transform = _ref.transform,
        transform = _ref$transform === void 0 ? function (url) {
      return {
        href: url,
        text: url
      };
    } : _ref$transform;

    return source.replace(/(?:https?|ftp|file):\/\/\S+/gm, function (match) {
      var linkHTML = "";
      var lastChar = match[match.length - 1]; // hotfix because our url regex sucks a bit

      var endsWithSeparationChar = lastChar === ")" || lastChar === ":";

      if (endsWithSeparationChar) {
        match = match.slice(0, -1);
      }

      var lineAndColumnPattern = /:([0-9]+):([0-9]+)$/;
      var lineAndColumMatch = match.match(lineAndColumnPattern);

      if (lineAndColumMatch) {
        var lineAndColumnString = lineAndColumMatch[0];
        var lineNumber = lineAndColumMatch[1];
        var columnNumber = lineAndColumMatch[2];
        var url = match.slice(0, -lineAndColumnString.length);

        var _transform = transform(url),
            href = _transform.href,
            text = _transform.text;

        linkHTML = link({
          href: href,
          text: "".concat(text, ":").concat(lineNumber, ":").concat(columnNumber)
        });
      } else {
        var linePattern = /:([0-9]+)$/;
        var lineMatch = match.match(linePattern);

        if (lineMatch) {
          var lineString = lineMatch[0];
          var _lineNumber = lineMatch[1];

          var _url = match.slice(0, -lineString.length);

          var _transform2 = transform(_url),
              _href = _transform2.href,
              _text = _transform2.text;

          linkHTML = link({
            href: _href,
            text: "".concat(_text, ":").concat(_lineNumber)
          });
        } else {
          var _url2 = match;

          var _transform3 = transform(_url2),
              _href2 = _transform3.href,
              _text2 = _transform3.text;

          linkHTML = link({
            href: _href2,
            text: _text2
          });
        }
      }

      if (endsWithSeparationChar) {
        return "".concat(linkHTML).concat(lastChar);
      }

      return linkHTML;
    });
  };

  var link = function link(_ref2) {
    var href = _ref2.href,
        _ref2$text = _ref2.text,
        text = _ref2$text === void 0 ? href : _ref2$text;
    return "<a href=\"".concat(href, "\">").concat(text, "</a>");
  };

  var appendHMTLInside = function appendHMTLInside(html, parentNode) {
    var temoraryParent = document.createElement("div");
    temoraryParent.innerHTML = html;
    transferChildren(temoraryParent, parentNode);
  };

  var transferChildren = function transferChildren(fromNode, toNode) {
    while (fromNode.firstChild) {
      toNode.appendChild(fromNode.firstChild);
    }
  };

  function _await$1(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  var _window = window,
      Notification = _window.Notification;

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

  var displayErrorNotificationNotAvailable = function displayErrorNotificationNotAvailable() {};

  var displayErrorNotificationImplementation = _async$1(function (error) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        icon = _ref.icon;

    return _await$1(Notification.requestPermission(), function (permission) {
      if (permission === "granted") {
        var notification = new Notification("An error occured", {
          lang: "en",
          body: error.stack,
          icon: icon
        });

        notification.onclick = function () {
          window.focus();
        };
      }
    });
  });

  var displayErrorNotification = typeof Notification === "function" ? displayErrorNotificationImplementation : displayErrorNotificationNotAvailable;

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

  // fallback to this polyfill (or even use an existing polyfill would be better)
  // https://github.com/github/fetch/blob/master/fetch.js

  function _await$2(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
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

  var fetchUsingXHR = _async$2(function (url) {
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
    return _await$2(headersPromise, function () {
      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/responseURL
      var responseUrl = "responseURL" in xhr ? xhr.responseURL : headers["x-request-url"];
      var responseStatus = xhr.status;
      var responseStatusText = xhr.statusText;
      var responseHeaders = getHeadersFromXHR(xhr);

      var readBody = function readBody() {
        return _await$2(bodyPromise, function () {
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
        return _call(readBody, function (_ref2) {
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
        return _call(text, JSON.parse);
      };

      var blob = _async$2(function () {
        if (!hasBlob) {
          throw new Error("blob not supported");
        }

        return _call(readBody, function (_ref3) {
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
        return _call(readBody, function (_ref4) {
          var responseBody = _ref4.responseBody,
              responseBodyType = _ref4.responseBodyType;
          return responseBodyType === "arrayBuffer" ? cloneBuffer(responseBody) : _call(blob, blobToArrayBuffer);
        });
      };

      var formData = _async$2(function () {
        if (!hasFormData) {
          throw new Error("formData not supported");
        }

        return _call(text, textToFormData);
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
    return new Error("error during xhr request on ".concat(url, ".\n--- error stack ---\n").concat(error.stack, "\n"));
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

  var blobToArrayBuffer = _async$2(function (blob) {
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

  function _await$3(value, then, direct) {
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
    return _continue(_catch(function () {
      return _await$3(window.fetch(url, _objectSpread({
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
      return  {
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

  function _await$4(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  var memoizedCreateBrowserSystem = memoize(createBrowserSystem);

  function _invoke$1(body, then) {
    var result = body();

    if (result && result.then) {
      return result.then(then);
    }

    return then(result);
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

  function _continue$1(value, then) {
    return value && value.then ? value.then(then) : then(value);
  }

  var createBrowserRuntime = _async$4(function (_ref) {
    var compileServerOrigin = _ref.compileServerOrigin,
        outDirectoryRelativeUrl = _ref.outDirectoryRelativeUrl,
        compileId = _ref.compileId,
        htmlFileRelativeUrl = _ref.htmlFileRelativeUrl;

    var fetchSource = function fetchSource(url) {
      return fetchUrl(url, {
        credentials: "include",
        headers: _objectSpread({}, htmlFileRelativeUrl ? {
          "x-jsenv-execution-id": htmlFileRelativeUrl
        } : {})
      });
    };

    var fetchJson = _async$4(function (url) {
      return _await$4(fetchSource(url), function (response) {
        return _await$4(response.json());
      });
    });

    var outDirectoryUrl = "".concat(compileServerOrigin, "/").concat(outDirectoryRelativeUrl);
    var envUrl = String(new URL("env.json", outDirectoryUrl));
    return _await$4(fetchJson(envUrl), function (_ref2) {
      var importDefaultExtension = _ref2.importDefaultExtension;
      var compileDirectoryRelativeUrl = "".concat(outDirectoryRelativeUrl).concat(compileId, "/"); // if there is an importmap in the document we should use it instead of fetching like this.
      // systemjs style with systemjs-importmap

      var importmapScript = document.querySelector("script[type=\"jsenv-importmap\"]");
      var importMap;
      return _invoke$1(function () {
        if (importmapScript) {
          var importmapRaw;
          var importmapFileUrl;
          return _invoke$1(function () {
            if (importmapScript.src) {
              importmapFileUrl = importmapScript.src;
              return _await$4(fetchSource(importmapFileUrl), function (importmapFileResponse) {
                var _temp = importmapFileResponse.status === 404;

                return _await$4(_temp ? {} : importmapFileResponse.json(), function (_importmapFileRespons) {
                  importmapRaw = _importmapFileRespons;
                }, _temp);
              });
            } else {
              importmapFileUrl = document.location.href;
              importmapRaw = JSON.parse(importmapScript.textContent) || {};
            }
          }, function () {
            importMap = normalizeImportMap(importmapRaw, importmapFileUrl);
          });
        }
      }, function () {
        var importFile = _async$4(function (specifier) {
          return _await$4(memoizedCreateBrowserSystem({
            compileServerOrigin: compileServerOrigin,
            outDirectoryRelativeUrl: outDirectoryRelativeUrl,
            importMap: importMap,
            importDefaultExtension: importDefaultExtension,
            fetchSource: fetchSource
          }), function (browserSystem) {
            return browserSystem.import(specifier);
          });
        });

        var executeFile = _async$4(function (specifier) {
          var _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
              _ref3$transferableNam = _ref3.transferableNamespace,
              transferableNamespace = _ref3$transferableNam === void 0 ? false : _ref3$transferableNam,
              _ref3$errorExposureIn = _ref3.errorExposureInConsole,
              errorExposureInConsole = _ref3$errorExposureIn === void 0 ? true : _ref3$errorExposureIn,
              _ref3$errorExposureIn2 = _ref3.errorExposureInNotification,
              errorExposureInNotification = _ref3$errorExposureIn2 === void 0 ? false : _ref3$errorExposureIn2,
              _ref3$errorExposureIn3 = _ref3.errorExposureInDocument,
              errorExposureInDocument = _ref3$errorExposureIn3 === void 0 ? true : _ref3$errorExposureIn3,
              _ref3$executionExposu = _ref3.executionExposureOnWindow,
              executionExposureOnWindow = _ref3$executionExposu === void 0 ? false : _ref3$executionExposu,
              _ref3$errorTransform = _ref3.errorTransform,
              errorTransform = _ref3$errorTransform === void 0 ? function (error) {
            return error;
          } : _ref3$errorTransform;

          return _await$4(memoizedCreateBrowserSystem({
            compileServerOrigin: compileServerOrigin,
            outDirectoryRelativeUrl: outDirectoryRelativeUrl,
            importMap: importMap,
            importDefaultExtension: importDefaultExtension,
            fetchSource: fetchSource
          }), function (browserSystem) {
            var executionResult;
            return _continue$1(_catch$1(function () {
              return _await$4(browserSystem.import(specifier), function (namespace) {
                if (transferableNamespace) {
                  namespace = makeNamespaceTransferable(namespace);
                }

                executionResult = {
                  status: "completed",
                  namespace: namespace,
                  coverageMap: readCoverage()
                };
              });
            }, function (error) {
              var transformedError;
              return _continue$1(_catch$1(function () {
                return _await$4(errorTransform(error), function (_errorTransform) {
                  transformedError = _errorTransform;
                });
              }, function () {
                transformedError = error;
              }), function () {
                if (errorExposureInConsole) displayErrorInConsole(transformedError);
                if (errorExposureInNotification) displayErrorNotification(transformedError);
                if (errorExposureInDocument) displayErrorInDocument(transformedError);
                executionResult = {
                  status: "errored",
                  exceptionSource: unevalException(transformedError),
                  coverageMap: readCoverage()
                };
              });
            }), function () {
              if (executionExposureOnWindow) {
                window.__executionResult__ = executionResult;
              }

              return executionResult;
            });
          });
        });

        return {
          compileDirectoryRelativeUrl: compileDirectoryRelativeUrl,
          importFile: importFile,
          executeFile: executeFile
        };
      });
    });
  });

  var makeNamespaceTransferable = function makeNamespaceTransferable(namespace) {
    var transferableNamespace = {};
    Object.keys(namespace).forEach(function (key) {
      var value = namespace[key];
      transferableNamespace[key] = isTransferable(value) ? value : hideNonTransferableValue(value);
    });
    return transferableNamespace;
  };

  var hideNonTransferableValue = function hideNonTransferableValue(value) {
    if (typeof value === "function") {
      return "[[HIDDEN: ".concat(value.name, " function cannot be transfered]]");
    }

    if (_typeof(value) === "symbol") {
      return "[[HIDDEN: symbol function cannot be transfered]]";
    }

    return "[[HIDDEN: ".concat(value.constructor ? value.constructor.name : "object", " cannot be transfered]]");
  }; // https://stackoverflow.com/a/32673910/2634179


  var isTransferable = function isTransferable(value) {
    var seenArray = [];

    var visit = function visit() {
      if (typeof value === "function") return false;
      if (_typeof(value) === "symbol") return false;
      if (value === null) return false;

      if (_typeof(value) === "object") {
        var constructorName = value.constructor.namespace;

        if (supportedTypes.includes(constructorName)) {
          return true;
        }

        var maybe = maybeTypes.includes(constructorName);

        if (maybe) {
          var visited = seenArray.includes(value);

          if (visited) {
            // we don't really know until we are done visiting the object
            // implementing it properly means waiting for the recursion to be done
            // let's just
            return true;
          }

          seenArray.push(value);

          if (constructorName === "Array" || constructorName === "Object") {
            return Object.keys(value).every(function (key) {
              return isTransferable(value[key]);
            });
          }

          if (constructorName === "Map") {
            return _toConsumableArray(value.keys()).every(isTransferable) && _toConsumableArray(value.values()).every(isTransferable);
          }

          if (constructorName === "Set") {
            return _toConsumableArray(value.keys()).every(isTransferable);
          }
        } // Error, DOM Node and others


        return false;
      }

      return true;
    };

    return visit();
  };

  var supportedTypes = ["Boolean", "Number", "String", "Date", "RegExp", "Blob", "FileList", "ImageData", "ImageBitmap", "ArrayBuffer"];
  var maybeTypes = ["Array", "Object", "Map", "Set"];

  var unevalException = function unevalException(value) {
    return uneval(value);
  };

  var readCoverage = function readCoverage() {
    return window.__coverage__;
  };

  var displayErrorInConsole = function displayErrorInConsole(error) {
    console.error(error);
  };

  var stackToString = function stackToString(stack, _ref) {
    var error = _ref.error,
        indent = _ref.indent;
    var name = error.name || "Error";
    var message = error.message || "";
    var stackString = stack.map(function (callSite) {
      return "\n".concat(indent, "at ").concat(callSite);
    }).join("");
    return "".concat(name, ": ").concat(message).concat(stackString);
  };

  var parseDataUrl = function parseDataUrl(dataUrl) {
    var afterDataProtocol = dataUrl.slice("data:".length);
    var commaIndex = afterDataProtocol.indexOf(",");
    var beforeComma = afterDataProtocol.slice(0, commaIndex);
    var mediaType;
    var base64Flag;

    if (beforeComma.endsWith(";base64")) {
      mediaType = beforeComma.slice(0, -";base64".length);
      base64Flag = true;
    } else {
      mediaType = beforeComma;
      base64Flag = false;
    }

    var afterComma = afterDataProtocol.slice(commaIndex + 1);
    return {
      mediaType: mediaType === "" ? "text/plain;charset=US-ASCII" : mediaType,
      base64Flag: base64Flag,
      data: afterComma
    };
  };
  var dataUrlToRawData = function dataUrlToRawData(_ref2) {
    var base64Flag = _ref2.base64Flag,
        data = _ref2.data;
    return base64Flag ? base64ToString(data) : data;
  };
  var dataToBase64 = (typeof window === "undefined" ? "undefined" : _typeof(window)) === "object" ? window.atob : function (data) {
    return Buffer.from(data).toString("base64");
  };
  var base64ToString = (typeof window === "undefined" ? "undefined" : _typeof(window)) === "object" ? window.btoa : function (base64String) {
    return Buffer.from(base64String, "base64").toString("utf8");
  };

  var getJavaScriptSourceMappingUrl = function getJavaScriptSourceMappingUrl(javaScriptSource) {
    var sourceMappingUrl;
    replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, function (value) {
      sourceMappingUrl = value;
    });
    return sourceMappingUrl;
  };
  var javascriptSourceMappingUrlCommentRegexp = /\/\/ ?# ?sourceMappingURL=([^\s'"]+)/g;

  var replaceSourceMappingUrl = function replaceSourceMappingUrl(source, regexp, callback) {
    var lastSourceMappingUrl;
    var matchSourceMappingUrl;

    while (matchSourceMappingUrl = regexp.exec(source)) {
      lastSourceMappingUrl = matchSourceMappingUrl;
    }

    if (lastSourceMappingUrl) {
      var index = lastSourceMappingUrl.index;
      var before = source.slice(0, index);
      var after = source.slice(index);
      var mappedAfter = after.replace(regexp, function (match, firstGroup) {
        return callback(firstGroup);
      });
      return "".concat(before).concat(mappedAfter);
    }

    return source;
  };

  var startsWithWindowsDriveLetter = function startsWithWindowsDriveLetter(string) {
    var firstChar = string[0];
    if (!/[a-zA-Z]/.test(firstChar)) return false;
    var secondChar = string[1];
    if (secondChar !== ":") return false;
    return true;
  };
  var windowsFilePathToUrl = function windowsFilePathToUrl(windowsFilePath) {
    return "file:///".concat(replaceBackSlashesWithSlashes(windowsFilePath));
  };
  var replaceBackSlashesWithSlashes = function replaceBackSlashesWithSlashes(string) {
    return string.replace(/\\/g, "/");
  };

  function _await$5(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _invoke$2(body, then) {
    var result = body();

    if (result && result.then) {
      return result.then(then);
    }

    return then(result);
  }

  function _async$5(f) {
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

  var remapCallSite = _async$5(function (callSite, _ref) {
    var _exit = false;
    var urlToSourcemapConsumer = _ref.urlToSourcemapConsumer,
        resolveFile = _ref.resolveFile,
        readErrorStack = _ref.readErrorStack,
        onFailure = _ref.onFailure;

    if (callSite.isNative()) {
      return callSite;
    } // Most call sites will return the source file from getFileName(), but code
    // passed to eval() ending in "//# sourceURL=..." will return the source file
    // from getScriptNameOrSourceURL() instead


    var source = callSite.getFileName() || callSite.getScriptNameOrSourceURL();
    return _invoke$2(function () {
      if (source) {
        var line = callSite.getLineNumber();
        var column = callSite.getColumnNumber() - 1;
        return _await$5(remapSourcePosition({
          source: source,
          line: line,
          column: column,
          resolveFile: resolveFile,
          urlToSourcemapConsumer: urlToSourcemapConsumer,
          readErrorStack: readErrorStack,
          onFailure: onFailure
        }), function (originalPosition) {
          var callSiteClone = cloneCallSite(callSite);

          callSiteClone.getFunctionName = function () {
            return originalPosition.name || callSite.getFunctionName();
          };

          callSiteClone.getFileName = function () {
            return originalPosition.source;
          };

          callSiteClone.getLineNumber = function () {
            return originalPosition.line;
          };

          callSiteClone.getColumnNumber = function () {
            return originalPosition.column + 1;
          };

          callSiteClone.getScriptNameOrSourceURL = function () {
            return originalPosition.source;
          };

          _exit = true;
          return callSiteClone;
        });
      }
    }, function (_result) {
      var _exit2 = false;
      if (_exit) return _result;
      // Code called using eval() needs special handling
      return _invoke$2(function () {
        if (callSite.isEval()) {
          var origin = callSite.getEvalOrigin();
          return _invoke$2(function () {
            if (origin) {
              var callSiteClone = cloneCallSite(callSite);
              return _await$5(remapEvalOrigin(origin, {
                resolveFile: resolveFile,
                urlToSourcemapConsumer: urlToSourcemapConsumer,
                readErrorStack: readErrorStack,
                onFailure: onFailure
              }), function (originalEvalOrigin) {
                callSiteClone.getEvalOrigin = function () {
                  return originalEvalOrigin;
                };

                _exit2 = true;
                return callSiteClone;
              });
            }
          }, function (_result2) {
            if (_exit2) return _result2;
            _exit2 = true;
            return callSite;
          });
        }
      }, function (_result3) {
        return _exit2 ? _result3 : callSite;
      }); // If we get here then we were unable to change the source position
    });
  });

  var cloneCallSite = function cloneCallSite(callSite) {
    var callSiteClone = {};
    methods.forEach(function (name) {
      callSiteClone[name] = function () {
        return callSite[name]();
      };
    });

    callSiteClone.toString = function () {
      return callSiteToFunctionCall(callSiteClone);
    };

    return callSiteClone;
  };

  var methods = ["getColumnNumber", "getEvalOrigin", "getFileName", "getFunction", "getFunctionName", "getLineNumber", "getMethodName", "getPosition", "getScriptNameOrSourceURL", "getThis", "getTypeName", "isConstructor", "isEval", "isNative", "isToplevel", "toString"];

  var callSiteToFunctionCall = function callSiteToFunctionCall(callSite) {
    var fileLocation = callSiteToFileLocation(callSite);
    var isConstructor = callSite.isConstructor();
    var isMethodCall = !callSite.isToplevel() && !isConstructor;

    if (isMethodCall) {
      return "".concat(callSiteToMethodCall(callSite), " (").concat(fileLocation, ")");
    }

    var functionName = callSite.getFunctionName();

    if (isConstructor) {
      return "new ".concat(functionName || "<anonymous>", " (").concat(fileLocation, ")");
    }

    if (functionName) {
      return "".concat(functionName, " (").concat(fileLocation, ")");
    }

    return "".concat(fileLocation);
  };

  var callSiteToMethodCall = function callSiteToMethodCall(callSite) {
    var functionName = callSite.getFunctionName();
    var typeName = callSiteToType(callSite);

    if (!functionName) {
      return "".concat(typeName, ".<anonymous>");
    }

    var methodName = callSite.getMethodName();
    var as = generateAs({
      methodName: methodName,
      functionName: functionName
    });

    if (typeName && !functionName.startsWith(typeName)) {
      return "".concat(typeName, ".").concat(functionName).concat(as);
    }

    return "".concat(functionName).concat(as);
  };

  var generateAs = function generateAs(_ref2) {
    var methodName = _ref2.methodName,
        functionName = _ref2.functionName;
    if (!methodName) return "";
    if (functionName.indexOf(".".concat(methodName)) === functionName.length - methodName.length - 1) return "";
    return " [as ".concat(methodName, "]");
  };

  var callSiteToType = function callSiteToType(callSite) {
    var typeName = callSite.getTypeName(); // Fixes shim to be backward compatible with Node v0 to v4

    if (typeName === "[object Object]") {
      return "null";
    }

    return typeName;
  };

  var callSiteToFileLocation = function callSiteToFileLocation(callSite) {
    if (callSite.isNative()) return "native";
    var sourceFile = callSiteToSourceFile(callSite);
    var lineNumber = callSite.getLineNumber();

    if (lineNumber === null) {
      return sourceFile;
    }

    var columnNumber = callSite.getColumnNumber();

    if (!columnNumber) {
      return "".concat(sourceFile, ":").concat(lineNumber);
    }

    return "".concat(sourceFile, ":").concat(lineNumber, ":").concat(columnNumber);
  };

  var callSiteToSourceFile = function callSiteToSourceFile(callSite) {
    var fileName = callSite.getScriptNameOrSourceURL();

    if (fileName) {
      return fileName;
    } // Source code does not originate from a file and is not native, but we
    // can still get the source position inside the source string, e.g. in
    // an eval string.


    if (callSite.isEval()) {
      return "".concat(callSite.getEvalOrigin(), ", <anonymous>");
    }

    return "<anonymous>";
  }; // Parses code generated by FormatEvalOrigin(), a function inside V8:
  // https://code.google.com/p/v8/source/browse/trunk/src/messages.js


  var remapEvalOrigin = _async$5(function (origin, _ref3) {
    var _exit3 = false;
    var resolveFile = _ref3.resolveFile,
        urlToSourcemapConsumer = _ref3.urlToSourcemapConsumer,
        onFailure = _ref3.onFailure;
    // Most eval() calls are in this format
    var topLevelEvalMatch = /^eval at ([^(]+) \((.+):(\d+):(\d+)\)$/.exec(origin);
    return _invoke$2(function () {
      if (topLevelEvalMatch) {
        var source = topLevelEvalMatch[2];
        var line = Number(topLevelEvalMatch[3]);
        var column = topLevelEvalMatch[4] - 1;
        return _await$5(remapSourcePosition({
          source: source,
          line: line,
          column: column,
          resolveFile: resolveFile,
          urlToSourcemapConsumer: urlToSourcemapConsumer,
          onFailure: onFailure
        }), function (originalPosition) {
          _exit3 = true;
          return "eval at ".concat(topLevelEvalMatch[1], " (").concat(originalPosition.source, ":").concat(originalPosition.line, ":").concat(originalPosition.column + 1, ")");
        });
      }
    }, function (_result4) {
      var _exit4 = false;
      if (_exit3) return _result4;
      // Parse nested eval() calls using recursion
      var nestedEvalMatch = /^eval at ([^(]+) \((.+)\)$/.exec(origin);
      return _invoke$2(function () {
        if (nestedEvalMatch) {
          return _await$5(remapEvalOrigin(nestedEvalMatch[2], {
            resolveFile: resolveFile,
            urlToSourcemapConsumer: urlToSourcemapConsumer,
            onFailure: onFailure
          }), function (originalEvalOrigin) {
            _exit4 = true;
            return "eval at ".concat(nestedEvalMatch[1], " (").concat(originalEvalOrigin, ")");
          });
        }
      }, function (_result5) {
        return _exit4 ? _result5 : origin;
      }); // Make sure we still return useful information if we didn't find anything
    });
  });

  var remapSourcePosition = _async$5(function (_ref4) {
    var source = _ref4.source,
        line = _ref4.line,
        column = _ref4.column,
        resolveFile = _ref4.resolveFile,
        urlToSourcemapConsumer = _ref4.urlToSourcemapConsumer,
        readErrorStack = _ref4.readErrorStack,
        onFailure = _ref4.onFailure;
    var position = {
      source: source,
      line: line,
      column: column
    };
    var url = sourceToUrl(source, {
      resolveFile: resolveFile
    });
    return url ? _await$5(urlToSourcemapConsumer(url), function (sourceMapConsumer) {
      if (!sourceMapConsumer) return position;

      try {
        var originalPosition = sourceMapConsumer.originalPositionFor(position); // Only return the original position if a matching line was found. If no
        // matching line is found then we return position instead, which will cause
        // the stack trace to print the path and line for the compiled file. It is
        // better to give a precise location in the compiled file than a vague
        // location in the original file.

        var originalSource = originalPosition.source;
        if (originalSource === null) return position;
        originalPosition.source = resolveFile(originalSource, url, {
          type: "file-original"
        });
        return originalPosition;
      } catch (e) {
        onFailure("error while remapping position.\n--- error stack ---\n".concat(readErrorStack(e), "\n--- source ---\n").concat(source, "\n--- line ---\n").concat(line, "\n--- column ---\n").concat(column));
        return position;
      }
    }) : position;
  });

  var sourceToUrl = function sourceToUrl(source, _ref5) {
    var resolveFile = _ref5.resolveFile;

    if (startsWithScheme(source)) {
      return source;
    } // linux filesystem path


    if (source[0] === "/") {
      return resolveFile(source);
    } // be careful, due to babel or something like that we might receive paths like
    // C:/directory/file.js (without backslashes we would expect on windows)
    // In that case we consider C: is the signe we are on windows
    // And I avoid to rely on process.platform === "win32" because this file might be executed in chrome


    if (startsWithWindowsDriveLetter(source)) {
      return windowsFilePathToUrl(source);
    } // I don't think we will ever encounter relative file in the stack trace
    // but if it ever happens we are safe :)


    if (source.slice(0, 2) === "./" || source.slice(0, 3) === "../") {
      return resolveFile(source);
    } // we have received a "bare specifier" for the source
    // it happens for internal/process/task_queues.js for instance
    // if we do return resolveFile(source) it will be converted to
    // file:///C:/project-directory/internal/process/task_queues.js in node
    // and
    // http://domain.com/internal/process/task_queues.js
    // but the file will certainly be a 404
    // and if not it won't be the right file anyway
    // for now we assume "bare specifier" in the stack trace
    // are internal files that are pointless to try to remap


    return null;
  };

  var startsWithScheme = function startsWithScheme(string) {
    return /^[a-zA-Z]{2,}:/.test(string);
  };

  function _await$6(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _catch$2(body, recover) {
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

  function _async$6(f) {
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

  function _invoke$3(body, then) {
    var result = body();

    if (result && result.then) {
      return result.then(then);
    }

    return then(result);
  }

  function _continue$2(value, then) {
    return value && value.then ? value.then(then) : then(value);
  }

  var generateOriginalStackString = _async$6(function (_ref) {
    var stack = _ref.stack,
        error = _ref.error,
        resolveFile = _ref.resolveFile,
        fetchFile = _ref.fetchFile,
        SourceMapConsumer = _ref.SourceMapConsumer,
        indent = _ref.indent,
        readErrorStack = _ref.readErrorStack,
        onFailure = _ref.onFailure;
    var urlToSourcemapConsumer = memoizeByFirstArgStringValue(_async$6(function (stackTraceFileUrl) {
      var _exit = false;
      return _catch$2(function () {
        var text;
        return _continue$2(_catch$2(function () {
          return _await$6(fetchFile(stackTraceFileUrl), function (fileResponse) {
            var status = fileResponse.status;

            if (status !== 200) {
              if (status === 404) {
                onFailure("stack trace file not found at ".concat(stackTraceFileUrl));
              } else {
                onFailure("unexpected response fetching stack trace file.\n--- response status ---\n".concat(status, "\n--- response text ---\n").concat(fileResponse.body, "\n--- stack trace file ---\n").concat(stackTraceFileUrl));
              }

              _exit = true;
              return null;
            }

            return _await$6(fileResponse.text(), function (_fileResponse$text) {
              text = _fileResponse$text;
            });
          });
        }, function (e) {
          onFailure("error while fetching stack trace file.\n--- fetch error stack ---\n".concat(readErrorStack(e), "\n--- stack trace file ---\n").concat(stackTraceFileUrl));
          _exit = true;
          return null;
        }), function (_result) {
          var _exit2 = false;
          if (_exit) return _result;
          var jsSourcemapUrl = getJavaScriptSourceMappingUrl(text);

          if (!jsSourcemapUrl) {
            return null;
          }

          var sourcemapUrl;
          var sourcemapString;
          return _invoke$3(function () {
            if (jsSourcemapUrl.startsWith("data:")) {
              sourcemapUrl = stackTraceFileUrl;
              sourcemapString = dataUrlToRawData(parseDataUrl(jsSourcemapUrl));
            } else {
              sourcemapUrl = resolveFile(jsSourcemapUrl, stackTraceFileUrl, {
                type: "source-map"
              });
              return _catch$2(function () {
                return _await$6(fetchFile(sourcemapUrl), function (sourcemapResponse) {
                  var _exit3 = false;
                  var status = sourcemapResponse.status;
                  return _invoke$3(function () {
                    if (status !== 200) {
                      return _invoke$3(function () {
                        if (status === 404) {
                          onFailure("sourcemap file not found at ".concat(sourcemapUrl));
                        } else {
                          return _await$6(sourcemapResponse.text(), function (_sourcemapResponse$te) {
                            onFailure("unexpected response for sourcemap file.\n--- response status ---\n".concat(status, "\n--- response text ---\n").concat(_sourcemapResponse$te, "\n--- sourcemap url ---\n").concat(sourcemapUrl));
                          });
                        }
                      }, function () {
                        _exit2 = true;
                        return null;
                      });
                    }
                  }, function (_result3) {
                    return _exit3 ? _result3 : _await$6(sourcemapResponse.text(), function (_sourcemapResponse$te2) {
                      sourcemapString = _sourcemapResponse$te2;
                    });
                  });
                });
              }, function (e) {
                onFailure("error while fetching sourcemap.\n--- fetch error stack ---\n".concat(readErrorStack(e), "\n--- sourcemap url ---\n").concat(sourcemapUrl));
                _exit2 = true;
                return null;
              });
            }
          }, function (_result4) {
            if (_exit2) return _result4;
            var sourceMap;

            try {
              sourceMap = JSON.parse(sourcemapString);
            } catch (e) {
              onFailure("error while parsing sourcemap.\n--- parse error stack ---\n".concat(readErrorStack(e), "\n--- sourcemap url ---\n").concat(sourcemapUrl));
              return null;
            }

            var _sourceMap = sourceMap,
                sourcesContent = _sourceMap.sourcesContent;

            if (!sourcesContent) {
              sourcesContent = [];
              sourceMap.sourcesContent = sourcesContent;
            }

            var firstSourceMapSourceFailure = null;
            return _await$6(Promise.all(sourceMap.sources.map(_async$6(function (source, index) {
              if (index in sourcesContent) return;
              var sourcemapSourceUrl = resolveFile(source, sourcemapUrl, {
                type: "source"
              });
              return _catch$2(function () {
                return _await$6(fetchFile(sourcemapSourceUrl), function (sourceResponse) {
                  var _exit4 = false;
                  var status = sourceResponse.status;
                  return _invoke$3(function () {
                    if (status !== 200) {
                      if (firstSourceMapSourceFailure) {
                        _exit4 = true;
                        return;
                      }

                      if (status === 404) {
                        firstSourceMapSourceFailure = "sourcemap source not found.\n--- sourcemap source url ---\n".concat(sourcemapSourceUrl, "\n--- sourcemap url ---\n").concat(sourcemapUrl);
                        _exit4 = true;
                        return;
                      }

                      return _await$6(sourceResponse.text(), function (_sourceResponse$text) {
                        firstSourceMapSourceFailure = "unexpected response for sourcemap source.\n  --- response status ---\n  ".concat(status, "\n  --- response text ---\n  ").concat(_sourceResponse$text, "\n  --- sourcemap source url ---\n  ").concat(sourcemapSourceUrl, "\n  --- sourcemap url ---\n  ").concat(sourcemapUrl);
                        _exit4 = true;
                      });
                    }
                  }, function (_result6) {
                    return _exit4 ? _result6 : _await$6(sourceResponse.text(), function (sourceString) {
                      sourcesContent[index] = sourceString;
                    });
                  });
                });
              }, function (e) {
                if (firstSourceMapSourceFailure) return;
                firstSourceMapSourceFailure = "error while fetching sourcemap source.\n--- fetch error stack ---\n".concat(readErrorStack(e), "\n--- sourcemap source url ---\n").concat(sourcemapSourceUrl, "\n--- sourcemap url ---\n").concat(sourcemapUrl);
              });
            }))), function () {
              if (firstSourceMapSourceFailure) {
                onFailure(firstSourceMapSourceFailure);
                return null;
              }

              return new SourceMapConsumer(sourceMap);
            });
          });
        });
      }, function (e) {
        onFailure("error while preparing a sourceMap consumer for a stack trace file.\n--- error stack ---\n".concat(readErrorStack(e), "\n--- stack trace file ---\n").concat(stackTraceFileUrl));
        return null;
      });
    }));
    return _catch$2(function () {
      return _await$6(Promise.all(stack.map(function (callSite) {
        return remapCallSite(callSite, {
          resolveFile: resolveFile,
          urlToSourcemapConsumer: urlToSourcemapConsumer,
          readErrorStack: readErrorStack,
          onFailure: onFailure
        });
      })), function (originalStack) {
        return stackToString(originalStack, {
          error: error,
          indent: indent
        });
      });
    }, function (e) {
      var unmappedStack = stackToString(stack, {
        error: error,
        indent: indent
      });
      onFailure("error while computing original stack.\n--- stack from error while computing ---\n".concat(readErrorStack(e), "\n--- stack from error to remap ---\n").concat(unmappedStack)); // in case of error return the non remapped stack

      return unmappedStack;
    });
  });

  var memoizeByFirstArgStringValue = function memoizeByFirstArgStringValue(fn) {
    var stringValueCache = {};
    return function (firstArgValue) {
      if (firstArgValue in stringValueCache) return stringValueCache[firstArgValue];
      var value = fn(firstArgValue);
      stringValueCache[firstArgValue] = value;
      return value;
    };
  };

  function _await$7(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _invoke$4(body, then) {
    var result = body();

    if (result && result.then) {
      return result.then(then);
    }

    return then(result);
  }

  function _async$7(f) {
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

  var installErrorStackRemapping = function installErrorStackRemapping(_ref) {
    var fetchFile = _ref.fetchFile,
        resolveFile = _ref.resolveFile,
        SourceMapConsumer = _ref.SourceMapConsumer,
        _ref$indent = _ref.indent,
        indent = _ref$indent === void 0 ? "  " : _ref$indent;

    if (typeof fetchFile !== "function") {
      throw new TypeError("fetchFile must be a function, got ".concat(fetchFile));
    }

    if (typeof SourceMapConsumer !== "function") {
      throw new TypeError("sourceMapConsumer must be a function, got ".concat(SourceMapConsumer));
    }

    if (typeof indent !== "string") {
      throw new TypeError("indent must be a string, got ".concat(indent));
    }

    var errorOriginalStackStringCache = new WeakMap();
    var errorRemapFailureCallbackMap = new WeakMap();
    var installed = false;
    var previousPrepareStackTrace = Error.prepareStackTrace;

    var install = function install() {
      if (installed) return;
      installed = true;
      Error.prepareStackTrace = prepareStackTrace;
    };

    var uninstall = function uninstall() {
      if (!installed) return;
      installed = false;
      Error.prepareStackTrace = previousPrepareStackTrace;
    }; // ensure we do not use prepareStackTrace for thoose error
    // otherwise we would recursively remap error stack
    // and if the reason causing the failure is still here
    // it would create an infinite loop


    var readErrorStack = function readErrorStack(error) {
      uninstall();
      var stack = error.stack;
      install();
      return stack;
    };

    var prepareStackTrace = function prepareStackTrace(error, stack) {
      var onFailure = function onFailure(failureData) {
        var failureCallbackArray = errorRemapFailureCallbackMap.get(error);

        if (failureCallbackArray) {
          failureCallbackArray.forEach(function (callback) {
            return callback(failureData);
          });
        }
      };

      var originalStackStringPromise = generateOriginalStackString({
        stack: stack,
        error: error,
        resolveFile: resolveFile,
        fetchFile: memoizeFetch(fetchFile),
        SourceMapConsumer: SourceMapConsumer,
        readErrorStack: readErrorStack,
        indent: indent,
        onFailure: onFailure
      });
      errorOriginalStackStringCache.set(error, originalStackStringPromise);
      return stackToString(stack, {
        error: error,
        indent: indent
      });
    };

    var getErrorOriginalStackString = _async$7(function (error) {
      var _exit = false;

      var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
          _ref2$onFailure = _ref2.onFailure,
          onFailure = _ref2$onFailure === void 0 ? function (message) {
        console.warn(message);
      } : _ref2$onFailure;

      if (onFailure) {
        var remapFailureCallbackArray = errorRemapFailureCallbackMap.get(error);

        if (remapFailureCallbackArray) {
          errorRemapFailureCallbackMap.set(error, [].concat(_toConsumableArray(remapFailureCallbackArray), [onFailure]));
        } else {
          errorRemapFailureCallbackMap.set(error, [onFailure]);
        }
      } // ensure Error.prepareStackTrace gets triggered by reading error.stack now


      var stack = error.stack;
      var promise = errorOriginalStackStringCache.get(error);
      return _invoke$4(function () {
        if (promise) {
          return _await$7(promise, function (originalStack) {
            errorRemapFailureCallbackMap.get(error);
            _exit = true;
            return originalStack;
          });
        }
      }, function (_result) {
        return _exit ? _result : stack;
      });
    });

    install();
    return {
      getErrorOriginalStackString: getErrorOriginalStackString,
      uninstall: uninstall
    };
  };

  var memoizeFetch = function memoizeFetch(fetchUrl) {
    var urlCache = {};
    return _async$7(function (url) {
      if (url in urlCache) {
        return urlCache[url];
      }

      var responsePromise = fetchUrl(url);
      urlCache[url] = responsePromise;
      return responsePromise;
    });
  };

  function _await$8(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _async$8(f) {
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

  var installBrowserErrorStackRemapping = function installBrowserErrorStackRemapping() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    return installErrorStackRemapping(_objectSpread({
      fetchFile: _async$8(function (url) {
        // browser having Error.captureStackTrace got window.fetch
        // and this executes only when Error.captureStackTrace exists
        // so no need for polyfill or whatever here
        return _await$8(window.fetch(url), function (response) {
          // we read response test before anything because once memoized fetch
          // gets annoying preventing you to read
          // body multiple times, even using response.clone()
          return _await$8(response.text(), function (_text) {
            return {
              status: response.status,
              url: response.url,
              statusText: response.statusText,
              headers: responseToHeaders$1(response),
              text: function text() {
                return _text;
              },
              json: response.json.bind(response),
              blob: response.blob.bind(response),
              arrayBuffer: response.arrayBuffer.bind(response)
            };
          });
        });
      }),
      resolveFile: function resolveFile(specifier) {
        var importer = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : window.location.href;
        // browsers having Error.captureStrackTrace got window.URL
        // and this executes only when Error.captureStackTrace exists
        return String(new window.URL(specifier, importer));
      }
    }, options));
  };

  var responseToHeaders$1 = function responseToHeaders(response) {
    var headers = {};
    response.headers.forEach(function (value, name) {
      headers[name] = value;
    });
    return headers;
  };

  function _await$9(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  function _async$9(f) {
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

  var fetchAndEvalUsingFetch = _async$9(function (url) {
    return _await$9(fetchUrl(url), function (response) {
      return function () {
        if (response.status >= 200 && response.status <= 299) {
          return _await$9(response.text(), function (text) {
            // eslint-disable-next-line no-eval
            window.eval(appendSourceURL$1(text, url));
          });
        } else {
          return _await$9(response.text(), function (text) {
            throw new Error("Unexpected response for script.\n--- script url ---\n".concat(url, "\n--- response body ---\n").concat(text, "\n--- response status ---\n").concat(response.status));
          });
        }
      }();
    });
  });

  var appendSourceURL$1 = function appendSourceURL(code, sourceURL) {
    return "".concat(code, "\n", "//#", " sourceURL=").concat(sourceURL);
  };

  function _await$a(value, then, direct) {
    if (direct) {
      return then ? then(value) : value;
    }

    if (!value || !value.then) {
      value = Promise.resolve(value);
    }

    return then ? value.then(then) : value;
  }

  var getNavigationStartTime = function getNavigationStartTime() {
    try {
      return window.performance.timing.navigationStart;
    } catch (e) {
      return Date.now();
    }
  };

  function _async$a(f) {
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

  var navigationStartTime = getNavigationStartTime();

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

  var readyPromise = new Promise(function (resolve) {
    if (document.readyState === "complete") {
      resolve();
    } else {
      var loadCallback = function loadCallback() {
        window.removeEventListener("load", loadCallback);
        resolve();
      };

      window.addEventListener("load", loadCallback);
    }
  });

  function _invoke$5(body, then) {
    var result = body();

    if (result && result.then) {
      return result.then(then);
    }

    return then(result);
  }

  var fileExecutionMap = {};
  var executionResultPromise = readyPromise.then(_async$a(function () {
    var fileExecutionResultMap = {};
    var fileExecutionResultPromises = [];
    var status = "completed";
    var exceptionSource = "";
    Object.keys(fileExecutionMap).forEach(function (key) {
      fileExecutionResultMap[key] = null; // to get always same order for Object.keys(executionResult)

      var fileExecutionResultPromise = fileExecutionMap[key];
      fileExecutionResultPromises.push(fileExecutionResultPromise);
      fileExecutionResultPromise.then(function (fileExecutionResult) {
        fileExecutionResultMap[key] = fileExecutionResult;

        if (fileExecutionResult.status === "errored") {
          status = "errored";
          exceptionSource = fileExecutionResult.exceptionSource;
        }
      });
    });
    return _await$a(Promise.all(fileExecutionResultPromises), function () {
      return _objectSpread(_objectSpread({
        status: status
      }, status === "errored" ? {
        exceptionSource: exceptionSource
      } : {}), {}, {
        startTime: navigationStartTime,
        endTime: Date.now(),
        fileExecutionResultMap: fileExecutionResultMap
      });
    });
  }));

  var importFile = function importFile(specifier) {
    // si on a déja importer ce fichier ??
    // if (specifier in fileExecutionMap) {
    // }
    var fileExecutionResultPromise = function () {
      return _call$1(getBrowserRuntime, function (browserRuntime) {
        return _await$a(browserRuntime.executeFile(specifier, {}));
      });
    }();

    fileExecutionMap[specifier] = fileExecutionResultPromise;
    return fileExecutionResultPromise;
  };

  var getBrowserRuntime = memoize(_async$a(function () {
    var compileServerOrigin = document.location.origin;
    return _await$a(fetchUrl("".concat(compileServerOrigin, "/.jsenv/compile-meta.json"), {
      headers: {
        "x-jsenv": true
      }
    }), function (compileMetaResponse) {
      return _await$a(compileMetaResponse.json(), function (compileMeta) {
        var outDirectoryRelativeUrl = compileMeta.outDirectoryRelativeUrl,
            errorStackRemapping = compileMeta.errorStackRemapping;
        var outDirectoryUrl = "".concat(compileServerOrigin, "/").concat(outDirectoryRelativeUrl);
        var afterOutDirectory = document.location.href.slice(outDirectoryUrl.length);
        var parts = afterOutDirectory.split("/");
        var compileId = parts[0];
        var remaining = parts.slice(1).join("/");
        var htmlFileRelativeUrl = remaining;
        return _await$a(createBrowserRuntime({
          compileServerOrigin: compileServerOrigin,
          outDirectoryRelativeUrl: outDirectoryRelativeUrl,
          compileId: compileId,
          htmlFileRelativeUrl: htmlFileRelativeUrl
        }), function (browserRuntime) {
          return _invoke$5(function () {
            if (errorStackRemapping && Error.captureStackTrace) {
              var sourcemapMainFileRelativeUrl = compileMeta.sourcemapMainFileRelativeUrl,
                  sourcemapMappingFileRelativeUrl = compileMeta.sourcemapMappingFileRelativeUrl;
              return _await$a(fetchAndEvalUsingFetch("".concat(compileServerOrigin, "/").concat(sourcemapMainFileRelativeUrl)), function () {
                var SourceMapConsumer = window.sourceMap.SourceMapConsumer;
                SourceMapConsumer.initialize({
                  "lib/mappings.wasm": "".concat(compileServerOrigin, "/").concat(sourcemapMappingFileRelativeUrl)
                });

                var _installBrowserErrorS = installBrowserErrorStackRemapping({
                  SourceMapConsumer: SourceMapConsumer
                }),
                    getErrorOriginalStackString = _installBrowserErrorS.getErrorOriginalStackString;

                var errorTransform = _async$a(function (error) {
                  return !error || !(error instanceof Error) ? error : _await$a(getErrorOriginalStackString(error), function (originalStack) {
                    error.stack = originalStack;
                    return error;
                  });
                });

                var executeFile = browserRuntime.executeFile;

                browserRuntime.executeFile = function (file) {
                  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
                  return executeFile(file, _objectSpread({
                    errorTransform: errorTransform
                  }, options));
                };
              });
            }
          }, function () {
            return browserRuntime;
          });
        });
      });
    });
  }));
  window.__jsenv__ = {
    executionResultPromise: executionResultPromise,
    importFile: importFile
  };

}());

//# sourceMappingURL=jsenv-browser-system.js.map