'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var logger = require('@jsenv/logger');
var cancellation = require('@jsenv/cancellation');
var util = require('@jsenv/util');
var fs = require('fs');
var server = require('@jsenv/server');
var module$1 = require('module');
var path = require('path');
var importMap = require('@jsenv/import-map');
var https = require('https');
var crypto = require('crypto');
var os = require('os');
var readline = require('readline');
var nodeSignals = require('@jsenv/node-signals');
var vm = require('vm');
var child_process = require('child_process');
var _uneval = require('@jsenv/uneval');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var readline__default = /*#__PURE__*/_interopDefaultLegacy(readline);

const executeJsenvAsyncFunction = fn => cancellation.executeAsyncFunction(fn, {
  catchCancellation: true,
  considerUnhandledRejectionsAsExceptions: true
});

const COMPILE_ID_BEST = "best";
const COMPILE_ID_OTHERWISE = "otherwise";
const COMPILE_ID_BUILD_GLOBAL = "otherwise-build-global";
const COMPILE_ID_BUILD_GLOBAL_FILES = "otherwise-build-global-files";
const COMPILE_ID_BUILD_COMMONJS = "otherwise-build-commonjs";
const COMPILE_ID_BUILD_COMMONJS_FILES = "otherwise-build-commonjs-files";

const assertProjectDirectoryUrl = ({
  projectDirectoryUrl
}) => {
  return util.assertAndNormalizeDirectoryUrl(projectDirectoryUrl);
};
const assertProjectDirectoryExists = ({
  projectDirectoryUrl
}) => {
  util.assertDirectoryPresence(projectDirectoryUrl);
};
const assertImportMapFileRelativeUrl = ({
  importMapFileRelativeUrl
}) => {
  if (importMapFileRelativeUrl === "") {
    throw new TypeError(`importMapFileRelativeUrl is an empty string`);
  }

  if (typeof importMapFileRelativeUrl !== "string") {
    throw new TypeError(`importMapFileRelativeUrl must be a string, received ${importMapFileRelativeUrl}`);
  }
};
const assertImportMapFileInsideProject = ({
  importMapFileUrl,
  projectDirectoryUrl
}) => {
  if (!util.urlIsInsideOf(importMapFileUrl, projectDirectoryUrl)) {
    throw new Error(logger.createDetailedMessage(`importmap file must be inside project directory`, {
      ["import map file url"]: importMapFileUrl,
      ["project directory url"]: projectDirectoryUrl
    }));
  }
};

/* global __filename */
const filenameContainsBackSlashes = __filename.indexOf("\\") > -1;
const url = filenameContainsBackSlashes ? `file:///${__filename.replace(/\\/g, "/")}` : `file://${__filename}`;

let jsenvCoreDirectoryUrl;

if (typeof __filename === "string") {
  jsenvCoreDirectoryUrl = util.resolveUrl( // get ride of dist/commonjs/main.js
  "../../", util.fileSystemPathToUrl(__filename));
} else {
  jsenvCoreDirectoryUrl = util.resolveUrl( // get ride of src/internal/jsenvCoreDirectoryUrl.js
  "../../", url);
}

// heavily inspired from https://github.com/jviide/babel-plugin-transform-replace-expressions
// last known commit: 57b608e0eeb8807db53d1c68292621dfafb5599c
const babelPluginReplaceExpressions = (api, options) => {
  const {
    traverse,
    parse,
    types
  } = api;
  const {
    replaceMap = {},
    allowConflictingReplacements = false
  } = options;
  const replacementMap = new Map();
  const valueExpressionSet = new Set();
  return {
    name: "transform-replace-expressions",
    pre: state => {
      // https://github.com/babel/babel/blob/d50e78d45b608f6e0f6cc33aeb22f5db5027b153/packages/babel-traverse/src/path/replacement.js#L93
      const parseExpression = value => {
        const expressionNode = parse(value, state.opts).program.body[0].expression;
        traverse.removeProperties(expressionNode);
        return expressionNode;
      };

      Object.keys(replaceMap).forEach(key => {
        const keyExpressionNode = parseExpression(key);
        const candidateArray = replacementMap.get(keyExpressionNode.type) || [];
        const value = replaceMap[key];
        const valueExpressionNode = parseExpression(value);
        const equivalentKeyExpressionIndex = candidateArray.findIndex(candidate => types.isNodesEquivalent(candidate.keyExpressionNode, keyExpressionNode));

        if (!allowConflictingReplacements && equivalentKeyExpressionIndex > -1) {
          throw new Error(`Expressions ${candidateArray[equivalentKeyExpressionIndex].key} and ${key} conflict`);
        }

        const newCandidate = {
          key,
          value,
          keyExpressionNode,
          valueExpressionNode
        };

        if (equivalentKeyExpressionIndex > -1) {
          candidateArray[equivalentKeyExpressionIndex] = newCandidate;
        } else {
          candidateArray.push(newCandidate);
        }

        replacementMap.set(keyExpressionNode.type, candidateArray);
      });
      replacementMap.forEach(candidateArray => {
        candidateArray.forEach(candidate => {
          valueExpressionSet.add(candidate.valueExpressionNode);
        });
      });
    },
    visitor: {
      Expression(path) {
        if (valueExpressionSet.has(path.node)) {
          path.skip();
          return;
        }

        const candidateArray = replacementMap.get(path.node.type);

        if (!candidateArray) {
          return;
        }

        const candidateFound = candidateArray.find(candidate => {
          return types.isNodesEquivalent(candidate.keyExpressionNode, path.node);
        });

        if (candidateFound) {
          try {
            types.validate(path.parent, path.key, candidateFound.valueExpressionNode);
          } catch (err) {
            if (!(err instanceof TypeError)) {
              throw err;
            }

            path.skip();
            return;
          }

          path.replaceWith(candidateFound.valueExpressionNode);
          return;
        }
      }

    }
  };
};

const valueToVersion = value => {
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

const numberToVersion = number => {
  return {
    major: number,
    minor: 0,
    patch: 0
  };
};

const stringToVersion = string => {
  if (string.indexOf(".") > -1) {
    const parts = string.split(".");
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

const createValueErrorMessage = ({
  value
}) => `value must be a number or a string.
value: ${value}`;

const versionCompare = (versionA, versionB) => {
  const semanticVersionA = valueToVersion(versionA);
  const semanticVersionB = valueToVersion(versionB);
  const majorDiff = semanticVersionA.major - semanticVersionB.major;

  if (majorDiff > 0) {
    return majorDiff;
  }

  if (majorDiff < 0) {
    return majorDiff;
  }

  const minorDiff = semanticVersionA.minor - semanticVersionB.minor;

  if (minorDiff > 0) {
    return minorDiff;
  }

  if (minorDiff < 0) {
    return minorDiff;
  }

  const patchDiff = semanticVersionA.patch - semanticVersionB.patch;

  if (patchDiff > 0) {
    return patchDiff;
  }

  if (patchDiff < 0) {
    return patchDiff;
  }

  return 0;
};

const versionIsBelow = (versionSupposedBelow, versionSupposedAbove) => {
  return versionCompare(versionSupposedBelow, versionSupposedAbove) < 0;
};

const findHighestVersion = (...values) => {
  if (values.length === 0) throw new Error(`missing argument`);
  return values.reduce((highestVersion, value) => {
    if (versionIsBelow(highestVersion, value)) {
      return value;
    }

    return highestVersion;
  });
};

// copied from
// https://github.com/babel/babel/blob/master/packages/babel-compat-data/data/plugins.json#L1
// now moved at https://github.com/babel/babel/blob/548cb3ee89552ffc08ee5625b084bd33f8107530/packages/babel-compat-data/data/plugins.json#L1
// Because this is an hidden implementation detail of @babel/preset-env
// it could be deprecated or moved anytime.
// For that reason it makes more sens to have it inlined here
// than importing it from an undocumented location.
// Ideally it would be documented or a separate module
const jsenvBabelPluginCompatMap = {
  "proposal-numeric-separator": {
    chrome: "75",
    edge: "79",
    firefox: "70",
    safari: "13",
    node: "12.5",
    ios: "13",
    opera: "62",
    electron: "6.1"
  },
  "proposal-nullish-coalescing-operator": {
    chrome: "80",
    edge: "80",
    firefox: "72",
    safari: "13.1",
    opera: "67",
    electron: "8.1"
  },
  "proposal-optional-chaining": {
    chrome: "80",
    edge: "80",
    firefox: "74",
    safari: "13.1",
    opera: "67",
    electron: "8.1"
  },
  "proposal-json-strings": {
    chrome: "66",
    edge: "79",
    firefox: "62",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "9",
    opera: "53",
    electron: "3.1"
  },
  "proposal-optional-catch-binding": {
    chrome: "66",
    edge: "79",
    firefox: "58",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    opera: "53",
    electron: "3.1"
  },
  "proposal-async-generator-functions": {
    chrome: "63",
    edge: "79",
    firefox: "57",
    safari: "12",
    node: "10",
    ios: "12",
    samsung: "8",
    opera: "50",
    electron: "3.1"
  },
  "proposal-object-rest-spread": {
    chrome: "60",
    edge: "79",
    firefox: "55",
    safari: "11.1",
    node: "8.3",
    ios: "11.3",
    samsung: "8",
    opera: "47",
    electron: "2.1"
  },
  "transform-dotall-regex": {
    chrome: "62",
    edge: "79",
    safari: "11.1",
    node: "8.10",
    ios: "11.3",
    samsung: "8",
    opera: "49",
    electron: "3.1"
  },
  "proposal-unicode-property-regex": {
    chrome: "64",
    edge: "79",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    opera: "51",
    electron: "3.1"
  },
  "transform-named-capturing-groups-regex": {
    chrome: "64",
    edge: "79",
    safari: "11.1",
    node: "10",
    ios: "11.3",
    samsung: "9",
    opera: "51",
    electron: "3.1"
  },
  // copy of transform-async-to-generator
  // so that async is not transpiled when supported
  "transform-async-to-promises": {
    chrome: "55",
    edge: "15",
    firefox: "52",
    safari: "11",
    node: "7.6",
    ios: "11",
    samsung: "6",
    opera: "42",
    electron: "1.6"
  },
  "transform-async-to-generator": {
    chrome: "55",
    edge: "15",
    firefox: "52",
    safari: "11",
    node: "7.6",
    ios: "11",
    samsung: "6",
    opera: "42",
    electron: "1.6"
  },
  "transform-exponentiation-operator": {
    chrome: "52",
    edge: "14",
    firefox: "52",
    safari: "10.1",
    node: "7",
    ios: "10.3",
    samsung: "6",
    opera: "39",
    electron: "1.3"
  },
  "transform-template-literals": {
    chrome: "41",
    edge: "13",
    firefox: "34",
    safari: "13",
    node: "4",
    ios: "13",
    samsung: "3.4",
    opera: "28",
    electron: "0.24"
  },
  "transform-literals": {
    chrome: "44",
    edge: "12",
    firefox: "53",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    opera: "31",
    electron: "0.31"
  },
  "transform-function-name": {
    chrome: "51",
    edge: "79",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    opera: "38",
    electron: "1.2"
  },
  "transform-arrow-functions": {
    chrome: "47",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    opera: "34",
    electron: "0.36"
  },
  "transform-block-scoped-functions": {
    chrome: "41",
    edge: "12",
    firefox: "46",
    safari: "10",
    node: "4",
    ie: "11",
    ios: "10",
    samsung: "3.4",
    opera: "28",
    electron: "0.24"
  },
  "transform-classes": {
    chrome: "46",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    opera: "33",
    electron: "0.36"
  },
  "transform-object-super": {
    chrome: "46",
    edge: "13",
    firefox: "45",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    opera: "33",
    electron: "0.36"
  },
  "transform-shorthand-properties": {
    chrome: "43",
    edge: "12",
    firefox: "33",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "4",
    opera: "30",
    electron: "0.29"
  },
  "transform-duplicate-keys": {
    chrome: "42",
    edge: "12",
    firefox: "34",
    safari: "9",
    node: "4",
    ios: "9",
    samsung: "3.4",
    opera: "29",
    electron: "0.27"
  },
  "transform-computed-properties": {
    chrome: "44",
    edge: "12",
    firefox: "34",
    safari: "7.1",
    node: "4",
    ios: "8",
    samsung: "4",
    opera: "31",
    electron: "0.31"
  },
  "transform-for-of": {
    chrome: "51",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    opera: "38",
    electron: "1.2"
  },
  "transform-sticky-regex": {
    chrome: "49",
    edge: "13",
    firefox: "3",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    opera: "36",
    electron: "1"
  },
  "transform-unicode-regex": {
    chrome: "50",
    edge: "13",
    firefox: "46",
    safari: "12",
    node: "6",
    ios: "12",
    samsung: "5",
    opera: "37",
    electron: "1.1"
  },
  "transform-spread": {
    chrome: "46",
    edge: "13",
    firefox: "36",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    opera: "33",
    electron: "0.36"
  },
  "transform-parameters": {
    chrome: "49",
    edge: "18",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    opera: "36",
    electron: "1"
  },
  "transform-destructuring": {
    chrome: "51",
    edge: "15",
    firefox: "53",
    safari: "10",
    node: "6.5",
    ios: "10",
    samsung: "5",
    opera: "38",
    electron: "1.2"
  },
  "transform-block-scoping": {
    chrome: "49",
    edge: "14",
    firefox: "51",
    safari: "11",
    node: "6",
    ios: "11",
    samsung: "5",
    opera: "36",
    electron: "1"
  },
  "transform-typeof-symbol": {
    chrome: "38",
    edge: "12",
    firefox: "36",
    safari: "9",
    node: "0.12",
    ios: "9",
    samsung: "3",
    opera: "25",
    electron: "0.2"
  },
  "transform-new-target": {
    chrome: "46",
    edge: "14",
    firefox: "41",
    safari: "10",
    node: "5",
    ios: "10",
    samsung: "5",
    opera: "33",
    electron: "0.36"
  },
  "transform-regenerator": {
    chrome: "50",
    edge: "13",
    firefox: "53",
    safari: "10",
    node: "6",
    ios: "10",
    samsung: "5",
    opera: "37",
    electron: "1.1"
  },
  "transform-member-expression-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "5"
  },
  "transform-property-literals": {
    chrome: "7",
    opera: "12",
    edge: "12",
    firefox: "2",
    safari: "5.1",
    node: "0.10",
    ie: "9",
    android: "4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "5"
  },
  "transform-reserved-words": {
    chrome: "13",
    opera: "10.50",
    edge: "12",
    firefox: "2",
    safari: "3.1",
    node: "0.10",
    ie: "9",
    android: "4.4",
    ios: "6",
    phantom: "2",
    samsung: "1",
    electron: "0.2"
  }
};

// we could reuse this to get a list of polyfill
// using https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/built-ins.json#L1
// adding a featureNameArray to every group
// and according to that featureNameArray, add these polyfill
// to the generated build
const jsenvPluginCompatMap = {};

const computeBabelPluginMapForRuntime = ({
  babelPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  runtimeName,
  runtimeVersion
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`);
  }

  if (typeof babelPluginCompatMap !== "object") {
    throw new TypeError(`babelPluginCompatMap must be an object, got ${babelPluginCompatMap}`);
  }

  if (typeof runtimeName !== "string") {
    throw new TypeError(`runtimeName must be a string, got ${runtimeName}`);
  }

  if (typeof runtimeVersion !== "string") {
    throw new TypeError(`runtimeVersion must be a string, got ${runtimeVersion}`);
  }

  const babelPluginMapForRuntime = {};
  Object.keys(babelPluginMap).forEach(key => {
    const compatible = runtimeIsCompatibleWithFeature({
      runtimeName,
      runtimeVersion,
      runtimeCompatMap: key in babelPluginCompatMap ? babelPluginCompatMap[key] : {}
    });

    if (!compatible) {
      babelPluginMapForRuntime[key] = babelPluginMap[key];
    }
  });
  return babelPluginMapForRuntime;
};

const runtimeIsCompatibleWithFeature = ({
  runtimeName,
  runtimeVersion,
  runtimeCompatMap
}) => {
  const runtimeCompatibleVersion = computeRuntimeCompatibleVersion({
    runtimeCompatMap,
    runtimeName
  });
  const highestVersion = findHighestVersion(runtimeVersion, runtimeCompatibleVersion);
  return highestVersion === runtimeVersion;
};

const computeRuntimeCompatibleVersion = ({
  runtimeCompatMap,
  runtimeName
}) => {
  return runtimeName in runtimeCompatMap ? runtimeCompatMap[runtimeName] : "Infinity";
};

const computeJsenvPluginMapForRuntime = ({
  jsenvPluginMap,
  jsenvPluginCompatMap: jsenvPluginCompatMap$1 = jsenvPluginCompatMap,
  runtimeName,
  runtimeVersion
}) => {
  if (typeof jsenvPluginMap !== "object") {
    throw new TypeError(`jsenvPluginMap must be a object, got ${jsenvPluginMap}`);
  }

  if (typeof jsenvPluginCompatMap$1 !== "object") {
    throw new TypeError(`jsenvPluginCompatMap must be a string, got ${jsenvPluginCompatMap$1}`);
  }

  if (typeof runtimeName !== "string") {
    throw new TypeError(`runtimeName must be a string, got ${runtimeName}`);
  }

  if (typeof runtimeVersion !== "string") {
    throw new TypeError(`runtimeVersion must be a string, got ${runtimeVersion}`);
  }

  const jsenvPluginMapForRuntime = {};
  Object.keys(jsenvPluginMap).forEach(key => {
    const compatible = runtimeIsCompatibleWithFeature$1({
      runtimeName,
      runtimeVersion,
      featureCompat: key in jsenvPluginCompatMap$1 ? jsenvPluginCompatMap$1[key] : {}
    });

    if (!compatible) {
      jsenvPluginMapForRuntime[key] = jsenvPluginMap[key];
    }
  });
  return jsenvPluginMapForRuntime;
};

const runtimeIsCompatibleWithFeature$1 = ({
  runtimeName,
  runtimeVersion,
  featureCompat
}) => {
  const runtimeCompatibleVersion = computeRuntimeCompatibleVersion$1({
    featureCompat,
    runtimeName
  });
  const highestVersion = findHighestVersion(runtimeVersion, runtimeCompatibleVersion);
  return highestVersion === runtimeVersion;
};

const computeRuntimeCompatibleVersion$1 = ({
  featureCompat,
  runtimeName
}) => {
  return runtimeName in featureCompat ? featureCompat[runtimeName] : "Infinity";
};

const groupHaveSameRequirements = (leftGroup, rightGroup) => {
  return leftGroup.babelPluginRequiredNameArray.join("") === rightGroup.babelPluginRequiredNameArray.join("") && leftGroup.jsenvPluginRequiredNameArray.join("") === rightGroup.jsenvPluginRequiredNameArray.join("");
};

const generateRuntimeGroupArray = ({
  babelPluginMap,
  jsenvPluginMap,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  jsenvPluginCompatMap: jsenvPluginCompatMap$1 = jsenvPluginCompatMap,
  runtimeName
}) => {
  const versionArray = [];
  Object.keys(babelPluginMap).forEach(babelPluginKey => {
    if (babelPluginKey in babelPluginCompatMap) {
      const babelPluginCompat = babelPluginCompatMap[babelPluginKey];

      if (runtimeName in babelPluginCompat) {
        const version = String(babelPluginCompat[runtimeName]);

        if (!versionArray.includes(version)) {
          versionArray.push(version);
        }
      }
    }
  });
  Object.keys(jsenvPluginMap).forEach(jsenvPluginKey => {
    if (jsenvPluginKey in jsenvPluginCompatMap$1) {
      const jsenvPluginCompat = jsenvPluginCompatMap$1[jsenvPluginKey];

      if (runtimeName in jsenvPluginCompat) {
        const version = String(jsenvPluginCompat[runtimeName]);

        if (!versionArray.includes(version)) {
          versionArray.push(version);
        }
      }
    }
  });
  versionArray.push("0.0.0");
  versionArray.sort(versionCompare);
  const runtimeGroupArray = [];
  versionArray.forEach(version => {
    const babelPluginMapForRuntime = computeBabelPluginMapForRuntime({
      babelPluginMap,
      babelPluginCompatMap,
      runtimeName,
      runtimeVersion: version
    });
    const babelPluginRequiredNameArray = Object.keys(babelPluginMap).filter(babelPluginKey => babelPluginKey in babelPluginMapForRuntime).sort();
    const jsenvPluginMapForRuntime = computeJsenvPluginMapForRuntime({
      jsenvPluginMap,
      jsenvPluginCompatMap: jsenvPluginCompatMap$1,
      runtimeName,
      runtimeVersion: version
    });
    const jsenvPluginRequiredNameArray = Object.keys(jsenvPluginMap).filter(jsenvPluginKey => jsenvPluginKey in jsenvPluginMapForRuntime).sort();
    const group = {
      babelPluginRequiredNameArray,
      jsenvPluginRequiredNameArray,
      runtimeCompatMap: {
        [runtimeName]: version
      }
    };
    const groupWithSameRequirements = runtimeGroupArray.find(runtimeGroupCandidate => groupHaveSameRequirements(runtimeGroupCandidate, group));

    if (groupWithSameRequirements) {
      groupWithSameRequirements.runtimeCompatMap[runtimeName] = findHighestVersion(groupWithSameRequirements.runtimeCompatMap[runtimeName], version);
    } else {
      runtimeGroupArray.push(group);
    }
  });
  return runtimeGroupArray;
};

const composeRuntimeCompatMap = (runtimeCompatMap, secondRuntimeCompatMap) => {
  return objectComposeValue(normalizeRuntimeCompatMapVersions(runtimeCompatMap), normalizeRuntimeCompatMapVersions(secondRuntimeCompatMap), (version, secondVersion) => findHighestVersion(version, secondVersion));
};

const normalizeRuntimeCompatMapVersions = runtimeCompatibility => {
  return objectMapValue(runtimeCompatibility, version => String(version));
};

const objectMapValue = (object, callback) => {
  const mapped = {};
  Object.keys(object).forEach(key => {
    mapped[key] = callback(object[key], key, object);
  });
  return mapped;
};

const objectComposeValue = (previous, object, callback) => {
  const composed = { ...previous
  };
  Object.keys(object).forEach(key => {
    composed[key] = key in composed ? callback(composed[key], object[key]) : object[key];
  });
  return composed;
};

const composeGroupArray = (...arrayOfGroupArray) => {
  return arrayOfGroupArray.reduce(groupArrayReducer, []);
};

const groupArrayReducer = (previousGroupArray, groupArray) => {
  const reducedGroupArray = [];
  previousGroupArray.forEach(group => {
    reducedGroupArray.push(copyGroup(group));
  });
  groupArray.forEach(group => {
    const groupWithSameRequirements = reducedGroupArray.find(existingGroupCandidate => groupHaveSameRequirements(group, existingGroupCandidate));

    if (groupWithSameRequirements) {
      groupWithSameRequirements.runtimeCompatMap = composeRuntimeCompatMap(groupWithSameRequirements.runtimeCompatMap, group.runtimeCompatMap);
    } else {
      reducedGroupArray.push(copyGroup(group));
    }
  });
  return reducedGroupArray;
};

const copyGroup = ({
  babelPluginRequiredNameArray,
  jsenvPluginRequiredNameArray,
  runtimeCompatMap
}) => {
  return {
    babelPluginRequiredNameArray: babelPluginRequiredNameArray.slice(),
    jsenvPluginRequiredNameArray: jsenvPluginRequiredNameArray.slice(),
    runtimeCompatMap: { ...runtimeCompatMap
    }
  };
};

const generateAllRuntimeGroupArray = ({
  babelPluginMap,
  jsenvPluginMap,
  babelPluginCompatMap,
  jsenvPluginCompatMap,
  runtimeNames
}) => {
  const arrayOfGroupArray = runtimeNames.map(runtimeName => generateRuntimeGroupArray({
    babelPluginMap,
    jsenvPluginMap,
    babelPluginCompatMap,
    jsenvPluginCompatMap,
    runtimeName
  }));
  const groupArray = composeGroupArray(...arrayOfGroupArray);
  return groupArray;
};

const runtimeCompatMapToScore = (runtimeCompatMap, runtimeScoreMap) => {
  return Object.keys(runtimeCompatMap).reduce((previous, runtimeName) => {
    const runtimeVersion = runtimeCompatMap[runtimeName];
    return previous + runtimeToScore(runtimeName, runtimeVersion, runtimeScoreMap);
  }, 0);
};

const runtimeToScore = (runtimeName, runtimeVersion, runtimeScoreMap) => {
  if (runtimeName in runtimeScoreMap === false) return runtimeScoreMap.other || 0;
  const versionUsageMap = runtimeScoreMap[runtimeName];
  const versionArray = Object.keys(versionUsageMap);
  if (versionArray.length === 0) return runtimeScoreMap.other || 0;
  const versionArrayAscending = versionArray.sort(versionCompare);
  const highestVersion = versionArrayAscending[versionArray.length - 1];
  if (findHighestVersion(runtimeVersion, highestVersion) === runtimeVersion) return versionUsageMap[highestVersion];
  const closestVersion = versionArrayAscending.reverse().find(version => findHighestVersion(runtimeVersion, version) === runtimeVersion);
  if (!closestVersion) return runtimeScoreMap.other || 0;
  return versionUsageMap[closestVersion];
};

/*

# featureCompatMap legend

        featureName
             │
{ ┌──────────┴────────────┐
  "transform-block-scoping": {─┐
    "chrome": "10",            │
    "safari": "3.0",           runTimeCompatMap
    "firefox": "5.1"           │
}────┼─────────┼───────────────┘
}    │         └─────┐
  runtimeName  runtimeVersion

# group legend

{
  "best": {
    "babelPluginRequiredNameArray" : [
      "transform-block-scoping",
    ],
    "runtimeCompatMap": {
      "chrome": "10",
      "firefox": "6"
    }
  }
}

Take chars below to update legends
─│┌┐└┘├┤┴┬

*/
const generateGroupMap = ({
  babelPluginMap,
  // jsenv plugin are for later, for now, nothing is using them
  jsenvPluginMap = {},
  babelPluginCompatMap,
  jsenvPluginCompatMap,
  runtimeScoreMap,
  groupCount = 1,
  // pass this to true if you don't care if someone tries to run your code
  // on a runtime which is not inside runtimeScoreMap.
  runtimeAlwaysInsideRuntimeScoreMap = false,
  // pass this to true if you think you will always be able to detect
  // the runtime or that if you fail to do so you don't care.
  runtimeWillAlwaysBeKnown = false
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`);
  }

  if (typeof jsenvPluginMap !== "object") {
    throw new TypeError(`jsenvPluginMap must be an object, got ${jsenvPluginMap}`);
  }

  if (typeof runtimeScoreMap !== "object") {
    throw new TypeError(`runtimeScoreMap must be an object, got ${runtimeScoreMap}`);
  }

  if (typeof groupCount < 1) {
    throw new TypeError(`groupCount must be above 1, got ${groupCount}`);
  }

  const groupWithoutFeature = {
    babelPluginRequiredNameArray: Object.keys(babelPluginMap),
    jsenvPluginRequiredNameArray: Object.keys(jsenvPluginMap),
    runtimeCompatMap: {}
  }; // when we create one group and we cannot ensure
  // code will be runned on a runtime inside runtimeScoreMap
  // then we return otherwise group to be safe

  if (groupCount === 1 && !runtimeAlwaysInsideRuntimeScoreMap) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature
    };
  }

  const allRuntimeGroupArray = generateAllRuntimeGroupArray({
    babelPluginMap,
    babelPluginCompatMap,
    jsenvPluginMap,
    jsenvPluginCompatMap,
    runtimeNames: arrayWithoutValue(Object.keys(runtimeScoreMap), "other")
  });

  if (allRuntimeGroupArray.length === 0) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature
    };
  }

  const groupToScore = ({
    runtimeCompatMap
  }) => runtimeCompatMapToScore(runtimeCompatMap, runtimeScoreMap);

  const allRuntimeGroupArraySortedByScore = allRuntimeGroupArray.sort((a, b) => groupToScore(b) - groupToScore(a));
  const length = allRuntimeGroupArraySortedByScore.length; // if we arrive here and want a single group
  // we take the worst group and consider it's our best group
  // because it's the lowest runtime we want to support

  if (groupCount === 1) {
    return {
      [COMPILE_ID_BEST]: allRuntimeGroupArraySortedByScore[length - 1]
    };
  }

  const addOtherwiseToBeSafe = !runtimeAlwaysInsideRuntimeScoreMap || !runtimeWillAlwaysBeKnown;
  const lastGroupIndex = addOtherwiseToBeSafe ? groupCount - 1 : groupCount;
  const groupArray = length + 1 > groupCount ? allRuntimeGroupArraySortedByScore.slice(0, lastGroupIndex) : allRuntimeGroupArraySortedByScore;
  const groupMap = {};
  groupArray.forEach((group, index) => {
    if (index === 0) {
      groupMap[COMPILE_ID_BEST] = group;
    } else {
      groupMap[`intermediate-${index + 1}`] = group;
    }
  });

  if (addOtherwiseToBeSafe) {
    groupMap[COMPILE_ID_OTHERWISE] = groupWithoutFeature;
  }

  return groupMap;
};

const arrayWithoutValue = (array, value) => array.filter(valueCandidate => valueCandidate !== value);

// https://www.statista.com/statistics/268299/most-popular-internet-browsers/
// this source of stat is what I found in 5min
// we could improve these default usage score using better stats
// and keep in mind this should be updated time to time or even better
// come from a project specific audience
const jsenvBrowserScoreMap = {
  android: 0.001,
  chrome: {
    71: 0.3,
    69: 0.19,
    0: 0.01 // it means oldest version of chrome will get a score of 0.01

  },
  firefox: {
    61: 0.3
  },
  edge: {
    12: 0.1
  },
  electron: 0.001,
  ios: 0.001,
  opera: 0.001,
  other: 0.001,
  safari: {
    10: 0.1
  }
};

// https://nodejs.org/metrics/summaries/version/nodejs.org-access.log.csv
const jsenvNodeVersionScoreMap = {
  "0.10": 0.02,
  "0.12": 0.01,
  "4": 0.1,
  "6": 0.25,
  "7": 0.1,
  "8": 1,
  "9": 0.1,
  "10": 0.5,
  "11": 0.25
};

const require$1 = module$1.createRequire(url);

/* eslint-disable import/max-dependencies */

const proposalJSONStrings = require$1("@babel/plugin-proposal-json-strings");

const proposalNumericSeparator = require$1("@babel/plugin-proposal-numeric-separator");

const proposalObjectRestSpread = require$1("@babel/plugin-proposal-object-rest-spread");

const proposalOptionalCatchBinding = require$1("@babel/plugin-proposal-optional-catch-binding");

const proposalOptionalChaining = require$1("@babel/plugin-proposal-optional-chaining");

const proposalUnicodePropertyRegex = require$1("@babel/plugin-proposal-unicode-property-regex");

const syntaxObjectRestSpread = require$1("@babel/plugin-syntax-object-rest-spread");

const syntaxOptionalCatchBinding = require$1("@babel/plugin-syntax-optional-catch-binding");

const transformArrowFunction = require$1("@babel/plugin-transform-arrow-functions");

const transformAsyncToPromises = require$1("babel-plugin-transform-async-to-promises");

const transformBlockScopedFunctions = require$1("@babel/plugin-transform-block-scoped-functions");

const transformBlockScoping = require$1("@babel/plugin-transform-block-scoping");

const transformClasses = require$1("@babel/plugin-transform-classes");

const transformComputedProperties = require$1("@babel/plugin-transform-computed-properties");

const transformDestructuring = require$1("@babel/plugin-transform-destructuring");

const transformDotAllRegex = require$1("@babel/plugin-transform-dotall-regex");

const transformDuplicateKeys = require$1("@babel/plugin-transform-duplicate-keys");

const transformExponentiationOperator = require$1("@babel/plugin-transform-exponentiation-operator");

const transformForOf = require$1("@babel/plugin-transform-for-of");

const transformFunctionName = require$1("@babel/plugin-transform-function-name");

const transformLiterals = require$1("@babel/plugin-transform-literals");

const transformNewTarget = require$1("@babel/plugin-transform-new-target");

const transformObjectSuper = require$1("@babel/plugin-transform-object-super");

const transformParameters = require$1("@babel/plugin-transform-parameters");

const transformRegenerator = require$1("@babel/plugin-transform-regenerator");

const transformShorthandProperties = require$1("@babel/plugin-transform-shorthand-properties");

const transformSpread = require$1("@babel/plugin-transform-spread");

const transformStickyRegex = require$1("@babel/plugin-transform-sticky-regex");

const transformTemplateLiterals = require$1("@babel/plugin-transform-template-literals");

const transformTypeOfSymbol = require$1("@babel/plugin-transform-typeof-symbol");

const transformUnicodeRegex = require$1("@babel/plugin-transform-unicode-regex");

const jsenvBabelPluginMap = {
  "proposal-numeric-separator": [proposalNumericSeparator],
  "proposal-json-strings": [proposalJSONStrings],
  "proposal-object-rest-spread": [proposalObjectRestSpread],
  "proposal-optional-catch-binding": [proposalOptionalCatchBinding],
  "proposal-optional-chaining": [proposalOptionalChaining],
  "proposal-unicode-property-regex": [proposalUnicodePropertyRegex],
  "syntax-object-rest-spread": [syntaxObjectRestSpread],
  "syntax-optional-catch-binding": [syntaxOptionalCatchBinding],
  "transform-async-to-promises": [transformAsyncToPromises],
  "transform-arrow-functions": [transformArrowFunction],
  "transform-block-scoped-functions": [transformBlockScopedFunctions],
  "transform-block-scoping": [transformBlockScoping],
  "transform-classes": [transformClasses],
  "transform-computed-properties": [transformComputedProperties],
  "transform-destructuring": [transformDestructuring],
  "transform-dotall-regex": [transformDotAllRegex],
  "transform-duplicate-keys": [transformDuplicateKeys],
  "transform-exponentiation-operator": [transformExponentiationOperator],
  "transform-for-of": [transformForOf],
  "transform-function-name": [transformFunctionName],
  "transform-literals": [transformLiterals],
  "transform-new-target": [transformNewTarget],
  "transform-object-super": [transformObjectSuper],
  "transform-parameters": [transformParameters],
  "transform-regenerator": [transformRegenerator, {
    asyncGenerators: true,
    generators: true,
    async: false
  }],
  "transform-shorthand-properties": [transformShorthandProperties],
  "transform-spread": [transformSpread],
  "transform-sticky-regex": [transformStickyRegex],
  "transform-template-literals": [transformTemplateLiterals],
  "transform-typeof-symbol": [transformTypeOfSymbol],
  "transform-unicode-regex": [transformUnicodeRegex]
};

const createCallbackList = () => {
  const callbackSet = new Set();

  const register = callback => {
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };

  const notify = (...args) => {
    callbackSet.forEach(callback => {
      callback(...args);
    });
  };

  return {
    register,
    notify
  };
};

const urlToCompileInfo = (url, {
  compileServerOrigin,
  outDirectoryRelativeUrl
}) => {
  const outDirectoryServerUrl = util.resolveDirectoryUrl(outDirectoryRelativeUrl, compileServerOrigin); // not inside compile directory -> nothing to compile

  if (!url.startsWith(outDirectoryServerUrl)) {
    return {
      insideCompileDirectory: false
    };
  }

  const afterOutDirectory = url.slice(outDirectoryServerUrl.length); // serve files inside /.jsenv/out/* directly without compilation
  // this is just to allow some files to be written inside outDirectory and read directly
  // if asked by the client (such as env.json, groupMap.json, meta.json)

  if (!afterOutDirectory.includes("/") || afterOutDirectory[0] === "/") {
    return {
      insideCompileDirectory: true
    };
  }

  const parts = afterOutDirectory.split("/");
  const compileId = parts[0]; // no compileId, we don't know what to compile (not supposed so happen)

  if (compileId === "") {
    return {
      insideCompileDirectory: true,
      compileId: null
    };
  }

  const afterCompileId = parts.slice(1).join("/"); // note: afterCompileId can be '' (but not supposed to happen)

  return {
    insideCompileDirectory: true,
    compileId,
    afterCompileId
  };
}; // take any url string and try to return a file url (an url inside projectDirectoryUrl)

const urlToProjectUrl = (url, {
  projectDirectoryUrl,
  compileServerOrigin
}) => {
  if (url.startsWith(projectDirectoryUrl)) {
    return url;
  }

  const serverUrl = urlToServerUrl(url, {
    projectDirectoryUrl,
    compileServerOrigin
  });

  if (serverUrl) {
    return `${projectDirectoryUrl}${serverUrl.slice(`${compileServerOrigin}/`.length)}`;
  }

  return null;
};
const urlToProjectRelativeUrl = (url, {
  projectDirectoryUrl,
  compileServerOrigin
}) => {
  const projectUrl = urlToProjectUrl(url, {
    projectDirectoryUrl,
    compileServerOrigin
  });

  if (!projectUrl) {
    return null;
  }

  return util.urlToRelativeUrl(projectUrl, projectDirectoryUrl);
}; // take any url string and try to return the corresponding remote url (an url inside compileServerOrigin)

const urlToServerUrl = (url, {
  projectDirectoryUrl,
  compileServerOrigin
}) => {
  if (url.startsWith(`${compileServerOrigin}/`)) {
    return url;
  }

  if (url.startsWith(projectDirectoryUrl)) {
    return `${compileServerOrigin}/${url.slice(projectDirectoryUrl.length)}`;
  }

  return null;
};
const urlToOriginalServerUrl = (url, {
  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  compileDirectoryRelativeUrl
}) => {
  const originalProjectUrl = urlToOriginalProjectUrl(url, {
    projectDirectoryUrl,
    compileServerOrigin,
    outDirectoryRelativeUrl,
    compileDirectoryRelativeUrl
  });

  if (!originalProjectUrl) {
    return null;
  }

  return urlToServerUrl(originalProjectUrl, {
    projectDirectoryUrl,
    compileServerOrigin
  });
}; // take any url string and try to return a file url inside project directory url
// prefer the source url if the url is inside compile directory

const urlToOriginalProjectUrl = (url, {
  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,
  compileDirectoryRelativeUrl
}) => {
  const projectUrl = urlToProjectUrl(url, {
    projectDirectoryUrl,
    compileServerOrigin
  });

  if (!projectUrl) {
    return null;
  }

  if (!compileDirectoryRelativeUrl) {
    compileDirectoryRelativeUrl = serverUrlToCompileDirectoryRelativeUrl(urlToServerUrl(projectUrl, {
      projectDirectoryUrl,
      compileServerOrigin
    }), {
      compileServerOrigin,
      outDirectoryRelativeUrl
    });

    if (!compileDirectoryRelativeUrl) {
      return projectUrl;
    }
  }

  const compileDirectoryUrl = util.resolveUrl(compileDirectoryRelativeUrl, projectDirectoryUrl);

  if (!util.urlIsInsideOf(projectUrl, compileDirectoryUrl)) {
    return projectUrl;
  }

  const relativeUrl = util.urlToRelativeUrl(projectUrl, compileDirectoryUrl);
  return util.resolveUrl(relativeUrl, projectDirectoryUrl);
};

const serverUrlToCompileDirectoryRelativeUrl = (serverUrl, {
  compileServerOrigin,
  outDirectoryRelativeUrl
}) => {
  const compileInfo = urlToCompileInfo(serverUrl, {
    compileServerOrigin,
    outDirectoryRelativeUrl
  });

  if (compileInfo.compiledId) {
    return `${outDirectoryRelativeUrl}${compileInfo.compileId}/`;
  }

  return null;
};

const urlToCompiledServerUrl = (url, {
  projectDirectoryUrl,
  compileServerOrigin,
  compileDirectoryRelativeUrl
}) => {
  const serverUrl = urlToServerUrl(url, {
    projectDirectoryUrl,
    compileServerOrigin
  });

  if (!serverUrl) {
    return null;
  }

  const compileDirectoryServerUrl = util.resolveUrl(compileDirectoryRelativeUrl, compileServerOrigin);

  if (util.urlIsInsideOf(serverUrl, compileDirectoryServerUrl)) {
    return serverUrl;
  }

  const projectRelativeUrl = urlToProjectRelativeUrl(serverUrl, {
    projectDirectoryUrl,
    compileServerOrigin
  });

  if (projectRelativeUrl) {
    return util.resolveUrl(projectRelativeUrl, compileDirectoryServerUrl);
  }

  return null;
};

const jsenvNodeSystemRelativeUrl = "./src/internal/node-launcher/node-js-file.js";
const jsenvNodeSystemBuildRelativeUrl = "./dist/jsenv-node-system.cjs";
const jsenvNodeSystemUrl = util.resolveUrl(jsenvNodeSystemRelativeUrl, jsenvCoreDirectoryUrl);
const jsenvNodeSystemBuildUrl = util.resolveUrl(jsenvNodeSystemBuildRelativeUrl, jsenvCoreDirectoryUrl);
const jsenvBrowserSystemRelativeUrl = "./src/internal/browser-launcher/jsenv-browser-system.js";
const jsenvBrowserSystemBuildRelativeUrl = "./dist/jsenv-browser-system.js";
const jsenvBrowserSystemUrl = util.resolveUrl(jsenvBrowserSystemRelativeUrl, jsenvCoreDirectoryUrl);
const jsenvBrowserSystemBuildUrl = util.resolveUrl(jsenvBrowserSystemBuildRelativeUrl, jsenvCoreDirectoryUrl);
const sourcemapMainFileUrl = util.fileSystemPathToUrl(require$1.resolve("source-map/dist/source-map.js"));
const sourcemapMappingFileUrl = util.fileSystemPathToUrl(require$1.resolve("source-map/lib/mappings.wasm")); // Exploring redirection
// (auto redirection to a compile group depending on browser capabilities)

const jsenvExploringRedirectorHtmlUrl = util.resolveUrl("./src/internal/exploring/exploring.redirector.html", jsenvCoreDirectoryUrl);
const jsenvExploringRedirectorJsRelativeUrl = "./src/internal/exploring/exploring.redirector.js";
const jsenvExploringRedirectorJsBuildRelativeUrl = "./dist/jsenv-exploring-redirector.js";
const jsenvExploringRedirectorJsUrl = util.resolveUrl(jsenvExploringRedirectorJsRelativeUrl, jsenvCoreDirectoryUrl);
const jsenvExploringRedirectorJsBuildUrl = util.resolveUrl(jsenvExploringRedirectorJsBuildRelativeUrl, jsenvCoreDirectoryUrl); // Exploring index and toolbar
const jsenvExploringIndexJsBuildUrl = util.resolveUrl("./dist/jsenv-exploring-index.js", jsenvCoreDirectoryUrl);
const jsenvExploringIndexHtmlUrl = util.resolveUrl("./src/internal/exploring/exploring.html", jsenvCoreDirectoryUrl);
const jsenvToolbarHtmlUrl = util.resolveUrl("./src/internal/toolbar/toolbar.html", jsenvCoreDirectoryUrl);
const jsenvToolbarInjectorBuildRelativeUrl = "./dist/jsenv-toolbar-injector.js";
const jsenvToolbarInjectorBuildUrl = util.resolveUrl(jsenvToolbarInjectorBuildRelativeUrl, jsenvCoreDirectoryUrl);
const jsenvToolbarJsRelativeUrl = "./src/internal/toolbar/toolbar.main.js";
const jsenvToolbarJsBuildRelativeUrl = "dist/jsenv-toolbar.js";
const jsenvToolbarJsUrl = util.resolveUrl(jsenvToolbarJsRelativeUrl, jsenvCoreDirectoryUrl);
const jsenvToolbarJsBuildUrl = util.resolveUrl(jsenvToolbarJsBuildRelativeUrl, jsenvCoreDirectoryUrl);
const jsenvImportMetaResolveGlobalUrl = util.resolveUrl("helpers/import-meta-resolve/import-meta-resolve-global.js", jsenvCoreDirectoryUrl);
const jsenvImportMetaResolveCommonjsUrl = util.resolveUrl("helpers/import-meta-resolve/import-meta-resolve-commonjs.js", jsenvCoreDirectoryUrl);

// and in our case we are talking about a dev server
// in other words it's not super important to handle concurrent connections
// https://gist.github.com/adamhooper/9e0e2583e0f22ace0e0840b9c09e395d
// https://stackoverflow.com/questions/42321861/fs-readfile-is-very-slow-am-i-making-too-many-request

const readFileContent = async url => {
  const buffer = fs.readFileSync(util.urlToFileSystemPath(url));
  return String(buffer);
};
const writeFileContent = async (url, content, {
  fileLikelyNotFound = false
} = {}) => {
  const filePath = util.urlToFileSystemPath(url);
  const directoryPath = path.dirname(filePath);

  const ensureParentDirectory = () => {
    try {
      fs.mkdirSync(directoryPath, {
        recursive: true
      });
    } catch (error) {
      if (error.code === "EEXIST") {
        return;
      }

      throw error;
    }
  };

  if (fileLikelyNotFound) {
    // whenever outside knows file is likely not exisiting
    // ensure parent directory exists first
    ensureParentDirectory();
    fs.writeFileSync(filePath, content);
  } else {
    // most of the time when you want to write a file it's likely existing (at least the parent directory)
    try {
      fs.writeFileSync(filePath, content);
    } catch (error) {
      if (error.code === "ENOENT") {
        ensureParentDirectory();
        fs.writeFileSync(filePath, content);
        return;
      }

      throw error;
    }
  }
};
const testFilePresence = async url => {
  return fs.existsSync(util.urlToFileSystemPath(url));
};

const urlIsCompilationAsset = url => {
  const filename = util.urlToFilename(url); // sourcemap are not inside the asset folder because
  // of https://github.com/microsoft/vscode-chrome-debug-core/issues/544

  if (filename.endsWith(".map")) {
    return true;
  }

  return filename.includes("__asset__");
};
const getMetaJsonFileUrl = compileFileUrl => generateCompiledFileAssetUrl(compileFileUrl, "meta.json");
const generateCompiledFileAssetUrl = (compiledFileUrl, assetName) => {
  return `${compiledFileUrl}__asset__${assetName}`;
};

const readMeta = async ({
  logger: logger$1,
  compiledFileUrl
}) => {
  const metaJsonFileUrl = getMetaJsonFileUrl(compiledFileUrl);

  try {
    const metaJsonString = await readFileContent(metaJsonFileUrl);
    const metaJsonObject = JSON.parse(metaJsonString);
    return metaJsonObject;
  } catch (error) {
    if (error && error.code === "ENOENT") {
      logger$1.debug(logger.createDetailedMessage(`no meta.json.`, {
        ["meta.json path"]: util.urlToFileSystemPath(metaJsonFileUrl),
        ["compiled file"]: util.urlToFileSystemPath(compiledFileUrl)
      }));
      return null;
    }

    if (error && error.name === "SyntaxError") {
      logger$1.error(logger.createDetailedMessage(`meta.json syntax error.`, {
        ["syntax error stack"]: error.stack,
        ["meta.json path"]: util.urlToFileSystemPath(metaJsonFileUrl)
      }));
      return null;
    }

    throw error;
  }
};

const validateMeta = async ({
  logger,
  meta,
  compiledFileUrl,
  ifEtagMatch,
  ifModifiedSinceDate,
  compileCacheSourcesValidation = true,
  compileCacheAssetsValidation = true
}) => {
  const [compiledFileValidationTiming, compiledFileValidation] = await server.timeFunction("cache compiled file validation", () => validateCompiledFile({
    compiledFileUrl,
    ifEtagMatch,
    ifModifiedSinceDate
  }));

  if (!compiledFileValidation.valid) {
    logger.debug(`${util.urlToFileSystemPath(compiledFileUrl)} modified (${compiledFileValidation.code})`);
    return { ...compiledFileValidation,
      timing: compiledFileValidationTiming
    };
  }

  logger.debug(`${util.urlToFileSystemPath(compiledFileUrl)} not modified`);

  if (meta.sources.length === 0) {
    logger.warn(`meta.sources is empty, cache considered as invalid by precaution`);
    return {
      code: "SOURCES_EMPTY",
      valid: false,
      timing: compiledFileValidationTiming
    };
  }

  const [[sourcesValidationTiming, sourcesValidations], [assetsValidationTiming, assetValidations]] = await Promise.all([server.timeFunction("cache sources validation", () => compileCacheSourcesValidation ? validateSources({
    meta,
    compiledFileUrl
  }) : []), server.timeFunction("cache assets validation", () => compileCacheAssetsValidation ? validateAssets({
    meta,
    compiledFileUrl
  }) : [])]);
  const invalidSourceValidation = sourcesValidations.find(({
    valid
  }) => !valid);

  if (invalidSourceValidation) {
    logger.debug(`${util.urlToFileSystemPath(invalidSourceValidation.data.sourceFileUrl)} source modified (${invalidSourceValidation.code})`);
    return { ...invalidSourceValidation,
      timing: { ...compiledFileValidationTiming,
        ...sourcesValidationTiming,
        ...assetsValidationTiming
      }
    };
  }

  const invalidAssetValidation = assetValidations.find(({
    valid
  }) => !valid);

  if (invalidAssetValidation) {
    logger.debug(`${util.urlToFileSystemPath(invalidAssetValidation.data.assetFileUrl)} asset modified (${invalidAssetValidation.code})`);
    return { ...invalidAssetValidation,
      timing: { ...compiledFileValidationTiming,
        ...sourcesValidationTiming,
        ...assetsValidationTiming
      }
    };
  }

  logger.debug(`${util.urlToFileSystemPath(compiledFileUrl)} cache is valid`);
  const compiledSource = compiledFileValidation.data.compiledSource;
  const sourcesContent = sourcesValidations.map(({
    data
  }) => data.sourceContent);
  const assetsContent = assetValidations.find(({
    data
  }) => data.assetContent);
  return {
    valid: true,
    data: {
      compiledSource,
      sourcesContent,
      assetsContent
    },
    timing: { ...compiledFileValidationTiming,
      ...sourcesValidationTiming,
      ...assetsValidationTiming
    }
  };
};

const validateCompiledFile = async ({
  compiledFileUrl,
  ifEtagMatch,
  ifModifiedSinceDate
}) => {
  try {
    const compiledSource = await readFileContent(compiledFileUrl);

    if (ifEtagMatch) {
      const compiledEtag = util.bufferToEtag(Buffer.from(compiledSource));

      if (ifEtagMatch !== compiledEtag) {
        return {
          code: "COMPILED_FILE_ETAG_MISMATCH",
          valid: false,
          data: {
            compiledSource,
            compiledEtag
          }
        };
      }
    }

    if (ifModifiedSinceDate) {
      const compiledMtime = await util.readFileSystemNodeModificationTime(compiledFileUrl);

      if (ifModifiedSinceDate < dateToSecondsPrecision(compiledMtime)) {
        return {
          code: "COMPILED_FILE_MTIME_OUTDATED",
          valid: false,
          data: {
            compiledSource,
            compiledMtime
          }
        };
      }
    }

    return {
      valid: true,
      data: {
        compiledSource
      }
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        code: "COMPILED_FILE_NOT_FOUND",
        valid: false,
        data: {
          compiledFileUrl
        }
      };
    }

    return Promise.reject(error);
  }
};

const validateSources = ({
  meta,
  compiledFileUrl
}) => {
  return Promise.all(meta.sources.map((source, index) => validateSource({
    compiledFileUrl,
    source,
    eTag: meta.sourcesEtag[index]
  })));
};

const validateSource = async ({
  compiledFileUrl,
  source,
  eTag
}) => {
  const metaJsonFileUrl = getMetaJsonFileUrl(compiledFileUrl);
  const sourceFileUrl = util.resolveUrl(source, metaJsonFileUrl);

  try {
    const sourceContent = await readFileContent(sourceFileUrl);
    const sourceETag = util.bufferToEtag(Buffer.from(sourceContent));

    if (sourceETag !== eTag) {
      return {
        code: "SOURCE_ETAG_MISMATCH",
        valid: false,
        data: {
          source,
          sourceFileUrl,
          sourceContent
        }
      };
    }

    return {
      valid: true,
      data: {
        sourceContent
      }
    };
  } catch (e) {
    if (e && e.code === "ENOENT") {
      // missing source invalidates the cache because
      // we cannot check its validity
      // HOWEVER inside writeMeta we will check if a source can be found
      // when it cannot we will not put it as a dependency
      // to invalidate the cache.
      // It is important because some files are constructed on other files
      // which are not truly on the filesystem
      // (IN theory the above happens only for convertCommonJsWithRollup because jsenv
      // always have a concrete file especially to avoid that kind of thing)
      return {
        code: "SOURCE_NOT_FOUND",
        valid: false,
        data: {
          source,
          sourceFileUrl,
          sourceContent: ""
        }
      };
    }

    throw e;
  }
};

const validateAssets = ({
  compiledFileUrl,
  meta
}) => Promise.all(meta.assets.map((asset, index) => validateAsset({
  asset,
  compiledFileUrl,
  eTag: meta.assetsEtag[index]
})));

const validateAsset = async ({
  asset,
  compiledFileUrl,
  eTag
}) => {
  const metaJsonFileUrl = getMetaJsonFileUrl(compiledFileUrl);
  const assetFileUrl = util.resolveUrl(asset, metaJsonFileUrl);

  try {
    const assetContent = await readFileContent(assetFileUrl);
    const assetContentETag = util.bufferToEtag(Buffer.from(assetContent));

    if (eTag !== assetContentETag) {
      return {
        code: "ASSET_ETAG_MISMATCH",
        valid: false,
        data: {
          asset,
          assetFileUrl,
          assetContent,
          assetContentETag
        }
      };
    }

    return {
      valid: true,
      data: {
        assetContent,
        assetContentETag
      }
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {
        code: "ASSET_FILE_NOT_FOUND",
        valid: false,
        data: {
          asset,
          assetFileUrl
        }
      };
    }

    return Promise.reject(error);
  }
};

const dateToSecondsPrecision = date => {
  const dateWithSecondsPrecision = new Date(date);
  dateWithSecondsPrecision.setMilliseconds(0);
  return dateWithSecondsPrecision;
};

const updateMeta = async ({
  logger,
  meta,
  compiledFileUrl,
  cacheHitTracking,
  compileResult,
  compileResultStatus
}) => {
  const isNew = compileResultStatus === "created";
  const isUpdated = compileResultStatus === "updated";
  const isCached = compileResultStatus === "cached";
  const {
    compiledSource,
    contentType,
    assets,
    assetsContent
  } = compileResult;
  let {
    sources,
    sourcesContent
  } = compileResult;
  const promises = [];

  if (isNew || isUpdated) {
    // ensure source that does not leads to concrete files are not capable to invalidate the cache
    const sourceExists = await Promise.all(sources.map(async sourceFileUrl => {
      const sourceFileExists = await testFilePresence(sourceFileUrl);

      if (sourceFileExists) {
        return true;
      } // this can lead to cache never invalidated by itself
      // it's a very important warning


      logger.warn(`a source file cannot be found -> excluded from meta.sources & meta.sourcesEtag.
--- source ---
${sourceFileUrl}`);
      return false;
    }));
    sources = sources.filter((source, index) => sourceExists[index]);
    sourcesContent = sourcesContent.filter((sourceContent, index) => sourceExists[index]);
    const {
      writeCompiledSourceFile = true,
      writeAssetsFile = true
    } = compileResult;

    if (writeCompiledSourceFile) {
      logger.debug(`write compiled file at ${util.urlToFileSystemPath(compiledFileUrl)}`);
      promises.push(writeFileContent(compiledFileUrl, compiledSource, {
        fileLikelyNotFound: isNew
      }));
    }

    if (writeAssetsFile) {
      promises.push(...assets.map((assetFileUrl, index) => {
        logger.debug(`write compiled file asset at ${util.urlToFileSystemPath(assetFileUrl)}`);
        return writeFileContent(assetFileUrl, assetsContent[index], {
          fileLikelyNotFound: isNew
        });
      }));
    }
  }

  const metaJsonFileUrl = getMetaJsonFileUrl(compiledFileUrl);

  if (isNew || isUpdated || isCached && cacheHitTracking) {
    let latestMeta;
    const sourceAndAssetProps = {
      sources: sources.map(source => util.urlToRelativeUrl(source, metaJsonFileUrl)),
      sourcesEtag: sourcesContent.map(sourceContent => util.bufferToEtag(Buffer.from(sourceContent))),
      assets: assets.map(asset => util.urlToRelativeUrl(asset, metaJsonFileUrl)),
      assetsEtag: assetsContent.map(assetContent => util.bufferToEtag(Buffer.from(assetContent)))
    };

    if (isNew) {
      latestMeta = {
        contentType,
        ...sourceAndAssetProps,
        createdMs: Number(Date.now()),
        lastModifiedMs: Number(Date.now())
      };
    } else if (isUpdated) {
      latestMeta = { ...meta,
        ...sourceAndAssetProps,
        lastModifiedMs: Number(Date.now())
      };
    } else {
      latestMeta = { ...meta
      };
    }

    if (cacheHitTracking) {
      latestMeta = { ...latestMeta,
        matchCount: 1,
        lastMatchMs: Number(Date.now())
      };
    }

    logger.debug(`write compiled file meta at ${util.urlToFileSystemPath(metaJsonFileUrl)}`);
    promises.push(writeFileContent(metaJsonFileUrl, JSON.stringify(latestMeta, null, "  "), {
      fileLikelyNotFound: isNew
    }));
  }

  return Promise.all(promises);
};

const createLockRegistry = () => {
  let lockArray = [];

  const lockForRessource = async ressource => {
    const currentLock = lockArray.find(lock => lock.ressource === ressource);
    let unlockResolve;
    const unlocked = new Promise(resolve => {
      unlockResolve = resolve;
    });
    const lock = {
      ressource,
      unlocked
    };
    lockArray = [...lockArray, lock];
    if (currentLock) await currentLock.unlocked;

    const unlock = () => {
      lockArray = lockArray.filter(lockCandidate => lockCandidate !== lock);
      unlockResolve();
    };

    return unlock;
  };

  return {
    lockForRessource
  };
};

/* eslint-disable import/max-dependencies */
const {
  lockForRessource
} = createLockRegistry();
const getOrGenerateCompiledFile = async ({
  logger: logger$1,
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl = originalFileUrl,
  writeOnFilesystem,
  useFilesystemAsCache,
  cacheHitTracking = false,
  cacheInterProcessLocking = false,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
  fileContentFallback,
  ifEtagMatch,
  ifModifiedSinceDate,
  compile
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof originalFileUrl !== "string") {
    throw new TypeError(`originalFileUrl must be a string, got ${originalFileUrl}`);
  }

  if (!originalFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(logger.createDetailedMessage(`origin file must be inside project`, {
      ["original file url"]: originalFileUrl,
      ["project directory url"]: projectDirectoryUrl
    }));
  }

  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`);
  }

  if (!compiledFileUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(logger.createDetailedMessage(`compiled file must be inside project`, {
      ["compiled file url"]: compiledFileUrl,
      ["project directory url"]: projectDirectoryUrl
    }));
  }

  if (typeof compile !== "function") {
    throw new TypeError(`compile must be a function, got ${compile}`);
  }

  const lockTimeEnd = server.timeStart("lock");
  return startAsap(async () => {
    const lockTiming = lockTimeEnd();
    const {
      meta,
      compileResult,
      compileResultStatus,
      timing
    } = await computeCompileReport({
      originalFileUrl,
      compiledFileUrl,
      compile,
      fileContentFallback,
      ifEtagMatch,
      ifModifiedSinceDate,
      useFilesystemAsCache,
      compileCacheSourcesValidation,
      compileCacheAssetsValidation,
      logger: logger$1
    });
    let cacheWriteTiming = {};

    if (writeOnFilesystem) {
      const result = await server.timeFunction("cache write", () => updateMeta({
        logger: logger$1,
        meta,
        compileResult,
        compileResultStatus,
        compiledFileUrl,
        cacheHitTracking
      }));
      cacheWriteTiming = result[0];
    }

    return {
      meta,
      compileResult,
      compileResultStatus,
      timing: { ...lockTiming,
        ...timing,
        ...cacheWriteTiming
      }
    };
  }, {
    compiledFileUrl,
    cacheInterProcessLocking,
    logger: logger$1
  });
};

const computeCompileReport = async ({
  originalFileUrl,
  compiledFileUrl,
  compile,
  fileContentFallback,
  ifEtagMatch,
  ifModifiedSinceDate,
  useFilesystemAsCache,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation,
  logger
}) => {
  const [cacheReadTiming, meta] = await server.timeFunction("cache read", async () => {
    if (useFilesystemAsCache) {
      return readMeta({
        logger,
        compiledFileUrl
      });
    }

    return null;
  });

  if (!meta) {
    const [compileTiming, compileResult] = await server.timeFunction("compile", () => callCompile({
      logger,
      originalFileUrl,
      fileContentFallback,
      compile
    }));
    return {
      meta: null,
      compileResult,
      compileResultStatus: "created",
      timing: { ...cacheReadTiming,
        ...compileTiming
      }
    };
  }

  const metaValidation = await validateMeta({
    logger,
    meta,
    compiledFileUrl,
    ifEtagMatch,
    ifModifiedSinceDate,
    compileCacheSourcesValidation,
    compileCacheAssetsValidation
  });

  if (!metaValidation.valid) {
    const [compileTiming, compileResult] = await server.timeFunction("compile", () => callCompile({
      logger,
      originalFileUrl,
      fileContentFallback,
      compile
    }));
    return {
      meta,
      compileResult,
      compileResultStatus: "updated",
      timing: { ...cacheReadTiming,
        ...metaValidation.timing,
        ...compileTiming
      }
    };
  }

  const {
    contentType,
    sources,
    assets
  } = meta;
  const {
    compiledSource,
    sourcesContent,
    assetsContent
  } = metaValidation.data;
  return {
    meta,
    compileResult: {
      contentType,
      compiledSource,
      sources,
      sourcesContent,
      assets,
      assetsContent
    },
    compileResultStatus: "cached",
    timing: { ...cacheReadTiming,
      ...metaValidation.timing
    }
  };
};

const callCompile = async ({
  logger,
  originalFileUrl,
  fileContentFallback,
  compile
}) => {
  logger.debug(`compile ${originalFileUrl}`);
  const compileArgs = compile.length === 0 ? [] : await getArgumentsForCompile({
    originalFileUrl,
    fileContentFallback
  });
  const {
    sources = [],
    sourcesContent = [],
    assets = [],
    assetsContent = [],
    contentType,
    compiledSource,
    ...rest
  } = await compile(...compileArgs);

  if (typeof contentType !== "string") {
    throw new TypeError(`compile must return a contentType string, got ${contentType}`);
  }

  if (typeof compiledSource !== "string") {
    throw new TypeError(`compile must return a compiledSource string, got ${compiledSource}`);
  }

  return {
    contentType,
    compiledSource,
    sources,
    sourcesContent,
    assets,
    assetsContent,
    ...rest
  };
};

const getArgumentsForCompile = async ({
  originalFileUrl,
  fileContentFallback
}) => {
  let fileContent;

  if (fileContentFallback) {
    try {
      fileContent = await readFileContent(originalFileUrl);
    } catch (e) {
      if (e.code === "ENOENT") {
        fileContent = await fileContentFallback();
      } else {
        throw e;
      }
    }
  } else {
    fileContent = await readFileContent(originalFileUrl);
  }

  return [fileContent];
};

const startAsap = async (fn, {
  logger,
  compiledFileUrl,
  cacheInterProcessLocking
}) => {
  const metaJsonFileUrl = getMetaJsonFileUrl(compiledFileUrl);
  const metaJsonFilePath = util.urlToFileSystemPath(metaJsonFileUrl);
  logger.debug(`lock ${metaJsonFilePath}`); // in case this process try to concurrently access meta we wait for previous to be done

  const unlockLocal = await lockForRessource(metaJsonFilePath);

  let unlockInterProcessLock = () => {};

  if (cacheInterProcessLocking) {
    // after that we use a lock pathnameRelative to be sure we don't conflict with other process
    // trying to do the same (mapy happen when spawining multiple server for instance)
    // https://github.com/moxystudio/node-proper-lockfile/issues/69
    await util.ensureParentDirectories(metaJsonFilePath); // https://github.com/moxystudio/node-proper-lockfile#lockfile-options

    const lockfile = require$1("proper-lockfile");

    unlockInterProcessLock = await lockfile.lock(metaJsonFilePath, {
      realpath: false,
      retries: {
        retries: 20,
        minTimeout: 20,
        maxTimeout: 500
      }
    });
  }

  try {
    return await fn();
  } finally {
    // we want to unlock in case of error too
    logger.debug(`unlock ${metaJsonFilePath}`);
    unlockLocal();
    unlockInterProcessLock();
  } // here in case of error.code === 'ELOCKED' thrown from here
  // https://github.com/moxystudio/node-proper-lockfile/blob/1a478a43a077a7a7efc46ac79fd8f713a64fd499/lib/lockfile.js#L54
  // we could give a better failure message when server tries to compile a file
  // otherwise he'll get a 500 without much more info to debug
  // we use two lock because the local lock is very fast, it's a sort of perf improvement

};

const compileFile = async ({
  // cancellatioToken,
  logger,
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  fileContentFallback,
  projectFileRequestedCallback = () => {},
  request,
  compile,
  writeOnFilesystem,
  useFilesystemAsCache,
  compileCacheStrategy = "etag",
  serverCompileCacheHitTracking = false,
  serverCompileCacheInterProcessLocking = false,
  compileCacheSourcesValidation,
  compileCacheAssetsValidation
}) => {
  if (writeOnFilesystem && compileCacheStrategy !== "etag" && compileCacheStrategy !== "mtime") {
    throw new Error(`compileCacheStrategy must be etag or mtime , got ${compileCacheStrategy}`);
  }

  const {
    headers = {}
  } = request;
  const clientCacheDisabled = headers["cache-control"] === "no-cache";
  const cacheWithETag = writeOnFilesystem && compileCacheStrategy === "etag";
  let ifEtagMatch;

  if (cacheWithETag && "if-none-match" in headers) {
    ifEtagMatch = headers["if-none-match"];
  }

  const cacheWithMtime = writeOnFilesystem && compileCacheStrategy === "mtime";
  let ifModifiedSinceDate;

  if (cacheWithMtime && "if-modified-since" in headers) {
    const ifModifiedSince = headers["if-modified-since"];

    try {
      ifModifiedSinceDate = new Date(ifModifiedSince);
    } catch (e) {
      return {
        status: 400,
        statusText: "if-modified-since header is not a valid date"
      };
    }
  }

  try {
    const {
      compileResult,
      compileResultStatus,
      timing
    } = await getOrGenerateCompiledFile({
      logger,
      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      fileContentFallback,
      ifEtagMatch,
      ifModifiedSinceDate,
      writeOnFilesystem,
      useFilesystemAsCache,
      cacheHitTracking: serverCompileCacheHitTracking,
      cacheInterProcessLocking: serverCompileCacheInterProcessLocking,
      compileCacheSourcesValidation,
      compileCacheAssetsValidation,
      compile
    });
    compileResult.sources.forEach(source => {
      const sourceFileUrl = util.resolveUrl(source, compiledFileUrl);
      projectFileRequestedCallback(util.urlToRelativeUrl(sourceFileUrl, projectDirectoryUrl), request);
    });
    const {
      contentType,
      compiledSource
    } = compileResult;

    if (cacheWithETag && !clientCacheDisabled) {
      if (ifEtagMatch && compileResultStatus === "cached") {
        return {
          status: 304,
          timing
        };
      }

      return {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(compiledSource),
          "content-type": contentType,
          "etag": util.bufferToEtag(Buffer.from(compiledSource))
        },
        body: compiledSource,
        timing
      };
    }

    if (cacheWithMtime && !clientCacheDisabled) {
      if (ifModifiedSinceDate && compileResultStatus === "cached") {
        return {
          status: 304,
          timing
        };
      }

      return {
        status: 200,
        headers: {
          "content-length": Buffer.byteLength(compiledSource),
          "content-type": contentType,
          "last-modified": new Date(await util.readFileSystemNodeModificationTime(compiledFileUrl)).toUTCString()
        },
        body: compiledSource,
        timing
      };
    }

    return {
      status: 200,
      headers: {
        "content-length": Buffer.byteLength(compiledSource),
        "content-type": contentType
      },
      body: compiledSource,
      timing
    };
  } catch (error) {
    if (error && error.code === "PARSE_ERROR") {
      const {
        data
      } = error;
      const {
        filename
      } = data;

      if (filename) {
        const relativeUrl = util.urlToRelativeUrl(util.fileSystemPathToUrl(filename), projectDirectoryUrl);
        projectFileRequestedCallback(relativeUrl, request);
      } // on the correspondig file


      const json = JSON.stringify(data);
      return {
        status: 500,
        statusText: "parse error",
        headers: {
          "cache-control": "no-store",
          "content-length": Buffer.byteLength(json),
          "content-type": "application/json"
        },
        body: json
      };
    }

    if (error && error.statusText === "Unexpected directory operation") {
      return {
        status: 403
      };
    }

    return server.convertFileSystemErrorToResponseProperties(error);
  }
};

const minifyJs = async (jsString, jsUrl, options) => {
  const {
    minify
  } = require$1("terser");

  const result = await minify({
    [jsUrl]: jsString
  }, options);
  return result;
};

const getJavaScriptSourceMappingUrl = javaScriptSource => {
  let sourceMappingUrl;
  replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, value => {
    sourceMappingUrl = value;
  });
  return sourceMappingUrl;
};
const setJavaScriptSourceMappingUrl = (javaScriptSource, sourceMappingFileUrl) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(javaScriptSource, javascriptSourceMappingUrlCommentRegexp, () => {
    replaced = true;
    return sourceMappingFileUrl ? writeJavaScriptSourceMappingURL(sourceMappingFileUrl) : "";
  });

  if (replaced) {
    return sourceAfterReplace;
  }

  return sourceMappingFileUrl ? `${javaScriptSource}
${writeJavaScriptSourceMappingURL(sourceMappingFileUrl)}` : javaScriptSource;
};
const getCssSourceMappingUrl = cssSource => {
  let sourceMappingUrl;
  replaceSourceMappingUrl(cssSource, cssSourceMappingUrlCommentRegExp, value => {
    sourceMappingUrl = value;
  });
  return sourceMappingUrl;
};
const setCssSourceMappingUrl = (cssSource, sourceMappingFileUrl) => {
  let replaced;
  const sourceAfterReplace = replaceSourceMappingUrl(cssSource, cssSourceMappingUrlCommentRegExp, () => {
    replaced = true;
    return sourceMappingFileUrl ? writeCssSourceMappingUrl(sourceMappingFileUrl) : "";
  });

  if (replaced) {
    return sourceAfterReplace;
  }

  return sourceMappingFileUrl ? `${cssSource}
${writeCssSourceMappingUrl(sourceMappingFileUrl)}` : cssSource;
};
const javascriptSourceMappingUrlCommentRegexp = /\/\/ ?# ?sourceMappingURL=([^\s'"]+)/g;
const cssSourceMappingUrlCommentRegExp = /\/\*# ?sourceMappingURL=([^\s'"]+) \*\//g; // ${"//#"} is to avoid a parser thinking there is a sourceMappingUrl for this file

const writeJavaScriptSourceMappingURL = value => `${"//#"} sourceMappingURL=${value}`;

const writeCssSourceMappingUrl = value => `/*# sourceMappingURL=${value} */`;

const sourcemapToBase64Url = sourcemap => {
  const asBase64 = Buffer.from(JSON.stringify(sourcemap)).toString("base64");
  return `data:application/json;charset=utf-8;base64,${asBase64}`;
};

const replaceSourceMappingUrl = (source, regexp, callback) => {
  let lastSourceMappingUrl;
  let matchSourceMappingUrl;

  while (matchSourceMappingUrl = regexp.exec(source)) {
    lastSourceMappingUrl = matchSourceMappingUrl;
  }

  if (lastSourceMappingUrl) {
    const index = lastSourceMappingUrl.index;
    const before = source.slice(0, index);
    const after = source.slice(index);
    const mappedAfter = after.replace(regexp, (match, firstGroup) => {
      return callback(firstGroup);
    });
    return `${before}${mappedAfter}`;
  }

  return source;
};

const {
  transformSync
} = require$1("@babel/core");

const bundleWorker = ({
  workerScriptUrl,
  workerScriptSourceMap
}) => {
  const {
    code,
    map
  } = transformWorkerScript(workerScriptUrl, {
    workerScriptSourceMap
  });
  return {
    code,
    map
  };
};

const transformWorkerScript = (scriptUrl, {
  workerScriptSourceMap,
  importerUrl
}) => {
  const scriptPath = util.urlToFileSystemPath(scriptUrl);
  let scriptContent;

  try {
    scriptContent = String(fs.readFileSync(scriptPath));
  } catch (e) {
    if (e.code === "ENOENT") {
      if (importerUrl) {
        throw new Error(logger.createDetailedMessage(`no file found for an import in a worker.`, {
          ["worker url"]: importerUrl,
          ["imported url"]: scriptUrl
        }));
      }

      throw new Error(`no worker file at ${scriptUrl}`);
    }

    throw e;
  }

  const {
    code,
    map
  } = transformSync(scriptContent, {
    filename: scriptPath,
    configFile: false,
    babelrc: false,
    // trust only these options, do not read any babelrc config file
    ast: false,
    inputSourceMap: workerScriptSourceMap,
    sourceMaps: true,
    // sourceFileName: scriptPath,
    plugins: [[babelPluginInlineImportScripts, {}]]
  });
  return {
    code,
    map
  };
};

const babelPluginInlineImportScripts = api => {
  const {
    types,
    parse
  } = api;
  return {
    name: "transform-inline-import-scripts",
    visitor: {
      CallExpression: (path, {
        file: {
          opts: {
            filename
          }
        }
      }) => {
        const calleePath = path.get("callee");

        const replaceImportScriptsWithFileContents = () => {
          const fileUrl = util.fileSystemPathToUrl(filename);
          let previousArgType = "";
          const importedUrls = path.get("arguments").map((arg, index) => {
            if (!types.isStringLiteral(arg)) {
              if (previousArgType && previousArgType !== "dynamic") {
                throw new Error(`importScript mixed arguments: arg number ${index} is dynamic while previous arg was ${previousArgType}`);
              }

              previousArgType = "dynamic";
              return arg;
            }

            const importedUrl = util.resolveUrl(arg.node.value, fileUrl);

            if (!importedUrl.startsWith("file://")) {
              if (previousArgType && previousArgType !== "remote") {
                throw new Error(`importScript mixed arguments: arg number ${index} targets a remote url while previous arg was ${previousArgType}`);
              }

              previousArgType = "remote";
              return arg;
            }

            previousArgType = "local";
            return importedUrl;
          });

          if (previousArgType === "local") {
            const nodes = importedUrls.reduce((previous, importedUrl) => {
              const importedScriptResult = transformWorkerScript(importedUrl, {
                importerUrl: fileUrl
              });
              const importedSourceAst = parse(importedScriptResult.code);
              return [...previous, ...importedSourceAst.program.body];
            }, []);
            calleePath.parentPath.replaceWithMultiple(nodes);
          }
        };

        if (types.isIdentifier(calleePath.node, {
          name: "importScripts"
        })) {
          replaceImportScriptsWithFileContents();
          return;
        }

        if (types.isMemberExpression(calleePath.node)) {
          const calleeObject = calleePath.get("object");
          const isSelf = types.isIdentifier(calleeObject.node, {
            name: "self"
          });

          if (isSelf) {
            const propertyPath = calleePath.get("property");

            if (types.isIdentifier(propertyPath.node, {
              name: "importScripts"
            })) {
              replaceImportScriptsWithFileContents();
              return;
            }
          }
        }
      }
    }
  };
};

const buildServiceWorker = async ({
  projectDirectoryUrl,
  buildDirectoryUrl,
  serviceWorkerProjectRelativeUrl,
  serviceWorkerBuildRelativeUrl = serviceWorkerProjectRelativeUrl,
  minify = false,
  serviceWorkerTransformer = code => code
}) => {
  const serviceWorkerProjectUrl = util.resolveUrl(serviceWorkerProjectRelativeUrl, projectDirectoryUrl);
  const serviceWorkerBuildUrl = util.resolveUrl(serviceWorkerBuildRelativeUrl, buildDirectoryUrl);
  const workerBundle = bundleWorker({
    workerScriptUrl: serviceWorkerProjectUrl
  });
  const serviceWorkerCode = serviceWorkerTransformer(workerBundle.code);

  if (minify) {
    const minifyResult = await minifyJs(serviceWorkerCode, serviceWorkerProjectRelativeUrl, {
      sourceMap: { ...(workerBundle.map ? {
          content: JSON.stringify(workerBundle.map)
        } : {}),
        asObject: true,
        includeSources: true
      }
    });
    await writeJsAndSourcemap(serviceWorkerBuildUrl, minifyResult.code, minifyResult.map);
  } else {
    await writeJsAndSourcemap(serviceWorkerBuildUrl, serviceWorkerCode, workerBundle.map);
  }
};

const writeJsAndSourcemap = async (serviceWorkerBuildUrl, serviceWorkerCode, serviceWorkerSourceMap) => {
  const filename = util.urlToFilename(serviceWorkerBuildUrl);
  const sourcemapFilename = `${filename}.map`;
  const sourcemapBuildUrl = `${util.urlToParentUrl(serviceWorkerBuildUrl)}${sourcemapFilename}`;
  serviceWorkerCode = setJavaScriptSourceMappingUrl(serviceWorkerCode, sourcemapFilename);
  await Promise.all([util.writeFile(serviceWorkerBuildUrl, serviceWorkerCode), util.writeFile(sourcemapBuildUrl, JSON.stringify(serviceWorkerSourceMap, null, "  "))]);
};

const createBareSpecifierError = ({
  specifier,
  importer,
  importMapUrl
}) => {
  const detailedMessage = logger.createDetailedMessage("Unmapped bare specifier.", {
    specifier,
    importer,
    "how to fix": `Add a mapping for "${specifier}" into the importmap file at ${importMapUrl}`,
    "suggestion": `Generate importmap using https://github.com/jsenv/jsenv-node-module-import-map`
  });
  return new Error(detailedMessage);
};

https.globalAgent.options.rejectUnauthorized = false;
const fetchUrl = async (url, {
  ignoreHttpsError = true,
  ...rest
} = {}) => {
  const response = await server.fetchUrl(url, {
    ignoreHttpsError,
    ...rest
  });
  return {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: server.headersToObject(response.headers),
    text: response.text.bind(response),
    json: response.json.bind(response),
    blob: response.blob.bind(response),
    arrayBuffer: response.arrayBuffer.bind(response)
  };
};

const validateResponseStatusIsOk = async (response, importer) => {
  const {
    status,
    url
  } = response;

  if (status === 404) {
    return {
      valid: false,
      message: logger.createDetailedMessage(`Error: got 404 on url.`, {
        url,
        ["imported by"]: importer
      })
    };
  }

  if (status === 500) {
    if (response.headers["content-type"] === "application/json") {
      return {
        valid: false,
        message: logger.createDetailedMessage(`Error: error on url.`, {
          url,
          "imported by": importer,
          "parse error": JSON.stringify(await response.json(), null, "  ")
        })
      };
    }
  }

  if (responseStatusIsOk(status)) {
    return {
      valid: true
    };
  }

  return {
    valid: false,
    message: logger.createDetailedMessage(`unexpected response status.`, {
      ["response status"]: status,
      ["expected status"]: "200 to 299",
      url,
      ["imported by"]: importer
    })
  };
};

const responseStatusIsOk = responseStatus => responseStatus >= 200 && responseStatus < 300;

/**

minimalBabelPluginArray exists so that jsenv support latest js syntax by default.
Otherwise users have to explicitely enable those syntax when they use it.

*/

const syntaxDynamicImport = require$1("@babel/plugin-syntax-dynamic-import");

const syntaxImportMeta = require$1("@babel/plugin-syntax-import-meta");

const syntaxNumericSeparator = require$1("@babel/plugin-syntax-numeric-separator");

const minimalBabelPluginArray = [syntaxDynamicImport, syntaxImportMeta, syntaxNumericSeparator];

// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel

const {
  addNamespace,
  addDefault,
  addNamed
} = require$1("@babel/helper-module-imports");

const {
  parseExpression
} = require$1("@babel/parser");

const babelPluginTransformImportMeta = (api, pluginOptions) => {
  const {
    replaceImportMeta
  } = pluginOptions;
  let babelState;

  const jsValueToAst = jsValue => {
    const valueAst = parseExpression(jsValue, babelState.opts);
    return valueAst;
  };

  return {
    pre: state => {
      babelState = state;
    },
    //  visitor: {
    //     Program(programPath) {
    //       const paths = []
    //       programPath.traverse({
    //         MetaProperty(metaPropertyPath) {
    //           const metaPropertyNode = metaPropertyPath.node
    //           if (!metaPropertyNode.meta) {
    //             return
    //           }
    //           if (metaPropertyNode.meta.name !== "import") {
    //             return
    //           }
    //           if (metaPropertyNode.property.name !== "meta") {
    //             return
    //           }
    //           paths.push(metaPropertyPath)
    //         },
    //       })
    //       const importAst = addNamespace(programPath, importMetaSpecifier)
    //       paths.forEach((path) => {
    //         path.replaceWith(importAst)
    //       })
    //     },
    visitor: {
      Program(programPath) {
        const metaPropertyPathMap = {};
        programPath.traverse({
          MemberExpression(path) {
            const {
              node
            } = path;
            const {
              object
            } = node;

            if (object.type !== "MetaProperty") {
              return;
            }

            const {
              property: objectProperty
            } = object;

            if (objectProperty.name !== "meta") {
              return;
            }

            const {
              property
            } = node;
            const {
              name
            } = property;

            if (name in metaPropertyPathMap) {
              metaPropertyPathMap[name].push(path);
            } else {
              metaPropertyPathMap[name] = [path];
            }
          }

        });
        Object.keys(metaPropertyPathMap).forEach(importMetaPropertyName => {
          replaceImportMeta(importMetaPropertyName, {
            replaceWithImport: ({
              namespace,
              name,
              from,
              nameHint
            }) => {
              let importAst;

              if (namespace) {
                importAst = addNamespace(programPath, from, {
                  nameHint
                });
              } else if (name) {
                importAst = addNamed(programPath, name, from);
              } else {
                importAst = addDefault(programPath, from, {
                  nameHint
                });
              }

              metaPropertyPathMap[importMetaPropertyName].forEach(path => {
                path.replaceWith(importAst);
              });
            },
            replaceWithValue: value => {
              const valueAst = jsValueToAst( // eslint-disable-next-line no-nested-ternary
              value === undefined ? "undefined" : value === null ? "null" : JSON.stringify(value));
              metaPropertyPathMap[importMetaPropertyName].forEach(path => {
                path.replaceWith(valueAst);
              });
            }
          });
        });
      }

    }
  };
};

const findAsyncPluginNameInBabelPluginMap = babelPluginMap => {
  if ("transform-async-to-promises" in babelPluginMap) {
    return "transform-async-to-promises";
  }

  if ("transform-async-to-generator" in babelPluginMap) {
    return "transform-async-to-generator";
  }

  return "";
};

// https://github.com/drudru/ansi_up/blob/master/ansi_up.js

const ansiToHTML = ansiString => {
  const Convert = require$1("ansi-to-html");

  return new Convert().toHtml(ansiString);
};

const ensureRegeneratorRuntimeImportBabelPlugin = (api, options) => {
  const {
    addSideEffect
  } = require$1("@babel/helper-module-imports");

  api.assertVersion(7);
  const {
    regeneratorRuntimeIdentifierName = "regeneratorRuntime",
    regeneratorRuntimeImportPath = "@jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js"
  } = options;
  return {
    visitor: {
      Identifier(path, opts) {
        const {
          filename
        } = opts;
        const filepathname = filename.replace(/\\/g, "/");

        if (filepathname.endsWith("node_modules/regenerator-runtime/runtime.js")) {
          return;
        }

        const {
          node
        } = path;

        if (node.name === regeneratorRuntimeIdentifierName) {
          addSideEffect(path.scope.getProgramParent().path, regeneratorRuntimeImportPath);
        }
      }

    }
  };
};

const ensureGlobalThisImportBabelPlugin = (api, options) => {
  const {
    addSideEffect
  } = require$1("@babel/helper-module-imports");

  api.assertVersion(7);
  const {
    globalThisIdentifierName = "globalThis",
    globalThisImportPath = "@jsenv/core/helpers/global-this/global-this.js"
  } = options;
  return {
    visitor: {
      Identifier(path, opts) {
        const {
          filename
        } = opts;
        const filepathname = filename.replace(/\\/g, "/");

        if (filepathname.endsWith("/helpers/global-this/global-this.js")) {
          return;
        }

        const {
          node
        } = path;

        if (node.name === globalThisIdentifierName) {
          addSideEffect(path.scope.getProgramParent().path, globalThisImportPath);
        }
      }

    }
  };
};

// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-core/src/tools/build-external-helpers.js

const {
  list
} = require$1("@babel/helpers");

const babelHelperNameInsideJsenvCoreArray = ["applyDecoratedDescriptor", "arrayLikeToArray", "arrayWithHoles", "arrayWithoutHoles", "assertThisInitialized", "AsyncGenerator", "asyncGeneratorDelegate", "asyncIterator", "asyncToGenerator", "awaitAsyncGenerator", "AwaitValue", "classCallCheck", "classNameTDZError", "classPrivateFieldDestructureSet", "classPrivateFieldGet", "classPrivateFieldLooseBase", "classPrivateFieldLooseKey", "classPrivateFieldSet", "classPrivateMethodGet", "classPrivateMethodSet", "classStaticPrivateFieldSpecGet", "classStaticPrivateFieldSpecSet", "classStaticPrivateMethodGet", "classStaticPrivateMethodSet", "construct", "createClass", "createForOfIteratorHelper", "createForOfIteratorHelperLoose", "createSuper", "decorate", "defaults", "defineEnumerableProperties", "defineProperty", "extends", "get", "getPrototypeOf", "inherits", "inheritsLoose", "initializerDefineProperty", "initializerWarningHelper", "instanceof", "interopRequireDefault", "interopRequireWildcard", "isNativeFunction", "isNativeReflectConstruct", "iterableToArray", "iterableToArrayLimit", "iterableToArrayLimitLoose", "jsx", "newArrowCheck", "nonIterableRest", "nonIterableSpread", "objectDestructuringEmpty", "objectSpread", "objectSpread2", "objectWithoutProperties", "objectWithoutPropertiesLoose", "possibleConstructorReturn", "readOnlyError", "set", "setPrototypeOf", "skipFirstGeneratorNext", "slicedToArray", "slicedToArrayLoose", "superPropBase", "taggedTemplateLiteral", "taggedTemplateLiteralLoose", "tdz", "temporalRef", "temporalUndefined", "toArray", "toConsumableArray", "toPrimitive", "toPropertyKey", "typeof", "unsupportedIterableToArray", "wrapAsyncGenerator", "wrapNativeSuper", "wrapRegExp"];
const babelHelperScope = "@jsenv/core/helpers/babel/"; // maybe we can put back / in front of .jsenv here because we will
// "redirect" or at least transform everything inside .jsenv
// not only everything inside .dist

const babelHelperAbstractScope = `.jsenv/helpers/babel/`;
const babelHelperNameToImportSpecifier = babelHelperName => {
  if (babelHelperNameInsideJsenvCoreArray.includes(babelHelperName)) {
    return `${babelHelperScope}${babelHelperName}/${babelHelperName}.js`;
  }

  return `${babelHelperAbstractScope}${babelHelperName}/${babelHelperName}.js`;
};
const filePathToBabelHelperName = filePath => {
  const fileUrl = util.fileSystemPathToUrl(filePath);
  const babelHelperPrefix = "core/helpers/babel/";

  if (fileUrl.includes(babelHelperPrefix)) {
    const afterBabelHelper = fileUrl.slice(fileUrl.indexOf(babelHelperPrefix) + babelHelperPrefix.length);
    return afterBabelHelper.slice(0, afterBabelHelper.indexOf("/"));
  }

  if (fileUrl.includes(babelHelperAbstractScope)) {
    const afterBabelHelper = fileUrl.slice(fileUrl.indexOf(babelHelperAbstractScope) + babelHelperAbstractScope.length);
    return afterBabelHelper.slice(0, afterBabelHelper.indexOf("/"));
  }

  return null;
};

const {
  addDefault: addDefault$1
} = require$1("@babel/helper-module-imports"); // named import approach found here:
// https://github.com/rollup/rollup-plugin-babel/blob/18e4232a450f320f44c651aa8c495f21c74d59ac/src/helperPlugin.js#L1
// for reference this is how it's done to reference
// a global babel helper object instead of using
// a named import
// https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-plugin-external-helpers/src/index.js


const transformBabelHelperToImportBabelPlugin = api => {
  api.assertVersion(7);
  return {
    pre: file => {
      const cachedHelpers = {};
      file.set("helperGenerator", name => {
        // the list of possible helpers name
        // https://github.com/babel/babel/blob/99f4f6c3b03c7f3f67cf1b9f1a21b80cfd5b0224/packages/babel-helpers/src/helpers.js#L13
        if (!file.availableHelper(name)) {
          return undefined;
        }

        if (cachedHelpers[name]) {
          return cachedHelpers[name];
        }

        const filePath = file.opts.filename;
        const babelHelperImportSpecifier = babelHelperNameToImportSpecifier(name);

        if (filePathToBabelHelperName(filePath) === name) {
          return undefined;
        }

        const helper = addDefault$1(file.path, babelHelperImportSpecifier, {
          nameHint: `_${name}`
        });
        cachedHelpers[name] = helper;
        return helper;
      });
    }
  };
};

/* eslint-disable import/max-dependencies */

const {
  transformAsync,
  transformFromAstAsync
} = require$1("@babel/core");

const transformModulesSystemJs = require$1("@babel/plugin-transform-modules-systemjs");

const proposalDynamicImport = require$1("@babel/plugin-proposal-dynamic-import");

const jsenvTransform = async ({
  inputCode,
  inputPath,
  inputRelativePath,
  inputAst,
  inputMap,
  babelPluginMap,
  moduleOutFormat,
  importMetaFormat,
  importMetaEnvFileSpecifier,
  importMeta = {},
  allowTopLevelAwait,
  transformTopLevelAwait,
  transformGenerator,
  transformGlobalThis,
  regeneratorRuntimeImportPath,
  sourcemapEnabled
}) => {
  // https://babeljs.io/docs/en/options
  const options = {
    filename: inputPath,
    filenameRelative: inputRelativePath,
    inputSourceMap: inputMap,
    configFile: false,
    babelrc: false,
    // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: sourcemapEnabled,
    sourceFileName: inputPath,
    // https://babeljs.io/docs/en/options#parseropts
    parserOpts: {
      allowAwaitOutsideFunction: allowTopLevelAwait
    }
  };
  const babelHelperName = filePathToBabelHelperName(inputPath); // to prevent typeof circular dependency

  if (babelHelperName === "typeof") {
    const babelPluginMapWithoutTransformTypeOf = {};
    Object.keys(babelPluginMap).forEach(key => {
      if (key !== "transform-typeof-symbol") {
        babelPluginMapWithoutTransformTypeOf[key] = babelPluginMap[key];
      }
    });
    babelPluginMap = babelPluginMapWithoutTransformTypeOf;
  }

  if (transformGenerator) {
    babelPluginMap = { ...babelPluginMap,
      "ensure-regenerator-runtime-import": [ensureRegeneratorRuntimeImportBabelPlugin, {
        regeneratorRuntimeImportPath
      }]
    };
  }

  if (transformGlobalThis) {
    babelPluginMap = { ...babelPluginMap,
      "ensure-global-this-import": [ensureGlobalThisImportBabelPlugin]
    };
  }

  babelPluginMap = {
    "transform-import-meta": [babelPluginTransformImportMeta, {
      replaceImportMeta: (metaPropertyName, {
        replaceWithImport,
        replaceWithValue
      }) => {
        if (metaPropertyName === "url") {
          if (importMetaFormat === "esmodule") {
            // keep native version
            return;
          }

          if (importMetaFormat === "systemjs") {
            // systemjs will handle it
            return;
          }

          if (importMetaFormat === "commonjs") {
            replaceWithImport({
              from: `@jsenv/core/helpers/import-meta/import-meta-url-commonjs.js`
            });
            return;
          }

          if (importMetaFormat === "global") {
            replaceWithImport({
              from: `@jsenv/core/helpers/import-meta/import-meta-url-global.js`
            });
            return;
          }

          return;
        }

        if (metaPropertyName === "resolve") {
          if (importMetaFormat === "esmodule") {
            // keep native version
            return;
          }

          if (importMetaFormat === "systemjs") {
            // systemjs will handle it
            return;
          }

          if (importMetaFormat === "commonjs") {
            throw createParseError({
              message: `import.meta.resolve() not supported with commonjs format`
            }); // replaceWithImport({
            //   from: `@jsenv/core/helpers/import-meta/import-meta-resolve-commonjs.js`,
            // })
            // return
          }

          if (importMetaFormat === "global") {
            throw createParseError({
              message: `import.meta.resolve() not supported with global format`
            }); // replaceWithImport({
            //   from: `@jsenv/core/helpers/import-meta/import-meta-resolve-global.js`,
            // })
            // return
          }

          return;
        }

        if (metaPropertyName === "env") {
          replaceWithImport({
            namespace: true,
            from: importMetaEnvFileSpecifier,
            nameHint: path.basename(importMetaEnvFileSpecifier)
          });
          return;
        }

        replaceWithValue(importMeta[metaPropertyName]);
      }
    }],
    ...babelPluginMap,
    "transform-babel-helpers-to-import": [transformBabelHelperToImportBabelPlugin]
  };
  const asyncPluginName = findAsyncPluginNameInBabelPluginMap(babelPluginMap);

  if (moduleOutFormat === "systemjs" && transformTopLevelAwait && asyncPluginName) {
    const babelPluginArrayWithoutAsync = [];
    Object.keys(babelPluginMap).forEach(name => {
      if (name !== asyncPluginName) {
        babelPluginArrayWithoutAsync.push(babelPluginMap[name]);
      }
    }); // put body inside something like (async () => {})()

    const result = await babelTransform({
      ast: inputAst,
      code: inputCode,
      options: { ...options,
        plugins: [...minimalBabelPluginArray, ...babelPluginArrayWithoutAsync, [proposalDynamicImport], [transformModulesSystemJs]]
      }
    }); // we need to retranspile the await keywords now wrapped
    // inside Systemjs function.
    // They are ignored, at least by transform-async-to-promises
    // see https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/26

    const finalResult = await babelTransform({
      // ast: result.ast,
      code: result.code,
      options: { ...options,
        // about inputSourceMap see
        // https://github.com/babel/babel/blob/eac4c5bc17133c2857f2c94c1a6a8643e3b547a7/packages/babel-core/src/transformation/file/generate.js#L57
        // https://github.com/babel/babel/blob/090c364a90fe73d36a30707fc612ce037bdbbb24/packages/babel-core/src/transformation/file/merge-map.js#L6s
        inputSourceMap: result.map,
        plugins: [...minimalBabelPluginArray, babelPluginMap[asyncPluginName]]
      }
    });
    return { ...result,
      ...finalResult,
      metadata: { ...result.metadata,
        ...finalResult.metadata
      }
    };
  }

  const babelPluginArray = [...minimalBabelPluginArray, ...Object.keys(babelPluginMap).map(babelPluginName => babelPluginMap[babelPluginName]), ...(moduleOutFormat === "systemjs" ? [[proposalDynamicImport], [transformModulesSystemJs]] : [])];
  const result = await babelTransform({
    ast: inputAst,
    code: inputCode,
    options: { ...options,
      plugins: babelPluginArray
    }
  });
  return result;
};

const babelTransform = async ({
  ast,
  code,
  options
}) => {
  try {
    if (ast) {
      const result = await transformFromAstAsync(ast, code, options);
      return result;
    }

    return await transformAsync(code, options);
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      const message = error.message;
      throw createParseError({
        message: message.replace(ansiRegex, ""),
        messageHTML: ansiToHTML(message),
        filename: options.filename,
        lineNumber: error.loc.line,
        columnNumber: error.loc.column
      });
    }

    throw error;
  }
};

const pattern = ["[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)", "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"].join("|");
const ansiRegex = new RegExp(pattern, "g");

const createParseError = data => {
  const {
    message
  } = data;
  const parseError = new Error(message);
  parseError.code = "PARSE_ERROR";
  parseError.data = data;
  return parseError;
};

const transformJs = async ({
  projectDirectoryUrl,
  code,
  url,
  urlAfterTransform,
  map,
  babelPluginMap,
  convertMap = {},
  moduleOutFormat = "esmodule",
  importMetaFormat = moduleOutFormat,
  importMetaEnvFileRelativeUrl,
  importMeta,
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformGenerator = true,
  transformGlobalThis = true,
  sourcemapEnabled = true
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`);
  }

  if (typeof code === "undefined") {
    throw new TypeError(`code missing, received ${code}`);
  }

  if (typeof url !== "string") {
    throw new TypeError(`url must be a string, got ${url}`);
  }

  const {
    inputCode,
    inputMap
  } = await computeInputCodeAndInputMap({
    code: String(code),
    url,
    urlAfterTransform,
    map,
    projectDirectoryUrl,
    convertMap,
    sourcemapEnabled,
    allowTopLevelAwait
  });
  const inputPath = computeInputPath(url);
  const inputRelativePath = computeInputRelativePath(url, projectDirectoryUrl);
  const importMetaEnvFileUrl = util.resolveUrl(importMetaEnvFileRelativeUrl, projectDirectoryUrl);
  const importMetaEnvRelativeUrlForInput = util.urlToRelativeUrl(importMetaEnvFileUrl, url);
  const importMetaEnvFileSpecifier = relativeUrlToSpecifier(importMetaEnvRelativeUrlForInput);
  return jsenvTransform({
    inputCode,
    inputMap,
    inputPath,
    inputRelativePath,
    babelPluginMap,
    convertMap,
    moduleOutFormat,
    importMetaFormat,
    importMetaEnvFileSpecifier,
    importMeta,
    allowTopLevelAwait,
    transformTopLevelAwait,
    transformGenerator,
    transformGlobalThis,
    sourcemapEnabled
  });
};

const computeInputCodeAndInputMap = async ({
  code,
  url,
  urlAfterTransform,
  map,
  projectDirectoryUrl,
  convertMap,
  remap,
  allowTopLevelAwait
}) => {
  const structuredMetaMap = util.normalizeStructuredMetaMap({
    convert: convertMap
  }, projectDirectoryUrl);
  const {
    convert
  } = util.urlToMeta({
    url,
    structuredMetaMap
  });

  if (!convert) {
    return {
      inputCode: code,
      inputMap: map
    };
  }

  if (typeof convert !== "function") {
    throw new TypeError(`convert must be a function, got ${convert}`);
  } // TODO: handle map when passed


  const conversionResult = await convert({
    projectDirectoryUrl,
    code,
    url,
    urlAfterTransform,
    map,
    remap,
    allowTopLevelAwait
  });

  if (typeof conversionResult !== "object") {
    throw new TypeError(`convert must return an object, got ${conversionResult}`);
  }

  const inputCode = conversionResult.code;

  if (typeof inputCode !== "string") {
    throw new TypeError(`convert must return { code } string, got { code: ${inputCode} } `);
  }

  const inputMap = conversionResult.map;
  return {
    inputCode,
    inputMap
  };
};

const computeInputPath = url => {
  if (url.startsWith("file://")) {
    return util.urlToFileSystemPath(url);
  }

  return url;
};

const computeInputRelativePath = (url, projectDirectoryUrl) => {
  if (url.startsWith(projectDirectoryUrl)) {
    return util.urlToRelativeUrl(url, projectDirectoryUrl);
  }

  return undefined;
};

const relativeUrlToSpecifier = relativeUrl => {
  if (relativeUrl.startsWith("data:")) return relativeUrl;
  if (relativeUrl.startsWith("http:")) return relativeUrl;
  if (relativeUrl.startsWith("https:")) return relativeUrl;
  if (relativeUrl.startsWith("file:")) return relativeUrl;
  if (relativeUrl.startsWith("../")) return relativeUrl;
  if (relativeUrl.startsWith("./")) return relativeUrl;
  return `./${relativeUrl}`;
};

const renderNamePattern = (pattern, replacements) => {
  return pattern.replace(/\[(\w+)\]/g, (_match, type) => {
    const replacement = replacements[type]();
    return replacement;
  });
};

/**

An important concern here:

All script type="module" will be converted to inline script.
These inline script execution order is non predictible it depends
which one is being done first

*/

const parse5 = require$1("parse5"); // https://github.com/inikulin/parse5/blob/master/packages/parse5/lib/tree-adapters/default.js
// eslint-disable-next-line import/no-unresolved
// const treeAdapter = require("parse5/lib/tree-adapters/default.js")


const parseHtmlString = htmlString => {
  const htmlAst = parse5.parse(htmlString, {
    sourceCodeLocationInfo: true
  });
  return htmlAst;
};
const parseSvgString = svgString => {
  const svgAst = parse5.parseFragment(svgString, {
    sourceCodeLocationInfo: true
  });
  return svgAst;
};
const stringifyHtmlAst = htmlAst => {
  const htmlString = parse5.serialize(htmlAst);
  return htmlString;
};
const findNode = (htmlStringOrAst, predicate) => {
  const htmlAst = typeof htmlStringOrAst === "string" ? parseHtmlString(htmlStringOrAst) : htmlStringOrAst;
  let nodeMatching = null;
  visitHtmlAst(htmlAst, node => {
    if (predicate(node)) {
      nodeMatching = node;
      return "stop";
    }

    return null;
  });
  return nodeMatching;
};
const findFirstImportmapNode = htmlStringOrAst => findNode(htmlStringOrAst, htmlNodeIsScriptImportmap);
const getHtmlNodeAttributeByName = (htmlNode, attributeName) => htmlNode.attrs.find(attr => attr.name === attributeName);
const removeHtmlNodeAttribute = (htmlNode, attributeToRemove) => {
  let attrIndex;

  if (typeof attributeToRemove === "object") {
    attrIndex = htmlNode.attrs.indexOf(attributeToRemove);
  }

  if (attrIndex === -1) {
    return false;
  }

  htmlNode.attrs.splice(attrIndex, 1);
  return true;
};
const addHtmlNodeAttribute = (htmlNode, attributeToSet) => {
  if (typeof attributeToSet !== "object") {
    throw new TypeError(`addHtmlNodeAttribute attribute must be an object {name, value}`);
  }

  const existingAttributeIndex = htmlNode.attrs.findIndex(attr => attr.name === attributeToSet.name);

  if (existingAttributeIndex === -1) {
    htmlNode.attrs.push(attributeToSet);
  } else {
    htmlNode.attrs[existingAttributeIndex] = attributeToSet;
  }
};
const getHtmlNodeTextNode = htmlNode => {
  const firstChild = htmlNode.childNodes[0];
  return firstChild && firstChild.nodeName === "#text" ? firstChild : null;
};
const setHtmlNodeText = (htmlNode, textContent) => {
  const textNode = getHtmlNodeTextNode(htmlNode);

  if (textNode) {
    textNode.value = textContent;
  } else {
    const newTextNode = {
      nodeName: "#text",
      value: textContent,
      parentNode: htmlNode
    };
    htmlNode.childNodes.splice(0, 0, newTextNode);
  }
};
const removeHtmlNodeText = htmlNode => {
  const textNode = getHtmlNodeTextNode(htmlNode);

  if (textNode) {
    htmlNode.childNodes = [];
  }
};
const getHtmlNodeLocation = htmlNode => {
  const {
    sourceCodeLocation
  } = htmlNode;

  if (!sourceCodeLocation) {
    return {};
  }

  const {
    startLine,
    startCol
  } = sourceCodeLocation;
  return {
    line: startLine,
    column: startCol
  };
};
const htmlAstContains = (htmlAst, predicate) => {
  let contains = false;
  visitHtmlAst(htmlAst, node => {
    if (predicate(node)) {
      contains = true;
      return "stop";
    }

    return null;
  });
  return contains;
};
const htmlNodeIsScriptModule = htmlNode => {
  if (htmlNode.nodeName !== "script") {
    return false;
  }

  const typeAttribute = getHtmlNodeAttributeByName(htmlNode, "type");

  if (!typeAttribute) {
    return false;
  }

  return typeAttribute.value === "module";
};
const htmlNodeIsScriptImportmap = htmlNode => {
  if (htmlNode.nodeName !== "script") {
    return false;
  }

  const typeAttribute = getHtmlNodeAttributeByName(htmlNode, "type");

  if (!typeAttribute) {
    return false;
  }

  return typeAttribute.value === "importmap";
};
const parseSrcset = srcsetString => {
  const srcsetParts = [];
  srcsetString.split(",").forEach(set => {
    const [specifier, descriptor] = set.trim().split(" ");
    srcsetParts.push({
      specifier,
      descriptor
    });
  });
  return srcsetParts;
};
const stringifySrcset = srcsetParts => {
  const srcsetString = srcsetParts.map(({
    specifier,
    descriptor
  }) => `${specifier} ${descriptor}`).join(", ");
  return srcsetString;
}; // let's <img>, <link for favicon>, <link for css>, <styles>
// <audio> <video> <picture> supports comes for free by detecting
// <source src> attribute
// if srcset is used we should parse it and collect all src referenced in it
// also <link ref="preload">
// ideally relative iframe should recursively fetch (not needed so lets ignore)
// <svg> ideally looks for external ressources inside them
// but right now we will focus on: <link href> and <style> tags
// on veut vérifier qu'on les récupere bien
// dans rollup pour chaque css on feras le transformcss + l'ajout des assets reférencés
// pour le style inline on le parse aussi et on le remettra inline dans le html
// ensuite qu'on est capable de les mettre a jour
// ce qui veut dire de mettre a jour link.ref et style.text

const parseHtmlAstRessources = htmlAst => {
  const links = [];
  const styles = [];
  const scripts = [];
  const imgs = [];
  const images = [];
  const uses = [];
  const sources = [];
  visitHtmlAst(htmlAst, node => {
    if (node.nodeName === "link") {
      links.push(node);
      return;
    }

    if (node.nodeName === "style") {
      styles.push(node);
      return;
    }

    if (node.nodeName === "script") {
      scripts.push(node);
      return;
    }

    if (node.nodeName === "img") {
      imgs.push(node);
      return;
    }

    if (node.nodeName === "image") {
      images.push(node);
      return;
    }

    if (node.nodeName === "use") {
      uses.push(node);
      return;
    }

    if (node.nodeName === "source") {
      sources.push(node);
      return;
    }
  });
  return {
    links,
    styles,
    scripts,
    imgs,
    images,
    uses,
    sources
  };
};
const replaceHtmlNode = (node, replacement, {
  inheritAttributes = true
} = {}) => {
  let newNode;

  if (typeof replacement === "string") {
    newNode = parseHtmlAsSingleElement(replacement);
  } else {
    newNode = replacement;
  }

  if (inheritAttributes) {
    newNode.attrs = [// inherit script attributes except src, type, href
    ...node.attrs.filter(({
      name
    }) => name !== "type" && name !== "src" && name !== "href"), ...newNode.attrs];
  }

  replaceNode(node, newNode);
};
const manipulateHtmlAst = (htmlAst, {
  scriptInjections = []
}) => {
  const htmlNode = htmlAst.childNodes.find(node => node.nodeName === "html");
  const headNode = htmlNode.childNodes[0];
  const bodyNode = htmlNode.childNodes[1];
  const scriptsToPreprendInHead = [];
  scriptInjections.forEach(script => {
    const scriptExistingInHead = findExistingScript(headNode, script);

    if (scriptExistingInHead) {
      replaceNode(scriptExistingInHead, scriptToNode(script));
      return;
    }

    const scriptExistingInBody = findExistingScript(bodyNode, script);

    if (scriptExistingInBody) {
      replaceNode(scriptExistingInBody, scriptToNode(script));
      return;
    }

    scriptsToPreprendInHead.push(script);
  });
  const headScriptsFragment = scriptsToFragment(scriptsToPreprendInHead);
  insertFragmentBefore(headNode, headScriptsFragment, findChild(headNode, node => node.nodeName === "script"));
};

const insertFragmentBefore = (node, fragment, childNode) => {
  const {
    childNodes = []
  } = node;

  if (childNode) {
    const childNodeIndex = childNodes.indexOf(childNode);
    node.childNodes = [...childNodes.slice(0, childNodeIndex), ...fragment.childNodes.map(child => {
      return { ...child,
        parentNode: node
      };
    }), ...childNodes.slice(childNodeIndex)];
  } else {
    node.childNodes = [...childNodes, ...fragment.childNodes.map(child => {
      return { ...child,
        parentNode: node
      };
    })];
  }
};

const scriptToNode = script => {
  return scriptsToFragment([script]).childNodes[0];
};

const scriptsToFragment = scripts => {
  const html = scripts.reduce((previous, script) => {
    const {
      text = "",
      ...attributes
    } = script;
    const scriptAttributes = objectToHtmlAttributes(attributes);
    return `${previous}<script ${scriptAttributes}>${text}</script>
      `;
  }, "");
  const fragment = parse5.parseFragment(html);
  return fragment;
};

const findExistingScript = (node, script) => findChild(node, childNode => {
  return childNode.nodeName === "script" && sameScript(childNode, script);
});

const findChild = ({
  childNodes = []
}, predicate) => childNodes.find(predicate);

const sameScript = (node, {
  type = "text/javascript",
  src
}) => {
  const typeAttribute = getHtmlNodeAttributeByName(node, "type");

  if (!typeAttribute) {
    return type === undefined || type === "text/javascript";
  }

  if (typeAttribute !== type) {
    return false;
  }

  const srcAttribute = getHtmlNodeAttributeByName(node, "src");

  if (!srcAttribute) {
    return src === undefined;
  }

  if (srcAttribute.value !== src) {
    return false;
  }

  return true;
};

const objectToHtmlAttributes = object => {
  return Object.keys(object).map(key => `${key}=${valueToHtmlAttributeValue(object[key])}`).join(" ");
};

const valueToHtmlAttributeValue = value => {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  return `"${JSON.stringify(value)}"`;
};
const getUniqueNameForInlineHtmlNode = (node, nodes, pattern) => {
  return renderNamePattern(pattern, {
    id: () => {
      const idAttribute = getHtmlNodeAttributeByName(node, "id");

      if (idAttribute) {
        return idAttribute.value;
      }

      const {
        line,
        column
      } = getHtmlNodeLocation(node);
      const lineTaken = nodes.some(nodeCandidate => nodeCandidate !== node && getHtmlNodeLocation(nodeCandidate).line === line);

      if (lineTaken) {
        return `${line}.${column}`;
      }

      return line;
    }
  });
};

const parseHtmlAsSingleElement = html => {
  const fragment = parse5.parseFragment(html);
  return fragment.childNodes[0];
};

const replaceNode = (node, newNode) => {
  const {
    parentNode
  } = node;
  const parentNodeChildNodes = parentNode.childNodes;
  const nodeIndex = parentNodeChildNodes.indexOf(node);
  parentNodeChildNodes[nodeIndex] = newNode;
};

const visitHtmlAst = (htmlAst, callback) => {
  const visitNode = node => {
    const callbackReturnValue = callback(node);

    if (callbackReturnValue === "stop") {
      return;
    }

    const {
      childNodes
    } = node;

    if (childNodes) {
      let i = 0;

      while (i < childNodes.length) {
        visitNode(childNodes[i++]);
      }
    }
  };

  visitNode(htmlAst);
};

const sortObjectByPathnames = object => {
  const objectSorted = {};
  const keysSorted = Object.keys(object).sort(util.comparePathnames);
  keysSorted.forEach(key => {
    objectSorted[key] = object[key];
  });
  return objectSorted;
};

const parseDataUrl = dataUrl => {
  const afterDataProtocol = dataUrl.slice("data:".length);
  const commaIndex = afterDataProtocol.indexOf(",");
  const beforeComma = afterDataProtocol.slice(0, commaIndex);
  let mediaType;
  let base64Flag;

  if (beforeComma.endsWith(`;base64`)) {
    mediaType = beforeComma.slice(0, -`;base64`.length);
    base64Flag = true;
  } else {
    mediaType = beforeComma;
    base64Flag = false;
  }

  const afterComma = afterDataProtocol.slice(commaIndex + 1);
  return {
    mediaType: mediaType === "" ? "text/plain;charset=US-ASCII" : mediaType,
    base64Flag,
    data: afterComma
  };
};
const stringifyDataUrl = ({
  mediaType,
  base64Flag = true,
  data
}) => {
  if (!mediaType || mediaType === "text/plain;charset=US-ASCII") {
    // can be a buffer or a string, hence check on data.length instead of !data or data === ''
    if (data.length === 0) {
      return `data:,`;
    }

    if (base64Flag) {
      return `data:,${data}`;
    }

    return `data:,${dataToBase64(data)}`;
  }

  if (base64Flag) {
    return `data:${mediaType};base64,${dataToBase64(data)}`;
  }

  return `data:${mediaType},${data}`;
};
const dataUrlToRawData = ({
  base64Flag,
  data
}) => {
  return base64Flag ? base64ToString(data) : data;
};
const dataToBase64 = typeof window === "object" ? window.atob : data => Buffer.from(data).toString("base64");
const base64ToString = typeof window === "object" ? window.btoa : base64String => Buffer.from(base64String, "base64").toString("utf8");

const getTargetAsBase64Url = ({
  targetBuildBuffer,
  targetContentType
}) => {
  return stringifyDataUrl({
    data: targetBuildBuffer,
    base64Flag: true,
    mediaType: targetContentType
  });
};
const memoize = fn => {
  let called;
  let previousCallReturnValue;

  const memoized = (...args) => {
    if (called) return previousCallReturnValue;
    previousCallReturnValue = fn(...args);
    called = true;
    return previousCallReturnValue;
  };

  memoized.forceMemoization = value => {
    called = true;
    previousCallReturnValue = value;
  };

  return memoized;
};
const getCallerLocation = () => {
  const {
    prepareStackTrace
  } = Error;

  Error.prepareStackTrace = (error, stack) => {
    Error.prepareStackTrace = prepareStackTrace;
    return stack;
  };

  const {
    stack
  } = new Error();
  const callerCallsite = stack[2];
  const fileName = callerCallsite.getFileName();
  return {
    url: fileName && util.isFileSystemPath(fileName) ? util.fileSystemPathToUrl(fileName) : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber()
  };
};
const compareContentType = (leftContentType, rightContentType) => {
  if (leftContentType === rightContentType) {
    return true;
  }

  if (leftContentType === "text/javascript" && rightContentType === "application/javascript") {
    return true;
  }

  if (leftContentType === "application/javascript" && rightContentType === "text/javascript") {
    return true;
  }

  return false;
};
const checkContentType = (reference, {
  logger,
  showReferenceSourceLocation
}) => {
  const {
    referenceExpectedContentType
  } = reference;
  const {
    targetContentType
  } = reference.target;

  if (!referenceExpectedContentType) {
    return;
  }

  if (compareContentType(referenceExpectedContentType, targetContentType)) {
    return;
  } // sourcemap content type is fine if we got octet-stream too


  const {
    targetUrl
  } = reference.target;

  if (referenceExpectedContentType === "application/json" && targetContentType === "application/octet-stream" && targetUrl.endsWith(".map")) {
    return;
  }

  logger.warn(formatContentTypeMismatchLog(reference, {
    showReferenceSourceLocation
  }));
};

const formatContentTypeMismatchLog = (reference, {
  showReferenceSourceLocation
}) => {
  const {
    referenceExpectedContentType,
    target
  } = reference;
  const {
    targetContentType,
    targetUrl
  } = target;
  return logger.createDetailedMessage(`A reference was expecting ${referenceExpectedContentType} but found ${targetContentType} instead.`, {
    ["reference"]: showReferenceSourceLocation(reference),
    ["target url"]: targetUrl
  });
};

const formatExternalReferenceLog = (reference, {
  showReferenceSourceLocation,
  projectDirectoryUrl
}) => {
  const {
    target
  } = reference;
  const {
    targetUrl
  } = target;
  return logger.createDetailedMessage(`Found reference to an url outside project directory.
${showReferenceSourceLocation(reference)}`, {
    ["target url"]: targetUrl,
    ["project directory url"]: projectDirectoryUrl
  });
};
const formatReferenceFound = (reference, referenceSourceLocation) => {
  const {
    target
  } = reference;
  const {
    targetIsInline,
    targetIsJsModule,
    targetRelativeUrl
  } = target;
  let message;

  if (targetIsInline && targetIsJsModule) {
    message = `found inline js module.`;
  } else if (targetIsInline) {
    message = `found inline asset.`;
  } else if (targetIsJsModule) {
    message = `found js module reference to ${targetRelativeUrl}.`;
  } else {
    message = `found asset reference to ${targetRelativeUrl}.`;
  }

  message += `
--- reference source ---
${referenceSourceLocation}`;
  return message;
}; // const textualContentTypes = ["text/html", "text/css", "image/svg+xml"]
// const isTextualContentType = (contentType) => {
//   if (textualContentTypes.includes(contentType)) {
//     return true
//   }
//   if (contentType.startsWith("text/")) {
//     return true
//   }
//   return false
// }

const collectNodesMutations = (nodes, notifiers, target, candidates) => {
  const mutations = [];
  nodes.forEach(node => {
    mutations.push(...collectNodeMutations(node, notifiers, target, nodes, candidates));
  });
  return mutations;
};
const htmlNodeToReferenceLocation = htmlNode => {
  const {
    line,
    column
  } = getHtmlNodeLocation(htmlNode);
  return {
    referenceLine: line,
    referenceColumn: column
  };
};

const collectNodeMutations = (node, notifiers, target, nodes, candidates) => {
  let firstValueReturned;
  candidates.find(candidate => {
    const returnValue = candidate(node, notifiers, target, nodes);

    if (returnValue === null || returnValue === undefined) {
      return false;
    }

    firstValueReturned = returnValue;
    return true;
  });

  if (typeof firstValueReturned === "function") {
    return [firstValueReturned];
  }

  if (Array.isArray(firstValueReturned)) {
    return firstValueReturned;
  }

  return [];
};

const minifyHtml = (htmlString, options) => {
  const {
    minify
  } = require$1("html-minifier");

  return minify(htmlString, options);
};

const parseSvgAsset = async (svgTarget, notifiers, {
  minify,
  minifyHtmlOptions
}) => {
  const svgString = String(svgTarget.targetBuffer);
  const svgAst = await parseSvgString(svgString);
  const htmlRessources = parseHtmlAstRessources(svgAst);
  const mutations = collectSvgMutations(htmlRessources, notifiers, svgTarget);
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    mutations.forEach(mutationCallback => {
      mutationCallback({
        getReferenceUrlRelativeToImporter
      });
    });
    const svgAfterTransformation = stringifyHtmlAst(svgAst); // could also benefit of minification https://github.com/svg/svgo

    return minify ? minifyHtml(svgAfterTransformation, minifyHtmlOptions) : svgAfterTransformation;
  };
};
const collectSvgMutations = ({
  images,
  uses
}, notifiers, svgTarget) => {
  const imagesMutations = collectNodesMutations(images, notifiers, svgTarget, [imageHrefVisitor]);
  const usesMutations = collectNodesMutations(uses, notifiers, svgTarget, [useHrefVisitor]);
  const svgMutations = [...imagesMutations, ...usesMutations];
  return svgMutations;
};

const imageHrefVisitor = (image, {
  notifyReferenceFound
}) => {
  const hrefAttribute = getHtmlNodeAttributeByName(image, "href");

  if (!hrefAttribute) {
    return null;
  }

  const hrefReference = notifyReferenceFound({
    referenceTargetSpecifier: hrefAttribute.value,
    ...htmlNodeToReferenceLocation(image)
  });
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    const hrefNewValue = referenceToUrl(hrefReference, getReferenceUrlRelativeToImporter);
    hrefAttribute.value = hrefNewValue;
  };
};

const useHrefVisitor = (use, {
  notifyReferenceFound
}) => {
  const hrefAttribute = getHtmlNodeAttributeByName(use, "href");

  if (!hrefAttribute) {
    return null;
  }

  const href = hrefAttribute.value;

  if (href[0] === "#") {
    return null;
  }

  const {
    hash
  } = new URL(href, "file://");
  const hrefReference = notifyReferenceFound({
    referenceTargetSpecifier: href,
    ...htmlNodeToReferenceLocation(use)
  });
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    const hrefNewValue = referenceToUrl(hrefReference, getReferenceUrlRelativeToImporter);
    hrefAttribute.value = `${hrefNewValue}${hash}`;
  };
};

const referenceToUrl = (reference, getReferenceUrlRelativeToImporter) => {
  const {
    targetIsInline
  } = reference.target;

  if (targetIsInline) {
    return getTargetAsBase64Url(reference.target);
  }

  return getReferenceUrlRelativeToImporter(reference);
};

/**

Finds all asset reference in html then update all references to target the files in dist/ when needed.

There is some cases where the asset won't be found and updated:
- inline styles
- inline attributes

Don't write the following for instance:

<div style="background:url('img.png')"></div>

Or be sure to also reference this url somewhere in the html file like

<link rel="preload" href="img.png" />

*/
const parseHtmlAsset = async (htmlTarget, notifiers, {
  minify,
  minifyHtmlOptions,
  htmlStringToHtmlAst = htmlString => parseHtmlString(htmlString),
  htmlAstToHtmlString = htmlAst => stringifyHtmlAst(htmlAst)
} = {}) => {
  const htmlString = String(htmlTarget.targetBuffer);
  const htmlAst = await htmlStringToHtmlAst(htmlString);
  const {
    links,
    styles,
    scripts,
    imgs,
    images,
    uses,
    sources
  } = parseHtmlAstRessources(htmlAst);
  const scriptsMutations = collectNodesMutations(scripts, notifiers, htmlTarget, [// regular javascript are not parseable by rollup
  // and we don't really care about there content
  // we will handle them as regular asset
  // but we still want to inline/minify/hash them for performance
  regularScriptSrcVisitor, regularScriptTextNodeVisitor, moduleScriptSrcVisitor, moduleScriptTextNodeVisitor, importmapScriptSrcVisitor, importmapScriptTextNodeVisitor]);
  const linksMutations = collectNodesMutations(links, notifiers, htmlTarget, [linkStylesheetHrefVisitor, linkHrefVisitor]);
  const stylesMutations = collectNodesMutations(styles, notifiers, htmlTarget, [styleTextNodeVisitor]);
  const imgsSrcMutations = collectNodesMutations(imgs, notifiers, htmlTarget, [imgSrcVisitor]);
  const imgsSrcsetMutations = collectNodesMutations(imgs, notifiers, htmlTarget, [srcsetVisitor]);
  const sourcesSrcMutations = collectNodesMutations(sources, notifiers, htmlTarget, [sourceSrcVisitor]);
  const sourcesSrcsetMutations = collectNodesMutations(sources, notifiers, htmlTarget, [srcsetVisitor]);
  const svgMutations = collectSvgMutations({
    images,
    uses
  }, notifiers, htmlTarget);
  const htmlMutations = [...scriptsMutations, ...linksMutations, ...stylesMutations, ...imgsSrcMutations, ...imgsSrcsetMutations, ...sourcesSrcMutations, ...sourcesSrcsetMutations, ...svgMutations];
  return async params => {
    htmlMutations.forEach(mutationCallback => {
      mutationCallback({ ...params
      });
    });
    const htmlAfterTransformation = htmlAstToHtmlString(htmlAst);
    return minify ? minifyHtml(htmlAfterTransformation, minifyHtmlOptions) : htmlAfterTransformation;
  };
};

const regularScriptSrcVisitor = (script, {
  notifyReferenceFound
}) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type");

  if (typeAttribute && (typeAttribute.value !== "text/javascript" || typeAttribute.value !== "application/javascript")) {
    return null;
  }

  const srcAttribute = getHtmlNodeAttributeByName(script, "src");

  if (!srcAttribute) {
    return null;
  }

  const remoteScriptReference = notifyReferenceFound({
    referenceExpectedContentType: "application/javascript",
    referenceTargetSpecifier: srcAttribute.value,
    ...htmlNodeToReferenceLocation(script)
  });
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    const {
      targetIsInline
    } = remoteScriptReference.target;

    if (targetIsInline) {
      removeHtmlNodeAttribute(script, srcAttribute);
      const {
        targetBuildBuffer
      } = remoteScriptReference.target;
      setHtmlNodeText(script, targetBuildBuffer);
    } else {
      const urlRelativeToImporter = getReferenceUrlRelativeToImporter(remoteScriptReference);
      srcAttribute.value = urlRelativeToImporter;
    }
  };
};

const regularScriptTextNodeVisitor = (script, {
  notifyReferenceFound
}, htmlTarget, scripts) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type");

  if (typeAttribute && (typeAttribute.value !== "text/javascript" || typeAttribute.value !== "application/javascript")) {
    return null;
  }

  const srcAttribute = getHtmlNodeAttributeByName(script, "src");

  if (srcAttribute) {
    return null;
  }

  const textNode = getHtmlNodeTextNode(script);

  if (!textNode) {
    return null;
  }

  const jsReference = notifyReferenceFound({
    referenceExpectedContentType: "application/javascript",
    referenceTargetSpecifier: getUniqueNameForInlineHtmlNode(script, scripts, `${util.urlToBasename(htmlTarget.targetUrl)}.[id].js`),
    ...htmlNodeToReferenceLocation(script),
    targetContentType: "application/javascript",
    targetBuffer: Buffer.from(textNode.value),
    targetIsInline: true
  });
  return () => {
    const {
      targetBuildBuffer
    } = jsReference.target;
    textNode.value = targetBuildBuffer;
  };
};

const moduleScriptSrcVisitor = (script, {
  format,
  notifyReferenceFound
}) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type");

  if (!typeAttribute) {
    return null;
  }

  if (typeAttribute.value !== "module") {
    return null;
  }

  const srcAttribute = getHtmlNodeAttributeByName(script, "src");

  if (!srcAttribute) {
    return null;
  }

  const remoteScriptReference = notifyReferenceFound({
    referenceExpectedContentType: "application/javascript",
    referenceTargetSpecifier: srcAttribute.value,
    ...htmlNodeToReferenceLocation(script),
    targetIsJsModule: true
  });
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    if (format === "systemjs") {
      typeAttribute.value = "systemjs-module";
    }

    const urlRelativeToImporter = getReferenceUrlRelativeToImporter(remoteScriptReference);
    const relativeUrlNotation = ensureRelativeUrlNotation(urlRelativeToImporter);
    srcAttribute.value = relativeUrlNotation;
  };
};

const moduleScriptTextNodeVisitor = (script, {
  format,
  notifyReferenceFound
}, htmlTarget, scripts) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type");

  if (!typeAttribute) {
    return null;
  }

  if (typeAttribute.value !== "module") {
    return null;
  }

  const srcAttribute = getHtmlNodeAttributeByName(script, "src");

  if (srcAttribute) {
    return null;
  }

  const textNode = getHtmlNodeTextNode(script);

  if (!textNode) {
    return null;
  }

  const jsReference = notifyReferenceFound({
    referenceExpectedContentType: "application/javascript",
    referenceTargetSpecifier: getUniqueNameForInlineHtmlNode(script, scripts, `${util.urlToBasename(htmlTarget.targetUrl)}.[id].js`),
    ...htmlNodeToReferenceLocation(script),
    targetContentType: "application/javascript",
    targetBuffer: textNode.value,
    targetIsJsModule: true,
    targetIsInline: true
  });
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    if (format === "systemjs") {
      typeAttribute.value = "systemjs-module";
    }

    const urlRelativeToImporter = getReferenceUrlRelativeToImporter(jsReference);
    const relativeUrlNotation = ensureRelativeUrlNotation(urlRelativeToImporter);
    removeHtmlNodeText(script);
    addHtmlNodeAttribute(script, {
      name: "src",
      value: relativeUrlNotation
    });
  };
};

const importmapScriptSrcVisitor = (script, {
  format,
  notifyReferenceFound
}) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type");

  if (!typeAttribute) {
    return null;
  }

  if (typeAttribute.value !== "importmap") {
    return null;
  }

  const srcAttribute = getHtmlNodeAttributeByName(script, "src");

  if (!srcAttribute) {
    return null;
  }

  const importmapReference = notifyReferenceFound({
    referenceExpectedContentType: "application/importmap+json",
    referenceTargetSpecifier: srcAttribute.value,
    ...htmlNodeToReferenceLocation(script),
    // here we want to force the fileName for the importmap
    // so that we don't have to rewrite its content
    // the goal is to put the importmap at the same relative path
    // than in the project
    targetFileNamePattern: () => {
      const importmapReferenceUrl = importmapReference.referenceUrl;
      const importmapTargetUrl = importmapReference.target.targetUrl;
      const importmapUrlRelativeToImporter = util.urlToRelativeUrl(importmapTargetUrl, importmapReferenceUrl);
      const importmapParentRelativeUrl = util.urlToRelativeUrl(util.urlToParentUrl(util.resolveUrl(importmapUrlRelativeToImporter, "file://")), "file://");
      return `${importmapParentRelativeUrl}[name]-[hash][extname]`;
    }
  });
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    if (format === "systemjs") {
      typeAttribute.value = "systemjs-importmap";
    }

    const {
      targetIsInline
    } = importmapReference.target;

    if (targetIsInline) {
      // here put a warning if we cannot inline importmap because it would mess
      // the remapping (note that it's feasible) but not yet supported
      removeHtmlNodeAttribute(script, srcAttribute);
      const {
        targetBuildBuffer
      } = importmapReference.target;
      setHtmlNodeText(script, targetBuildBuffer);
    } else {
      const urlRelativeToImporter = getReferenceUrlRelativeToImporter(importmapReference);
      srcAttribute.value = urlRelativeToImporter;
    }
  };
};

const importmapScriptTextNodeVisitor = (script, {
  format,
  notifyReferenceFound
}, htmlTarget, scripts) => {
  const typeAttribute = getHtmlNodeAttributeByName(script, "type");

  if (!typeAttribute) {
    return null;
  }

  if (typeAttribute.value !== "importmap") {
    return null;
  }

  const srcAttribute = getHtmlNodeAttributeByName(script, "src");

  if (srcAttribute) {
    return null;
  }

  const textNode = getHtmlNodeTextNode(script);

  if (!textNode) {
    return null;
  }

  const importmapReference = notifyReferenceFound({
    referenceExpectedContentType: "application/importmap+json",
    referenceTargetSpecifier: getUniqueNameForInlineHtmlNode(script, scripts, `${util.urlToBasename(htmlTarget.targetUrl)}.[id].importmap`),
    ...htmlNodeToReferenceLocation(script),
    targetContentType: "application/importmap+json",
    targetBuffer: Buffer.from(textNode.value),
    targetIsInline: true
  });
  return () => {
    if (format === "systemjs") {
      typeAttribute.value = "systemjs-importmap";
    }

    const {
      targetBuildBuffer
    } = importmapReference.target;
    textNode.value = targetBuildBuffer;
  };
};

const linkStylesheetHrefVisitor = (link, {
  notifyReferenceFound
}) => {
  const hrefAttribute = getHtmlNodeAttributeByName(link, "href");

  if (!hrefAttribute) {
    return null;
  }

  const relAttribute = getHtmlNodeAttributeByName(link, "rel");

  if (!relAttribute) {
    return null;
  }

  if (relAttribute.value !== "stylesheet") {
    return null;
  }

  const cssReference = notifyReferenceFound({
    referenceExpectedContentType: "text/css",
    referenceTargetSpecifier: hrefAttribute.value,
    ...htmlNodeToReferenceLocation(link)
  });
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    const {
      targetIsInline
    } = cssReference.target;

    if (targetIsInline) {
      const {
        targetBuildBuffer
      } = cssReference.target;
      replaceHtmlNode(link, `<style>${targetBuildBuffer}</style>`);
    } else {
      const urlRelativeToImporter = getReferenceUrlRelativeToImporter(cssReference);
      hrefAttribute.value = urlRelativeToImporter;
    }
  };
};

const linkHrefVisitor = (link, {
  notifyReferenceFound
}) => {
  const hrefAttribute = getHtmlNodeAttributeByName(link, "href");

  if (!hrefAttribute) {
    return null;
  }

  const contentType = linkToContentType(link);
  const reference = notifyReferenceFound({
    referenceExpectedContentType: contentType,
    referenceTargetSpecifier: hrefAttribute.value,
    ...htmlNodeToReferenceLocation(link),
    targetUrlVersioningDisabled: contentType === "application/manifest+json"
  });
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    const {
      targetIsInline
    } = reference.target;

    if (targetIsInline) {
      replaceHtmlNode(link, `<link href="${getTargetAsBase64Url(reference.target)}" />`);
    } else {
      const urlRelativeToImporter = getReferenceUrlRelativeToImporter(reference);
      hrefAttribute.value = urlRelativeToImporter;
    }
  };
};

const linkToContentType = link => {
  const typeAttribute = getHtmlNodeAttributeByName(link, "type");

  if (typeAttribute) {
    return typeAttribute.value;
  }

  const relAttribute = getHtmlNodeAttributeByName(link, "rel");

  if (relAttribute) {
    if (relAttribute.value === "manifest") {
      return "application/manifest+json";
    }
  }

  return undefined;
};

const styleTextNodeVisitor = (style, {
  notifyReferenceFound
}, htmlTarget, styles) => {
  const textNode = getHtmlNodeTextNode(style);

  if (!textNode) {
    return null;
  }

  const inlineStyleReference = notifyReferenceFound({
    referenceExpectedContentType: "text/css",
    referenceTargetSpecifier: getUniqueNameForInlineHtmlNode(style, styles, `${util.urlToBasename(htmlTarget.targetUrl)}.[id].css`),
    ...htmlNodeToReferenceLocation(style),
    targetContentType: "text/css",
    targetBuffer: Buffer.from(textNode.value),
    targetIsInline: true
  });
  return () => {
    const {
      targetBuildBuffer
    } = inlineStyleReference.target;
    textNode.value = targetBuildBuffer;
  };
};

const imgSrcVisitor = (img, {
  notifyReferenceFound
}) => {
  const srcAttribute = getHtmlNodeAttributeByName(img, "src");

  if (!srcAttribute) {
    return null;
  }

  const srcReference = notifyReferenceFound({
    referenceTargetSpecifier: srcAttribute.value,
    ...htmlNodeToReferenceLocation(img)
  });
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    const srcNewValue = referenceToUrl$1(srcReference, getReferenceUrlRelativeToImporter);
    srcAttribute.value = srcNewValue;
  };
};

const srcsetVisitor = (htmlNode, {
  notifyReferenceFound
}) => {
  const srcsetAttribute = getHtmlNodeAttributeByName(htmlNode, "srcset");

  if (!srcsetAttribute) {
    return null;
  }

  const srcsetParts = parseSrcset(srcsetAttribute.value);
  const srcsetPartsReferences = srcsetParts.map(({
    specifier
  }) => notifyReferenceFound({
    referenceTargetSpecifier: specifier,
    ...htmlNodeToReferenceLocation(htmlNode)
  }));

  if (srcsetParts.length === 0) {
    return null;
  }

  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    srcsetParts.forEach((srcsetPart, index) => {
      const reference = srcsetPartsReferences[index];
      srcsetPart.specifier = referenceToUrl$1(reference, getReferenceUrlRelativeToImporter);
    });
    const srcsetNewValue = stringifySrcset(srcsetParts);
    srcsetAttribute.value = srcsetNewValue;
  };
};

const sourceSrcVisitor = (source, {
  notifyReferenceFound
}) => {
  const srcAttribute = getHtmlNodeAttributeByName(source, "src");

  if (!srcAttribute) {
    return null;
  }

  const typeAttribute = getHtmlNodeAttributeByName(source, "type");
  const srcReference = notifyReferenceFound({
    referenceExpectedContentType: typeAttribute ? typeAttribute.value : undefined,
    referenceTargetSpecifier: srcAttribute.value,
    ...htmlNodeToReferenceLocation(source)
  });
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    const srcNewValue = referenceToUrl$1(srcReference, getReferenceUrlRelativeToImporter);
    srcAttribute.value = srcNewValue;
  };
};

const referenceToUrl$1 = (reference, getReferenceUrlRelativeToImporter) => {
  const {
    targetIsInline
  } = reference.target;

  if (targetIsInline) {
    return getTargetAsBase64Url(reference.target);
  }

  return getReferenceUrlRelativeToImporter(reference);
}; // otherwise systemjs handle it as a bare import


const ensureRelativeUrlNotation = relativeUrl => {
  if (relativeUrl.startsWith("../")) {
    return relativeUrl;
  }

  return `./${relativeUrl}`;
};

const parseImportmapAsset = (importmapTarget, notifiers, {
  minify,
  importMapToInject
}) => {
  const importmapString = String(importmapTarget.targetBuffer);
  return () => {
    if (importMapToInject) {
      const importmapOriginal = JSON.parse(importmapString);
      const importmapFinal = importMap.composeTwoImportMaps(importmapOriginal, importMapToInject);
      return minify ? valueToCompactJsonString(importmapFinal) : valueToReadableJsonString(importmapFinal);
    }

    return minify ? valueToCompactJsonString(JSON.parse(importmapString)) : importmapString;
  };
}; // removes eventual whitespace in json

const valueToCompactJsonString = json => JSON.stringify(json); // prefer a readable json when minification is disabled


const valueToReadableJsonString = json => JSON.stringify(json, null, "  ");

const applyPostCss = async (cssString, cssUrl, plugins, // https://github.com/postcss/postcss#options
options = {}) => {
  const postcss = require$1("postcss");

  let result;

  try {
    const cssFileUrl = urlToFileUrl(cssUrl);
    result = await postcss(plugins).process(cssString, {
      collectUrls: true,
      from: util.urlToFileSystemPath(cssFileUrl),
      to: util.urlToFileSystemPath(cssFileUrl),
      ...options
    });
  } catch (error) {
    if (error.name === "CssSyntaxError") {
      console.error(String(error));
      throw error;
    }

    throw error;
  }

  return result;
}; // the goal of this function is to take an url that is likely an http url
// info a file:// url
// for instance http://example.com/dir/file.js
// must becomes file:///dir/file.js
// but in windows it must be file://C:/dir/file.js

const filesystemRootUrl = new URL("/", url);

const urlToFileUrl = url => {
  if (url.startsWith("file://")) {
    return url;
  }

  const origin = new URL(url).origin;
  const afterOrigin = url.slice(origin.length);
  return new URL(afterOrigin, filesystemRootUrl).href;
};

/**

https://github.com/postcss/postcss/blob/master/docs/writing-a-plugin.md
https://github.com/postcss/postcss/blob/master/docs/guidelines/plugin.md
https://github.com/postcss/postcss/blob/master/docs/guidelines/runner.md#31-dont-show-js-stack-for-csssyntaxerror

In case css sourcemap contains no%20source
This is because of https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/map-generator.js#L231
and it indicates a node has been replaced without passing source
hence sourcemap cannot point the original source location

*/

const valueParser = require$1("postcss-value-parser");

const postCssUrlHashPlugin = () => {
  return {
    postcssPlugin: "urlhash",
    prepare: result => {
      const {
        from,
        collectUrls = false,
        getUrlReplacementValue = () => undefined
      } = result.opts;
      const fromUrl = util.fileSystemPathToUrl(from);
      return {
        AtRule: {
          import: (atImportNode, {
            AtRule
          }) => {
            if (atImportNode.parent.type !== "root") {
              atImportNode.warn(result, "`@import` should be top level");
              return;
            }

            if (atImportNode.nodes) {
              atImportNode.warn(result, "`@import` was not terminated correctly");
              return;
            }

            const parsed = valueParser(atImportNode.params);
            let [urlNode] = parsed.nodes;

            if (!urlNode || urlNode.type !== "string" && urlNode.type !== "function") {
              atImportNode.warn(result, `No URL in \`${atImportNode.toString()}\``);
              return;
            }

            let url = "";

            if (urlNode.type === "string") {
              url = urlNode.value;
            } else if (urlNode.type === "function") {
              // Invalid function
              if (!/^url$/i.test(urlNode.value)) {
                atImportNode.warn(result, `Invalid \`url\` function in \`${atImportNode.toString()}\``);
                return;
              }

              const firstNode = urlNode.nodes[0];

              if (firstNode && firstNode.type === "string") {
                urlNode = firstNode;
                url = urlNode.value;
              } else {
                urlNode = urlNode.nodes;
                url = valueParser.stringify(urlNode.nodes);
              }
            }

            url = url.trim();

            if (url.length === 0) {
              atImportNode.warn(result, `Empty URL in \`${atImportNode.toString()}\``);
              return;
            }

            const specifier = url;
            url = util.resolveUrl(specifier, fromUrl);

            if (url === fromUrl) {
              atImportNode.warn(result, `\`@import\` loop in \`${atImportNode.toString()}\``);
              return;
            }

            const urlReference = {
              type: "import",
              specifier,
              url,
              atImportNode,
              urlNode
            };
            const urlNewValue = getUrlReplacementValue(urlReference);

            if (urlNewValue && urlNewValue !== urlNode.value) {
              urlNode.value = urlNewValue;
              const newParams = parsed.toString();
              const newAtImportRule = new AtRule({
                name: "import",
                params: newParams,
                source: atImportNode.source
              });
              atImportNode.replaceWith(newAtImportRule);
            }

            if (collectUrls) {
              result.messages.push(urlReference);
            }
          }
        },
        Declaration: declarationNode => {
          if (!declarationNodeContainsUrl(declarationNode)) {
            return;
          }

          walkUrls(declarationNode, (url, urlNode) => {
            // Empty URL
            if (!urlNode || url.length === 0) {
              declarationNode.warn(result, `Empty URL in \`${declarationNode.toString()}\``);
              return;
            } // Skip Data URI


            if (isDataUrl(url)) {
              return;
            }

            const specifier = url;
            url = util.resolveUrl(specifier, util.fileSystemPathToUrl(from));
            const urlReference = {
              type: "asset",
              specifier,
              url,
              declarationNode,
              urlNode
            };
            const urlNewValue = getUrlReplacementValue(urlReference);

            if (urlNewValue) {
              urlNode.value = urlNewValue;
            }

            if (collectUrls) {
              result.messages.push(urlReference);
            }
          });
        }
      };
    }
  };
};
postCssUrlHashPlugin.postcss = true;

const declarationNodeContainsUrl = declarationNode => {
  return /^(?:url|(?:-webkit-)?image-set)\(/i.test(declarationNode.value);
};

const walkUrls = (declarationNode, callback) => {
  const parsed = valueParser(declarationNode.value);
  parsed.walk(node => {
    // https://github.com/andyjansson/postcss-functions
    if (isUrlFunctionNode(node)) {
      const {
        nodes
      } = node;
      const [urlNode] = nodes;
      const url = urlNode && urlNode.type === "string" ? urlNode.value : valueParser.stringify(nodes);
      callback(url.trim(), urlNode);
      return;
    }

    if (isImageSetFunctionNode(node)) {
      Array.from(node.nodes).forEach(childNode => {
        if (childNode.type === "string") {
          callback(childNode.value.trim(), childNode);
          return;
        }

        if (isUrlFunctionNode(node)) {
          const {
            nodes
          } = childNode;
          const [urlNode] = nodes;
          const url = urlNode && urlNode.type === "string" ? urlNode.value : valueParser.stringify(nodes);
          callback(url.trim(), urlNode);
          return;
        }
      });
    }
  });
  declarationNode.value = parsed.toString();
};

const isUrlFunctionNode = node => {
  return node.type === "function" && /^url$/i.test(node.value);
};

const isImageSetFunctionNode = node => {
  return node.type === "function" && /^(?:-webkit-)?image-set$/i.test(node.value);
};

const isDataUrl = url => {
  return /data:[^\n\r;]+?(?:;charset=[^\n\r;]+?)?;base64,([\d+/A-Za-z]+={0,2})/.test(url);
};

const parseCssUrls = async (css, cssUrl = "file:///file.css") => {
  const atImports = [];
  const urlDeclarations = [];
  const postCssPlugins = [postCssUrlHashPlugin];
  const postCssOptions = {
    collectUrls: true
  };
  const result = await applyPostCss(css, cssUrl, postCssPlugins, postCssOptions);
  result.messages.forEach(({
    type,
    specifier,
    atImportNode,
    declarationNode,
    urlNode
  }) => {
    if (type === "import") {
      atImports.push({
        specifier,
        urlNode,
        urlDeclarationNode: atImportNode
      });
    }

    if (type === "asset") {
      urlDeclarations.push({
        specifier,
        urlNode,
        urlDeclarationNode: declarationNode
      });
    }
  });
  return {
    atImports,
    urlDeclarations
  };
};

const replaceCssUrls = async (css, cssUrl, getUrlReplacementValue, {
  cssMinification = false,
  cssMinificationOptions,
  sourcemapOptions = {}
} = {}) => {
  const postcssPlugins = [postCssUrlHashPlugin, ...(cssMinification ? [await getCssMinificationPlugin(cssMinificationOptions)] : [])];
  const postcssOptions = {
    getUrlReplacementValue,
    map: {
      inline: false,
      ...sourcemapOptions
    }
  };
  const result = await applyPostCss(css, cssUrl, postcssPlugins, postcssOptions);
  return result;
};

const getCssMinificationPlugin = async (cssMinificationOptions = {}) => {
  const cssnano = require$1("cssnano");

  const cssnanoDefaultPreset = require$1("cssnano-preset-default");

  return cssnano({
    preset: cssnanoDefaultPreset({ ...cssMinificationOptions // just to show how you could configure dicard comment plugin from css nano
      // https://github.com/cssnano/cssnano/tree/master/packages/cssnano-preset-default
      // discardComments: {
      //   remove: () => false,
      // },

    })
  });
};

const parseCssAsset = async (cssTarget, {
  notifyReferenceFound
}, {
  urlToOriginalServerUrl,
  minify,
  minifyCssOptions
}) => {
  const cssString = String(cssTarget.targetBuffer);
  const cssSourcemapUrl = getCssSourceMappingUrl(cssString);
  let sourcemapReference;

  if (cssSourcemapUrl) {
    sourcemapReference = notifyReferenceFound({
      referenceExpectedContentType: "application/json",
      referenceTargetSpecifier: cssSourcemapUrl,
      // we don't really know the line or column
      // but let's asusme it the last line and first column
      referenceLine: cssString.split(/\r?\n/).length - 1,
      referenceColumn: 0
    });
  }

  const {
    atImports,
    urlDeclarations
  } = await parseCssUrls(cssString, cssTarget.targetUrl);
  const urlNodeReferenceMapping = new Map();
  atImports.forEach(atImport => {
    const importReference = notifyReferenceFound({
      referenceTargetSpecifier: atImport.specifier,
      ...cssNodeToReferenceLocation(atImport.urlDeclarationNode)
    });
    urlNodeReferenceMapping.set(atImport.urlNode, importReference);
  });
  urlDeclarations.forEach(urlDeclaration => {
    const urlReference = notifyReferenceFound({
      referenceTargetSpecifier: urlDeclaration.specifier,
      ...cssNodeToReferenceLocation(urlDeclaration.urlDeclarationNode)
    });
    urlNodeReferenceMapping.set(urlDeclaration.urlNode, urlReference);
  });
  return async ({
    getReferenceUrlRelativeToImporter,
    precomputeBuildRelativeUrl,
    registerAssetEmitter
  }) => {
    const cssReplaceResult = await replaceCssUrls(cssString, cssTarget.targetUrl, ({
      urlNode
    }) => {
      const nodeCandidates = Array.from(urlNodeReferenceMapping.keys());
      const urlNodeFound = nodeCandidates.find(urlNodeCandidate => isSameCssDocumentUrlNode(urlNodeCandidate, urlNode));

      if (!urlNodeFound) {
        return urlNode.value;
      } // url node nous dit quel réfrence y correspond


      const urlNodeReference = urlNodeReferenceMapping.get(urlNodeFound);
      const {
        targetIsInline
      } = urlNodeReference.target;

      if (targetIsInline) {
        return getTargetAsBase64Url(urlNodeReference.target);
      }

      return getReferenceUrlRelativeToImporter(urlNodeReference);
    }, {
      cssMinification: minify,
      cssMinificationOptions: minifyCssOptions,
      // https://postcss.org/api/#sourcemapoptions
      sourcemapOptions: sourcemapReference ? {
        prev: String(sourcemapReference.target.targetBuildBuffer)
      } : {}
    });
    const code = cssReplaceResult.css;
    const map = cssReplaceResult.map.toJSON();
    const cssBuildRelativeUrl = precomputeBuildRelativeUrl(code);
    const cssSourcemapFilename = `${path.basename(cssBuildRelativeUrl)}.map`; // In theory code should never be modified once the url for caching is computed
    // because url for caching depends on file content.
    // There is an exception for sourcemap because we want to update sourcemap.file
    // to the cached filename of the css file.
    // To achieve that we set/update the sourceMapping url comment in compiled css file.
    // This is totally fine to do that because sourcemap and css file lives togethers
    // so this comment changes nothing regarding cache invalidation and is not important
    // to decide the filename for this css asset.

    const cssSourceAfterTransformation = setCssSourceMappingUrl(code, cssSourcemapFilename);
    registerAssetEmitter(({
      buildDirectoryUrl,
      emitAsset
    }) => {
      const cssBuildUrl = util.resolveUrl(cssTarget.targetBuildRelativeUrl, buildDirectoryUrl);
      const mapBuildUrl = util.resolveUrl(cssSourcemapFilename, cssBuildUrl);
      map.file = util.urlToFilename(cssBuildUrl);

      if (map.sources) {
        // hum en fait si css est inline, alors la source n'est pas le fichier compilé
        // mais bien le fichier html compilé ?
        const importerUrl = cssTarget.targetIsInline ? urlToOriginalServerUrl(cssTarget.targetUrl) : cssTarget.targetUrl;
        map.sources = map.sources.map(source => {
          const sourceUrl = util.resolveUrl(source, importerUrl);
          const sourceUrlRelativeToSourceMap = util.urlToRelativeUrl(sourceUrl, mapBuildUrl);
          return sourceUrlRelativeToSourceMap;
        });
      }

      const mapSource = JSON.stringify(map, null, "  ");
      const buildRelativeUrl = util.urlToRelativeUrl(mapBuildUrl, buildDirectoryUrl);

      if (sourcemapReference) {
        sourcemapReference.target.targetBuildRelativeUrl = buildRelativeUrl;
        sourcemapReference.target.targetBuildBuffer = mapSource;
      } else {
        emitAsset({
          fileName: buildRelativeUrl,
          source: mapSource
        });
      }
    });
    return {
      targetBuildRelativeUrl: cssBuildRelativeUrl,
      targetBuildBuffer: cssSourceAfterTransformation
    };
  };
};

const cssNodeToReferenceLocation = node => {
  const {
    line,
    column
  } = node.source.start;
  return {
    referenceLine: line,
    referenceColumn: column
  };
};

const isSameCssDocumentUrlNode = (firstUrlNode, secondUrlNode) => {
  if (!compareUrlNodeTypes(firstUrlNode.type, secondUrlNode.type)) {
    return false;
  }

  if (!compareUrlNodeValue(firstUrlNode.value, secondUrlNode.value)) {
    return false;
  } // maybe this sourceIndex should be removed in case there is some css transformation one day?
  // it does not seems to change though as if it was refering the original file source index


  if (firstUrlNode.sourceIndex !== secondUrlNode.sourceIndex) {
    return false;
  }

  return true;
}; // minification may change url node type from string to word
// that's still the same node


const compareUrlNodeTypes = (firstUrlNodeType, secondUrlNodeType) => {
  if (firstUrlNodeType === secondUrlNodeType) {
    return true;
  }

  if (firstUrlNodeType === "word" && secondUrlNodeType === "string") {
    return true;
  }

  if (firstUrlNodeType === "string" && secondUrlNodeType === "word") {
    return true;
  }

  return false;
}; // minification may change url node value from './whatever.png' to 'whatever.png'
// the value still revolves to the same target


const compareUrlNodeValue = (firstUrlNodeValue, secondUrlNodeValue) => {
  const firstValueNormalized = util.urlToRelativeUrl(util.resolveUrl(firstUrlNodeValue, "file:///"), "file:///");
  const secondValueNormalized = util.urlToRelativeUrl(util.resolveUrl(secondUrlNodeValue, "file:///"), "file:///");
  return firstValueNormalized === secondValueNormalized;
};

const parseJsAsset = async (jsTarget, {
  notifyReferenceFound
}, {
  urlToOriginalProjectUrl,
  urlToOriginalServerUrl,
  minify,
  minifyJsOptions
}) => {
  const jsUrl = jsTarget.targetUrl;
  const jsString = String(jsTarget.targetBuffer);
  const jsSourcemapUrl = getJavaScriptSourceMappingUrl(jsString);
  let sourcemapReference;

  if (jsSourcemapUrl) {
    sourcemapReference = notifyReferenceFound({
      referenceExpectedContentType: "application/json",
      referenceTargetSpecifier: jsSourcemapUrl,
      // we don't really know the line or column
      // but let's asusme it the last line and first column
      referenceLine: jsString.split(/\r?\n/).length - 1,
      referenceColumn: 0
    });
  }

  return async ({
    precomputeBuildRelativeUrl,
    registerAssetEmitter
  }) => {
    let map;

    if (sourcemapReference) {
      const sourcemapString = String(sourcemapReference.target.targetBuildBuffer);
      map = JSON.parse(sourcemapString);
    } // in case this js asset is a worker, bundle it so that:
    // importScripts are inlined which is good for:
    // - not breaking things (otherwise we would have to copy imported files in the build directory)
    // - perf (one less http request)


    const mightBeAWorkerScript = !jsTarget.targetIsInline;
    let jsSourceAfterTransformation;

    if (mightBeAWorkerScript) {
      const workerScriptUrl = urlToOriginalProjectUrl(jsUrl);
      const workerBundle = await bundleWorker({
        workerScriptUrl,
        workerScriptSourceMap: map
      });
      jsSourceAfterTransformation = workerBundle.code;
      map = workerBundle.map;
    } else {
      jsSourceAfterTransformation = jsString;
    }

    if (minify) {
      const jsUrlRelativeToImporter = jsTarget.targetIsInline ? util.urlToRelativeUrl(jsTarget.targetUrl, jsTarget.targetReferences[0].referenceUrl) : jsTarget.targetRelativeUrl;
      const result = await minifyJs(jsString, jsUrlRelativeToImporter, {
        sourceMap: { ...(map ? {
            content: JSON.stringify(map)
          } : {}),
          asObject: true
        },
        toplevel: false,
        ...minifyJsOptions
      });
      jsSourceAfterTransformation = result.code;
      map = result.map;

      if (!map.sourcesContent) {
        map.sourcesContent = [jsString];
      }
    }

    if (map) {
      const jsBuildRelativeUrl = precomputeBuildRelativeUrl(jsString);
      const jsSourcemapFilename = `${path.basename(jsBuildRelativeUrl)}.map`;
      jsSourceAfterTransformation = setJavaScriptSourceMappingUrl(jsSourceAfterTransformation, jsSourcemapFilename);
      registerAssetEmitter(({
        buildDirectoryUrl,
        emitAsset
      }) => {
        const jsBuildUrl = util.resolveUrl(jsTarget.targetBuildRelativeUrl, buildDirectoryUrl);
        const mapBuildUrl = util.resolveUrl(jsSourcemapFilename, jsBuildUrl);
        map.file = util.urlToFilename(jsBuildUrl);

        if (map.sources) {
          const importerUrl = jsTarget.targetIsInline ? urlToOriginalServerUrl(jsTarget.targetUrl) : jsTarget.targetUrl;
          map.sources = map.sources.map(source => {
            const sourceUrl = util.resolveUrl(source, importerUrl);
            const sourceUrlRelativeToSourceMap = util.urlToRelativeUrl(urlToOriginalServerUrl(sourceUrl), mapBuildUrl);
            return sourceUrlRelativeToSourceMap;
          });
        }

        const mapSource = JSON.stringify(map, null, "  ");
        const buildRelativeUrl = util.urlToRelativeUrl(mapBuildUrl, buildDirectoryUrl);

        if (sourcemapReference) {
          sourcemapReference.target.targetBuildRelativeUrl = buildRelativeUrl;
          sourcemapReference.target.targetBuildBuffer = mapSource;
        } else {
          emitAsset({
            fileName: buildRelativeUrl,
            source: mapSource
          });
        }
      });
      return {
        targetBuildRelativeUrl: jsBuildRelativeUrl,
        targetBuildBuffer: jsSourceAfterTransformation
      };
    }

    return jsSourceAfterTransformation;
  };
};

const parseJsonAsset = (jsonTarget, notifiers, {
  minify
}) => {
  const jsonString = String(jsonTarget.targetBuffer);
  return () => {
    if (minify) {
      // this is to remove eventual whitespaces
      return JSON.stringify(JSON.parse(jsonString));
    }

    return jsonString;
  };
};

const parseWebmanifest = (webmanifestTarget, {
  notifyReferenceFound
}, {
  minify
}) => {
  // const manifestUrl = manifestTarget.url
  const manifestString = String(webmanifestTarget.targetBuffer);
  const manifest = JSON.parse(manifestString);
  const {
    icons = []
  } = manifest;
  const iconReferences = icons.map(icon => {
    const iconReference = notifyReferenceFound({
      referenceTargetSpecifier: icon.src
    });
    return iconReference;
  });
  return ({
    getReferenceUrlRelativeToImporter
  }) => {
    if (icons.length === 0) {
      if (minify) {
        // this is to remove eventual whitespaces
        return JSON.stringify(manifest);
      }

      return JSON.stringify(manifestString);
    }

    const iconsAfterBuild = icons.map((icon, index) => {
      const iconAfterBuild = { ...icon
      };
      iconAfterBuild.src = getReferenceUrlRelativeToImporter(iconReferences[index]);
      return iconAfterBuild;
    });
    const manifestAfterBuild = { ...manifest
    };
    manifestAfterBuild.icons = iconsAfterBuild;

    if (minify) {
      return JSON.stringify(manifestAfterBuild);
    }

    return JSON.stringify(manifestAfterBuild, null, "  ");
  };
};

const parseTarget = (target, notifiers, {
  urlToOriginalProjectUrl,
  urlToOriginalServerUrl,
  format,
  systemJsUrl,
  useImportMapToImproveLongTermCaching,
  createImportMapForFilesUsedInJs,
  minify,
  minifyHtmlOptions,
  minifyCssOptions,
  minifyJsOptions
}) => {
  const {
    targetContentType
  } = target;

  if (!targetContentType) {
    return null;
  }

  if (targetContentType === "text/html") {
    return parseHtmlAsset(target, notifiers, {
      minify,
      minifyHtmlOptions,
      htmlStringToHtmlAst: htmlString => {
        const htmlAst = parseHtmlString(htmlString); // force presence of systemjs script if html contains a module script

        const injectSystemJsScriptIfNeeded = htmlAst => {
          if (format !== "systemjs") {
            return;
          }

          const htmlContainsModuleScript = htmlAstContains(htmlAst, htmlNodeIsScriptModule);

          if (!htmlContainsModuleScript) {
            return;
          }

          manipulateHtmlAst(htmlAst, {
            scriptInjections: [{
              src: systemJsUrl
            }]
          });
        }; // force the presence of a fake+inline+empty importmap script
        // if html contains no importmap and we useImportMapToImproveLongTermCaching
        // this inline importmap will be transformed later to have top level remapping
        // required to target hashed js urls


        const injectImportMapScriptIfNeeded = htmlAst => {
          if (!useImportMapToImproveLongTermCaching) {
            return;
          }

          if (findFirstImportmapNode(htmlAst)) {
            return;
          }

          manipulateHtmlAst(htmlAst, {
            scriptInjections: [{
              type: "importmap",
              id: "jsenv-build-importmap",
              text: "{}"
            }]
          });
        };

        injectSystemJsScriptIfNeeded(htmlAst);
        injectImportMapScriptIfNeeded(htmlAst);
        return htmlAst;
      }
    });
  }

  if (targetContentType === "text/css") {
    return parseCssAsset(target, notifiers, {
      urlToOriginalServerUrl,
      minify,
      minifyCssOptions
    });
  }

  if (targetContentType === "application/importmap+json") {
    return parseImportmapAsset(target, notifiers, {
      minify,
      importMapToInject: useImportMapToImproveLongTermCaching ? createImportMapForFilesUsedInJs() : undefined
    });
  }

  if (targetContentType === "application/manifest+json" || target.targetReferences[0].referenceExpectedContentType === "application/manifest+json") {
    return parseWebmanifest(target, notifiers, {
      minify
    });
  }

  if (targetContentType === "application/javascript" || targetContentType === "text/javascript") {
    return parseJsAsset(target, notifiers, {
      urlToOriginalProjectUrl,
      urlToOriginalServerUrl,
      minify,
      minifyJsOptions
    });
  }

  if (targetContentType === "image/svg+xml") {
    return parseSvgAsset(target, notifiers, {
      minify,
      minifyHtmlOptions
    });
  }

  if (targetContentType === "application/json" || targetContentType.endsWith("+json")) {
    return parseJsonAsset(target, notifiers, {
      minify
    });
  }

  return null;
};

const cross = "☓"; // "\u2613"

const checkmark = "✔"; // "\u2714"

const yellow = "\x1b[33m";
const magenta = "\x1b[35m";
const red = "\x1b[31m";
const green = "\x1b[32m";
const grey = "\x1b[39m";
const ansiResetSequence = "\x1b[0m";

// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/css-syntax-error.js#L43
const showSourceLocation = (source, {
  line,
  column,
  numberOfSurroundingLinesToShow = 1,
  lineMaxLength = 120,
  color = false
}) => {
  let mark = string => string;

  let aside = string => string;

  if (color) {
    mark = string => `${red}${string}${ansiResetSequence}`;

    aside = string => `${grey}${string}${ansiResetSequence}`;
  }

  const lines = source.split(/\r?\n/);
  let lineRange = {
    start: line - 1,
    end: line
  };
  lineRange = moveLineRangeUp(lineRange, numberOfSurroundingLinesToShow);
  lineRange = moveLineRangeDown(lineRange, numberOfSurroundingLinesToShow);
  lineRange = lineRangeWithinLines(lineRange, lines);
  const linesToShow = lines.slice(lineRange.start, lineRange.end);
  const endLineNumber = lineRange.end;
  const lineNumberMaxWidth = String(endLineNumber).length;
  const columnRange = {};

  if (column === undefined) {
    columnRange.start = 0;
    columnRange.end = lineMaxLength;
  } else if (column > lineMaxLength) {
    columnRange.start = column - Math.floor(lineMaxLength / 2);
    columnRange.end = column + Math.ceil(lineMaxLength / 2);
  } else {
    columnRange.start = 0;
    columnRange.end = lineMaxLength;
  }

  return linesToShow.map((lineSource, index) => {
    const lineNumber = lineRange.start + index + 1;
    const isMainLine = lineNumber === line;
    const lineSourceTruncated = applyColumnRange(columnRange, lineSource);
    const lineNumberWidth = String(lineNumber).length; // ensure if line moves from 7,8,9 to 10 the display is still great

    const lineNumberRightSpacing = " ".repeat(lineNumberMaxWidth - lineNumberWidth);
    const asideSource = `${lineNumber}${lineNumberRightSpacing} |`;
    const lineFormatted = `${aside(asideSource)} ${lineSourceTruncated}`;

    if (isMainLine) {
      if (column === undefined) {
        return `${mark(">")} ${lineFormatted}`;
      }

      const spacing = stringToSpaces(`${asideSource} ${lineSourceTruncated.slice(0, column - columnRange.start - 1)}`);
      return `${mark(">")} ${lineFormatted}
  ${spacing}${mark("^")}`;
    }

    return `  ${lineFormatted}`;
  }).join(`
`);
};

const applyColumnRange = ({
  start,
  end
}, line) => {
  if (typeof start !== "number") {
    throw new TypeError(`start must be a number, received ${start}`);
  }

  if (typeof end !== "number") {
    throw new TypeError(`end must be a number, received ${end}`);
  }

  if (end < start) {
    throw new Error(`end must be greater than start, but ${end} is smaller than ${start}`);
  }

  const prefix = "…";
  const suffix = "…";
  const lastIndex = line.length;

  if (line.length === 0) {
    // don't show any ellipsis if the line is empty
    // because it's not truncated in that case
    return "";
  }

  const startTruncated = start > 0;
  const endTruncated = lastIndex > end;
  let from = startTruncated ? start + prefix.length : start;
  let to = endTruncated ? end - suffix.length : end;
  if (to > lastIndex) to = lastIndex;

  if (start >= lastIndex || from === to) {
    return "";
  }

  let result = "";

  while (from < to) {
    result += line[from];
    from++;
  }

  if (result.length === 0) {
    return "";
  }

  if (startTruncated && endTruncated) {
    return `${prefix}${result}${suffix}`;
  }

  if (startTruncated) {
    return `${prefix}${result}`;
  }

  if (endTruncated) {
    return `${result}${suffix}`;
  }

  return result;
};

const stringToSpaces = string => string.replace(/[^\t]/g, " "); // const getLineRangeLength = ({ start, end }) => end - start


const moveLineRangeUp = ({
  start,
  end
}, number) => {
  return {
    start: start - number,
    end
  };
};

const moveLineRangeDown = ({
  start,
  end
}, number) => {
  return {
    start,
    end: end + number
  };
};

const lineRangeWithinLines = ({
  start,
  end
}, lines) => {
  return {
    start: start < 0 ? 0 : start,
    end: end > lines.length ? lines.length : end
  };
};

// https://github.com/browserify/resolve/blob/a09a2e7f16273970be4639313c83b913daea15d7/lib/core.json#L1
// https://nodejs.org/api/modules.html#modules_module_builtinmodules
// https://stackoverflow.com/a/35825896
// https://github.com/browserify/resolve/blob/master/lib/core.json#L1
const NATIVE_NODE_MODULE_SPECIFIER_ARRAY = ["assert", "assert/strict", "async_hooks", "buffer_ieee754", "buffer", "child_process", "cluster", "console", "constants", "crypto", "_debugger", "dgram", "dns", "domain", "events", "freelist", "fs", "fs/promises", "_http_agent", "_http_client", "_http_common", "_http_incoming", "_http_outgoing", "_http_server", "http", "http2", "https", "inspector", "_linklist", "module", "net", "node-inspect/lib/_inspect", "node-inspect/lib/internal/inspect_client", "node-inspect/lib/internal/inspect_repl", "os", "path", "perf_hooks", "process", "punycode", "querystring", "readline", "repl", "smalloc", "_stream_duplex", "_stream_transform", "_stream_wrap", "_stream_passthrough", "_stream_readable", "_stream_writable", "stream", "stream/promises", "string_decoder", "sys", "timers", "_tls_common", "_tls_legacy", "_tls_wrap", "tls", "trace_events", "tty", "url", "util", "v8/tools/arguments", "v8/tools/codemap", "v8/tools/consarray", "v8/tools/csvparser", "v8/tools/logreader", "v8/tools/profile_view", "v8/tools/splaytree", "v8", "vm", "worker_threads", "zlib", // global is special
"global"];
const isBareSpecifierForNativeNodeModule = specifier => {
  return NATIVE_NODE_MODULE_SPECIFIER_ARRAY.includes(specifier);
};

const fetchSourcemap = async (jsUrl, jsString, {
  cancellationToken = cancellation.createCancellationToken(),
  logger: logger$1 = logger.createLogger()
} = {}) => {
  const jsSourcemapUrl = getJavaScriptSourceMappingUrl(jsString);

  if (!jsSourcemapUrl) {
    return null;
  }

  if (jsSourcemapUrl.startsWith("data:")) {
    const jsSourcemapString = dataUrlToRawData(parseDataUrl(jsSourcemapUrl));
    return parseSourcemapString(jsSourcemapString, jsSourcemapUrl, `inline comment in ${jsUrl}`);
  }

  const sourcemapUrl = util.resolveUrl(jsSourcemapUrl, jsUrl);
  const sourcemapResponse = await fetchUrl(sourcemapUrl, {
    cancellationToken,
    ignoreHttpsError: true
  });
  const okValidation = await validateResponseStatusIsOk(sourcemapResponse, jsUrl);

  if (!okValidation.valid) {
    logger$1.warn(`unexpected response for sourcemap file:
${okValidation.message}`);
    return null;
  } // in theory we should also check sourcemapResponse content-type is correctly set
  // but not really important.


  const sourcemapBodyAsText = await sourcemapResponse.text();
  return parseSourcemapString(sourcemapBodyAsText, sourcemapUrl, jsUrl);
};

const parseSourcemapString = (sourcemapString, sourcemapUrl, importer) => {
  try {
    return JSON.parse(sourcemapString);
  } catch (e) {
    if (e.name === "SyntaxError") {
      console.error(logger.createDetailedMessage(`syntax error while parsing sourcemap.`, {
        ["syntax error stack"]: e.stack,
        ["sourcemap url"]: sourcemapUrl,
        ["imported by"]: importer
      }));
      return null;
    }

    throw e;
  }
};

const computeBuildRelativeUrl = (fileUrl, fileContent, pattern = "[name]-[hash][extname]") => {
  const buildRelativeUrl = renderNamePattern(typeof pattern === "function" ? pattern() : pattern, {
    dirname: () => util.urlToParentUrl(fileUrl),
    name: () => util.urlToBasename(fileUrl),
    hash: () => generateContentHash(fileContent),
    extname: () => util.urlToExtension(fileUrl)
  });
  return buildRelativeUrl;
}; // https://github.com/rollup/rollup/blob/19e50af3099c2f627451a45a84e2fa90d20246d5/src/utils/FileEmitter.ts#L47

const generateContentHash = stringOrBuffer => {
  const hash = crypto.createHash("sha256");
  hash.update(stringOrBuffer);
  return hash.digest("hex").slice(0, 8);
};

const computeBuildRelativeUrlForTarget = target => {
  return computeBuildRelativeUrl(target.targetUrl, target.targetBuildBuffer, targetToFileNamePattern(target));
};
const assetFileNamePattern = "assets/[name]-[hash][extname]";
const assetFileNamePatternWithoutHash = "assets/[name][extname]";

const targetToFileNamePattern = target => {
  if (target.targetFileNamePattern) {
    return target.targetFileNamePattern;
  }

  if (target.targetUrlVersioningDisabled) {
    if (target.targetIsEntry || target.targetIsJsModule) {
      return `[name][extname]`;
    }

    return assetFileNamePatternWithoutHash;
  }

  if (target.targetIsEntry || target.isTargetIsJsModule) {
    return `[name]-[hash][extname]`;
  }

  return assetFileNamePattern;
};

const precomputeBuildRelativeUrlForTarget = (target, targetBuildBuffer = "") => {
  if (target.targetBuildRelativeUrl) {
    return target.targetBuildRelativeUrl;
  }

  target.targetBuildBuffer = targetBuildBuffer;
  const precomputedBuildRelativeUrl = computeBuildRelativeUrlForTarget(target);
  target.targetBuildBuffer = undefined;
  return precomputedBuildRelativeUrl;
};

/**

--- Inlining asset ---
In the context of http2 and beyond http request
is reused so saving http request by inlining asset is less
attractive.
You gain some speed because one big file is still faster
than many small files.

But inlined asset got two drawbacks:

(1) they cannot be cached by the browser
assets inlined in the html file have no hash
and must be redownloaded every time.
-> No way to mitigate this

(2) they cannot be shared by different files.
assets inlined in the html cannot be shared
because their source lives in the html.
You might accidentatly load twice a css because it's
referenced both in js and html for instance.
-> We could warn about asset inlined + referenced
more than once

Each time an asset needs to be inlined its dependencies
must be re-resolved to its importer location.
This is quite a lot of work to implement this.
Considering that inlining is not that worth it and might
duplicate them when imported more than once let's just not do it.

*/
const createAssetBuilder = ({
  fetch,
  parse
}, {
  logLevel,
  format,
  projectDirectoryUrl,
  // project url but it can be an http url
  buildDirectoryRelativeUrl,
  urlToFileUrl,
  // get a file url from an eventual http url
  urlToCompiledServerUrl,
  loadUrl = () => null,
  emitChunk,
  emitAsset,
  setAssetSource,
  onJsModuleReferencedInHtml = () => {},
  resolveTargetUrl = ({
    targetSpecifier,
    importerUrl
  }) => util.resolveUrl(targetSpecifier, importerUrl)
}) => {
  const logger$1 = logger.createLogger({
    logLevel
  });
  const buildDirectoryUrl = util.resolveUrl(buildDirectoryRelativeUrl, projectDirectoryUrl);

  const createReferenceForHTMLEntry = async ({
    entryContentType,
    entryUrl,
    entryBuffer,
    entryBuildRelativeUrl
  }) => {
    // we don't really know where this reference to that asset file comes from
    // we could almost say it's from the script calling this function
    // so we could analyse stack trace here to put this function caller
    // as the reference to this target file
    const callerLocation = getCallerLocation();
    const entryReference = createReference({
      referenceTargetSpecifier: entryUrl,
      referenceExpectedContentType: entryContentType,
      referenceUrl: callerLocation.url,
      referenceLine: callerLocation.line,
      referenceColumn: callerLocation.column,
      targetContentType: entryContentType,
      targetBuffer: entryBuffer,
      targetIsEntry: true,
      // don't hash asset entry points
      targetUrlVersioningDisabled: true,
      targetFileNamePattern: entryBuildRelativeUrl
    });
    await entryReference.target.getDependenciesAvailablePromise(); // on await que les assets, pour le js rollup s'en occupe

    await Promise.all(entryReference.target.dependencies.map(async dependency => {
      if (dependency.referenceExpectedContentType === "application/importmap+json") {
        // don't await for importmap right away, it must be handled as the very last asset
        // to be aware of build mappings.
        // getReadyPromise() for that importmap will be called during getAllAssetEntryEmittedPromise
        // (a simpler approach could keep importmap untouched and override it late
        // (but that means updating html hash and importmap hash)
        return;
      }

      if (dependency.target.targetIsJsModule) {
        // await internally for rollup to be done with these js files
        // but don't await explicitely or rollup build cannot end
        // because rollup would wait for this promise in "buildStart" hook
        // and never go to the "generateBundle' hook where
        // a js module ready promise gets resolved
        dependency.target.getReadyPromise();
        return;
      }

      await dependency.target.getReadyPromise();
    }));
  };

  const createReferenceForJs = async ({
    jsUrl,
    jsLine,
    jsColumn,
    targetSpecifier,
    targetContentType,
    targetBuffer
  }) => {
    const reference = createReference({
      referenceTargetSpecifier: targetSpecifier,
      referenceExpectedContentType: targetContentType,
      referenceUrl: jsUrl,
      referenceColumn: jsLine,
      referenceLine: jsColumn,
      targetContentType,
      targetBuffer
    });
    await reference.target.getReadyPromise();
    return reference;
  };

  const getAllAssetEntryEmittedPromise = async () => {
    const urlToWait = Object.keys(targetMap).filter(url => targetMap[url].targetIsEntry);
    return Promise.all(urlToWait.map(async url => {
      const target = targetMap[url];
      await target.getReadyPromise();
      return target;
    }));
  };

  const targetMap = {};
  const targetRedirectionMap = {};

  const createReference = ({
    referenceTargetSpecifier,
    referenceExpectedContentType,
    referenceUrl,
    referenceColumn,
    referenceLine,
    targetContentType,
    targetBuffer,
    targetIsEntry,
    targetIsJsModule,
    targetIsInline,
    targetFileNamePattern,
    targetUrlVersioningDisabled
  }) => {
    const importerUrl = referenceUrl;
    const importerTarget = getTargetFromUrl(importerUrl) || {
      targetUrl: importerUrl,
      targetIsEntry: false,
      // maybe
      targetIsJsModule: true,
      targetBuildBuffer: ""
    }; // for now we can only emit a chunk from an entry file as visible in
    // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
    // https://github.com/rollup/rollup/issues/2872

    if (targetIsJsModule && !importerTarget.targetIsEntry) {
      // it's not really possible
      logger$1.warn(`ignoring js reference found in an asset (js can be referenced only from an html entry point)`);
      return null;
    }

    const resolveTargetReturnValue = resolveTargetUrl({
      targetSpecifier: referenceTargetSpecifier,
      targetIsJsModule,
      targetIsInline,
      importerUrl: referenceUrl,
      importerIsEntry: importerTarget.targetIsEntry,
      importerIsJsModule: importerTarget.targetIsJsModule
    });
    let targetUrl;
    let targetIsExternal = false;

    if (typeof resolveTargetReturnValue === "object") {
      if (resolveTargetReturnValue.external) {
        targetIsExternal = true;
      }

      targetUrl = resolveTargetReturnValue.url;
    } else {
      targetUrl = resolveTargetReturnValue;
    }

    if (targetUrl.startsWith("data:")) {
      targetIsExternal = false;
      targetIsInline = true;
      const {
        mediaType,
        base64Flag,
        data
      } = parseDataUrl(targetUrl);
      referenceExpectedContentType = mediaType;
      targetContentType = mediaType;
      targetBuffer = base64Flag ? Buffer.from(data, "base64") : decodeURI(data);
    } // any hash in the url would mess up with filenames


    targetUrl = removePotentialUrlHash(targetUrl);

    if (targetIsInline && targetFileNamePattern === undefined) {
      // inherit parent directory location because it's an inline file
      targetFileNamePattern = () => {
        const importerBuildRelativeUrl = precomputeBuildRelativeUrlForTarget(importerTarget);
        const importerParentRelativeUrl = util.urlToRelativeUrl(util.urlToParentUrl(util.resolveUrl(importerBuildRelativeUrl, "file://")), "file://");
        return `${importerParentRelativeUrl}[name]-[hash][extname]`;
      };
    }

    const reference = {
      referenceExpectedContentType,
      referenceUrl,
      referenceColumn,
      referenceLine
    };
    const existingTarget = getTargetFromUrl(targetUrl);

    if (existingTarget) {
      connectReferenceAndTarget(reference, existingTarget);
    } else {
      const target = createTarget({
        importerReference: reference,
        targetContentType,
        targetUrl,
        targetBuffer,
        targetIsEntry,
        targetIsJsModule,
        targetIsExternal,
        targetIsInline,
        targetFileNamePattern,
        targetUrlVersioningDisabled
      });
      targetMap[targetUrl] = target;
      connectReferenceAndTarget(reference, target);
    }

    if (targetIsExternal) {
      logger$1.debug(formatExternalReferenceLog(reference, {
        showReferenceSourceLocation,
        projectDirectoryUrl: urlToFileUrl(projectDirectoryUrl)
      }));
    } else {
      logger$1.debug(formatReferenceFound(reference, showReferenceSourceLocation(reference)));
    }

    return reference;
  };

  const connectReferenceAndTarget = (reference, target) => {
    reference.target = target;
    target.targetReferences.push(reference);
    target.getBufferAvailablePromise().then(() => {
      checkContentType(reference, {
        logger: logger$1,
        showReferenceSourceLocation
      });
    }, () => {});
  };

  const assetTransformMap = {};

  const createTarget = ({
    importerReference,
    targetContentType,
    targetUrl,
    targetBuffer,
    targetIsEntry = false,
    targetIsJsModule = false,
    targetIsExternal = false,
    targetIsInline = false,
    targetFileNamePattern,
    targetUrlVersioningDisabled = false
  }) => {
    const target = {
      targetContentType,
      targetUrl,
      targetBuffer,
      targetReferences: [],
      targetIsEntry,
      targetIsJsModule,
      targetIsInline,
      targetUrlVersioningDisabled,
      targetFileNamePattern,
      targetRelativeUrl: util.urlToRelativeUrl(targetUrl, projectDirectoryUrl),
      targetBuildBuffer: undefined
    };
    const getBufferAvailablePromise = memoize(async () => {
      const response = await fetch(targetUrl, showReferenceSourceLocation(importerReference));

      if (response.url !== targetUrl) {
        targetRedirectionMap[targetUrl] = response.url;
        target.targetUrl = response.url;
      }

      const responseContentTypeHeader = response.headers["content-type"];
      target.targetContentType = responseContentTypeHeader;
      const responseBodyAsArrayBuffer = await response.arrayBuffer();
      target.targetBuffer = Buffer.from(responseBodyAsArrayBuffer);
    });

    if (targetBuffer !== undefined) {
      getBufferAvailablePromise.forceMemoization(Promise.resolve());
    }

    const getDependenciesAvailablePromise = memoize(async () => {
      await getBufferAvailablePromise();
      const dependencies = [];
      let parsingDone = false;

      const notifyReferenceFound = ({
        referenceTargetSpecifier,
        referenceExpectedContentType,
        referenceLine,
        referenceColumn,
        targetContentType,
        targetBuffer,
        targetIsJsModule = false,
        targetIsInline = false,
        targetUrlVersioningDisabled,
        targetFileNamePattern
      }) => {
        if (parsingDone) {
          throw new Error(`notifyReferenceFound cannot be called once ${targetUrl} parsing is done.`);
        }

        const dependencyReference = createReference({
          referenceTargetSpecifier,
          referenceUrl: targetUrl,
          referenceLine,
          referenceColumn,
          referenceExpectedContentType,
          targetContentType,
          targetBuffer,
          targetIsJsModule,
          targetIsInline,
          targetUrlVersioningDisabled,
          targetFileNamePattern
        });

        if (dependencyReference) {
          dependencies.push(dependencyReference);
        }

        return dependencyReference;
      };

      const parseReturnValue = await parse(target, {
        format,
        notifyReferenceFound
      });
      parsingDone = true;

      if (dependencies.length > 0 && typeof parseReturnValue !== "function") {
        throw new Error(`parse notified some dependencies, it must return a function but received ${parseReturnValue}`);
      }

      if (typeof parseReturnValue === "function") {
        assetTransformMap[targetUrl] = parseReturnValue;
      }

      if (dependencies.length > 0) {
        logger$1.debug(logger.createDetailedMessage(`${shortenUrl(targetUrl)} dependencies collected`, {
          dependencies: dependencies.map(dependencyReference => shortenUrl(dependencyReference.target.targetUrl))
        }));
      }

      target.dependencies = dependencies;
    });
    const getReadyPromise = memoize(async () => {
      if (targetIsExternal) {
        // external urls are immediatly available and not modified
        return;
      } // once rollup is done with that module we know it's final url


      if (targetIsJsModule) {
        logger$1.debug(`waiting for rollup chunk to be ready to resolve ${shortenUrl(targetUrl)}`);
        const rollupChunkReadyPromise = new Promise(resolve => {
          registerCallbackOnceRollupChunkIsReady(target.targetUrl, resolve);
        });
        const {
          targetBuildBuffer,
          targetBuildRelativeUrl,
          targetFileName
        } = await rollupChunkReadyPromise;
        target.targetFileName = targetFileName;
        target.targetBuildEnd(targetBuildBuffer, targetBuildRelativeUrl);
        return;
      } // la transformation d'un asset c'est avant tout la transformation de ses dépendances


      await getDependenciesAvailablePromise();
      const dependencies = target.dependencies;
      await Promise.all(dependencies.map(dependencyReference => dependencyReference.target.getReadyPromise()));
      const transform = assetTransformMap[targetUrl];

      if (typeof transform !== "function") {
        target.targetBuildEnd(target.targetBuffer);
        return;
      } // assetDependenciesMapping contains all dependencies for an asset
      // each key is the absolute url to the dependency file
      // each value is an url relative to the asset importing this dependency
      // it looks like this:
      // {
      //   "file:///project/coin.png": "./coin-45eiopri.png"
      // }
      // we don't yet know the exact importerBuildRelativeUrl but we can generate a fake one
      // to ensure we resolve dependency against where the importer file will be


      const importerBuildRelativeUrl = precomputeBuildRelativeUrlForTarget(target);
      const assetEmitters = [];
      const transformReturnValue = await transform({
        precomputeBuildRelativeUrl: targetBuildBuffer => precomputeBuildRelativeUrlForTarget(target, targetBuildBuffer),
        registerAssetEmitter: callback => {
          assetEmitters.push(callback);
        },
        getReferenceUrlRelativeToImporter: reference => {
          const importerTarget = target;
          const referenceTarget = reference.target;
          let referenceTargetBuildRelativeUrl; // only js can reference an other file by url without versionning
          // and be able to actually fetch an other url with versioning using importmap
          // html needs the exact filename

          if (importerTarget.targetIsJsModule) {
            referenceTargetBuildRelativeUrl = referenceTarget.targetFileName || referenceTarget.targetBuildRelativeUrl;
          } else {
            referenceTargetBuildRelativeUrl = referenceTarget.targetBuildRelativeUrl;
          }

          const referenceTargetBuildUrl = util.resolveUrl(referenceTargetBuildRelativeUrl, "file:///");
          const importerBuildUrl = util.resolveUrl(importerBuildRelativeUrl, "file:///");
          return util.urlToRelativeUrl(referenceTargetBuildUrl, importerBuildUrl);
        }
      });

      if (transformReturnValue === null || transformReturnValue === undefined) {
        throw new Error(`transform must return an object {code, map}`);
      }

      let targetBuildBuffer;
      let targetBuildRelativeUrl;

      if (typeof transformReturnValue === "string") {
        targetBuildBuffer = transformReturnValue;
      } else {
        targetBuildBuffer = transformReturnValue.targetBuildBuffer;

        if (transformReturnValue.targetBuildRelativeUrl) {
          targetBuildRelativeUrl = transformReturnValue.targetBuildRelativeUrl;
        }
      }

      target.targetBuildEnd(targetBuildBuffer, targetBuildRelativeUrl);
      assetEmitters.forEach(callback => {
        callback({
          emitAsset,
          buildDirectoryUrl
        });
      });
    }); // was used to remove sourcemap files that are renamed after they are emitted
    // could be useful one day in case an asset is finally discarded

    const remove = () => {
      target.shouldBeIgnored = true;
    };

    const targetBuildEnd = (targetBuildBuffer, targetBuildRelativeUrl) => {
      if (targetBuildBuffer !== undefined) {
        target.targetBuildBuffer = targetBuildBuffer;

        if (targetBuildRelativeUrl === undefined) {
          target.targetBuildRelativeUrl = computeBuildRelativeUrlForTarget(target);
        }
      }

      if (targetBuildRelativeUrl !== undefined) {
        target.targetBuildRelativeUrl = targetBuildRelativeUrl;
      }

      if (!target.targetIsInline && !target.targetIsJsModule) {
        setAssetSource(target.rollupReferenceId, target.targetBuildBuffer);
      }
    };

    if (targetIsJsModule) {
      const jsModuleUrl = targetUrl;
      onJsModuleReferencedInHtml({
        jsModuleUrl,
        jsModuleIsInline: targetIsInline,
        jsModuleSource: String(targetBuffer)
      });
      const name = util.urlToRelativeUrl( // get basename url
      util.resolveUrl(util.urlToBasename(jsModuleUrl), jsModuleUrl), // get importer url
      urlToCompiledServerUrl(importerReference.referenceUrl));
      logger$1.debug(`emit chunk for ${shortenUrl(jsModuleUrl)}`);
      const rollupReferenceId = emitChunk({
        id: jsModuleUrl,
        name
      });
      target.rollupReferenceId = rollupReferenceId;
    } else if (targetIsInline) ; else {
      logger$1.debug(`emit asset for ${shortenUrl(targetUrl)}`);
      const rollupReferenceId = emitAsset({
        fileName: targetUrl
      });
      target.rollupReferenceId = rollupReferenceId;
    }

    Object.assign(target, {
      getBufferAvailablePromise,
      getDependenciesAvailablePromise,
      getReadyPromise,
      remove,
      targetBuildEnd
    });
    return target;
  };

  const rollupChunkReadyCallbackMap = {};

  const registerCallbackOnceRollupChunkIsReady = (url, callback) => {
    rollupChunkReadyCallbackMap[url] = callback;
  };

  const getRollupChunkReadyCallbackMap = () => rollupChunkReadyCallbackMap;

  const getTargetFromUrl = url => {
    if (url in targetMap) {
      return targetMap[url];
    }

    if (url in targetRedirectionMap) {
      return getTargetFromUrl(targetRedirectionMap[url]);
    }

    return null;
  };

  const getAssetByUrl = assetUrl => {
    return targetMap[assetUrl] || null;
  };

  const shortenUrl = url => {
    return util.urlIsInsideOf(url, projectDirectoryUrl) ? util.urlToRelativeUrl(url, projectDirectoryUrl) : url;
  };

  const showReferenceSourceLocation = reference => {
    const referenceUrl = reference.referenceUrl;
    const referenceTarget = getTargetFromUrl(referenceUrl);
    const referenceSource = referenceTarget ? referenceTarget.targetBuffer : loadUrl(referenceUrl);
    const referenceSourceAsString = referenceSource ? String(referenceSource) : "";
    let message = `${urlToFileUrl(referenceUrl)}`;

    if (typeof reference.referenceLine === "number") {
      message += `:${reference.referenceLine}`;

      if (typeof reference.referenceColumn === "number") {
        message += `:${reference.referenceColumn}`;
      }
    }

    if (referenceSourceAsString && typeof reference.referenceLine === "number") {
      return `${message}

${showSourceLocation(referenceSourceAsString, {
        line: reference.referenceLine,
        column: reference.referenceColumn
      })}
`;
    }

    return `${message}`;
  };

  return {
    createReferenceForHTMLEntry,
    createReferenceForJs,
    getRollupChunkReadyCallbackMap,
    getAllAssetEntryEmittedPromise,
    getAssetByUrl,
    inspect: () => {
      return {
        targetMap,
        targetRedirectionMap
      };
    }
  };
};
const referenceToCodeForRollup = reference => {
  const target = reference.target;

  if (target.targetIsInline) {
    return getTargetAsBase64Url(target);
  }

  return `import.meta.ROLLUP_FILE_URL_${target.rollupReferenceId}`;
};

const removePotentialUrlHash = url => {
  const urlObject = new URL(url);
  urlObject.hash = "";
  return String(urlObject);
};

const {
  asyncWalk
} = require$1("estree-walker");

const MagicString = require$1("magic-string");

const transformImportMetaUrlReferences = async ({
  url,
  // importerUrl,
  code,
  ast,
  assetBuilder,
  fetch,
  markBuildRelativeUrlAsUsedByJs
}) => {
  const magicString = new MagicString(code);
  await asyncWalk(ast, {
    enter: async node => {
      if (!isNewUrlImportMetaUrl(node)) {
        return;
      }

      const relativeUrl = node.arguments[0].value; // hum on devrait le fetch pour obtenir l'url finale et le content-type
      // par contre on y applique pas les import map

      const targetUrl = util.resolveUrl(relativeUrl, url);
      const response = await fetch(targetUrl, url);
      const targetBuffer = Buffer.from(await response.arrayBuffer());
      const reference = await assetBuilder.createReferenceForJs({
        jsUrl: url,
        ...(node.loc ? {
          jsLine: node.loc.start.line,
          jsColumn: node.loc.start.column
        } : {}),
        targetSpecifier: response.url,
        targetContentType: response.headers["content-type"],
        targetBuffer
      });

      if (reference) {
        magicString.overwrite(node.arguments[0].start, node.arguments[0].end, referenceToCodeForRollup(reference));
        markBuildRelativeUrlAsUsedByJs(reference.target.targetBuildRelativeUrl);
      }
    }
  });
  const codeOutput = magicString.toString();
  const map = magicString.generateMap({
    hires: true
  });
  return {
    code: codeOutput,
    map
  };
};

const isNewUrlImportMetaUrl = node => {
  return node.type === "NewExpression" && node.callee.type === "Identifier" && node.callee.name === "URL" && node.arguments.length === 2 && node.arguments[0].type === "Literal" && typeof node.arguments[0].value === "string" && node.arguments[1].type === "MemberExpression" && node.arguments[1].object.type === "MetaProperty" && node.arguments[1].property.type === "Identifier" && node.arguments[1].property.name === "url";
};

/* eslint-disable import/max-dependencies */
// because rollup will check the dependencies url
// when computing the file hash
// https://github.com/rollup/rollup/blob/d6131378f9481a442aeaa6d4e608faf3303366dc/src/Chunk.ts#L483
// this way file hash remains the same when file content does not change

const STATIC_COMPILE_SERVER_AUTHORITY = "//jsenv.com";
const createJsenvRollupPlugin = async ({
  cancellationToken,
  logger: logger$1,
  entryPointMap,
  projectDirectoryUrl,
  importMapFileRelativeUrl,
  importMetaEnvFileRelativeUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  importDefaultExtension,
  externalImportSpecifiers,
  externalImportUrlPatterns,
  babelPluginMap,
  node,
  browser,
  format,
  urlVersioning,
  useImportMapToImproveLongTermCaching,
  systemJsUrl,
  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
  assetManifestFile,
  assetManifestFileRelativeUrl,
  writeOnFileSystem,
  buildDirectoryUrl
}) => {
  const urlImporterMap = {};
  const urlResponseBodyMap = {};
  const virtualModules = {};
  const urlRedirectionMap = {};
  const jsModulesInHtml = {};
  let lastErrorMessage;

  const createJsenvPluginError = message => {
    const error = new Error(message);
    lastErrorMessage = message;
    return error;
  };

  const externalUrlPredicate = externalImportUrlPatternsToExternalUrlPredicate(externalImportUrlPatterns, projectDirectoryUrl); // map fileName (build relative urls without hash) to build relative url

  let buildManifest = {};

  const buildRelativeUrlToFileName = buildRelativeUrl => {
    const fileName = Object.keys(buildManifest).find(key => buildManifest[key] === buildRelativeUrl);
    return fileName;
  };

  const buildRelativeUrlsUsedInJs = [];

  const markBuildRelativeUrlAsUsedByJs = buildRelativeUrl => {
    buildRelativeUrlsUsedInJs.push(buildRelativeUrl);
    buildManifest[rollupFileNameWithoutHash(buildRelativeUrl)] = buildRelativeUrl;
  };

  const createImportMapForFilesUsedInJs = () => {
    const topLevelMappings = {};
    buildRelativeUrlsUsedInJs.sort(util.comparePathnames).forEach(buildRelativeUrl => {
      const fileName = buildRelativeUrlToFileName(buildRelativeUrl);

      if (fileName !== buildRelativeUrl) {
        topLevelMappings[`./${fileName}`] = `./${buildRelativeUrl}`;
      }
    });
    return {
      imports: topLevelMappings
    };
  };

  let buildMappings = {}; // an object where keys are build relative urls
  // and values rollup chunk or asset
  // we need this because we sometimes tell rollup
  // that a file.fileName is something while it's not really this
  // because of remapping

  let rollupBuild;
  const compileServerOriginForRollup = String(new URL(STATIC_COMPILE_SERVER_AUTHORITY, compileServerOrigin)).slice(0, -1);

  const urlToUrlForRollup = url => {
    if (url.startsWith(`${compileServerOrigin}/`)) {
      return `${compileServerOriginForRollup}/${url.slice(`${compileServerOrigin}/`.length)}`;
    }

    return url;
  };

  const rollupUrlToServerUrl = url => {
    if (url.startsWith(`${compileServerOriginForRollup}/`)) {
      return `${compileServerOrigin}/${url.slice(`${compileServerOriginForRollup}/`.length)}`;
    }

    return urlToServerUrl(url, {
      projectDirectoryUrl,
      compileServerOrigin
    });
  };

  const rollupUrlToProjectUrl = url => {
    return urlToProjectUrl(rollupUrlToServerUrl(url) || url, {
      projectDirectoryUrl,
      compileServerOrigin
    });
  };

  const rollupUrlToOriginalServerUrl = url => {
    return urlToOriginalServerUrl(rollupUrlToServerUrl(url) || url, {
      projectDirectoryUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl
    });
  };

  const rollupUrlToOriginalProjectUrl = url => {
    return urlToOriginalProjectUrl(rollupUrlToServerUrl(url) || url, {
      projectDirectoryUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl
    });
  };

  const rollupUrlToCompiledServerUrl = url => {
    return urlToCompiledServerUrl(rollupUrlToServerUrl(url) || url, {
      projectDirectoryUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl
    });
  };

  const EMPTY_CHUNK_URL = util.resolveUrl("__empty__", projectDirectoryUrl);
  const compileDirectoryUrl = util.resolveDirectoryUrl(compileDirectoryRelativeUrl, projectDirectoryUrl);
  const compileDirectoryRemoteUrl = util.resolveDirectoryUrl(compileDirectoryRelativeUrl, compileServerOrigin);

  const nativeModulePredicate = specifier => {
    if (node && isBareSpecifierForNativeNodeModule(specifier)) return true; // for now browser have no native module
    // and we don't know how we will handle that

    if (browser) return false;
    return false;
  };

  const fetchAndNormalizeImportmap = async (importmapUrl, {
    allow404 = false
  } = {}) => {
    const importmapResponse = await fetchUrl(importmapUrl);

    if (allow404 && importmapResponse.status === 404) {
      return null;
    }

    if (importmapResponse.status < 200 || importmapResponse.status > 299) {
      throw createJsenvPluginError(logger.createDetailedMessage(`Unexpected response status for importmap.`, {
        ["response status"]: importmapResponse.status,
        ["response text"]: await importmapResponse.text(),
        ["importmap url"]: importmapUrl
      }));
    }

    const importmap = await importmapResponse.json();
    const importmapNormalized = importMap.normalizeImportMap(importmap, importmapUrl);
    return importmapNormalized;
  };

  const fetchImportmapFromParameter = async () => {
    const importmapProjectUrl = util.resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl);
    importMapUrl = util.resolveUrl(importMapFileRelativeUrl, compileDirectoryRemoteUrl);
    const importMap = await fetchAndNormalizeImportmap(importMapUrl, {
      allow404: true
    });

    if (importMap === null) {
      logger$1.warn(`WARNING: no importmap found following importMapRelativeUrl at ${importmapProjectUrl}`);
      return {};
    }

    logger$1.debug(`use importmap found following importMapRelativeUrl at ${importmapProjectUrl}`);
    return importMap;
  };

  let assetBuilder;

  let rollupEmitFile = () => {};

  let rollupSetAssetSource = () => {};

  let fetchImportmap = fetchImportmapFromParameter;
  let importMap$1;
  let importMapUrl;

  const emitAsset = ({
    fileName,
    source
  }) => {
    return rollupEmitFile({
      type: "asset",
      source,
      fileName
    });
  };

  const emitChunk = chunk => rollupEmitFile({
    type: "chunk",
    ...chunk
  });

  const setAssetSource = (rollupReferenceId, assetSource) => rollupSetAssetSource(rollupReferenceId, assetSource);

  const jsenvRollupPlugin = {
    name: "jsenv",

    async buildStart() {
      logger$1.info(logger.createDetailedMessage(`start building project`, {
        ["project directory path"]: util.urlToFileSystemPath(projectDirectoryUrl),
        ["build directory path"]: util.urlToFileSystemPath(buildDirectoryUrl),
        ["entry point map"]: JSON.stringify(entryPointMap, null, "  ")
      }));

      rollupEmitFile = (...args) => this.emitFile(...args);

      rollupSetAssetSource = (...args) => this.setAssetSource(...args); // https://github.com/easesu/rollup-plugin-html-input/blob/master/index.js
      // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string


      const entryPointsPrepared = [];
      await Promise.all(Object.keys(entryPointMap).map(async key => {
        const entryProjectUrl = util.resolveUrl(key, projectDirectoryUrl);
        const entryBuildUrl = util.resolveUrl(entryPointMap[key], buildDirectoryUrl);
        const entryProjectRelativeUrl = util.urlToRelativeUrl(entryProjectUrl, projectDirectoryUrl);
        const entryBuildRelativeUrl = util.urlToRelativeUrl(entryBuildUrl, buildDirectoryUrl);
        const entryServerUrl = util.resolveUrl(entryProjectRelativeUrl, compileServerOrigin);
        const entryCompiledUrl = util.resolveUrl(entryProjectRelativeUrl, compileDirectoryRemoteUrl);
        const entryResponse = await fetchModule(entryServerUrl, `entryPointMap`);
        const entryContentType = entryResponse.headers["content-type"];

        if (entryContentType === "text/html") {
          const htmlSource = await entryResponse.text();
          const importmapHtmlNode = findFirstImportmapNode(htmlSource);

          if (importmapHtmlNode) {
            if (fetchImportmap === fetchImportmapFromParameter) {
              const srcAttribute = getHtmlNodeAttributeByName(importmapHtmlNode, "src");

              if (srcAttribute) {
                logger$1.debug(formatUseImportMap(importmapHtmlNode, entryProjectUrl, htmlSource));
                importMapUrl = util.resolveUrl(srcAttribute.value, entryCompiledUrl);

                if (!util.urlIsInsideOf(importMapUrl, compileDirectoryRemoteUrl)) {
                  logger$1.warn(formatImportmapOutsideCompileDirectory(importmapHtmlNode, entryProjectUrl, htmlSource, compileDirectoryUrl));
                }

                fetchImportmap = () => fetchAndNormalizeImportmap(importMapUrl);
              } else {
                const textNode = getHtmlNodeTextNode(importmapHtmlNode);

                if (textNode) {
                  logger$1.info(formatUseImportMap(importmapHtmlNode, entryProjectUrl, htmlSource));

                  fetchImportmap = () => {
                    const importmapRaw = JSON.parse(textNode.value);
                    const importmap = importMap.normalizeImportMap(importmapRaw, entryCompiledUrl);
                    return importmap;
                  };
                }
              }
            } else {
              logger$1.warn(formatIgnoreImportMap(importmapHtmlNode, entryProjectUrl, htmlSource));
            }
          }

          entryPointsPrepared.push({
            entryContentType,
            entryProjectRelativeUrl,
            entryBuildRelativeUrl,
            entryBuffer: Buffer.from(htmlSource)
          });
        } else if (entryContentType === "application/javascript" || entryContentType === "text/javascript") {
          entryPointsPrepared.push({
            entryContentType: "application/javascript",
            entryProjectRelativeUrl,
            entryBuildRelativeUrl
          });
        } else {
          entryPointsPrepared.push({
            entryContentType,
            entryProjectRelativeUrl,
            entryBuildRelativeUrl,
            entryBuffer: Buffer.from(await entryResponse.arrayBuffer())
          });
        }
      }));
      importMap$1 = await fetchImportmap(); // rollup will yell at us telling we did not provide an input option
      // if we provide only an html file without any script type module in it
      // but this can be desired to produce a build with only assets (html, css, images)
      // without any js
      // we emit an empty chunk, discards rollup warning about it and we manually remove
      // this chunk in buildProject hook

      let atleastOneChunkEmitted = false;
      assetBuilder = createAssetBuilder({
        parse: async (target, notifiers) => {
          return parseTarget(target, notifiers, {
            urlToOriginalProjectUrl: rollupUrlToOriginalProjectUrl,
            urlToOriginalServerUrl: rollupUrlToOriginalServerUrl,
            format,
            systemJsUrl,
            useImportMapToImproveLongTermCaching,
            createImportMapForFilesUsedInJs,
            minify,
            minifyHtmlOptions,
            minifyCssOptions,
            minifyJsOptions
          });
        },
        fetch: async (url, importer) => {
          const moduleResponse = await fetchModule(url, importer);
          return moduleResponse;
        }
      }, {
        logLevel: logger.loggerToLogLevel(logger$1),
        format,
        projectDirectoryUrl: `${compileServerOrigin}`,
        buildDirectoryRelativeUrl: util.urlToRelativeUrl(buildDirectoryUrl, projectDirectoryUrl),
        urlToFileUrl: rollupUrlToProjectUrl,
        urlToCompiledServerUrl: rollupUrlToCompiledServerUrl,
        loadUrl: url => urlResponseBodyMap[url],
        resolveTargetUrl: ({
          targetSpecifier,
          targetIsJsModule,
          importerUrl,
          importerIsEntry,
          importerIsJsModule
        }) => {
          const isHtmlEntryPoint = importerIsEntry && !importerIsJsModule;
          const isHtmlEntryPointReferencingAJsModule = isHtmlEntryPoint && targetIsJsModule; // when html references a js we must wait for the compiled version of js

          if (isHtmlEntryPointReferencingAJsModule) {
            const htmlCompiledUrl = rollupUrlToCompiledServerUrl(importerUrl);
            const jsModuleUrl = util.resolveUrl(targetSpecifier, htmlCompiledUrl);
            return jsModuleUrl;
          }

          let targetUrl;

          if (isHtmlEntryPoint && // parse and handle the untransformed importmap, not the one from compile server
          !targetSpecifier.endsWith(".importmap")) {
            const htmlCompiledUrl = rollupUrlToCompiledServerUrl(importerUrl);
            targetUrl = util.resolveUrl(targetSpecifier, htmlCompiledUrl);
          } else {
            targetUrl = util.resolveUrl(targetSpecifier, importerUrl);
          } // ignore url outside project directory
          // a better version would console.warn about file url outside projectDirectoryUrl
          // and ignore them and console.info/debug about remote url (https, http, ...)


          const projectUrl = rollupUrlToProjectUrl(targetUrl);

          if (!projectUrl) {
            return {
              external: true,
              url: targetUrl
            };
          }

          return targetUrl;
        },
        emitChunk,
        emitAsset,
        setAssetSource,
        onJsModuleReferencedInHtml: ({
          jsModuleUrl,
          jsModuleIsInline,
          jsModuleSource
        }) => {
          atleastOneChunkEmitted = true;

          if (jsModuleIsInline) {
            virtualModules[jsModuleUrl] = jsModuleSource;
          }

          jsModulesInHtml[urlToUrlForRollup(jsModuleUrl)] = true;
        }
      });
      await Promise.all(entryPointsPrepared.map(async ({
        entryContentType,
        entryProjectRelativeUrl,
        entryBuildRelativeUrl,
        entryBuffer
      }) => {
        if (entryContentType === "text/html") {
          const entryUrl = util.resolveUrl(entryProjectRelativeUrl, compileServerOrigin);
          await assetBuilder.createReferenceForHTMLEntry({
            entryContentType,
            entryUrl,
            entryBuffer,
            entryBuildRelativeUrl
          });
        } else if (entryContentType === "application/javascript") {
          atleastOneChunkEmitted = true;
          emitChunk({
            id: ensureRelativeUrlNotation$1(entryProjectRelativeUrl),
            name: entryBuildRelativeUrl,
            // don't hash js entry points
            fileName: entryBuildRelativeUrl
          });
        } else {
          console.warn(`entry content type ${entryProjectRelativeUrl} is unusual, got ${entryContentType}`);
          const entryUrl = util.resolveUrl(entryProjectRelativeUrl, compileServerOrigin);
          await assetBuilder.createReferenceForHTMLEntry({
            entryContentType,
            entryUrl,
            entryBuffer,
            entryBuildRelativeUrl
          });
        }
      }));

      if (!atleastOneChunkEmitted) {
        emitChunk({
          id: EMPTY_CHUNK_URL,
          fileName: "__empty__"
        });
      }
    },

    resolveId(specifier, importer) {
      if (importer === undefined) {
        if (specifier.endsWith(".html")) {
          importer = compileServerOrigin;
        } else {
          importer = compileDirectoryRemoteUrl;
        }
      } else {
        importer = rollupUrlToServerUrl(importer);
      }

      if (nativeModulePredicate(specifier)) {
        logger$1.debug(`${specifier} is native module -> marked as external`);
        return false;
      }

      if (externalImportSpecifiers.includes(specifier)) {
        logger$1.debug(`${specifier} verifies externalImportSpecifiers -> marked as external`);
        return {
          id: specifier,
          external: true
        };
      }

      if (virtualModules.hasOwnProperty(specifier)) {
        return specifier;
      }

      if (util.isFileSystemPath(importer)) {
        importer = util.fileSystemPathToUrl(importer);
      }

      const importUrl = importMap.resolveImport({
        specifier,
        importer,
        importMap: importMap$1,
        defaultExtension: importDefaultExtension,
        createBareSpecifierError: ({
          specifier,
          importer
        }) => {
          const importerOriginalProjectUrl = rollupUrlToOriginalProjectUrl(importer);
          const importMapOriginalProjectUrl = rollupUrlToOriginalProjectUrl(importMapUrl);
          const message = createBareSpecifierError({
            specifier,
            importer: importerOriginalProjectUrl ? util.urlToRelativeUrl(importerOriginalProjectUrl, projectDirectoryUrl) : importer,
            importMapUrl: importMapOriginalProjectUrl ? util.urlToRelativeUrl(importMapOriginalProjectUrl, projectDirectoryUrl) : importMapUrl,
            importMap: importMap$1
          }).message;
          return createJsenvPluginError(message);
        }
      });

      if (importer !== projectDirectoryUrl) {
        urlImporterMap[importUrl] = importer;
      } // keep external url intact


      const importProjectUrl = rollupUrlToProjectUrl(importUrl);

      if (!importProjectUrl) {
        return {
          id: specifier,
          external: true
        };
      }

      if (externalUrlPredicate(rollupUrlToOriginalProjectUrl(importProjectUrl))) {
        return {
          id: specifier,
          external: true
        };
      } // const rollupId = urlToRollupId(importUrl, { projectDirectoryUrl, compileServerOrigin })


      logger$1.debug(`${specifier} imported by ${importer} resolved to ${importUrl}`);
      return urlToUrlForRollup(importUrl);
    },

    resolveFileUrl: ({
      // chunkId, moduleId, referenceId,
      fileName
    }) => {
      const assetTarget = assetBuilder.getAssetByUrl(fileName);
      const buildRelativeUrl = assetTarget ? assetTarget.targetBuildRelativeUrl : fileName;

      if (format === "esmodule") {
        return `new URL("${buildRelativeUrl}", import.meta.url).href`;
      }

      if (format === "systemjs") {
        return `System.resolve("./${buildRelativeUrl}", module.meta.url)`;
      }

      if (format === "global") {
        return `new URL("${buildRelativeUrl}", document.currentScript && document.currentScript.src || document.baseURI).href`;
      }

      if (format === "commonjs") {
        return `new URL("${buildRelativeUrl}", "file:///" + __filename.replace(/\\/g, "/")).href`;
      }

      return null;
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {
    // },
    async load(id) {
      if (id === EMPTY_CHUNK_URL) {
        return "";
      }

      const moduleInfo = this.getModuleInfo(id);
      const url = rollupUrlToServerUrl(id); // const originalProjectUrl = urlToOriginalProjectUrl(url)
      // if (originalProjectUrl === jsenvImportMetaResolveGlobalUrl) {
      //   await assetBuilder.createReferenceForJs({
      //     jsUrl: url,
      //     targetSpecifier: importMapFileRelativeUrl,
      //     targetContentType: "application/importmap+json",
      //     // targetBuffer,
      //   })
      // }

      logger$1.debug(`loads ${url}`);
      const {
        responseUrl,
        contentRaw,
        content = "",
        map
      } = await loadModule(url);
      saveUrlResponseBody(responseUrl, contentRaw); // handle redirection

      if (responseUrl !== url) {
        saveUrlResponseBody(url, contentRaw);
        urlRedirectionMap[url] = responseUrl;
      }

      return {
        code: content,
        map
      };
    },

    async transform(code, id) {
      const ast = this.parse(code, {
        // used to know node line and column
        locations: true
      }); // const moduleInfo = this.getModuleInfo(id)

      const url = rollupUrlToServerUrl(id);
      const importerUrl = urlImporterMap[url];
      return transformImportMetaUrlReferences({
        url,
        importerUrl,
        code,
        ast,
        assetBuilder,
        fetch: fetchModule,
        markBuildRelativeUrlAsUsedByJs
      });
    },

    // resolveImportMeta: () => {}
    // transform should not be required anymore as
    // we will receive
    // transform: async (moduleContent, rollupId) => {}
    outputOptions: outputOptions => {
      const extension = path.extname(entryPointMap[Object.keys(entryPointMap)[0]]);
      const outputExtension = extension === ".html" ? ".js" : extension;
      outputOptions.entryFileNames = `[name]${outputExtension}`;
      outputOptions.chunkFileNames = useImportMapToImproveLongTermCaching || !urlVersioning ? `[name]${outputExtension}` : `[name]-[hash]${outputExtension}`; // rollup does not expects to have http dependency in the mix: fix them

      outputOptions.sourcemapPathTransform = (relativePath, sourcemapPath) => {
        const sourcemapUrl = util.fileSystemPathToUrl(sourcemapPath);
        const url = relativePathToUrl(relativePath, sourcemapUrl);
        const serverUrl = rollupUrlToServerUrl(url);
        const finalUrl = serverUrl in urlRedirectionMap ? urlRedirectionMap[serverUrl] : serverUrl;
        const projectUrl = rollupUrlToProjectUrl(finalUrl);

        if (projectUrl) {
          relativePath = util.urlToRelativeUrl(projectUrl, sourcemapUrl);
          return relativePath;
        }

        return finalUrl;
      };

      const relativePathToUrl = (relativePath, sourcemapUrl) => {
        const rollupUrl = util.resolveUrl(relativePath, sourcemapUrl); // here relativePath contains a protocol
        // because rollup don't work with url but with filesystem paths
        // let fix it below

        const url = fixRollupUrl(rollupUrl);
        return url;
      };

      return outputOptions;
    },
    renderChunk: async (code, chunk) => {
      let map = chunk.map;

      if (!minify) {
        return null;
      }

      const result = await minifyJs(code, chunk.fileName, {
        sourceMap: { ...(map ? {
            content: JSON.stringify(map)
          } : {}),
          asObject: true
        },
        ...(format === "global" ? {
          toplevel: false
        } : {
          toplevel: true
        }),
        ...minifyJsOptions
      });
      code = result.code;
      map = result.map;
      return {
        code,
        map
      };
    },

    async generateBundle(outputOptions, rollupResult) {
      const jsBuild = {};
      Object.keys(rollupResult).forEach(fileName => {
        const file = rollupResult[fileName];

        if (file.type !== "chunk") {
          return;
        }

        if (file.facadeModuleId === EMPTY_CHUNK_URL) {
          return;
        }

        let buildRelativeUrl;
        const canBeVersioned = file.facadeModuleId in jsModulesInHtml || !file.isEntry;

        if (urlVersioning && useImportMapToImproveLongTermCaching) {
          if (canBeVersioned) {
            buildRelativeUrl = computeBuildRelativeUrl(util.resolveUrl(fileName, buildDirectoryUrl), file.code, `[name]-[hash][extname]`);
          } else {
            buildRelativeUrl = fileName;
          }
        } else {
          buildRelativeUrl = fileName;
          fileName = rollupFileNameWithoutHash(fileName);
        }

        let originalProjectUrl;
        const id = file.facadeModuleId;

        if (id) {
          originalProjectUrl = rollupUrlToOriginalProjectUrl(id);
        } else {
          const sourcePath = file.map.sources[file.map.sources.length - 1];
          const fileBuildUrl = util.resolveUrl(file.fileName, buildDirectoryUrl);
          originalProjectUrl = util.resolveUrl(sourcePath, fileBuildUrl);
        }

        const originalProjectRelativeUrl = util.urlToRelativeUrl(originalProjectUrl, projectDirectoryUrl);

        if (canBeVersioned) {
          markBuildRelativeUrlAsUsedByJs(buildRelativeUrl);
        }

        jsBuild[buildRelativeUrl] = file;
        buildManifest[fileName] = buildRelativeUrl;
        buildMappings[originalProjectRelativeUrl] = buildRelativeUrl;
      }); // it's important to do this to emit late asset

      rollupEmitFile = (...args) => this.emitFile(...args);

      rollupSetAssetSource = (...args) => this.setAssetSource(...args); // malheureusement rollup ne permet pas de savoir lorsqu'un chunk
      // a fini d'etre résolu (parsing des imports statiques et dynamiques recursivement)
      // donc lorsque le build se termine on va indiquer
      // aux assets faisant référence a ces chunk js qu'ils sont terminés
      // et donc les assets peuvent connaitre le nom du chunk
      // et mettre a jour leur dépendance vers ce fichier js


      const rollupChunkReadyCallbackMap = assetBuilder.getRollupChunkReadyCallbackMap();
      Object.keys(rollupChunkReadyCallbackMap).forEach(key => {
        const targetBuildRelativeUrl = Object.keys(jsBuild).find(buildRelativeUrlCandidate => {
          const file = jsBuild[buildRelativeUrlCandidate];
          const {
            facadeModuleId
          } = file;
          return facadeModuleId && rollupUrlToServerUrl(facadeModuleId) === key;
        });
        const file = jsBuild[targetBuildRelativeUrl];
        const targetBuildBuffer = file.code;
        const targetFileName = useImportMapToImproveLongTermCaching || !urlVersioning ? buildRelativeUrlToFileName(targetBuildRelativeUrl) : targetBuildRelativeUrl;
        logger$1.debug(`resolve rollup chunk ${shortenUrl(key)}`);
        rollupChunkReadyCallbackMap[key]({
          targetBuildBuffer,
          targetBuildRelativeUrl,
          targetFileName
        });
      }); // wait html files to be emitted

      await assetBuilder.getAllAssetEntryEmittedPromise();
      const assetBuild = {};
      Object.keys(rollupResult).forEach(rollupFileId => {
        const file = rollupResult[rollupFileId];

        if (file.type !== "asset") {
          return;
        }

        const assetTarget = assetBuilder.getAssetByUrl(rollupFileId);

        if (!assetTarget) {
          const buildRelativeUrl = rollupFileId;
          const fileName = rollupFileNameWithoutHash(buildRelativeUrl);
          assetBuild[buildRelativeUrl] = file;
          buildManifest[fileName] = buildRelativeUrl; // the asset does not exists in the project it was generated during building
          // happens for sourcemap

          return;
        } // ignore potential useless assets which happens when:
        // - sourcemap re-emitted
        // - importmap re-emitted to have buildRelativeUrlMap


        if (assetTarget.shouldBeIgnored) {
          return;
        }

        const buildRelativeUrl = assetTarget.targetBuildRelativeUrl;
        const fileName = rollupFileNameWithoutHash(buildRelativeUrl);
        const originalProjectUrl = rollupUrlToOriginalProjectUrl(rollupFileId);
        const originalProjectRelativeUrl = util.urlToRelativeUrl(originalProjectUrl, projectDirectoryUrl); // in case sourcemap is mutated, we must not trust rollup but the asset builder source instead

        file.source = String(assetTarget.targetBuildBuffer);
        assetBuild[buildRelativeUrl] = file;
        buildMappings[originalProjectRelativeUrl] = buildRelativeUrl;
        buildManifest[fileName] = buildRelativeUrl;
      });
      rollupBuild = { ...jsBuild,
        ...assetBuild
      };
      rollupBuild = sortObjectByPathnames(rollupBuild);
      buildManifest = sortObjectByPathnames(buildManifest);
      buildMappings = sortObjectByPathnames(buildMappings);

      if (assetManifestFile) {
        const assetManifestFileUrl = util.resolveUrl(assetManifestFileRelativeUrl, buildDirectoryUrl);
        await util.writeFile(assetManifestFileUrl, JSON.stringify(buildManifest, null, "  "));
      }

      logger$1.info(logger.createDetailedMessage(`build done`, formatBuildDoneDetails(rollupBuild)));

      if (writeOnFileSystem) {
        await Promise.all(Object.keys(rollupBuild).map(async buildRelativeUrl => {
          const file = rollupBuild[buildRelativeUrl];
          const fileBuildUrl = util.resolveUrl(buildRelativeUrl, buildDirectoryUrl);

          if (file.type === "chunk") {
            let fileCode = file.code;

            if (file.map) {
              const sourcemapBuildRelativeUrl = `${buildRelativeUrl}.map`;

              if (sourcemapBuildRelativeUrl in rollupBuild === false) {
                const sourcemapBuildUrl = util.resolveUrl(sourcemapBuildRelativeUrl, buildDirectoryUrl);
                const fileSourcemapString = JSON.stringify(file.map, null, "  ");
                await util.writeFile(sourcemapBuildUrl, fileSourcemapString);
                const sourcemapBuildUrlRelativeToFileBuildUrl = util.urlToRelativeUrl(sourcemapBuildUrl, fileBuildUrl);
                fileCode = setJavaScriptSourceMappingUrl(fileCode, sourcemapBuildUrlRelativeToFileBuildUrl);
              }
            }

            await util.writeFile(fileBuildUrl, fileCode);
          } else {
            await util.writeFile(fileBuildUrl, file.source);
          }
        }));
      }
    }

  };

  const saveUrlResponseBody = (url, responseBody) => {
    urlResponseBodyMap[url] = responseBody;
    const projectUrl = rollupUrlToProjectUrl(url);

    if (projectUrl && projectUrl !== url) {
      urlResponseBodyMap[projectUrl] = responseBody;
    }
  };

  const loadModule = async (moduleUrl // {
  //   moduleInfo
  // },
  ) => {
    if (moduleUrl in virtualModules) {
      const codeInput = virtualModules[moduleUrl];
      const {
        code,
        map
      } = await transformJs({
        projectDirectoryUrl,
        importMetaEnvFileRelativeUrl,
        code: codeInput,
        url: rollupUrlToProjectUrl(moduleUrl),
        // transformJs expect a file:// url
        babelPluginMap
      });
      return {
        responseUrl: moduleUrl,
        contentRaw: code,
        content: code,
        map
      };
    }

    const importerUrl = urlImporterMap[moduleUrl];
    const moduleResponse = await fetchModule(moduleUrl, rollupUrlToProjectUrl(importerUrl) || importerUrl);
    const contentType = moduleResponse.headers["content-type"] || "";
    const commonData = {
      responseUrl: moduleResponse.url
    }; // keep this in sync with module-registration.js

    if (contentType === "application/javascript" || contentType === "text/javascript") {
      const jsModuleString = await moduleResponse.text();
      const map = await fetchSourcemap(moduleUrl, jsModuleString, {
        cancellationToken,
        logger: logger$1
      });
      return { ...commonData,
        contentRaw: jsModuleString,
        content: jsModuleString,
        map
      };
    }

    if (contentType === "application/json" || contentType.endsWith("+json")) {
      const responseBodyAsString = await moduleResponse.text(); // there is no need to minify the json string
      // because it becomes valid javascript
      // that will be minified by minifyJs inside renderChunk

      const json = responseBodyAsString;
      return { ...commonData,
        contentRaw: json,
        content: `export default ${json}`
      };
    }

    const moduleResponseBodyAsBuffer = Buffer.from(await moduleResponse.arrayBuffer());
    const targetContentType = moduleResponse.headers["content-type"];
    const assetReferenceForImport = await assetBuilder.createReferenceForJs({
      // Reference to this target is corresponds to a static or dynamic import.
      // found in a given file (importerUrl).
      // But we don't know the line and colum because rollup
      // does not tell us that information
      jsUrl: importerUrl,
      jsLine: undefined,
      jsColumn: undefined,
      targetSpecifier: moduleResponse.url,
      targetContentType,
      targetBuffer: moduleResponseBodyAsBuffer
    });

    if (assetReferenceForImport) {
      markBuildRelativeUrlAsUsedByJs(assetReferenceForImport.target.targetBuildRelativeUrl);
      const content = `export default ${referenceToCodeForRollup(assetReferenceForImport)}`;
      return { ...commonData,
        contentRaw: String(moduleResponseBodyAsBuffer),
        content
      };
    }

    return { ...commonData,
      contentRaw: String(moduleResponseBodyAsBuffer),
      content: String(moduleResponseBodyAsBuffer)
    };
  };

  const fetchModule = async (moduleUrl, importer) => {
    const response = await fetchUrl(moduleUrl, {
      cancellationToken,
      ignoreHttpsError: true
    });
    importer = rollupUrlToOriginalProjectUrl(importer) || rollupUrlToProjectUrl(importer) || importer;

    if (response.status === 404) {
      throw createJsenvPluginError(formatFileNotFound(rollupUrlToOriginalProjectUrl(response.url) || rollupUrlToProjectUrl(response.url) || response.url, importer));
    }

    const okValidation = await validateResponseStatusIsOk(response, importer);

    if (!okValidation.valid) {
      throw createJsenvPluginError(okValidation.message);
    }

    return response;
  };

  const shortenUrl = url => {
    return util.urlIsInsideOf(url, projectDirectoryUrl) ? util.urlToRelativeUrl(url, projectDirectoryUrl) : url;
  };

  return {
    jsenvRollupPlugin,
    getLastErrorMessage: () => lastErrorMessage,
    getResult: () => {
      return {
        rollupBuild,
        urlResponseBodyMap,
        buildMappings,
        buildManifest,
        buildImportMap: createImportMapForFilesUsedInJs()
      };
    }
  };
};

const fixRollupUrl = rollupUrl => {
  // fix rollup not supporting source being http
  const httpIndex = rollupUrl.indexOf(`http:/`, 1);

  if (httpIndex > -1) {
    return `http://${rollupUrl.slice(httpIndex + `http:/`.length)}`;
  }

  const httpsIndex = rollupUrl.indexOf("https:/", 1);

  if (httpsIndex > -1) {
    return `https://${rollupUrl.slice(httpsIndex + `https:/`.length)}`;
  }

  const fileIndex = rollupUrl.indexOf("file:", 1);

  if (fileIndex > -1) {
    return `file://${rollupUrl.slice(fileIndex + `file:`.length)}`;
  }

  return rollupUrl;
};

const formatFileNotFound = (url, importer) => {
  return logger.createDetailedMessage(`A file cannot be found.`, {
    file: util.urlToFileSystemPath(url),
    ["imported by"]: importer.startsWith("file://") && !importer.includes("\n") ? util.urlToFileSystemPath(importer) : importer
  });
};

const showImportmapSourceLocation = (importmapHtmlNode, htmlUrl, htmlSource) => {
  const {
    line,
    column
  } = getHtmlNodeLocation(importmapHtmlNode);
  return `${htmlUrl}:${line}:${column}

${showSourceLocation(htmlSource, {
    line,
    column
  })}
`;
};

const formatIgnoreImportMap = (importmapHtmlNode, htmlUrl, htmlSource) => {
  return `ignore importmap found in html file.
${showImportmapSourceLocation(importmapHtmlNode, htmlUrl, htmlSource)}`;
};

const formatUseImportMap = (importmapHtmlNode, htmlUrl, htmlSource) => {
  return `use importmap found in html file.
${showImportmapSourceLocation(importmapHtmlNode, htmlUrl, htmlSource)}`;
};

const formatImportmapOutsideCompileDirectory = (importmapHtmlNode, htmlUrl, htmlSource, compileDirectoryUrl) => {
  return `WARNING: found importmap outside compile directory.
Remapped import will not be compiled.
You should make importmap source relative.
${showImportmapSourceLocation(importmapHtmlNode, htmlUrl, htmlSource)}
--- compile directory url ---
${compileDirectoryUrl}`;
};

const formatBuildDoneDetails = build => {
  const assetFilenames = Object.keys(build).filter(key => build[key].type === "asset").map(key => build[key].fileName);
  const assetCount = assetFilenames.length;
  const chunkFilenames = Object.keys(build).filter(key => build[key].type === "chunk").map(key => build[key].fileName);
  const chunkCount = chunkFilenames.length;
  const assetDescription = // eslint-disable-next-line no-nested-ternary
  assetCount === 0 ? "" : assetCount === 1 ? "1 asset" : `${assetCount} assets`;
  const chunkDescription = // eslint-disable-next-line no-nested-ternary
  chunkCount === 0 ? "" : chunkCount === 1 ? "1 chunk" : `${chunkCount} chunks`;
  return { ...(assetDescription ? {
      [assetDescription]: assetFilenames
    } : {}),
    ...(chunkDescription ? {
      [chunkDescription]: chunkFilenames
    } : {})
  };
};

const rollupFileNameWithoutHash = fileName => {
  return fileName.replace(/-[a-z0-9]{8,}(\..*?)?$/, (_, afterHash = "") => {
    return afterHash;
  });
}; // otherwise importmap handle it as a bare import


const ensureRelativeUrlNotation$1 = relativeUrl => {
  if (relativeUrl.startsWith("../")) {
    return relativeUrl;
  }

  return `./${relativeUrl}`;
};

const externalImportUrlPatternsToExternalUrlPredicate = (externalImportUrlPatterns, projectDirectoryUrl) => {
  const externalImportUrlStructuredMetaMap = util.normalizeStructuredMetaMap({
    external: { ...externalImportUrlPatterns,
      "node_modules/@jsenv/core/helpers/": false
    }
  }, projectDirectoryUrl);
  return url => {
    const meta = util.urlToMeta({
      url,
      structuredMetaMap: externalImportUrlStructuredMetaMap
    });
    return Boolean(meta.external);
  };
};

const buildUsingRollup = async ({
  cancellationToken,
  logger,
  entryPointMap,
  projectDirectoryUrl,
  importMapFileRelativeUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  importDefaultExtension,
  externalImportSpecifiers,
  externalImportUrlPatterns,
  babelPluginMap,
  node,
  browser,
  format,
  systemJsUrl,
  globals,
  globalName,
  sourcemapExcludeSources,
  buildDirectoryUrl,
  buildDirectoryClean,
  urlVersioning,
  useImportMapToImproveLongTermCaching,
  preserveEntrySignatures,
  jsConcatenation,
  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
  assetManifestFile = false,
  assetManifestFileRelativeUrl,
  serviceWorkers,
  serviceWorkerFinalizer,
  writeOnFileSystem
}) => {
  const {
    jsenvRollupPlugin,
    getLastErrorMessage,
    getResult
  } = await createJsenvRollupPlugin({
    cancellationToken,
    logger,
    entryPointMap,
    projectDirectoryUrl,
    importMapFileRelativeUrl,
    compileDirectoryRelativeUrl,
    compileServerOrigin,
    importDefaultExtension,
    externalImportSpecifiers,
    externalImportUrlPatterns,
    babelPluginMap,
    node,
    browser,
    format,
    systemJsUrl,
    buildDirectoryUrl,
    urlVersioning,
    useImportMapToImproveLongTermCaching,
    minify,
    minifyJsOptions,
    minifyCssOptions,
    minifyHtmlOptions,
    assetManifestFile,
    assetManifestFileRelativeUrl,
    writeOnFileSystem
  });

  try {
    await useRollup({
      cancellationToken,
      jsenvRollupPlugin,
      format,
      globals,
      globalName,
      sourcemapExcludeSources,
      preserveEntrySignatures,
      jsConcatenation,
      buildDirectoryUrl,
      buildDirectoryClean
    });
  } catch (e) {
    if (e.plugin === "jsenv") {
      const jsenvPluginErrorMessage = getLastErrorMessage();

      if (jsenvPluginErrorMessage) {
        e.message = jsenvPluginErrorMessage;
      }

      throw e;
    }

    throw e;
  }

  const jsenvBuild = getResult();

  if (writeOnFileSystem) {
    await Promise.all(Object.keys(serviceWorkers).map(async serviceWorkerProjectRelativeUrl => {
      const serviceWorkerBuildRelativeUrl = serviceWorkers[serviceWorkerProjectRelativeUrl];
      await buildServiceWorker({
        projectDirectoryUrl,
        buildDirectoryUrl,
        serviceWorkerProjectRelativeUrl,
        serviceWorkerBuildRelativeUrl,
        serviceWorkerTransformer: code => serviceWorkerFinalizer(code, jsenvBuild),
        minify
      });
    }));
  }

  return jsenvBuild;
};

const useRollup = async ({
  cancellationToken,
  jsenvRollupPlugin,
  format,
  globals,
  globalName,
  sourcemapExcludeSources,
  preserveEntrySignatures,
  // jsConcatenation,
  buildDirectoryUrl,
  buildDirectoryClean
}) => {
  const {
    rollup
  } = require$1("rollup");

  const rollupInputOptions = {
    // about cache here, we should/could reuse previous rollup call
    // to get the cache from the entryPointMap
    // as shown here: https://rollupjs.org/guide/en#cache
    // it could be passed in arguments to this function
    // however parallelism and having different rollup options per
    // call make it a bit complex
    // cache: null
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    //  experimentalTopLevelAwait: true,
    // if we want to ignore some warning
    // please use https://rollupjs.org/guide/en#onwarn
    // to be very clear about what we want to ignore
    onwarn: (warning, warn) => {
      if (warning.code === "THIS_IS_UNDEFINED") return;
      if (warning.code === "EMPTY_BUNDLE" && warning.chunkName === "__empty__") return; // ignore file name conflict when sourcemap or importmap are re-emitted

      if (warning.code === "FILE_NAME_CONFLICT" && (warning.message.includes(".map") || warning.message.includes(".importmap"))) {
        return;
      }

      warn(warning);
    },
    // on passe input: [] car c'est le plusign jsenv qui se chargera d'emit des chunks
    // en fonction de entryPointMap
    // on fait cela car sinon rollup est pénible si on passe un entry point map de type html
    input: [],
    preserveEntrySignatures,
    plugins: [jsenvRollupPlugin]
  };
  const rollupOutputOptions = {
    // https://rollupjs.org/guide/en#experimentaltoplevelawait
    // experimentalTopLevelAwait: true,
    // we could put prefConst to true by checking 'transform-block-scoping'
    // presence in babelPluginMap
    preferConst: false,
    // https://rollupjs.org/guide/en#output-dir
    dir: util.urlToFileSystemPath(buildDirectoryUrl),
    // https://rollupjs.org/guide/en#output-format
    format: formatToRollupFormat(format),
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources,
    // preserveModules: !jsConcatenation,
    ...(format === "global" ? {
      globals,
      name: globalName
    } : {})
  };
  const rollupReturnValue = await cancellation.createOperation({
    cancellationToken,
    start: () => rollup(rollupInputOptions)
  });

  if (buildDirectoryClean) {
    await util.ensureEmptyDirectory(buildDirectoryUrl);
  }

  const rollupOutputArray = await cancellation.createOperation({
    cancellationToken,
    start: () => rollupReturnValue.generate(rollupOutputOptions)
  });
  return rollupOutputArray;
};

const formatToRollupFormat = format => {
  if (format === "global") return "iife";
  if (format === "commonjs") return "cjs";
  if (format === "systemjs") return "system";
  if (format === "esmodule") return "esm";
  throw new Error(`unexpected format, got ${format}`);
};

/*

One thing to keep in mind:
the sourcemap.sourcesContent will contains a json file transformed to js
while urlResponseBodyMap will contain the json file raw source because the corresponding
json file etag is used to invalidate the cache

*/
const buildToCompilationResult = ({
  rollupBuild,
  urlResponseBodyMap
}, {
  mainFileName,
  projectDirectoryUrl,
  compiledFileUrl,
  sourcemapFileUrl
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`);
  }

  if (typeof sourcemapFileUrl !== "string") {
    throw new TypeError(`sourcemapFileUrl must be a string, got ${sourcemapFileUrl}`);
  }

  const sources = [];
  const sourcesContent = [];

  if (mainFileName === undefined) {
    mainFileName = Object.keys(rollupBuild).find(key => rollupBuild[key].isEntry);
  }

  const trackDependencies = dependencyMap => {
    Object.keys(dependencyMap).forEach(moduleUrl => {
      // do not track dependency outside project
      if (!moduleUrl.startsWith(projectDirectoryUrl)) {
        return;
      }

      if (!sources.includes(moduleUrl)) {
        sources.push(moduleUrl);
        sourcesContent.push(dependencyMap[moduleUrl]);
      }
    });
  };

  const assets = [];
  const assetsContent = [];
  const mainRollupFile = rollupBuild[mainFileName];
  const mainFile = parseRollupFile(mainRollupFile, {
    urlResponseBodyMap,
    sourcemapFileUrl,
    sourcemapFileRelativeUrlForModule: util.urlToRelativeUrl(sourcemapFileUrl, compiledFileUrl)
  }); // mainFile.sourcemap.file = fileUrlToRelativePath(originalFileUrl, sourcemapFileUrl)

  trackDependencies(mainFile.dependencyMap);
  assets.push(sourcemapFileUrl);
  assetsContent.push(JSON.stringify(mainFile.sourcemap, null, "  "));
  Object.keys(rollupBuild).forEach(fileName => {
    if (fileName === mainFileName) return;
    const rollupFile = rollupBuild[fileName];
    const file = parseRollupFile(rollupFile, {
      urlResponseBodyMap,
      compiledFileUrl,
      sourcemapFileUrl: util.resolveUrl(file.map.file, compiledFileUrl)
    });
    trackDependencies(file.dependencyMap);
    assets.push(util.resolveUrl(fileName), compiledFileUrl);
    assetsContent.push(file.content);
    assets.push(util.resolveUrl(`${fileName}.map`, compiledFileUrl));
    assetsContent.push(JSON.stringify(rollupFile.sourcemap, null, "  "));
  });
  return {
    contentType: "application/javascript",
    compiledSource: mainFile.content,
    sources,
    sourcesContent,
    assets,
    assetsContent
  };
};

const parseRollupFile = (rollupFile, {
  urlResponseBodyMap,
  sourcemapFileUrl,
  sourcemapFileRelativeUrlForModule = `./${rollupFile.fileName}.map`
}) => {
  const dependencyMap = {};
  const mainModuleSourcemap = rollupFile.map;
  mainModuleSourcemap.sources.forEach((source, index) => {
    const moduleUrl = util.resolveUrl(source, sourcemapFileUrl);
    dependencyMap[moduleUrl] = getModuleContent({
      urlResponseBodyMap,
      mainModuleSourcemap,
      moduleUrl,
      moduleIndex: index
    });
  });
  const sourcemap = rollupFile.map;
  const content = setJavaScriptSourceMappingUrl(rollupFile.code, sourcemapFileRelativeUrlForModule);
  return {
    dependencyMap,
    content,
    sourcemap
  };
};

const getModuleContent = ({
  urlResponseBodyMap,
  mainModuleSourcemap,
  moduleUrl,
  moduleIndex
}) => {
  if (moduleUrl in urlResponseBodyMap) {
    return urlResponseBodyMap[moduleUrl];
  } // try to read it from mainModuleSourcemap


  const sourcesContent = mainModuleSourcemap.sourcesContent || [];

  if (moduleIndex in sourcesContent) {
    const contentFromRollupSourcemap = sourcesContent[moduleIndex];

    if (contentFromRollupSourcemap !== null && contentFromRollupSourcemap !== undefined) {
      return contentFromRollupSourcemap;
    }
  } // try to get it from filesystem


  if (moduleUrl.startsWith("file:///")) {
    const moduleFilePath = util.urlToFileSystemPath(moduleUrl); // this could be async but it's ok for now
    // making it async could be harder than it seems
    // because sourcesContent must be in sync with sources

    try {
      const moduleFileBuffer = fs.readFileSync(moduleFilePath);
      const moduleFileString = String(moduleFileBuffer);
      return moduleFileString;
    } catch (e) {
      if (e && e.code === "ENOENT") {
        throw new Error(`module file not found at ${moduleUrl}`);
      }

      throw e;
    }
  } // it's an external ressource like http, throw


  throw new Error(`cannot fetch module content from ${moduleUrl}`);
};

const startsWithWindowsDriveLetter = string => {
  const firstChar = string[0];
  if (!/[a-zA-Z]/.test(firstChar)) return false;
  const secondChar = string[1];
  if (secondChar !== ":") return false;
  return true;
};
const windowsFilePathToUrl = windowsFilePath => {
  return `file:///${replaceBackSlashesWithSlashes(windowsFilePath)}`;
};
const replaceBackSlashesWithSlashes = string => string.replace(/\\/g, "/");

const isWindows = process.platform === "win32";
const transformResultToCompilationResult = async ({
  code,
  map,
  contentType = "application/javascript",
  metadata = {}
}, {
  projectDirectoryUrl,
  originalFileContent,
  originalFileUrl,
  compiledFileUrl,
  sourcemapFileUrl,
  sourcemapEnabled = true,
  // removing sourcesContent from map decrease the sourceMap
  // it also means client have to fetch source from server (additional http request)
  // some client ignore sourcesContent property such as vscode-chrome-debugger
  // Because it's the most complex scenario and we want to ensure client is always able
  // to find source from the sourcemap, we remove map.sourcesContent by default to test this.
  sourcemapExcludeSources = true,
  sourcemapMethod = "comment" // "comment", "inline"

}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof originalFileContent !== "string") {
    throw new TypeError(`originalFileContent must be a string, got ${originalFileContent}`);
  }

  if (typeof originalFileUrl !== "string") {
    throw new TypeError(`originalFileUrl must be a string, got ${originalFileUrl}`);
  }

  if (typeof compiledFileUrl !== "string") {
    throw new TypeError(`compiledFileUrl must be a string, got ${compiledFileUrl}`);
  }

  if (typeof sourcemapFileUrl !== "string") {
    throw new TypeError(`sourcemapFileUrl must be a string, got ${sourcemapFileUrl}`);
  }

  const sources = [];
  const sourcesContent = [];
  const assets = [];
  const assetsContent = [];
  let output = code;

  if (sourcemapEnabled && map) {
    if (map.sources.length === 0) {
      // may happen in some cases where babel returns a wrong sourcemap
      // there is at least one case where it happens
      // a file with only import './whatever.js' inside
      sources.push(originalFileUrl);
      sourcesContent.push(originalFileContent);
    } else {
      await Promise.all(map.sources.map(async (source, index) => {
        // be careful here we might received C:/Directory/file.js path from babel
        // also in case we receive relative path like directory\file.js we replace \ with slash
        // for url resolution
        const sourceFileUrl = isWindows && startsWithWindowsDriveLetter(source) ? windowsFilePathToUrl(source) : util.ensureWindowsDriveLetter(util.resolveUrl(isWindows ? replaceBackSlashesWithSlashes(source) : source, sourcemapFileUrl), sourcemapFileUrl);

        if (!sourceFileUrl.startsWith(projectDirectoryUrl)) {
          // do not track dependency outside project
          // it means cache stays valid for those external sources
          return;
        }

        map.sources[index] = util.urlToRelativeUrl(sourceFileUrl, sourcemapFileUrl);
        sources[index] = sourceFileUrl;

        if (map.sourcesContent && map.sourcesContent[index]) {
          sourcesContent[index] = map.sourcesContent[index];
        } else {
          const sourceFileContent = await util.readFile(sourceFileUrl);
          sourcesContent[index] = sourceFileContent;
        }
      }));
    }

    if (sourcemapExcludeSources) {
      delete map.sourcesContent;
    } // we don't need sourceRoot because our path are relative or absolute to the current location
    // we could comment this line because it is not set by babel because not passed during transform


    delete map.sourceRoot;
    const setSourceMappingUrl = contentType === "application/javascript" ? setJavaScriptSourceMappingUrl : setCssSourceMappingUrl;

    if (sourcemapMethod === "inline") {
      output = setSourceMappingUrl(output, sourcemapToBase64Url(map));
    } else if (sourcemapMethod === "comment") {
      const sourcemapFileRelativePathForModule = util.urlToRelativeUrl(sourcemapFileUrl, compiledFileUrl);
      output = setSourceMappingUrl(output, sourcemapFileRelativePathForModule);
      assets.push(sourcemapFileUrl);
      assetsContent.push(stringifyMap(map));
    }
  } else {
    sources.push(originalFileUrl);
    sourcesContent.push(originalFileContent);
  }

  const {
    coverage
  } = metadata;

  if (coverage) {
    const coverageAssetFileUrl = generateCompiledFileAssetUrl(compiledFileUrl, "coverage.json");
    assets.push(coverageAssetFileUrl);
    assetsContent.push(stringifyCoverage(coverage));
  }

  return {
    compiledSource: output,
    contentType,
    sources,
    sourcesContent,
    assets,
    assetsContent
  };
};

const stringifyMap = object => JSON.stringify(object, null, "  ");

const stringifyCoverage = object => JSON.stringify(object, null, "  ");

const jsenvCompilerForJavaScript = ({
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  compileId,
  importMetaEnvFileRelativeUrl,
  importMeta,
  groupMap,
  babelPluginMap,
  convertMap,
  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,
  writeOnFilesystem,
  sourcemapExcludeSources
}) => {
  const contentType = server.urlToContentType(originalFileUrl);

  if (contentType !== "application/javascript" && contentType !== "text/javascript") {
    return null;
  }

  return {
    compile: async originalFileContent => {
      const transformResult = await transformJs({
        projectDirectoryUrl,
        importMetaEnvFileRelativeUrl,
        importMeta,
        code: originalFileContent,
        url: originalFileUrl,
        urlAfterTransform: compiledFileUrl,
        babelPluginMap: compileIdToBabelPluginMap(compileId, {
          groupMap,
          babelPluginMap
        }),
        convertMap,
        transformTopLevelAwait,
        moduleOutFormat,
        importMetaFormat
      });
      const sourcemapFileUrl = `${compiledFileUrl}.map`;
      return transformResultToCompilationResult(transformResult, {
        projectDirectoryUrl,
        originalFileContent,
        originalFileUrl,
        compiledFileUrl,
        sourcemapFileUrl,
        sourcemapMethod: writeOnFilesystem ? "comment" : "inline",
        sourcemapExcludeSources
      });
    }
  };
};
const compileIdToBabelPluginMap = (compileId, {
  babelPluginMap,
  groupMap
}) => {
  const babelPluginMapForGroupMap = {};
  const groupBabelPluginMap = {};
  groupMap[compileId].babelPluginRequiredNameArray.forEach(babelPluginRequiredName => {
    if (babelPluginRequiredName in babelPluginMap) {
      groupBabelPluginMap[babelPluginRequiredName] = babelPluginMap[babelPluginRequiredName];
    }
  });
  return { ...groupBabelPluginMap,
    ...babelPluginMapForGroupMap
  };
};

const jsenvCompilerForDynamicBuild = ({
  compileId,
  originalFileUrl,
  ...rest
}) => {
  const contentType = server.urlToContentType(originalFileUrl);

  if (contentType !== "application/javascript" && contentType !== "text/javascript") {
    return null;
  }

  if (compileId === COMPILE_ID_BUILD_GLOBAL || compileId === COMPILE_ID_BUILD_COMMONJS) {
    return handleDynamicBuild({
      compileId,
      originalFileUrl,
      ...rest
    });
  }

  if (compileId === COMPILE_ID_BUILD_GLOBAL_FILES || compileId === COMPILE_ID_BUILD_COMMONJS_FILES) {
    return handleDynamicBuildFile({
      compileId,
      originalFileUrl,
      ...rest
    });
  }

  return null;
};

const handleDynamicBuild = ({
  cancellationToken,
  logger,
  projectDirectoryUrl,
  importMapFileRelativeUrl,
  compileId,
  originalFileUrl,
  compiledFileUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  importDefaultExtension,
  babelPluginMap
}) => {
  const format = compileId === COMPILE_ID_BUILD_GLOBAL ? "global" : "commonjs"; // might want to put this to false while working on jsenv
  // to that cache gets verified

  const isJenvInternalFile = false ;
  return {
    writeOnFilesystem: true,
    useFilesystemAsCache: true,
    compileCacheSourcesValidation: !isJenvInternalFile,
    compileCacheAssetsValidation: !isJenvInternalFile,
    compile: async () => {
      const compileIdForFiles = format === "global" ? COMPILE_ID_BUILD_GLOBAL_FILES : COMPILE_ID_BUILD_COMMONJS_FILES;
      const originalFileRelativeUrl = util.urlToRelativeUrl(originalFileUrl, projectDirectoryUrl);
      const buildRelativeUrl = format === "commonjs" ? `${util.urlToBasename(originalFileUrl)}.cjs` : util.urlToFilename(originalFileUrl);
      const entryPointMap = {
        [`./${originalFileRelativeUrl}`]: `./${buildRelativeUrl}`
      };
      const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileIdForFiles}/`;
      const build = await buildUsingRollup({
        cancellationToken,
        logger,
        entryPointMap,
        projectDirectoryUrl,
        importMapFileRelativeUrl,
        compileDirectoryRelativeUrl,
        compileServerOrigin,
        importDefaultExtension,
        externalImportSpecifiers: [],
        babelPluginMap,
        format,
        node: format === "commonjs",
        browser: format !== "commonjs",
        // buildDirectoryUrl is just theorical because of writeOnFileSystem: false
        // but still important to know where the files will be written
        buildDirectoryUrl: util.resolveDirectoryUrl("./", compiledFileUrl),
        writeOnFileSystem: false,
        sourcemapExcludeSources: true,
        assetManifestFile: false
      });
      const sourcemapFileUrl = `${compiledFileUrl}.map`;
      return buildToCompilationResult(build, {
        mainFileName: buildRelativeUrl,
        projectDirectoryUrl,
        originalFileUrl,
        compiledFileUrl,
        sourcemapFileUrl
      });
    }
  };
};

const handleDynamicBuildFile = ({
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  compileId,
  importMetaEnvFileRelativeUrl,
  importMeta,
  groupMap,
  babelPluginMap,
  convertMap,
  transformTopLevelAwait,
  writeOnFilesystem,
  sourcemapExcludeSources
}) => {
  return {
    compile: async originalFileContent => {
      const transformResult = await transformJs({
        projectDirectoryUrl,
        importMetaEnvFileRelativeUrl,
        importMeta,
        code: originalFileContent,
        url: originalFileUrl,
        urlAfterTransform: compiledFileUrl,
        babelPluginMap: compileIdToBabelPluginMap(getWorstCompileId(groupMap), {
          groupMap,
          babelPluginMap
        }),
        convertMap,
        transformTopLevelAwait,
        // we are compiling for rollup, do not transform into systemjs format
        moduleOutFormat: "esmodule",
        importMetaFormat: // eslint-disable-next-line no-nested-ternary
        compileId === COMPILE_ID_BUILD_GLOBAL_FILES ? "global" : compileId === COMPILE_ID_BUILD_COMMONJS_FILES ? "commonjs" : "esmodule"
      });
      const sourcemapFileUrl = `${compiledFileUrl}.map`;
      return transformResultToCompilationResult(transformResult, {
        projectDirectoryUrl,
        originalFileContent,
        originalFileUrl,
        compiledFileUrl,
        sourcemapFileUrl,
        sourcemapMethod: writeOnFilesystem ? "comment" : "inline",
        sourcemapExcludeSources
      });
    }
  };
};

const getWorstCompileId = groupMap => {
  if (COMPILE_ID_OTHERWISE in groupMap) {
    return COMPILE_ID_OTHERWISE;
  }

  return Object.keys(groupMap)[Object.keys(groupMap).length - 1];
};

const jsenvCompilerForHtml = ({
  // cancellationToken,
  // logger,
  // request,
  projectDirectoryUrl,
  originalFileUrl,
  compiledFileUrl,
  compileId,
  outDirectoryRelativeUrl,
  importMapFileRelativeUrl,
  importMetaEnvFileRelativeUrl,
  importMeta,
  groupMap,
  babelPluginMap,
  convertMap,
  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,
  jsenvBrowserBuildUrlRelativeToProject,
  scriptInjections
}) => {
  const contentType = server.urlToContentType(originalFileUrl);

  if (contentType !== "text/html") {
    return null;
  }

  return {
    compile: async htmlBeforeCompilation => {
      // parsing html should not throw any syntax error
      // invalid html markup is converted into some valid html
      // in the worst cases the faulty html string special characters
      // will be html encoded.
      // All this comment to say we don't have to try/catch html parsing
      const htmlAst = parseHtmlString(htmlBeforeCompilation);
      manipulateHtmlAst(htmlAst, {
        scriptInjections: [{
          src: `/${jsenvBrowserBuildUrlRelativeToProject}`
        }, // todo: this is dirty because it means
        // compile server is aware of exploring and jsenv toolbar
        // instead this should be moved to startExploring
        ...(originalFileUrl === jsenvToolbarHtmlUrl ? [] : scriptInjections)]
      });
      const {
        scripts
      } = parseHtmlAstRessources(htmlAst);
      let hasImportmap = false;
      const inlineScriptsContentMap = {};
      scripts.forEach(script => {
        const typeAttribute = getHtmlNodeAttributeByName(script, "type");
        const srcAttribute = getHtmlNodeAttributeByName(script, "src");

        if (typeAttribute && typeAttribute.value === "importmap" && srcAttribute) {
          hasImportmap = true;
          typeAttribute.value = "jsenv-importmap";
          return;
        }

        if (typeAttribute && typeAttribute.value === "module" && srcAttribute) {
          removeHtmlNodeAttribute(script, typeAttribute);
          removeHtmlNodeAttribute(script, srcAttribute);
          setHtmlNodeText(script, `window.__jsenv__.importFile(${JSON.stringify(srcAttribute.value)})`);
          return;
        }

        const textNode = getHtmlNodeTextNode(script);

        if (typeAttribute && typeAttribute.value === "module" && textNode) {
          const scriptAssetUrl = generateCompiledFileAssetUrl(compiledFileUrl, getUniqueNameForInlineHtmlNode(script, scripts, `[id].js`));
          const specifier = `./${util.urlToRelativeUrl(scriptAssetUrl, compiledFileUrl)}`;
          inlineScriptsContentMap[specifier] = textNode.value;
          removeHtmlNodeAttribute(script, typeAttribute);
          removeHtmlNodeAttribute(script, srcAttribute);
          setHtmlNodeText(script, `window.__jsenv__.importFile(${JSON.stringify(specifier)})`);
          return;
        }
      }); // ensure there is at least the importmap needed for jsenv

      if (hasImportmap === false) {
        manipulateHtmlAst(htmlAst, {
          scriptInjections: [{
            type: "jsenv-importmap",
            // in case there is no importmap, use a top level one
            src: `/${outDirectoryRelativeUrl}${compileId}/${importMapFileRelativeUrl}`
          }]
        });
      }

      const htmlAfterTransformation = stringifyHtmlAst(htmlAst);
      let assets = [];
      let assetsContent = [];
      await Promise.all(Object.keys(inlineScriptsContentMap).map(async scriptSrc => {
        const scriptAssetUrl = util.resolveUrl(scriptSrc, compiledFileUrl);
        const scriptBasename = util.urlToRelativeUrl(scriptAssetUrl, compiledFileUrl);
        const scriptOriginalFileUrl = util.resolveUrl(scriptBasename, originalFileUrl);
        const scriptAfterTransformFileUrl = util.resolveUrl(scriptBasename, compiledFileUrl);
        const scriptBeforeCompilation = inlineScriptsContentMap[scriptSrc];
        let scriptTransformResult;

        try {
          scriptTransformResult = await transformJs({
            projectDirectoryUrl,
            importMetaEnvFileRelativeUrl,
            importMeta,
            code: scriptBeforeCompilation,
            url: scriptOriginalFileUrl,
            urlAfterTransform: scriptAfterTransformFileUrl,
            babelPluginMap: compileIdToBabelPluginMap(compileId, {
              groupMap,
              babelPluginMap
            }),
            convertMap,
            transformTopLevelAwait,
            moduleOutFormat,
            importMetaFormat
          });
        } catch (e) {
          // If there is a syntax error in inline script
          // we put the raw script without transformation.
          // when systemjs will try to instantiate to script it
          // will re-throw this syntax error.
          // Thanks to this we see the syntax error in the
          // document and livereloading still works
          // because we gracefully handle this error
          if (e.code === "PARSE_ERROR") {
            const code = scriptBeforeCompilation;
            assets = [...assets, scriptAssetUrl];
            assetsContent = [...assetsContent, code];
            return;
          }

          throw e;
        }

        const sourcemapFileUrl = util.resolveUrl(`${scriptBasename}.map`, scriptAfterTransformFileUrl);
        let {
          code,
          map
        } = scriptTransformResult;
        const sourcemapFileRelativePathForModule = util.urlToRelativeUrl(sourcemapFileUrl, compiledFileUrl);
        code = setJavaScriptSourceMappingUrl(code, sourcemapFileRelativePathForModule);
        assets = [...assets, scriptAssetUrl, sourcemapFileUrl];
        assetsContent = [...assetsContent, code, JSON.stringify(map, null, "  ")];
      }));
      return {
        compiledSource: htmlAfterTransformation,
        contentType: "text/html",
        sources: [originalFileUrl],
        sourcesContent: [htmlBeforeCompilation],
        assets,
        assetsContent
      };
    }
  };
};

/**
 * allows the following:
 *
 * import "@jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js"
 * -> searches a file inside @jsenv/core/*
 *
 */
const transformImportmap = async (importmapBeforeTransformation, {
  originalFileUrl
}) => {
  const importMapForProject = JSON.parse(importmapBeforeTransformation);
  const topLevelRemappingForJsenvCore = {
    "@jsenv/core/": urlToRelativeUrlRemapping(jsenvCoreDirectoryUrl, originalFileUrl)
  };
  const importmapForSelfImport = {
    imports: topLevelRemappingForJsenvCore,
    scopes: generateJsenvCoreScopes({
      importMapForProject,
      topLevelRemappingForJsenvCore
    })
  };
  const importMap$1 = [importmapForSelfImport, importMapForProject].reduce((previous, current) => importMap.composeTwoImportMaps(previous, current), {});
  const scopes = importMap$1.scopes || {};
  const projectTopLevelMappings = importMapForProject.imports || {};
  Object.keys(scopes).forEach(scope => {
    const scopedMappings = scopes[scope];
    Object.keys(projectTopLevelMappings).forEach(key => {
      if (key in scopedMappings) {
        scopedMappings[key] = projectTopLevelMappings[key];
      }
    });
  });
  return {
    compiledSource: JSON.stringify(importMap$1, null, "  "),
    contentType: "application/importmap+json",
    sources: [originalFileUrl],
    sourcesContent: [importmapBeforeTransformation],
    assets: [],
    assetsContent: []
  };
}; // this function just here to ensure relative urls starts with './'
// so that importmap do not consider them as bare specifiers

const urlToRelativeUrlRemapping = (url, baseUrl) => {
  const relativeUrl = util.urlToRelativeUrl(url, baseUrl);

  if (util.urlIsInsideOf(url, baseUrl)) {
    if (relativeUrl.startsWith("../")) return relativeUrl;
    if (relativeUrl.startsWith("./")) return relativeUrl;
    return `./${relativeUrl}`;
  }

  return relativeUrl;
};

const generateJsenvCoreScopes = ({
  importMapForProject,
  topLevelRemappingForJsenvCore
}) => {
  const {
    scopes
  } = importMapForProject;

  if (!scopes) {
    return undefined;
  } // I must ensure jsenvCoreImports wins by default in every scope
  // because scope may contains stuff like
  // "/": "/"
  // "/": "/folder/"
  // to achieve this, we set jsenvCoreImports into every scope


  const scopesForJsenvCore = {};
  Object.keys(scopes).forEach(scopeKey => {
    scopesForJsenvCore[scopeKey] = topLevelRemappingForJsenvCore;
  });
  return scopesForJsenvCore;
};

const jsenvCompilerForImportmap = ({
  projectDirectoryUrl,
  importMapFileRelativeUrl,
  originalFileUrl
}) => {
  const contentType = server.urlToContentType(originalFileUrl);

  if (contentType !== "application/importmap+json") {
    return null;
  }

  const importMapFileUrl = util.resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl);
  return {
    // allow project to have no importmap
    fileContentFallback: () => {
      return originalFileUrl === importMapFileUrl ? "{}" : undefined;
    },
    compile: importmapBeforeTransformation => {
      return transformImportmap(importmapBeforeTransformation, {
        originalFileUrl
      });
    }
  };
};

const jsenvCompilerCandidates = [jsenvCompilerForDynamicBuild, jsenvCompilerForJavaScript, jsenvCompilerForHtml, jsenvCompilerForImportmap];
const createCompiledFileService = ({
  cancellationToken,
  logger,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,
  importMapFileRelativeUrl,
  importMetaEnvFileRelativeUrl,
  importMeta,
  importDefaultExtension,
  transformTopLevelAwait,
  moduleOutFormat,
  importMetaFormat,
  babelPluginMap,
  groupMap,
  convertMap,
  customCompilers,
  scriptInjections,
  projectFileRequestedCallback,
  useFilesystemAsCache,
  writeOnFilesystem,
  compileCacheStrategy,
  sourcemapExcludeSources
}) => {
  const jsenvBrowserBuildUrlRelativeToProject = util.urlToRelativeUrl(jsenvBrowserSystemBuildUrl, projectDirectoryUrl);
  return request => {
    const {
      origin,
      ressource
    } = request;
    const requestUrl = `${origin}${ressource}`;
    const requestCompileInfo = urlToCompileInfo(requestUrl, {
      outDirectoryRelativeUrl,
      compileServerOrigin: origin
    }); // not inside compile directory -> nothing to compile

    if (!requestCompileInfo.insideCompileDirectory) {
      return null;
    }

    const {
      compileId,
      afterCompileId
    } = requestCompileInfo; // serve files inside /.jsenv/out/* directly without compilation
    // this is just to allow some files to be written inside outDirectory and read directly
    // if asked by the client (such as env.json, groupMap.json, meta.json)

    if (!compileId) {
      return server.serveFile(request, {
        rootDirectoryUrl: projectDirectoryUrl,
        etagEnabled: true
      });
    }

    const allowedCompileIds = [...Object.keys(groupMap), COMPILE_ID_BUILD_GLOBAL, COMPILE_ID_BUILD_GLOBAL_FILES, COMPILE_ID_BUILD_COMMONJS, COMPILE_ID_BUILD_COMMONJS_FILES];

    if (!allowedCompileIds.includes(compileId)) {
      return {
        status: 400,
        statusText: `compileId must be one of ${allowedCompileIds}, received ${compileId}`
      };
    } // nothing after compileId, we don't know what to compile (not supposed to happen)


    if (afterCompileId === "") {
      return null;
    }

    const originalFileRelativeUrl = afterCompileId;
    projectFileRequestedCallback(originalFileRelativeUrl, request);
    const originalFileUrl = `${projectDirectoryUrl}${originalFileRelativeUrl}`;
    const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}${compileId}/`;
    const compileDirectoryUrl = util.resolveDirectoryUrl(compileDirectoryRelativeUrl, projectDirectoryUrl);
    const compiledFileUrl = util.resolveUrl(originalFileRelativeUrl, compileDirectoryUrl);
    importMeta = {
      jsenv: {
        importMapFileRelativeUrl,
        jsenvDirectoryRelativeUrl,
        outDirectoryRelativeUrl
      },
      ...importMeta
    };
    let compilerOptions = null;
    const compilerCandidateParams = {
      cancellationToken,
      logger,
      compileServerOrigin: request.origin,
      projectDirectoryUrl,
      originalFileUrl,
      compiledFileUrl,
      compileId,
      outDirectoryRelativeUrl,
      importMapFileRelativeUrl,
      importMetaEnvFileRelativeUrl,
      importDefaultExtension,
      moduleOutFormat,
      importMetaFormat,
      importMeta,
      groupMap,
      babelPluginMap,
      convertMap,
      transformTopLevelAwait,
      writeOnFilesystem,
      sourcemapExcludeSources,
      jsenvBrowserBuildUrlRelativeToProject,
      scriptInjections
    };
    const compilerCandidates = [...jsenvCompilerCandidates, ...customCompilers];
    compilerCandidates.find(compilerCandidate => {
      const returnValue = compilerCandidate(compilerCandidateParams);

      if (returnValue && typeof returnValue === "object") {
        compilerOptions = returnValue;
        return true;
      }

      return false;
    });

    if (compilerOptions) {
      return compileFile({
        cancellationToken,
        logger,
        projectDirectoryUrl,
        originalFileUrl,
        compiledFileUrl,
        writeOnFilesystem: true,
        // we always need them
        useFilesystemAsCache,
        compileCacheStrategy,
        projectFileRequestedCallback,
        request,
        ...compilerOptions
      });
    } // no compiler ? -> redirect to source version that will be served as file


    const originalFileServerUrl = util.resolveUrl(originalFileRelativeUrl, origin);
    return {
      status: 307,
      headers: {
        location: originalFileServerUrl
      }
    };
  };
};

/* eslint-disable import/max-dependencies */
const startCompileServer = async ({
  cancellationToken = cancellation.createCancellationToken(),
  compileServerLogLevel,
  projectDirectoryUrl,
  importMapFileRelativeUrl = "import-map.importmap",
  importDefaultExtension,
  importMetaDev = false,
  importMetaEnvFileRelativeUrl,
  importMeta = {},
  jsenvDirectoryRelativeUrl = ".jsenv",
  jsenvDirectoryClean = false,
  outDirectoryName = "out",
  writeOnFilesystem = true,
  sourcemapExcludeSources = false,
  // this should increase perf (no need to download source for browser)
  useFilesystemAsCache = true,
  compileCacheStrategy = "etag",
  projectFileEtagEnabled = true,
  // js compile options
  transformTopLevelAwait = true,
  moduleOutFormat = "systemjs",
  importMetaFormat = moduleOutFormat,
  env = {},
  processEnvNodeEnv = "undefined",
  replaceProcessEnvNodeEnv = true,
  replaceGlobalObject = false,
  replaceGlobalFilename = false,
  replaceGlobalDirname = false,
  replaceMap = {},
  babelPluginMap = jsenvBabelPluginMap,
  convertMap = {},
  customCompilers = [],
  // options related to the server itself
  compileServerProtocol = "https",
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp = "0.0.0.0",
  compileServerPort = 0,
  keepProcessAlive = false,
  stopOnPackageVersionChange = false,
  // remaining options
  compileGroupCount = 1,
  babelCompatMap = jsenvBabelPluginCompatMap,
  browserScoreMap = jsenvBrowserScoreMap,
  nodeVersionScoreMap = jsenvNodeVersionScoreMap,
  runtimeAlwaysInsideRuntimeScoreMap = false,
  livereloadWatchConfig = {
    "./**": true,
    "./**/.*/": false,
    // any folder starting with a dot is ignored (includes .git for instance)
    "./dist/": false,
    "./**/node_modules/": false
  },
  livereloadLogLevel = "info",
  customServices = {},
  livereloadSSE = false,
  scriptInjections = []
}) => {
  assertArguments({
    projectDirectoryUrl,
    importMapFileRelativeUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryName
  });
  const importMapFileUrl = util.resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl);
  const jsenvDirectoryUrl = util.resolveDirectoryUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl);
  const outDirectoryUrl = util.resolveDirectoryUrl(outDirectoryName, jsenvDirectoryUrl);
  const outDirectoryRelativeUrl = util.urlToRelativeUrl(outDirectoryUrl, projectDirectoryUrl); // normalization

  importMapFileRelativeUrl = util.urlToRelativeUrl(importMapFileUrl, projectDirectoryUrl);
  jsenvDirectoryRelativeUrl = util.urlToRelativeUrl(jsenvDirectoryUrl, projectDirectoryUrl);
  const logger$1 = logger.createLogger({
    logLevel: compileServerLogLevel
  });
  babelPluginMap = {
    "transform-replace-expressions": [babelPluginReplaceExpressions, {
      replaceMap: { ...(replaceProcessEnvNodeEnv ? {
          "process.env.NODE_ENV": `("${processEnvNodeEnv}")`
        } : {}),
        ...(replaceGlobalObject ? {
          global: "globalThis"
        } : {}),
        ...(replaceGlobalFilename ? {
          __filename: __filenameReplacement
        } : {}),
        ...(replaceGlobalDirname ? {
          __dirname: __dirnameReplacement
        } : {}),
        ...replaceMap
      },
      allowConflictingReplacements: true
    }],
    ...babelPluginMap
  };
  const compileServerGroupMap = generateGroupMap({
    babelPluginMap,
    babelCompatMap,
    runtimeScoreMap: { ...browserScoreMap,
      node: nodeVersionScoreMap
    },
    groupCount: compileGroupCount,
    runtimeAlwaysInsideRuntimeScoreMap
  });
  importMeta = {
    dev: importMetaDev,
    ...importMeta
  };
  await setupOutDirectory(outDirectoryUrl, {
    logger: logger$1,
    jsenvDirectoryUrl,
    jsenvDirectoryClean,
    useFilesystemAsCache,
    babelPluginMap,
    convertMap,
    importMeta,
    importMetaEnvFileRelativeUrl,
    compileServerGroupMap
  });
  const serverStopCancellationSource = cancellation.createCancellationSource();

  let projectFileRequestedCallback = () => {};

  if (livereloadSSE) {
    const sseSetup = setupServerSentEventsForLivereload({
      cancellationToken: cancellation.composeCancellationToken(cancellationToken, serverStopCancellationSource.token),
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      outDirectoryRelativeUrl,
      livereloadLogLevel,
      livereloadWatchConfig
    });
    projectFileRequestedCallback = sseSetup.projectFileRequestedCallback;
    const serveSSEForLivereload = createSSEForLivereloadService({
      cancellationToken,
      outDirectoryRelativeUrl,
      trackMainAndDependencies: sseSetup.trackMainAndDependencies
    });
    customServices = {
      "service:livereload sse": serveSSEForLivereload,
      ...customServices
    };
  }

  const serveCompilationAssetFile = createCompilationAssetFileService({
    projectDirectoryUrl
  });
  const serveBrowserScript = createBrowserScriptService({
    projectDirectoryUrl,
    outDirectoryRelativeUrl
  });
  const serveCompiledFile = createCompiledFileService({
    cancellationToken,
    logger: logger$1,
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    jsenvDirectoryRelativeUrl,
    importMapFileRelativeUrl,
    importDefaultExtension,
    importMetaEnvFileRelativeUrl,
    importMeta,
    transformTopLevelAwait,
    groupMap: compileServerGroupMap,
    babelPluginMap,
    convertMap,
    customCompilers,
    moduleOutFormat,
    importMetaFormat,
    scriptInjections,
    projectFileRequestedCallback,
    useFilesystemAsCache,
    writeOnFilesystem,
    sourcemapExcludeSources,
    compileCacheStrategy
  });
  const serveProjectFile = createProjectFileService({
    projectDirectoryUrl,
    projectFileRequestedCallback,
    projectFileEtagEnabled
  });
  const compileServer = await server.startServer({
    cancellationToken,
    logLevel: compileServerLogLevel,
    protocol: compileServerProtocol,
    http2: compileServerProtocol === "https",
    privateKey: compileServerPrivateKey,
    certificate: compileServerCertificate,
    ip: compileServerIp,
    port: compileServerPort,
    sendServerTiming: true,
    nagle: false,
    sendServerInternalErrorDetails: true,
    requestToResponse: server.firstServiceWithTiming({ ...customServices,
      "service:compilation asset": serveCompilationAssetFile,
      "service:browser script": serveBrowserScript,
      "service:compiled file": serveCompiledFile,
      "service:project file": serveProjectFile
    }),
    accessControlAllowRequestOrigin: true,
    accessControlAllowRequestMethod: true,
    accessControlAllowRequestHeaders: true,
    accessControlAllowedRequestHeaders: [...server.jsenvAccessControlAllowedHeaders, "x-jsenv-execution-id"],
    accessControlAllowCredentials: true,
    keepProcessAlive
  });
  compileServer.stoppedPromise.then(serverStopCancellationSource.cancel);
  const uninstallOutFiles = await installOutFiles({
    logger: logger$1,
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    importMapFileRelativeUrl,
    compileServerGroupMap,
    env,
    writeOnFilesystem,
    onOutFileWritten: outFileUrl => {
      logger$1.debug(`-> ${outFileUrl}`);
    }
  });

  if (!writeOnFilesystem) {
    compileServer.stoppedPromise.then(() => {
      uninstallOutFiles();
    });
  }

  if (stopOnPackageVersionChange) {
    const stopListeningJsenvPackageVersionChange = listenJsenvPackageVersionChange({
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      onJsenvPackageVersionChange: () => {
        compileServer.stop(STOP_REASON_PACKAGE_VERSION_CHANGED);
      }
    });
    compileServer.stoppedPromise.then(() => {
      stopListeningJsenvPackageVersionChange();
    }, () => {});
  }

  return {
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importMapFileRelativeUrl,
    ...compileServer,
    compileServerGroupMap
  };
};
const computeOutDirectoryRelativeUrl = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl = ".jsenv",
  outDirectoryName = "out"
}) => {
  const jsenvDirectoryUrl = util.resolveDirectoryUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl);
  const outDirectoryUrl = util.resolveDirectoryUrl(outDirectoryName, jsenvDirectoryUrl);
  const outDirectoryRelativeUrl = util.urlToRelativeUrl(outDirectoryUrl, projectDirectoryUrl);
  return outDirectoryRelativeUrl;
};

const assertArguments = ({
  projectDirectoryUrl,
  importMapFileRelativeUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryName
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string. got ${projectDirectoryUrl}`);
  }

  assertImportMapFileRelativeUrl({
    importMapFileRelativeUrl
  });
  const importMapFileUrl = util.resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl);
  assertImportMapFileInsideProject({
    importMapFileUrl,
    projectDirectoryUrl
  });

  if (typeof jsenvDirectoryRelativeUrl !== "string") {
    throw new TypeError(`jsenvDirectoryRelativeUrl must be a string. got ${jsenvDirectoryRelativeUrl}`);
  }

  const jsenvDirectoryUrl = util.resolveDirectoryUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl);

  if (!jsenvDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new TypeError(logger.createDetailedMessage(`jsenv directory must be inside project directory`, {
      ["jsenv directory url"]: jsenvDirectoryUrl,
      ["project directory url"]: projectDirectoryUrl
    }));
  }

  if (typeof outDirectoryName !== "string") {
    throw new TypeError(`outDirectoryName must be a string. got ${outDirectoryName}`);
  }
};

const setupOutDirectory = async (outDirectoryUrl, {
  logger: logger$1,
  jsenvDirectoryClean,
  jsenvDirectoryUrl,
  useFilesystemAsCache,
  babelPluginMap,
  convertMap,
  importMeta,
  importMetaEnvFileRelativeUrl,
  compileServerGroupMap,
  replaceProcessEnvNodeEnv,
  processEnvNodeEnv
}) => {
  if (jsenvDirectoryClean) {
    logger$1.info(`Cleaning jsenv directory because jsenvDirectoryClean parameter enabled`);
    await util.ensureEmptyDirectory(jsenvDirectoryUrl);
  }

  if (useFilesystemAsCache) {
    const jsenvCorePackageFileUrl = util.resolveUrl("./package.json", jsenvCoreDirectoryUrl);
    const jsenvCorePackageFilePath = util.urlToFileSystemPath(jsenvCorePackageFileUrl);
    const jsenvCorePackageVersion = readPackage(jsenvCorePackageFilePath).version;
    const outDirectoryMeta = {
      jsenvCorePackageVersion,
      babelPluginMap,
      convertMap,
      importMeta,
      importMetaEnvFileRelativeUrl,
      compileServerGroupMap,
      replaceProcessEnvNodeEnv,
      processEnvNodeEnv
    };
    const metaFileUrl = util.resolveUrl("./meta.json", outDirectoryUrl);
    let previousOutDirectoryMeta;

    try {
      const source = await util.readFile(metaFileUrl);
      previousOutDirectoryMeta = JSON.parse(source);
    } catch (e) {
      if (e && e.code === "ENOENT") {
        previousOutDirectoryMeta = null;
      } else {
        throw e;
      }
    }

    if (previousOutDirectoryMeta !== null) {
      const outDirectoryChanges = getOutDirectoryChanges(previousOutDirectoryMeta, outDirectoryMeta);

      if (outDirectoryChanges) {
        if (!jsenvDirectoryClean) {
          logger$1.warn(logger.createDetailedMessage(`Cleaning jsenv ${util.urlToBasename(outDirectoryUrl.slice(0, -1))} directory because configuration has changed.`, {
            "changes": outDirectoryChanges.namedChanges ? outDirectoryChanges.namedChanges : `something`,
            "out directory": util.urlToFileSystemPath(outDirectoryUrl)
          }));
        }

        await util.ensureEmptyDirectory(outDirectoryUrl);
      }
    }

    await util.writeFile(metaFileUrl, JSON.stringify(outDirectoryMeta, null, "  "));
  }
};

const getOutDirectoryChanges = (previousOutDirectoryMeta, outDirectoryMeta) => {
  const changes = [];
  Object.keys(outDirectoryMeta).forEach(key => {
    const now = outDirectoryMeta[key];
    const previous = previousOutDirectoryMeta[key];

    if (!compareValueJson(now, previous)) {
      changes.push(key);
    }
  });

  if (changes.length > 0) {
    return {
      namedChanges: changes
    };
  } // in case basic comparison from above is not enough


  if (!compareValueJson(previousOutDirectoryMeta, outDirectoryMeta)) {
    return {
      somethingChanged: true
    };
  }

  return null;
};

const compareValueJson = (left, right) => {
  return JSON.stringify(left) === JSON.stringify(right);
}; // eslint-disable-next-line valid-jsdoc

/**
 * We need to get two things:
 * { projectFileRequestedCallback, trackMainAndDependencies }
 *
 * projectFileRequestedCallback
 * This function will be called by the compile server every time a file inside projectDirectory
 * is requested so that we can build up the dependency tree of any file
 *
 * trackMainAndDependencies
 * This function is meant to be used to implement server sent events in order for a client to know
 * when a given file or any of its dependencies changes in order to implement livereloading.
 * At any time this function can be called with (mainRelativeUrl, { modified, removed, lastEventId })
 * modified is called
 *  - immediatly if lastEventId is passed and mainRelativeUrl or any of its dependencies have
 *  changed since that event (last change is passed to modified if their is more than one change)
 *  - when mainRelativeUrl or any of its dependencies is modified
 * removed is called
 *  - with same spec as modified but when a file is deleted from the filesystem instead of modified
 *
 */


const setupServerSentEventsForLivereload = ({
  cancellationToken,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,
  livereloadLogLevel,
  livereloadWatchConfig
}) => {
  const livereloadLogger = logger.createLogger({
    logLevel: livereloadLogLevel
  });
  const trackerMap = new Map();
  const projectFileRequested = createCallbackList();
  const projectFileModified = createCallbackList();
  const projectFileRemoved = createCallbackList();
  const projectFileAdded = createCallbackList();

  const projectFileRequestedCallback = (relativeUrl, request) => {
    // I doubt a compilation asset like .js.map will change
    // in theory a compilation asset should not change
    // if the source file did not change
    // so we can avoid watching compilation asset
    if (urlIsCompilationAsset(`${projectDirectoryUrl}${relativeUrl}`)) {
      return;
    }

    projectFileRequested.notify(relativeUrl, request);
  };

  const watchDescription = { ...livereloadWatchConfig,
    [jsenvDirectoryRelativeUrl]: false
  };
  const unregisterDirectoryLifecyle = util.registerDirectoryLifecycle(projectDirectoryUrl, {
    watchDescription,
    updated: ({
      relativeUrl
    }) => {
      projectFileModified.notify(relativeUrl);
    },
    removed: ({
      relativeUrl
    }) => {
      projectFileRemoved.notify(relativeUrl);
    },
    added: ({
      relativeUrl
    }) => {
      projectFileAdded.notify(relativeUrl);
    },
    keepProcessAlive: false,
    recursive: true
  });
  cancellationToken.register(unregisterDirectoryLifecyle);

  const getDependencySet = mainRelativeUrl => {
    if (trackerMap.has(mainRelativeUrl)) {
      return trackerMap.get(mainRelativeUrl);
    }

    const dependencySet = new Set();
    dependencySet.add(mainRelativeUrl);
    trackerMap.set(mainRelativeUrl, dependencySet);
    return dependencySet;
  }; // each time a file is requested for the first time its dependencySet is computed


  projectFileRequested.register(mainRelativeUrl => {
    // for now node use case of livereloading + node.js
    // and for browsers only html file can be main files
    // this avoid collecting dependencies of non html files that will never be used
    if (!mainRelativeUrl.endsWith(".html")) {
      return;
    } // when a file is requested, always rebuild its dependency in case it has changed
    // since the last time it was requested


    const dependencySet = new Set();
    dependencySet.add(mainRelativeUrl);
    trackerMap.set(mainRelativeUrl, dependencySet);
    const unregisterDependencyRequested = projectFileRequested.register((relativeUrl, request) => {
      if (dependencySet.has(relativeUrl)) {
        return;
      }

      const dependencyReport = reportDependency(relativeUrl, mainRelativeUrl, request);

      if (dependencyReport.dependency === false) {
        livereloadLogger.debug(`${relativeUrl} not a dependency of ${mainRelativeUrl} because ${dependencyReport.reason}`);
        return;
      }

      livereloadLogger.debug(`${relativeUrl} is a dependency of ${mainRelativeUrl} because ${dependencyReport.reason}`);
      dependencySet.add(relativeUrl);
    });
    const unregisterMainRemoved = projectFileRemoved.register(relativeUrl => {
      if (relativeUrl === mainRelativeUrl) {
        unregisterDependencyRequested();
        unregisterMainRemoved();
        trackerMap.delete(mainRelativeUrl);
      }
    });
  });

  const trackMainAndDependencies = (mainRelativeUrl, {
    modified,
    removed,
    added
  }) => {
    livereloadLogger.debug(`track ${mainRelativeUrl} and its dependencies`);
    const unregisterModified = projectFileModified.register(relativeUrl => {
      const dependencySet = getDependencySet(mainRelativeUrl);

      if (dependencySet.has(relativeUrl)) {
        modified(relativeUrl);
      }
    });
    const unregisterRemoved = projectFileRemoved.register(relativeUrl => {
      const dependencySet = getDependencySet(mainRelativeUrl);

      if (dependencySet.has(relativeUrl)) {
        removed(relativeUrl);
      }
    });
    const unregisterAdded = projectFileAdded.register(relativeUrl => {
      const dependencySet = getDependencySet(mainRelativeUrl);

      if (dependencySet.has(relativeUrl)) {
        added(relativeUrl);
      }
    });
    return () => {
      livereloadLogger.debug(`stop tracking ${mainRelativeUrl} and its dependencies.`);
      unregisterModified();
      unregisterRemoved();
      unregisterAdded();
    };
  };

  const reportDependency = (relativeUrl, mainRelativeUrl, request) => {
    if (relativeUrl === mainRelativeUrl) {
      return {
        dependency: true,
        reason: "it's main"
      };
    }

    if ("x-jsenv-execution-id" in request.headers) {
      const executionId = request.headers["x-jsenv-execution-id"];

      if (executionId === mainRelativeUrl) {
        return {
          dependency: true,
          reason: "x-jsenv-execution-id request header"
        };
      }

      return {
        dependency: false,
        reason: "x-jsenv-execution-id request header"
      };
    }

    if ("referer" in request.headers) {
      const {
        origin
      } = request;
      const {
        referer
      } = request.headers; // referer is likely the exploringServer

      if (referer !== origin && !util.urlIsInsideOf(referer, origin)) {
        return {
          dependency: false,
          reason: "referer is an other origin"
        };
      } // here we know the referer is inside compileServer


      const refererRelativeUrl = urlToOriginalRelativeUrl(referer, util.resolveUrl(outDirectoryRelativeUrl, request.origin));

      if (refererRelativeUrl) {
        // search if referer (file requesting this one) is tracked as being a dependency of main file
        // in that case because the importer is a dependency the importee is also a dependency
        // eslint-disable-next-line no-unused-vars
        for (const tracker of trackerMap) {
          if (tracker[0] === mainRelativeUrl && tracker[1].has(refererRelativeUrl)) {
            return {
              dependency: true,
              reason: "referer is a dependency"
            };
          }
        }
      }
    }

    return {
      dependency: true,
      reason: "it was requested"
    };
  };

  return {
    projectFileRequestedCallback,
    trackMainAndDependencies
  };
};

const createSSEForLivereloadService = ({
  cancellationToken,
  outDirectoryRelativeUrl,
  trackMainAndDependencies
}) => {
  const cache = [];
  const sseRoomLimit = 100;

  const getOrCreateSSERoom = mainFileRelativeUrl => {
    const cacheEntry = cache.find(cacheEntryCandidate => cacheEntryCandidate.mainFileRelativeUrl === mainFileRelativeUrl);

    if (cacheEntry) {
      return cacheEntry.sseRoom;
    }

    const sseRoom = server.createSSERoom({
      retryDuration: 2000,
      historyLength: 100,
      welcomeEvent: true
    }); // each time something is modified or removed we send event to the room

    const stopTracking = trackMainAndDependencies(mainFileRelativeUrl, {
      modified: relativeUrl => {
        sseRoom.sendEvent({
          type: "file-modified",
          data: relativeUrl
        });
      },
      removed: relativeUrl => {
        sseRoom.sendEvent({
          type: "file-removed",
          data: relativeUrl
        });
      },
      added: relativeUrl => {
        sseRoom.sendEvent({
          type: "file-added",
          data: relativeUrl
        });
      }
    });
    sseRoom.start();
    const cancelRegistration = cancellationToken.register(() => {
      cancelRegistration.unregister();
      sseRoom.stop();
      stopTracking();
    });
    cache.push({
      mainFileRelativeUrl,
      sseRoom,
      cleanup: () => {
        cancelRegistration.unregister();
        sseRoom.stop();
        stopTracking();
      }
    });

    if (cache.length >= sseRoomLimit) {
      const firstCacheEntry = cache.shift();
      firstCacheEntry.cleanup();
    }

    return sseRoom;
  };

  return request => {
    const {
      accept
    } = request.headers;

    if (!accept || !accept.includes("text/event-stream")) {
      return null;
    }

    const fileRelativeUrl = urlToOriginalRelativeUrl(util.resolveUrl(request.ressource, request.origin), util.resolveUrl(outDirectoryRelativeUrl, request.origin));
    const room = getOrCreateSSERoom(fileRelativeUrl);
    return room.connect(request.headers["last-event-id"] || new URL(request.ressource, request.origin).searchParams.get("last-event-id"));
  };
};

const urlToOriginalRelativeUrl = (url, outDirectoryRemoteUrl) => {
  if (util.urlIsInsideOf(url, outDirectoryRemoteUrl)) {
    const afterCompileDirectory = util.urlToRelativeUrl(url, outDirectoryRemoteUrl);
    const fileRelativeUrl = afterCompileDirectory.slice(afterCompileDirectory.indexOf("/") + 1);
    return fileRelativeUrl;
  }

  return new URL(url).pathname.slice(1);
};

const createCompilationAssetFileService = ({
  projectDirectoryUrl
}) => {
  return request => {
    const {
      origin,
      ressource
    } = request;
    const requestUrl = `${origin}${ressource}`;

    if (urlIsCompilationAsset(requestUrl)) {
      return server.serveFile(request, {
        rootDirectoryUrl: projectDirectoryUrl,
        etagEnabled: true
      });
    }

    return null;
  };
};

const createBrowserScriptService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl
}) => {
  const sourcemapMainFileRelativeUrl = util.urlToRelativeUrl(sourcemapMainFileUrl, projectDirectoryUrl);
  const sourcemapMappingFileRelativeUrl = util.urlToRelativeUrl(sourcemapMappingFileUrl, projectDirectoryUrl);
  return request => {
    if (request.method === "GET" && request.ressource === "/.jsenv/compile-meta.json" && "x-jsenv" in request.headers) {
      const body = JSON.stringify({
        outDirectoryRelativeUrl,
        errorStackRemapping: true,
        sourcemapMainFileRelativeUrl,
        sourcemapMappingFileRelativeUrl
      });
      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body)
        },
        body
      };
    }

    return null;
  };
};

const createProjectFileService = ({
  projectDirectoryUrl,
  projectFileRequestedCallback,
  projectFileEtagEnabled
}) => {
  return request => {
    const {
      ressource
    } = request;
    const relativeUrl = ressource.slice(1);
    projectFileRequestedCallback(relativeUrl, request);
    const responsePromise = server.serveFile(request, {
      rootDirectoryUrl: projectDirectoryUrl,
      etagEnabled: projectFileEtagEnabled
    });
    return responsePromise;
  };
};

const installOutFiles = async ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryRelativeUrl,
  importDefaultExtension,
  importMapFileRelativeUrl,
  compileServerGroupMap,
  env,
  onOutFileWritten = () => {}
}) => {
  const outDirectoryUrl = util.resolveUrl(outDirectoryRelativeUrl, projectDirectoryUrl);
  env = { ...env,
    jsenvDirectoryRelativeUrl,
    outDirectoryRelativeUrl,
    importDefaultExtension,
    importMapFileRelativeUrl
  };

  const groupMapToString = () => JSON.stringify(compileServerGroupMap, null, "  ");

  const envToString = () => JSON.stringify(env, null, "  ");

  const groupMapOutFileUrl = util.resolveUrl("./groupMap.json", outDirectoryUrl);
  const envOutFileUrl = util.resolveUrl("./env.json", outDirectoryUrl);
  await Promise.all([util.writeFile(groupMapOutFileUrl, groupMapToString()), util.writeFile(envOutFileUrl, envToString())]);
  onOutFileWritten(groupMapOutFileUrl);
  onOutFileWritten(envOutFileUrl);
  return async () => {
    util.removeFileSystemNode(groupMapOutFileUrl, {
      allowUseless: true
    });
    util.removeFileSystemNode(envOutFileUrl);
  };
};

const listenJsenvPackageVersionChange = ({
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  onJsenvPackageVersionChange = () => {}
}) => {
  const jsenvCoreDirectoryUrl = util.resolveUrl(jsenvDirectoryRelativeUrl, projectDirectoryUrl);
  const packageFileUrl = util.resolveUrl("./package.json", jsenvCoreDirectoryUrl);
  const packageFilePath = util.urlToFileSystemPath(packageFileUrl);
  let packageVersion;

  try {
    packageVersion = readPackage(packageFilePath).version;
  } catch (e) {
    if (e.code === "ENOENT") return () => {};
  }

  const checkPackageVersion = () => {
    let packageObject;

    try {
      packageObject = readPackage(packageFilePath);
    } catch (e) {
      // package json deleted ? not a problem
      // let's wait for it to show back
      if (e.code === "ENOENT") return; // package.json malformed ? not a problem
      // let's wait for use to fix it or filesystem to finish writing the file

      if (e.name === "SyntaxError") return;
      throw e;
    }

    if (packageVersion !== packageObject.version) {
      onJsenvPackageVersionChange();
    }
  };

  return util.registerFileLifecycle(packageFilePath, {
    added: checkPackageVersion,
    updated: checkPackageVersion,
    keepProcessAlive: false
  });
};

const readPackage = packagePath => {
  const buffer = fs.readFileSync(packagePath);
  const string = String(buffer);
  const packageObject = JSON.parse(string);
  return packageObject;
};

const STOP_REASON_PACKAGE_VERSION_CHANGED = {
  toString: () => `package version changed`
};
const __filenameReplacement = `import.meta.url.slice('file:///'.length)`;
const __dirnameReplacement = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`;

const FORMAT_ENTRY_POINTS = {
  commonjs: {
    "./main.js": "./main.cjs"
  },
  esmodule: {
    "./main.html": "./main.html"
  },
  global: {
    "./main.js": "./main.js"
  },
  systemjs: {
    "./main.html": "./main.html"
  }
};
const buildProject = async ({
  cancellationToken = cancellation.createCancellationTokenForProcess(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  logger: logger$1,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importMetaEnvFileRelativeUrlForBuild = "env.prod.js",
  importMeta = {
    dev: false
  },
  importDefaultExtension,
  externalImportSpecifiers = [],
  env = {},
  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap = jsenvBabelPluginMap,
  format = "esmodule",
  externalImportUrlPatterns = format === "commonjs" ? {
    "node_modules/": true
  } : {},
  browser = format === "global" || format === "systemjs" || format === "esmodule",
  node = format === "commonjs",
  entryPointMap = FORMAT_ENTRY_POINTS[format],
  systemJsUrl = "/node_modules/systemjs/dist/s.min.js",
  globalName,
  globals = {},
  sourcemapExcludeSources = false,
  buildDirectoryRelativeUrl,
  buildDirectoryClean = false,
  writeOnFileSystem = true,
  assetManifestFile = false,
  assetManifestFileRelativeUrl = "asset-manifest.json",
  urlVersioning = true,
  useImportMapToImproveLongTermCaching = format === "systemjs",
  preserveEntrySignatures,
  jsConcatenation = true,
  minify = "undefined" === "production",
  // https://github.com/kangax/html-minifier#options-quick-reference
  minifyHtmlOptions = {
    collapseWhitespace: true
  },
  // https://github.com/terser/terser#minify-options
  minifyJsOptions,
  // https://github.com/cssnano/cssnano/tree/master/packages/cssnano-preset-default
  minifyCssOptions,
  // when true .jsenv/out-build directory is generated
  // with all intermediated files used to produce the final build files.
  // it might improve buildProject speed for subsequent build generation
  // but this is to be proven and not absolutely required
  // When false intermediates files are transformed and served in memory
  // by the compile server
  // must be true by default otherwise rollup cannot find sourcemap files
  // when asking them to the compile server
  // (to fix that sourcemap could be inlined)
  filesystemCache = true,
  serviceWorkers = {},
  serviceWorkerFinalizer,
  ...rest
}) => {
  return executeJsenvAsyncFunction(async () => {
    logger$1 = logger$1 || logger.createLogger({
      logLevel
    });

    if (format === "esmodule") {
      if (buildDirectoryRelativeUrl === undefined) {
        buildDirectoryRelativeUrl = "./dist/esmodule";
      }
    } else if (format === "systemjs") {
      if (buildDirectoryRelativeUrl === undefined) {
        buildDirectoryRelativeUrl = "./dist/systemjs";
      }
    } else if (format === "commonjs") {
      if (buildDirectoryRelativeUrl === undefined) {
        buildDirectoryRelativeUrl = "./dist/commonjs";
      }

      if (node === undefined) {
        node = true;
      }
    } else if (format === "global") {
      if (buildDirectoryRelativeUrl === undefined) {
        buildDirectoryRelativeUrl = "./dist/global";
      }

      if (browser === undefined) {
        browser = true;
      }
    } else {
      throw new TypeError(`unexpected format: ${format}. Must be esmodule, systemjs, commonjs or global.`);
    }

    if (!jsConcatenation) {
      throw new Error(`jsConcatenation cannot be disabled for now. See https://github.com/rollup/rollup/issues/3882`);
    }

    projectDirectoryUrl = assertProjectDirectoryUrl({
      projectDirectoryUrl
    });
    await assertProjectDirectoryExists({
      projectDirectoryUrl
    });
    assertEntryPointMap({
      entryPointMap
    });

    if (Object.keys(entryPointMap).length === 0) {
      logger$1.error(`entryPointMap is an empty object`);
      return {
        rollupBuilds: {}
      };
    }

    assertBuildDirectoryRelativeUrl({
      buildDirectoryRelativeUrl
    });
    const buildDirectoryUrl = util.resolveDirectoryUrl(buildDirectoryRelativeUrl, projectDirectoryUrl);
    assertBuildDirectoryInsideProject({
      buildDirectoryUrl,
      projectDirectoryUrl
    });
    const compileServer = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      // build compiled files are written into a different directory
      // than exploring-server. This is because here we compile for rollup
      // that is expecting esmodule format, not systemjs
      // + some more differences like import.meta.dev
      outDirectoryName: "out-build",
      importMapFileRelativeUrl,
      importDefaultExtension,
      importMetaEnvFileRelativeUrl: importMetaEnvFileRelativeUrlForBuild,
      importMeta,
      moduleOutFormat: "esmodule",
      // rollup will transform into systemjs
      importMetaFormat: format,
      // but ensure import.meta are correctly transformed into the right format
      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      env,
      babelPluginMap,
      writeOnFilesystem: filesystemCache,
      useFilesystemAsCache: filesystemCache,
      // override with potential custom options
      ...rest
    });
    const {
      outDirectoryRelativeUrl,
      origin: compileServerOrigin
    } = compileServer;

    try {
      const result = await buildUsingRollup({
        cancellationToken,
        logger: logger$1,
        entryPointMap,
        projectDirectoryUrl,
        importMapFileRelativeUrl: compileServer.importMapFileRelativeUrl,
        compileDirectoryRelativeUrl: `${outDirectoryRelativeUrl}${COMPILE_ID_OTHERWISE}/`,
        compileServerOrigin,
        importDefaultExtension,
        externalImportSpecifiers,
        externalImportUrlPatterns,
        babelPluginMap,
        node,
        browser,
        writeOnFileSystem,
        format,
        systemJsUrl,
        globalName,
        globals,
        sourcemapExcludeSources,
        buildDirectoryUrl,
        buildDirectoryClean,
        assetManifestFile,
        assetManifestFileRelativeUrl,
        urlVersioning,
        useImportMapToImproveLongTermCaching,
        preserveEntrySignatures,
        jsConcatenation,
        minify,
        minifyHtmlOptions,
        minifyJsOptions,
        minifyCssOptions,
        serviceWorkers,
        serviceWorkerFinalizer
      });
      return result;
    } finally {
      compileServer.stop("build generated");
    }
  });
};

const assertEntryPointMap = ({
  entryPointMap
}) => {
  if (typeof entryPointMap !== "object") {
    throw new TypeError(`entryPointMap must be an object, got ${entryPointMap}`);
  }

  const keys = Object.keys(entryPointMap);
  keys.forEach(key => {
    if (!key.startsWith("./")) {
      throw new TypeError(`unexpected key in entryPointMap, all keys must start with ./ but found ${key}`);
    }

    const value = entryPointMap[key];

    if (typeof value !== "string") {
      throw new TypeError(`unexpected value in entryPointMap, all values must be strings found ${value} for key ${key}`);
    }

    if (!value.startsWith("./")) {
      throw new TypeError(`unexpected value in entryPointMap, all values must starts with ./ but found ${value} for key ${key}`);
    }
  });
};

const assertBuildDirectoryRelativeUrl = ({
  buildDirectoryRelativeUrl
}) => {
  if (typeof buildDirectoryRelativeUrl !== "string") {
    throw new TypeError(`buildDirectoryRelativeUrl must be a string, received ${buildDirectoryRelativeUrl}`);
  }
};

const assertBuildDirectoryInsideProject = ({
  buildDirectoryUrl,
  projectDirectoryUrl
}) => {
  if (!buildDirectoryUrl.startsWith(projectDirectoryUrl)) {
    throw new Error(logger.createDetailedMessage(`build directory must be inside project directory`, {
      ["build directory url"]: buildDirectoryUrl,
      ["project directory url"]: projectDirectoryUrl
    }));
  }
};

const convertCommonJsWithBabel = async ({
  projectDirectoryUrl,
  importMetaEnvFileRelativeUrl,
  code,
  url,
  replaceGlobalObject = true,
  replaceGlobalFilename = true,
  replaceGlobalDirname = true,
  replaceProcessEnvNodeEnv = true,
  processEnvNodeEnv = "undefined",
  replaceMap = {}
}) => {
  const transformCommonJs = require$1("babel-plugin-transform-commonjs"); // maybe we should use babel core here instead of transformJs


  const result = await transformJs({
    projectDirectoryUrl,
    importMetaEnvFileRelativeUrl,
    code,
    url,
    babelPluginMap: {
      "transform-commonjs": [transformCommonJs],
      "transform-replace-expressions": [babelPluginReplaceExpressions, {
        replaceMap: { ...(replaceProcessEnvNodeEnv ? {
            "process.env.NODE_ENV": `("${processEnvNodeEnv}")`
          } : {}),
          ...(replaceGlobalObject ? {
            global: "globalThis"
          } : {}),
          ...(replaceGlobalFilename ? {
            __filename: __filenameReplacement$1
          } : {}),
          ...(replaceGlobalDirname ? {
            __dirname: __dirnameReplacement$1
          } : {}),
          ...replaceMap
        }
      }]
    }
  });
  return result;
};
const __filenameReplacement$1 = `import.meta.url.slice('file:///'.length)`;
const __dirnameReplacement$1 = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`; // const createInlineProcessNodeEnvBabelPlugin = ({ value = process.env.NODE_ENV }) => {
//   return ({ types: t }) => {
//     return {
//       name: "inline-process-node-env",
//       visitor: {
//         MemberExpression(path) {
//           if (path.matchesPattern("process.env.NODE_ENV")) {
//             path.replaceWith(t.valueToNode(value))
//             if (path.parentPath.isBinaryExpression()) {
//               const evaluated = path.parentPath.evaluate()
//               if (evaluated.confident) {
//                 path.parentPath.replaceWith(t.valueToNode(evaluated.value))
//               }
//             }
//           }
//         },
//       },
//     }
//   }
// }

const convertCommonJsWithRollup = async ({
  url,
  urlAfterTransform,
  replaceGlobalObject = true,
  replaceGlobalFilename = true,
  replaceGlobalDirname = true,
  replaceProcessEnvNodeEnv = true,
  replaceProcess = true,
  replaceBuffer = true,
  processEnvNodeEnv = "undefined",
  replaceMap = {},
  convertBuiltinsToBrowser = true,
  external = []
} = {}) => {
  if (!url.startsWith("file:///")) {
    // it's possible to make rollup compatible with http:// for instance
    // however it's an exotic use case for now
    throw new Error(`compatible only with file:// protocol, got ${url}`);
  }

  const {
    rollup
  } = require$1("rollup");

  const commonjs = require$1("@rollup/plugin-commonjs");

  const {
    nodeResolve
  } = require$1("@rollup/plugin-node-resolve");

  const createJSONRollupPlugin = require$1("@rollup/plugin-json");

  const createReplaceRollupPlugin = require$1("@rollup/plugin-replace");

  const builtins = require$1("rollup-plugin-node-builtins-brofs");

  const createNodeGlobalRollupPlugin = require$1("rollup-plugin-node-globals");

  const filePath = util.urlToFileSystemPath(url);
  const nodeBuiltinsRollupPlugin = builtins();
  const nodeResolveRollupPlugin = nodeResolve({
    mainFields: ["main"]
  });
  const jsonRollupPlugin = createJSONRollupPlugin();
  const nodeGlobalRollupPlugin = createNodeGlobalRollupPlugin({
    global: false,
    // handled by replaceMap
    dirname: false,
    // handled by replaceMap
    filename: false,
    //  handled by replaceMap
    process: replaceProcess,
    buffer: replaceBuffer
  });
  const commonJsRollupPlugin = commonjs();
  const rollupBuild = await rollup({
    input: filePath,
    inlineDynamicImports: true,
    external,
    plugins: [commonJsRollupPlugin, createReplaceRollupPlugin({ ...(replaceProcessEnvNodeEnv ? {
        "process.env.NODE_ENV": JSON.stringify(processEnvNodeEnv)
      } : {}),
      ...(replaceGlobalObject ? {
        global: "globalThis"
      } : {}),
      ...(replaceGlobalFilename ? {
        __filename: __filenameReplacement$2
      } : {}),
      ...(replaceGlobalDirname ? {
        __dirname: __dirnameReplacement$2
      } : {}),
      ...replaceMap
    }), nodeGlobalRollupPlugin, ...(convertBuiltinsToBrowser ? [nodeBuiltinsRollupPlugin] : []), nodeResolveRollupPlugin, jsonRollupPlugin]
  });
  const generateOptions = {
    // https://rollupjs.org/guide/en#output-format
    format: "esm",
    // entryFileNames: `./[name].js`,
    // https://rollupjs.org/guide/en#output-sourcemap
    sourcemap: true,
    sourcemapExcludeSources: true,
    ...(urlAfterTransform ? {
      dir: util.urlToFileSystemPath(util.resolveUrl("./", urlAfterTransform))
    } : {})
  };
  const result = await rollupBuild.generate(generateOptions);
  return result.output[0];
};
const __filenameReplacement$2 = `import.meta.url.slice('file:///'.length)`;
const __dirnameReplacement$2 = `import.meta.url.slice('file:///'.length).replace(/[\\\/\\\\][^\\\/\\\\]*$/, '')`;

const {
  createFileCoverage
} = require$1("istanbul-lib-coverage"); // https://github.com/istanbuljs/istanbuljs/blob/5405550c3868712b14fd8bfe0cbd6f2e7ac42279/packages/istanbul-lib-coverage/lib/coverage-map.js#L43


const composeCoverageMap = (...coverageMaps) => {
  const finalCoverageMap = {};
  coverageMaps.forEach(coverageMap => {
    Object.keys(coverageMap).forEach(filename => {
      const coverage = coverageMap[filename];
      finalCoverageMap[filename] = filename in finalCoverageMap ? merge(finalCoverageMap[filename], coverage) : coverage;
    });
  });
  return finalCoverageMap;
};

const merge = (coverageA, coverageB) => {
  const fileCoverage = createFileCoverage(coverageA);
  fileCoverage.merge(coverageB);
  return fileCoverage.toJSON();
};

const TIMING_BEFORE_EXECUTION = "before-execution";
const TIMING_DURING_EXECUTION = "during-execution";
const TIMING_AFTER_EXECUTION = "after-execution";
const launchAndExecute = async ({
  cancellationToken = cancellation.createCancellationToken(),
  executionLogLevel,
  fileRelativeUrl,
  launch,
  // stopAfterExecute false by default because you want to keep browser alive
  // or nodejs process
  // however unit test will pass true because they want to move on
  stopAfterExecute = false,
  stopAfterExecuteReason = "stop after execute",
  // when launch returns { disconnected, gracefulStop, stop }
  // the launched runtime have that amount of ms for disconnected to resolve
  // before we call stop
  gracefulStopAllocatedMs = 4000,
  runtimeConsoleCallback = () => {},
  runtimeStartedCallback = () => {},
  runtimeStoppedCallback = () => {},
  runtimeErrorCallback = () => {},
  runtimeDisconnectCallback = () => {},
  measureDuration = false,
  mirrorConsole = false,
  captureConsole = false,
  // rename collectConsole ?
  collectRuntimeName = false,
  collectRuntimeVersion = false,
  inheritCoverage = false,
  collectCoverage = false,
  ...rest
} = {}) => {
  const logger$1 = logger.createLogger({
    logLevel: executionLogLevel
  });

  if (typeof fileRelativeUrl !== "string") {
    throw new TypeError(`fileRelativeUrl must be a string, got ${fileRelativeUrl}`);
  }

  if (typeof launch !== "function") {
    throw new TypeError(`launch launch must be a function, got ${launch}`);
  }

  let executionResultTransformer = executionResult => executionResult;

  if (measureDuration) {
    const startMs = Date.now();
    executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
      const endMs = Date.now();
      executionResult.startMs = startMs;
      executionResult.endMs = endMs;
      return executionResult;
    });
  }

  if (mirrorConsole) {
    runtimeConsoleCallback = composeCallback(runtimeConsoleCallback, ({
      type,
      text
    }) => {
      if (type === "error") {
        process.stderr.write(text);
      } else {
        process.stdout.write(text);
      }
    });
  }

  if (captureConsole) {
    const consoleCalls = [];
    runtimeConsoleCallback = composeCallback(runtimeConsoleCallback, ({
      type,
      text
    }) => {
      consoleCalls.push({
        type,
        text
      });
    });
    executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
      executionResult.consoleCalls = consoleCalls;
      return executionResult;
    });
  }

  if (collectRuntimeName) {
    runtimeStartedCallback = composeCallback(runtimeStartedCallback, ({
      name
    }) => {
      executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
        executionResult.runtimeName = name;
        return executionResult;
      });
    });
  }

  if (collectRuntimeVersion) {
    runtimeStartedCallback = composeCallback(runtimeStartedCallback, ({
      version
    }) => {
      executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
        executionResult.runtimeVersion = version;
        return executionResult;
      });
    });
  }

  if (inheritCoverage) {
    const collectCoverageSaved = collectCoverage;
    collectCoverage = true;
    executionResultTransformer = composeTransformer(executionResultTransformer, executionResult => {
      const {
        coverageMap,
        ...rest
      } = executionResult; // ensure the coverage of the executed file is taken into account

      global.__coverage__ = composeCoverageMap(global.__coverage__ || {}, coverageMap || {});

      if (collectCoverageSaved) {
        return executionResult;
      }

      if (fileRelativeUrl.endsWith(".html") && rest.namespace) {
        Object.keys(rest.namespace).forEach(file => {
          delete rest.namespace[file].coverageMap;
        });
      }

      return rest;
    });
  }

  const executionResult = await computeRawExecutionResult({
    cancellationToken,
    logger: logger$1,
    fileRelativeUrl,
    launch,
    stopAfterExecute,
    stopAfterExecuteReason,
    gracefulStopAllocatedMs,
    runtimeConsoleCallback,
    runtimeErrorCallback,
    runtimeDisconnectCallback,
    runtimeStartedCallback,
    runtimeStoppedCallback,
    collectCoverage,
    ...rest
  });
  return executionResultTransformer(executionResult);
};

const composeCallback = (previousCallback, callback) => {
  return (...args) => {
    previousCallback(...args);
    return callback(...args);
  };
};

const composeTransformer = (previousTransformer, transformer) => {
  return value => {
    const transformedValue = previousTransformer(value);
    return transformer(transformedValue);
  };
};

const computeRawExecutionResult = async ({
  cancellationToken,
  allocatedMs,
  ...rest
}) => {
  const hasAllocatedMs = typeof allocatedMs === "number" && allocatedMs !== Infinity;

  if (!hasAllocatedMs) {
    return computeExecutionResult({
      cancellationToken,
      ...rest
    });
  } // here if allocatedMs is very big
  // setTimeout may be called immediatly
  // in that case we should just throw that hte number is too big


  const TIMEOUT_CANCEL_REASON = "timeout";
  const id = setTimeout(() => {
    timeoutCancellationSource.cancel(TIMEOUT_CANCEL_REASON);
  }, allocatedMs);

  const timeoutCancel = () => clearTimeout(id);

  cancellationToken.register(timeoutCancel);
  const timeoutCancellationSource = cancellation.createCancellationSource();
  const externalOrTimeoutCancellationToken = cancellation.composeCancellationToken(cancellationToken, timeoutCancellationSource.token);

  try {
    const executionResult = await computeExecutionResult({
      cancellationToken: externalOrTimeoutCancellationToken,
      ...rest
    });
    timeoutCancel();
    return executionResult;
  } catch (e) {
    if (cancellation.errorToCancelReason(e) === TIMEOUT_CANCEL_REASON) {
      return createTimedoutExecutionResult();
    }

    throw e;
  }
};

const computeExecutionResult = async ({
  cancellationToken,
  logger: logger$1,
  fileRelativeUrl,
  launch,
  stopAfterExecute,
  stopAfterExecuteReason,
  gracefulStopAllocatedMs,
  runtimeStartedCallback,
  runtimeStoppedCallback,
  runtimeConsoleCallback,
  runtimeErrorCallback,
  runtimeDisconnectCallback,
  ...rest
}) => {
  logger$1.debug(`launch runtime environment for ${fileRelativeUrl}`);
  const launchOperation = cancellation.createStoppableOperation({
    cancellationToken,
    start: async () => {
      const value = await launch({
        cancellationToken,
        logger: logger$1,
        ...rest
      });
      runtimeStartedCallback({
        name: value.name,
        version: value.version
      });
      return value;
    },
    stop: async ({
      name: runtimeName,
      version: runtimeVersion,
      gracefulStop,
      stop
    }, reason) => {
      const runtime = `${runtimeName}/${runtimeVersion}`; // external code can cancel using cancellationToken at any time.
      // it is important to keep the code inside this stop function because once cancelled
      // all code after the operation won't execute because it will be rejected with
      // the cancellation error

      let stoppedGracefully;

      if (gracefulStop && gracefulStopAllocatedMs) {
        logger$1.debug(`${fileRelativeUrl} ${runtime}: runtime.gracefulStop() because ${reason}`);

        const gracefulStopPromise = (async () => {
          await gracefulStop({
            reason
          });
          return true;
        })();

        const stopPromise = (async () => {
          stoppedGracefully = await new Promise(async resolve => {
            const timeoutId = setTimeout(() => {
              resolve(false);
            }, gracefulStopAllocatedMs);

            try {
              await gracefulStopPromise;
              resolve(true);
            } finally {
              clearTimeout(timeoutId);
            }
          });

          if (stoppedGracefully) {
            return stoppedGracefully;
          }

          logger$1.debug(`${fileRelativeUrl} ${runtime}: runtime.stop() because gracefulStop still pending after ${gracefulStopAllocatedMs}ms`);
          await stop({
            reason,
            gracefulFailed: true
          });
          return false;
        })();

        stoppedGracefully = await Promise.race([gracefulStopPromise, stopPromise]);
      } else {
        await stop({
          reason,
          gracefulFailed: false
        });
        stoppedGracefully = false;
      }

      logger$1.debug(`${fileRelativeUrl} ${runtime}: runtime stopped${stoppedGracefully ? " gracefully" : ""}`);
      runtimeStoppedCallback({
        stoppedGracefully
      });
    }
  });
  const {
    name: runtimeName,
    version: runtimeVersion,
    options,
    executeFile,
    registerErrorCallback,
    registerConsoleCallback,
    disconnected
  } = await launchOperation;
  const runtime = `${runtimeName}/${runtimeVersion}`;
  logger$1.debug(logger.createDetailedMessage(`${fileRelativeUrl} ${runtime}: runtime launched.`, {
    options: JSON.stringify(options, null, "  ")
  }));
  logger$1.debug(`${fileRelativeUrl} ${runtime}: start file execution.`);
  registerConsoleCallback(runtimeConsoleCallback);
  const executeOperation = cancellation.createOperation({
    cancellationToken,
    start: async () => {
      let timing = TIMING_BEFORE_EXECUTION;
      disconnected.then(() => {
        logger$1.debug(`${fileRelativeUrl} ${runtime}: runtime disconnected ${timing}.`);
        runtimeDisconnectCallback({
          timing
        });
      });
      const executed = executeFile(fileRelativeUrl, rest);
      timing = TIMING_DURING_EXECUTION;
      registerErrorCallback(error => {
        logger$1.error(logger.createDetailedMessage(`error ${timing}.`, {
          ["error stack"]: error.stack,
          ["file executed"]: fileRelativeUrl,
          ["runtime"]: runtime
        }));
        runtimeErrorCallback({
          error,
          timing
        });
      });
      const raceResult = await promiseTrackRace([disconnected, executed]);
      timing = TIMING_AFTER_EXECUTION;

      if (raceResult.winner === disconnected) {
        return createDisconnectedExecutionResult();
      }

      if (stopAfterExecute) {
        launchOperation.stop(stopAfterExecuteReason);
      }

      const executionResult = raceResult.value;
      const {
        status
      } = executionResult;

      if (status === "errored") {
        // debug log level because this error happens during execution
        // there is no need to log it.
        // the code will know the execution errored because it receives
        // an errored execution result
        logger$1.debug(logger.createDetailedMessage(`error ${TIMING_DURING_EXECUTION}.`, {
          ["error stack"]: executionResult.error.stack,
          ["file executed"]: fileRelativeUrl,
          ["runtime"]: runtime
        }));
        return createErroredExecutionResult(executionResult, rest);
      }

      logger$1.debug(`${fileRelativeUrl} ${runtime}: execution completed.`);
      return createCompletedExecutionResult(executionResult, rest);
    }
  });
  const executionResult = await executeOperation;
  return executionResult;
};

const createTimedoutExecutionResult = () => {
  return {
    status: "timedout"
  };
};

const createDisconnectedExecutionResult = () => {
  return {
    status: "disconnected"
  };
};

const createErroredExecutionResult = ({
  error,
  coverageMap
}, {
  collectCoverage
}) => {
  return {
    status: "errored",
    error,
    ...(collectCoverage ? {
      coverageMap
    } : {})
  };
};

const createCompletedExecutionResult = ({
  namespace,
  coverageMap
}, {
  collectCoverage
}) => {
  return {
    status: "completed",
    namespace: normalizeNamespace(namespace),
    ...(collectCoverage ? {
      coverageMap
    } : {})
  };
};

const normalizeNamespace = namespace => {
  if (typeof namespace !== "object") return namespace;
  if (namespace instanceof Promise) return namespace;
  const normalized = {}; // remove "__esModule" or Symbol.toStringTag from namespace object

  Object.keys(namespace).forEach(key => {
    normalized[key] = namespace[key];
  });
  return normalized;
};

const promiseTrackRace = promiseArray => {
  return new Promise((resolve, reject) => {
    let resolved = false;

    const visit = index => {
      const promise = promiseArray[index];
      promise.then(value => {
        if (resolved) return;
        resolved = true;
        resolve({
          winner: promise,
          value,
          index
        });
      }, reject);
    };

    let i = 0;

    while (i < promiseArray.length) {
      visit(i++);
    }
  });
};

const execute = async ({
  cancellationToken = cancellation.createCancellationTokenForProcess(),
  logLevel = "warn",
  compileServerLogLevel = logLevel,
  executionLogLevel = logLevel,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  fileRelativeUrl,
  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap,
  convertMap,
  compileGroupCount = 2,
  importMetaDev,
  importMetaEnvFileRelativeUrl,
  importMeta,
  launch,
  mirrorConsole = true,
  stopAfterExecute = false,
  gracefulStopAllocatedMs,
  ignoreError = false,
  ...rest
}) => {
  const executionPromise = executeJsenvAsyncFunction(async () => {
    projectDirectoryUrl = assertProjectDirectoryUrl({
      projectDirectoryUrl
    });
    await assertProjectDirectoryExists({
      projectDirectoryUrl
    });

    if (typeof fileRelativeUrl !== "string") {
      throw new TypeError(`fileRelativeUrl must be a string, got ${fileRelativeUrl}`);
    }

    fileRelativeUrl = fileRelativeUrl.replace(/\\/g, "/");

    if (typeof launch !== "function") {
      throw new TypeError(`launch must be a function, got ${launch}`);
    }

    const {
      outDirectoryRelativeUrl,
      origin: compileServerOrigin,
      stop
    } = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      importMapFileRelativeUrl,
      importDefaultExtension,
      importMetaDev,
      importMetaEnvFileRelativeUrl,
      importMeta,
      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      babelPluginMap,
      convertMap,
      compileGroupCount
    });
    const result = await launchAndExecute({
      cancellationToken,
      executionLogLevel,
      fileRelativeUrl,
      launch: params => launch({
        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        compileServerOrigin,
        ...params
      }),
      mirrorConsole,
      stopAfterExecute,
      gracefulStopAllocatedMs,
      ...rest
    });
    stop("single-execution-done");
    return result;
  });

  if (ignoreError) {
    return executionPromise;
  }

  const result = await executionPromise;

  if (result.status === "errored") {
    /*
    Warning: when node launched with --unhandled-rejections=strict, despites
    this promise being rejected by throw result.error node will compltely ignore it.
     The error can be logged by doing
    ```js
    process.setUncaughtExceptionCaptureCallback((error) => {
      console.error(error.stack)
    })
    ```
    But it feels like a hack.
    */
    throw result.error;
  }

  return result;
};

const babelPluginInstrument = (api, options) => {
  const {
    programVisitor
  } = require$1("istanbul-lib-instrument");

  const {
    types
  } = api;
  const {
    useInlineSourceMaps = false,
    projectDirectoryUrl,
    coverageConfig = {
      "./**/*": true
    }
  } = options;
  const structuredMetaMapForCover = util.normalizeStructuredMetaMap({
    cover: coverageConfig
  }, projectDirectoryUrl);

  const shouldInstrument = relativeUrl => {
    return util.urlToMeta({
      url: util.resolveUrl(relativeUrl, projectDirectoryUrl),
      structuredMetaMap: structuredMetaMapForCover
    }).cover;
  };

  return {
    name: "transform-instrument",
    visitor: {
      Program: {
        enter(path) {
          const {
            file
          } = this;
          const {
            opts
          } = file;
          const relativeUrl = optionsToRelativeUrl(opts);

          if (!relativeUrl) {
            console.warn("file without relativeUrl", relativeUrl);
            return;
          }

          if (!shouldInstrument(relativeUrl)) return;
          this.__dv__ = null;
          let inputSourceMap;

          if (useInlineSourceMaps) {
            // https://github.com/istanbuljs/babel-plugin-istanbul/commit/a9e15643d249a2985e4387e4308022053b2cd0ad#diff-1fdf421c05c1140f6d71444ea2b27638R65
            inputSourceMap = opts.inputSourceMap || file.inputMap ? file.inputMap.sourcemap : null;
          } else {
            inputSourceMap = opts.inputSourceMap;
          }

          this.__dv__ = programVisitor(types, opts.filenameRelative || opts.filename, {
            coverageVariable: "__coverage__",
            inputSourceMap
          });

          this.__dv__.enter(path);
        },

        exit(path) {
          if (!this.__dv__) {
            return;
          }

          const object = this.__dv__.exit(path); // object got two properties: fileCoverage and sourceMappingURL


          this.file.metadata.coverage = object.fileCoverage;
        }

      }
    }
  };
};

const optionsToRelativeUrl = ({
  filenameRelative
}) => {
  if (filenameRelative) return filenameRelative;
  return "";
};

const generateFileExecutionSteps = ({
  fileRelativeUrl,
  filePlan
}) => {
  const fileExecutionSteps = [];
  Object.keys(filePlan).forEach(name => {
    const stepConfig = filePlan[name];

    if (stepConfig === null || stepConfig === undefined) {
      return;
    }

    if (typeof stepConfig !== "object") {
      throw new TypeError(logger.createDetailedMessage(`found unexpected value in plan, they must be object.`, {
        ["file relative path"]: fileRelativeUrl,
        ["name"]: name,
        ["value"]: stepConfig
      }));
    }

    fileExecutionSteps.push({
      name,
      fileRelativeUrl,
      ...stepConfig
    });
  });
  return fileExecutionSteps;
};

const generateExecutionSteps = async (plan, {
  cancellationToken,
  projectDirectoryUrl
}) => {
  const structuredMetaMap = {
    filePlan: plan
  };
  const fileResultArray = await util.collectFiles({
    cancellationToken,
    directoryUrl: projectDirectoryUrl,
    structuredMetaMap,
    predicate: ({
      filePlan
    }) => filePlan
  });
  const executionSteps = [];
  fileResultArray.forEach(({
    relativeUrl,
    meta
  }) => {
    const fileExecutionSteps = generateFileExecutionSteps({
      fileRelativeUrl: relativeUrl,
      filePlan: meta.filePlan
    });
    executionSteps.push(...fileExecutionSteps);
  });
  return executionSteps;
};

const {
  createFileCoverage: createFileCoverage$1
} = require$1("istanbul-lib-coverage");

const createEmptyCoverage = relativeUrl => createFileCoverage$1(relativeUrl).toJSON();

const relativeUrlToEmptyCoverage = async (relativeUrl, {
  cancellationToken,
  projectDirectoryUrl,
  babelPluginMap
}) => {
  const {
    transformAsync
  } = require$1("@babel/core");

  const fileUrl = util.resolveUrl(relativeUrl, projectDirectoryUrl);
  const source = await cancellation.createOperation({
    cancellationToken,
    start: () => util.readFile(fileUrl)
  });
  const plugins = [...minimalBabelPluginArray];
  Object.keys(babelPluginMap).forEach(babelPluginName => {
    if (babelPluginName !== "transform-instrument") {
      plugins.push(babelPluginMap[babelPluginName]);
    }
  });
  plugins.push([babelPluginInstrument, {
    projectDirectoryUrl
  }]);

  try {
    const {
      metadata
    } = await cancellation.createOperation({
      cancellationToken,
      start: () => transformAsync(source, {
        filename: util.urlToFileSystemPath(fileUrl),
        filenameRelative: relativeUrl,
        configFile: false,
        babelrc: false,
        parserOpts: {
          allowAwaitOutsideFunction: true
        },
        plugins
      })
    });
    const {
      coverage
    } = metadata;

    if (!coverage) {
      throw new Error(`missing coverage for file`);
    } // https://github.com/gotwarlost/istanbul/blob/bc84c315271a5dd4d39bcefc5925cfb61a3d174a/lib/command/common/run-with-cover.js#L229


    Object.keys(coverage.s).forEach(function (key) {
      coverage.s[key] = 0;
    });
    return coverage;
  } catch (e) {
    if (e && e.code === "BABEL_PARSE_ERROR") {
      // return an empty coverage for that file when
      // it contains a syntax error
      return createEmptyCoverage(relativeUrl);
    }

    throw e;
  }
};

const ensureRelativePathsInCoverage = coverageMap => {
  const coverageMapRelative = {};
  Object.keys(coverageMap).forEach(key => {
    const coverageForFile = coverageMap[key];
    coverageMapRelative[key] = coverageForFile.path.startsWith("./") ? coverageForFile : { ...coverageForFile,
      path: `./${coverageForFile.path}`
    };
  });
  return coverageMapRelative;
};

const reportToCoverageMap = async (report, {
  cancellationToken,
  projectDirectoryUrl,
  babelPluginMap,
  coverageConfig,
  coverageIncludeMissing
}) => {
  const coverageMapForReport = executionReportToCoverageMap(report);

  if (!coverageIncludeMissing) {
    return ensureRelativePathsInCoverage(coverageMapForReport);
  }

  const relativeFileUrlToCoverArray = await listRelativeFileUrlToCover({
    cancellationToken,
    projectDirectoryUrl,
    coverageConfig
  });
  const relativeFileUrlMissingCoverageArray = relativeFileUrlToCoverArray.filter(relativeFileUrlToCover => relativeFileUrlToCover in coverageMapForReport === false);
  const coverageMapForMissedFiles = {};
  await Promise.all(relativeFileUrlMissingCoverageArray.map(async relativeFileUrlMissingCoverage => {
    const emptyCoverage = await relativeUrlToEmptyCoverage(relativeFileUrlMissingCoverage, {
      cancellationToken,
      projectDirectoryUrl,
      babelPluginMap
    });
    coverageMapForMissedFiles[relativeFileUrlMissingCoverage] = emptyCoverage;
    return emptyCoverage;
  }));
  return ensureRelativePathsInCoverage({ ...coverageMapForReport,
    ...coverageMapForMissedFiles
  });
};

const listRelativeFileUrlToCover = async ({
  cancellationToken,
  projectDirectoryUrl,
  coverageConfig
}) => {
  const structuredMetaMapForCoverage = {
    cover: coverageConfig
  };
  const matchingFileResultArray = await util.collectFiles({
    cancellationToken,
    directoryUrl: projectDirectoryUrl,
    structuredMetaMap: structuredMetaMapForCoverage,
    predicate: ({
      cover
    }) => cover
  });
  return matchingFileResultArray.map(({
    relativeUrl
  }) => relativeUrl);
};

const executionReportToCoverageMap = report => {
  const coverageMapArray = [];
  Object.keys(report).forEach(file => {
    const executionResultForFile = report[file];
    Object.keys(executionResultForFile).forEach(executionName => {
      const executionResultForFileOnRuntime = executionResultForFile[executionName];
      const {
        coverageMap
      } = executionResultForFileOnRuntime;

      if (!coverageMap) {
        // several reasons not to have coverageMap here:
        // 1. the file we executed did not import an instrumented file.
        // - a test file without import
        // - a test file importing only file excluded from coverage
        // - a coverDescription badly configured so that we don't realize
        // a file should be covered
        // 2. the file we wanted to executed timedout
        // - infinite loop
        // - too extensive operation
        // - a badly configured or too low allocatedMs for that execution.
        // 3. the file we wanted to execute contains syntax-error
        // in any scenario we are fine because
        // coverDescription will generate empty coverage for files
        // that were suppose to be coverage but were not.
        return;
      }

      coverageMapArray.push(coverageMap);
    });
  });
  const executionCoverageMap = composeCoverageMap(...coverageMapArray);
  return executionCoverageMap;
};

const stringWidth = require$1("string-width");

const writeLog = (string, {
  stream = process.stdout
} = {}) => {
  string = `${string}
`;
  stream.write(string);
  const consoleModified = spyConsoleModification();

  const moveCursorToLineAbove = () => {
    readline__default['default'].moveCursor(stream, 0, -1);
  };

  const clearCursorLine = () => {
    readline__default['default'].clearLine(stream, 0);
  };

  const remove = util.memoize(() => {
    const {
      columns = 80,
      rows = 24
    } = stream;
    const logLines = string.split(/\r\n|\r|\n/);
    let visualLineCount = 0;
    logLines.forEach(logLine => {
      const width = stringWidth(logLine);
      visualLineCount += width === 0 ? 1 : Math.ceil(width / columns);
    });

    if (visualLineCount > rows) {
      // the whole log cannot be cleared because it's vertically to long
      // (longer than terminal height)
      // readline.moveCursor cannot move cursor higher than screen height
      // it means we would only clear the visible part of the log
      // better keep the log untouched
      return;
    }

    while (visualLineCount--) {
      clearCursorLine();

      if (visualLineCount > 0) {
        moveCursorToLineAbove();
      }
    } // an other version of the while above could the code below
    // readline.moveCursor(stream, 0, -visualLineCount)
    // readline.clearScreenDown(stream)

  });
  let updated = false;

  const update = newString => {
    if (updated) {
      console.warn(`cannot update twice`);
      return null;
    }

    updated = true;

    if (!consoleModified()) {
      remove();
    }

    return writeLog(newString, {
      stream
    });
  };

  return {
    remove,
    update
  };
}; // maybe https://github.com/gajus/output-interceptor/tree/v3.0.0 ?
// the problem with listening data on stdout
// is that node.js will later throw error if stream gets closed
// while something listening data on it

const spyConsoleModification = () => {
  const {
    stdout,
    stderr
  } = process;
  const originalStdoutWrite = stdout.write;
  const originalStdErrWrite = stderr.write;
  let modified = false;

  stdout.write = (chunk, encoding, callback) => {
    modified = true;
    return originalStdoutWrite.call(stdout, chunk, encoding, callback);
  };

  stderr.write = (chunk, encoding, callback) => {
    modified = true;
    return originalStdErrWrite.call(stderr, chunk, encoding, callback);
  };

  const uninstall = () => {
    stdout.write = originalStdoutWrite;
    stderr.write = originalStdErrWrite;
  };

  return () => {
    uninstall();
    return modified;
  };
};

const humanizeDuration = require$1("humanize-duration");

const formatDuration = duration => {
  return humanizeDuration(duration, {
    largest: 2,
    maxDecimalPoints: 2
  });
};

const createSummaryLog = summary => `
-------------- summary -----------------
${createSummaryMessage(summary)}${createTotalDurationMessage(summary)}
----------------------------------------
`;

const createSummaryMessage = ({
  executionCount,
  disconnectedCount,
  timedoutCount,
  erroredCount,
  completedCount
}) => {
  if (executionCount === 0) return `0 execution.`;
  return `${executionCount} execution: ${createSummaryDetails({
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount
  })}.`;
};

const createSummaryDetails = ({
  executionCount,
  disconnectedCount,
  timedoutCount,
  erroredCount,
  completedCount
}) => {
  if (disconnectedCount === executionCount) {
    return createAllDisconnectedDetails();
  }

  if (timedoutCount === executionCount) {
    return createAllTimedoutDetails();
  }

  if (erroredCount === executionCount) {
    return createAllErroredDetails();
  }

  if (completedCount === executionCount) {
    return createAllCompletedDetails();
  }

  return createMixedDetails({
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount
  });
};

const createAllDisconnectedDetails = () => `all ${magenta}disconnected${ansiResetSequence}`;

const createAllTimedoutDetails = () => `all ${yellow}timedout${ansiResetSequence}`;

const createAllErroredDetails = () => `all ${red}errored${ansiResetSequence}`;

const createAllCompletedDetails = () => `all ${green}completed${ansiResetSequence}`;

const createMixedDetails = ({
  disconnectedCount,
  timedoutCount,
  erroredCount,
  completedCount
}) => {
  const parts = [];

  if (disconnectedCount) {
    parts.push(`${disconnectedCount} ${magenta}disconnected${ansiResetSequence}`);
  }

  if (timedoutCount) {
    parts.push(`${timedoutCount} ${yellow}timed out${ansiResetSequence}`);
  }

  if (erroredCount) {
    parts.push(`${erroredCount} ${red}errored${ansiResetSequence}`);
  }

  if (completedCount) {
    parts.push(`${completedCount} ${green}completed${ansiResetSequence}`);
  }

  return `${parts.join(", ")}`;
};

const createTotalDurationMessage = ({
  startMs,
  endMs
}) => {
  if (!endMs) return "";
  return `
total duration: ${formatDuration(endMs - startMs)}`;
};

const createExecutionResultLog = ({
  status,
  fileRelativeUrl,
  allocatedMs,
  runtimeName,
  runtimeVersion,
  consoleCalls,
  startMs,
  endMs,
  error,
  executionIndex
}, {
  completedExecutionLogAbbreviation,
  executionCount,
  disconnectedCount,
  timedoutCount,
  erroredCount,
  completedCount
}) => {
  const executionNumber = executionIndex + 1;
  const summary = `(${createSummaryDetails({
    executionCount: executionNumber,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount
  })})`;
  const runtime = `${runtimeName}/${runtimeVersion}`;

  if (status === "completed") {
    if (completedExecutionLogAbbreviation) {
      return `
${green}${checkmark} execution ${executionNumber} of ${executionCount} completed${ansiResetSequence} ${summary}.`;
    }

    return `
${green}${checkmark} execution ${executionNumber} of ${executionCount} completed${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
      startMs,
      endMs
    })}${appendConsole(consoleCalls)}${appendError(error)}`;
  }

  if (status === "disconnected") {
    return `
${magenta}${cross} execution ${executionNumber} of ${executionCount} disconnected${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
      startMs,
      endMs
    })}${appendConsole(consoleCalls)}${appendError(error)}`;
  }

  if (status === "timedout") {
    return `
${yellow}${cross} execution ${executionNumber} of ${executionCount} timeout after ${allocatedMs}ms${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
      startMs,
      endMs
    })}${appendConsole(consoleCalls)}${appendError(error)}`;
  }

  return `
${red}${cross} execution ${executionNumber} of ${executionCount} error${ansiResetSequence} ${summary}.
file: ${fileRelativeUrl}
runtime: ${runtime}${appendDuration({
    startMs,
    endMs
  })}${appendConsole(consoleCalls)}${appendError(error)}`;
};

const appendDuration = ({
  endMs,
  startMs
}) => {
  if (!endMs) return "";
  return `
duration: ${formatDuration(endMs - startMs)}`;
};

const appendConsole = consoleCalls => {
  if (!consoleCalls || consoleCalls.length === 0) return "";
  const consoleOutput = consoleCalls.reduce((previous, {
    text
  }) => {
    return `${previous}${text}`;
  }, "");
  const consoleOutputTrimmed = consoleOutput.trim();
  if (consoleOutputTrimmed === "") return "";
  return `
${grey}-------- console --------${ansiResetSequence}
${consoleOutputTrimmed}
${grey}-------------------------${ansiResetSequence}`;
};

const appendError = error => {
  if (!error) return ``;
  return `
error: ${error.stack}`;
};

/* eslint-disable import/max-dependencies */

const wrapAnsi = require$1("wrap-ansi");

const executeConcurrently = async (executionSteps, {
  cancellationToken,
  logger: logger$1,
  executionLogLevel,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  babelPluginMap,
  concurrencyLimit = Math.max(os.cpus.length - 1, 1),
  executionDefaultOptions = {},
  stopAfterExecute,
  logSummary,
  completedExecutionLogMerging,
  completedExecutionLogAbbreviation,
  coverage,
  coverageConfig,
  coverageIncludeMissing,
  ...rest
}) => {
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`);
  }

  const executionOptionsFromDefault = {
    allocatedMs: 30000,
    measureDuration: true,
    // mirrorConsole: false because file will be executed in parallel
    // so log would be a mess to read
    mirrorConsole: false,
    captureConsole: true,
    collectRuntimeName: true,
    collectRuntimeVersion: true,
    collectCoverage: coverage,
    mainFileNotFoundCallback: ({
      fileRelativeUrl
    }) => {
      logger$1.error(new Error(logger.createDetailedMessage(`an execution main file does not exists.`, {
        ["file relative path"]: fileRelativeUrl
      })));
    },
    beforeExecutionCallback: () => {},
    afterExecutionCallback: () => {},
    ...executionDefaultOptions
  };
  const startMs = Date.now();
  const allExecutionDoneCancellationSource = cancellation.createCancellationSource();
  const executionCancellationToken = cancellation.composeCancellationToken(cancellationToken, allExecutionDoneCancellationSource.token);
  const report = {};
  const executionCount = executionSteps.length;
  let previousExecutionResult;
  let previousExecutionLog;
  let disconnectedCount = 0;
  let timedoutCount = 0;
  let erroredCount = 0;
  let completedCount = 0;
  await cancellation.createConcurrentOperations({
    cancellationToken,
    concurrencyLimit,
    array: executionSteps,
    start: async executionOptionsFromStep => {
      const executionIndex = executionSteps.indexOf(executionOptionsFromStep);
      const executionOptions = { ...executionOptionsFromDefault,
        ...executionOptionsFromStep
      };
      const {
        name,
        executionId,
        fileRelativeUrl,
        launch,
        allocatedMs,
        measureDuration,
        mirrorConsole,
        captureConsole,
        collectRuntimeName,
        collectRuntimeVersion,
        collectCoverage,
        mainFileNotFoundCallback,
        beforeExecutionCallback,
        afterExecutionCallback,
        gracefulStopAllocatedMs
      } = executionOptions;
      const beforeExecutionInfo = {
        allocatedMs,
        name,
        executionId,
        fileRelativeUrl,
        executionIndex
      };
      const filePath = util.urlToFileSystemPath(`${projectDirectoryUrl}${fileRelativeUrl}`);
      const fileExists = await pathLeadsToFile(filePath);

      if (!fileExists) {
        mainFileNotFoundCallback(beforeExecutionInfo);
        return;
      }

      beforeExecutionCallback(beforeExecutionInfo);
      const executionResult = await launchAndExecute({
        cancellationToken: executionCancellationToken,
        executionLogLevel,
        launch: params => launch({
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin,
          ...params
        }),
        allocatedMs,
        measureDuration,
        collectRuntimeName,
        collectRuntimeVersion,
        mirrorConsole,
        captureConsole,
        gracefulStopAllocatedMs,
        stopAfterExecute,
        stopAfterExecuteReason: "execution-done",
        executionId,
        fileRelativeUrl,
        collectCoverage,
        ...rest
      });
      const afterExecutionInfo = { ...beforeExecutionInfo,
        ...executionResult
      };
      afterExecutionCallback(afterExecutionInfo);

      if (executionResult.status === "timedout") {
        timedoutCount++;
      } else if (executionResult.status === "disconnected") {
        disconnectedCount++;
      } else if (executionResult.status === "errored") {
        erroredCount++;
      } else if (executionResult.status === "completed") {
        completedCount++;
      }

      if (logger.loggerToLevels(logger$1).info) {
        let log = createExecutionResultLog(afterExecutionInfo, {
          completedExecutionLogAbbreviation,
          executionCount,
          disconnectedCount,
          timedoutCount,
          erroredCount,
          completedCount
        });
        const {
          columns = 80
        } = process.stdout;
        log = wrapAnsi(log, columns, {
          trim: false,
          hard: true,
          wordWrap: false
        });

        if (previousExecutionLog && completedExecutionLogMerging && previousExecutionResult && previousExecutionResult.status === "completed" && (previousExecutionResult.consoleCalls ? previousExecutionResult.consoleCalls.length === 0 : true) && executionResult.status === "completed") {
          previousExecutionLog = previousExecutionLog.update(log);
        } else {
          previousExecutionLog = writeLog(log);
        }
      }

      if (fileRelativeUrl in report === false) {
        report[fileRelativeUrl] = {};
      }

      report[fileRelativeUrl][name] = executionResult;
      previousExecutionResult = executionResult;
    }
  }); // tell everyone we are done
  // (used to stop potential chrome browser still opened to be reused)

  allExecutionDoneCancellationSource.cancel("all execution done");
  const summary = reportToSummary(report);
  summary.startMs = startMs;
  summary.endMs = Date.now();

  if (logSummary) {
    logger$1.info(createSummaryLog(summary));
  }

  return {
    summary,
    report,
    ...(coverage ? {
      coverageMap: await reportToCoverageMap(report, {
        cancellationToken,
        projectDirectoryUrl,
        babelPluginMap,
        coverageConfig,
        coverageIncludeMissing
      })
    } : {})
  };
};

const pathLeadsToFile = path => new Promise((resolve, reject) => {
  fs.stat(path, (error, stats) => {
    if (error) {
      if (error.code === "ENOENT") {
        resolve(false);
      } else {
        reject(error);
      }
    } else {
      resolve(stats.isFile());
    }
  });
});

const reportToSummary = report => {
  const fileNames = Object.keys(report);
  const executionCount = fileNames.reduce((previous, fileName) => {
    return previous + Object.keys(report[fileName]).length;
  }, 0);

  const countResultMatching = predicate => {
    return fileNames.reduce((previous, fileName) => {
      const fileExecutionResult = report[fileName];
      return previous + Object.keys(fileExecutionResult).filter(executionName => {
        const fileExecutionResultForRuntime = fileExecutionResult[executionName];
        return predicate(fileExecutionResultForRuntime);
      }).length;
    }, 0);
  };

  const disconnectedCount = countResultMatching(({
    status
  }) => status === "disconnected");
  const timedoutCount = countResultMatching(({
    status
  }) => status === "timedout");
  const erroredCount = countResultMatching(({
    status
  }) => status === "errored");
  const completedCount = countResultMatching(({
    status
  }) => status === "completed");
  return {
    executionCount,
    disconnectedCount,
    timedoutCount,
    erroredCount,
    completedCount
  };
};

const executePlan = async (plan, {
  cancellationToken,
  compileServerLogLevel,
  logger,
  executionLogLevel,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  importMetaDev,
  importMetaEnvFileRelativeUrl,
  importMeta,
  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap,
  convertMap,
  compileGroupCount,
  concurrencyLimit,
  executionDefaultOptions,
  stopAfterExecute,
  completedExecutionLogMerging,
  completedExecutionLogAbbreviation,
  logSummary,
  // coverage parameters
  coverage,
  coverageConfig,
  coverageIncludeMissing,
  ...rest
} = {}) => {
  if (coverage) {
    babelPluginMap = { ...babelPluginMap,
      "transform-instrument": [babelPluginInstrument, {
        projectDirectoryUrl,
        coverageConfig
      }]
    };
  }

  const {
    origin: compileServerOrigin,
    outDirectoryRelativeUrl,
    stop
  } = await startCompileServer({
    cancellationToken,
    compileServerLogLevel,
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    jsenvDirectoryClean,
    importMapFileRelativeUrl,
    importDefaultExtension,
    importMetaDev,
    importMetaEnvFileRelativeUrl,
    importMeta,
    compileServerProtocol,
    compileServerPrivateKey,
    compileServerCertificate,
    compileServerIp,
    compileServerPort,
    keepProcessAlive: true,
    // to be sure it stays alive
    babelPluginMap,
    convertMap,
    compileGroupCount
  });
  const executionSteps = await generateExecutionSteps({ ...plan,
    [outDirectoryRelativeUrl]: null
  }, {
    cancellationToken,
    projectDirectoryUrl
  });
  const executionResult = await executeConcurrently(executionSteps, {
    cancellationToken,
    logger,
    executionLogLevel,
    projectDirectoryUrl,
    outDirectoryRelativeUrl,
    compileServerOrigin,
    importMapFileRelativeUrl,
    importDefaultExtension,
    babelPluginMap,
    stopAfterExecute,
    concurrencyLimit,
    executionDefaultOptions,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    logSummary,
    coverage,
    coverageConfig,
    coverageIncludeMissing,
    ...rest
  });
  stop("all execution done");
  return executionResult;
};

const executionIsPassed = ({
  summary
}) => summary.executionCount === summary.completedCount;

const generateCoverageJsonFile = async (coverageMap, coverageJsonFileUrl) => {
  await util.writeFile(coverageJsonFileUrl, JSON.stringify(coverageMap, null, "  "));
};

const {
  readFileSync
} = require$1("fs");

const generateCoverageHtmlDirectory = async (coverageMap, htmlDirectoryRelativeUrl, projectDirectoryUrl) => {
  const libReport = require$1("istanbul-lib-report");

  const reports = require$1("istanbul-reports");

  const {
    createCoverageMap
  } = require$1("istanbul-lib-coverage");

  const context = libReport.createContext({
    dir: util.urlToFileSystemPath(projectDirectoryUrl),
    coverageMap: createCoverageMap(coverageMap),
    sourceFinder: path => {
      return readFileSync(util.urlToFileSystemPath(util.resolveUrl(path, projectDirectoryUrl)), "utf8");
    }
  });
  const report = reports.create("html", {
    skipEmpty: true,
    skipFull: true,
    subdir: htmlDirectoryRelativeUrl
  });
  report.execute(context);
};

const generateCoverageTextLog = coverageMap => {
  const libReport = require$1("istanbul-lib-report");

  const reports = require$1("istanbul-reports");

  const {
    createCoverageMap
  } = require$1("istanbul-lib-coverage");

  const context = libReport.createContext({
    coverageMap: createCoverageMap(coverageMap)
  });
  const report = reports.create("text", {
    skipEmpty: true,
    skipFull: true
  });
  report.execute(context);
};

const jsenvCoverageConfig = {
  "./index.js": true,
  "./main.js": true,
  "./src/**/*.js": true,
  "./**/*.test.*": false,
  // contains .test. -> nope
  "./**/test/": false // inside a test folder -> nope,

};

/* eslint-disable import/max-dependencies */
const executeTestPlan = async ({
  cancellationToken = cancellation.createCancellationTokenForProcess(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  executionLogLevel = "warn",
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  importMetaDev = true,
  importMetaEnvFileRelativeUrlForTest = "env.dev.js",
  importMeta,
  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap,
  convertMap,
  compileGroupCount = 2,
  testPlan,
  concurrencyLimit,
  executionDefaultOptions = {},
  // stopAfterExecute: true to ensure runtime is stopped once executed
  // because we have what we wants: execution is completed and
  // we have associated coverageMap and capturedConsole
  // you can still pass false to debug what happens
  // meaning all node process and browsers launched stays opened
  stopAfterExecute = true,
  completedExecutionLogAbbreviation = false,
  completedExecutionLogMerging = false,
  logSummary = true,
  updateProcessExitCode = true,
  coverage = process.argv.includes("--cover") || process.argv.includes("--coverage"),
  coverageConfig = jsenvCoverageConfig,
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageTextLog = true,
  coverageJsonFile = Boolean(process.env.CI),
  coverageJsonFileLog = true,
  coverageJsonFileRelativeUrl = "./coverage/coverage.json",
  coverageHtmlDirectory = !process.env.CI,
  coverageHtmlDirectoryRelativeUrl = "./coverage",
  coverageHtmlDirectoryIndexLog = true,
  // for chromiumExecutablePath, firefoxExecutablePath and webkitExecutablePath
  // but we need something angostic that just forward the params hence using ...rest
  ...rest
}) => {
  return executeJsenvAsyncFunction(async () => {
    const logger$1 = logger.createLogger({
      logLevel
    });
    cancellationToken.register(cancelError => {
      if (cancelError.reason === "process SIGINT") {
        logger$1.info(`process SIGINT -> cancelling test execution`);
      }
    });
    projectDirectoryUrl = assertProjectDirectoryUrl({
      projectDirectoryUrl
    });
    await assertProjectDirectoryExists({
      projectDirectoryUrl
    });

    if (typeof testPlan !== "object") {
      throw new Error(`testPlan must be an object, got ${testPlan}`);
    }

    if (coverage) {
      if (typeof coverageConfig !== "object") {
        throw new TypeError(`coverageConfig must be an object, got ${coverageConfig}`);
      }

      if (Object.keys(coverageConfig).length === 0) {
        logger$1.warn(`coverageConfig is an empty object. Nothing will be instrumented for coverage so your coverage will be empty`);
      }

      if (!coverageAndExecutionAllowed) {
        const structuredMetaMapForExecute = util.normalizeStructuredMetaMap({
          execute: testPlan
        }, "file:///");
        const structuredMetaMapForCover = util.normalizeStructuredMetaMap({
          cover: coverageConfig
        }, "file:///");
        const patternsMatchingCoverAndExecute = Object.keys(structuredMetaMapForExecute.execute).filter(testPlanPattern => {
          return util.urlToMeta({
            url: testPlanPattern,
            structuredMetaMap: structuredMetaMapForCover
          }).cover;
        });

        if (patternsMatchingCoverAndExecute.length) {
          // I think it is an error, it would be strange, for a given file
          // to be both covered and executed
          throw new Error(logger.createDetailedMessage(`some file will be both covered and executed`, {
            patterns: patternsMatchingCoverAndExecute
          }));
        }
      }
    }

    const result = await executePlan(testPlan, {
      cancellationToken,
      compileServerLogLevel,
      logger: logger$1,
      executionLogLevel,
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      importMapFileRelativeUrl,
      importDefaultExtension,
      importMetaDev,
      importMetaEnvFileRelativeUrl: importMetaEnvFileRelativeUrlForTest,
      importMeta,
      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      babelPluginMap,
      convertMap,
      compileGroupCount,
      concurrencyLimit,
      executionDefaultOptions,
      stopAfterExecute,
      completedExecutionLogMerging,
      completedExecutionLogAbbreviation,
      logSummary,
      coverage,
      coverageConfig,
      coverageIncludeMissing,
      ...rest
    });

    if (updateProcessExitCode && !executionIsPassed(result)) {
      process.exitCode = 1;
    }

    const promises = []; // keep this one first because it does ensureEmptyDirectory
    // and in case coverage json file gets written in the same directory
    // it must be done before

    if (coverage && coverageHtmlDirectory) {
      const coverageHtmlDirectoryUrl = util.resolveDirectoryUrl(coverageHtmlDirectoryRelativeUrl, projectDirectoryUrl);
      await util.ensureEmptyDirectory(coverageHtmlDirectoryUrl);

      if (coverageHtmlDirectoryIndexLog) {
        const htmlCoverageDirectoryIndexFileUrl = `${coverageHtmlDirectoryUrl}index.html`;
        logger$1.info(`-> ${util.urlToFileSystemPath(htmlCoverageDirectoryIndexFileUrl)}`);
      }

      promises.push(generateCoverageHtmlDirectory(result.coverageMap, coverageHtmlDirectoryRelativeUrl, projectDirectoryUrl));
    }

    if (coverage && coverageJsonFile) {
      const coverageJsonFileUrl = util.resolveUrl(coverageJsonFileRelativeUrl, projectDirectoryUrl);

      if (coverageJsonFileLog) {
        logger$1.info(`-> ${util.urlToFileSystemPath(coverageJsonFileUrl)}`);
      }

      promises.push(generateCoverageJsonFile(result.coverageMap, coverageJsonFileUrl));
    }

    if (coverage && coverageTextLog) {
      promises.push(generateCoverageTextLog(result.coverageMap));
    }

    await Promise.all(promises);
    return result;
  });
};

const getBabelPluginMapForNode = ({
  babelPluginMap = jsenvBabelPluginMap,
  nodeMinimumVersion = decideNodeMinimumVersion()
} = {}) => {
  const babelPluginMapForNode = computeBabelPluginMapForRuntime({
    babelPluginMap,
    runtimeName: "node",
    runtimeVersion: nodeMinimumVersion
  });
  return babelPluginMapForNode;
};

const decideNodeMinimumVersion = () => {
  return process.version.slice(1);
};

const jsenvExplorableConfig = {
  source: {
    "./*.html": true,
    "./src/**/*.html": true
  },
  test: {
    "./test/**/*.html": true
  }
};

const jsenvServiceWorkerFinalizer = (code, {
  buildManifest,
  rollupBuild
}) => {
  const generatedUrlsConfig = {};
  Object.keys(buildManifest).forEach(projectRelativeUrl => {
    if (projectRelativeUrl.endsWith(".map")) {
      return;
    }

    const buildRelativeUrl = buildManifest[projectRelativeUrl];
    const versioned = fileNameContainsHash(buildRelativeUrl);
    const rollupFile = rollupBuild[buildRelativeUrl];
    generatedUrlsConfig[buildRelativeUrl] = {
      versioned,
      ...(versioned ? {} : {
        // when url is not versioned we compute a "version" for that url anyway
        // so that service worker source still changes and navigator
        // detect there is a change
        version: generateContentHash(rollupFile.type === "chunk" ? rollupFile.code : rollupFile.source)
      })
    };
  });
  return `
self.generatedUrlsConfig = ${JSON.stringify(generatedUrlsConfig, null, "  ")}
${code}
`;
};

const fileNameContainsHash = fileName => /-[a-z0-9]{8,}(\..*?)?$/.test(fileName);

const trackRessources = () => {
  const callbackArray = [];

  const registerCleanupCallback = callback => {
    if (typeof callback !== "function") throw new TypeError(`callback must be a function
callback: ${callback}`);
    callbackArray.push(callback);
    return () => {
      const index = callbackArray.indexOf(callback);
      if (index > -1) callbackArray.splice(index, 1);
    };
  };

  const cleanup = util.memoize(async reason => {
    const localCallbackArray = callbackArray.slice();
    await Promise.all(localCallbackArray.map(callback => callback(reason)));
  });
  return {
    registerCleanupCallback,
    cleanup
  };
};

const trackPageToNotify = (page, {
  onError,
  onConsole
}) => {
  // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
  const removeErrorListener = registerEvent({
    object: page,
    eventType: "error",
    callback: onError
  }); // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror

  const removePageErrorListener = registerEvent({
    object: page,
    eventType: "pageerror",
    callback: onError
  }); // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-console

  const removeConsoleListener = registerEvent({
    object: page,
    eventType: "console",
    // https://github.com/microsoft/playwright/blob/master/docs/api.md#event-console
    callback: async consoleMessage => {
      onConsole({
        type: consoleMessage.type(),
        text: appendNewLine(extractTextFromConsoleMessage(consoleMessage))
      });
    }
  });
  return () => {
    removeErrorListener();
    removePageErrorListener();
    removeConsoleListener();
  };
};

const appendNewLine = string => `${string}
`;

const extractTextFromConsoleMessage = consoleMessage => {
  return consoleMessage.text(); // ensure we use a string so that istanbul won't try
  // to put any coverage statement inside it
  // ideally we should use uneval no ?
  // eslint-disable-next-line no-new-func
  //   const functionEvaluatedBrowserSide = new Function(
  //     "value",
  //     `if (value instanceof Error) {
  //   return value.stack
  // }
  // return value`,
  //   )
  //   const argValues = await Promise.all(
  //     message.args().map(async (arg) => {
  //       const jsHandle = arg
  //       try {
  //         return await jsHandle.executionContext().evaluate(functionEvaluatedBrowserSide, jsHandle)
  //       } catch (e) {
  //         return String(jsHandle)
  //       }
  //     }),
  //   )
  //   const text = argValues.reduce((previous, value, index) => {
  //     let string
  //     if (typeof value === "object") string = JSON.stringify(value, null, "  ")
  //     else string = String(value)
  //     if (index === 0) return `${previous}${string}`
  //     return `${previous} ${string}`
  //   }, "")
  //   return text
};

const registerEvent = ({
  object,
  eventType,
  callback
}) => {
  object.on(eventType, callback);
  return () => {
    object.removeListener(eventType, callback);
  };
};

const createSharing = ({
  argsToId = argsToIdFallback
} = {}) => {
  const tokenMap = {};

  const getSharingToken = (...args) => {
    const id = argsToId(args);

    if (id in tokenMap) {
      return tokenMap[id];
    }

    const sharingToken = createSharingToken({
      unusedCallback: () => {
        delete tokenMap[id];
      }
    });
    tokenMap[id] = sharingToken;
    return sharingToken;
  };

  const getUniqueSharingToken = () => {
    return createSharingToken();
  };

  return {
    getSharingToken,
    getUniqueSharingToken
  };
};

const createSharingToken = ({
  unusedCallback = () => {}
} = {}) => {
  let useCount = 0;
  let sharedValue;
  let cleanup;
  const sharingToken = {
    isUsed: () => useCount > 0,
    setSharedValue: (value, cleanupFunction = () => {}) => {
      sharedValue = value;
      cleanup = cleanupFunction;
    },
    useSharedValue: () => {
      useCount++;
      let stopped = false;
      let stopUsingReturnValue;

      const stopUsing = () => {
        // ensure if stopUsing is called many times
        // it returns the same value and does not decrement useCount more than once
        if (stopped) {
          return stopUsingReturnValue;
        }

        stopped = true;
        useCount--;

        if (useCount === 0) {
          unusedCallback();
          sharedValue = undefined;
          stopUsingReturnValue = cleanup();
        } else {
          stopUsingReturnValue = undefined;
        }

        return stopUsingReturnValue;
      };

      return [sharedValue, stopUsing];
    }
  };
  return sharingToken;
};

const argsToIdFallback = args => JSON.stringify(args);

const evalSource = (code, filePath) => {
  const script = new vm.Script(code, {
    filename: filePath
  });
  return script.runInThisContext();
};

// https://github.com/benjamingr/RegExp.escape/blob/master/polyfill.js
const escapeRegexpSpecialCharacters = string => {
  string = String(string);
  let i = 0;
  let escapedString = "";

  while (i < string.length) {
    const char = string[i];
    i++;
    escapedString += isRegExpSpecialChar(char) ? `\\${char}` : char;
  }

  return escapedString;
};

const isRegExpSpecialChar = char => regexpSpecialChars.indexOf(char) > -1;

const regexpSpecialChars = ["/", "^", "\\", "[", "]", "(", ")", "{", "}", "?", "+", "*", ".", "|", "$"];

const executeHtmlFile = async (fileRelativeUrl, {
  cancellationToken,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  page,
  collectCoverage
}) => {
  const fileUrl = util.resolveUrl(fileRelativeUrl, projectDirectoryUrl);

  if (path.extname(fileUrl) !== ".html") {
    throw new Error(`the file to execute must use .html extension, received ${fileRelativeUrl}.`);
  }

  await util.assertFilePresence(fileUrl);
  const compileDirectoryRelativeUrl = `${outDirectoryRelativeUrl}otherwise/`;
  const compileDirectoryRemoteUrl = util.resolveUrl(compileDirectoryRelativeUrl, compileServerOrigin);
  const fileClientUrl = util.resolveUrl(fileRelativeUrl, compileDirectoryRemoteUrl);
  await page.goto(fileClientUrl, {
    timeout: 0
  });
  await page.waitForFunction(
  /* istanbul ignore next */
  () => {
    return Boolean(window.__jsenv__);
  }, [], {
    timeout: 0
  });
  let executionResult;

  try {
    executionResult = await page.evaluate(
    /* istanbul ignore next */
    () => {
      return window.__jsenv__.executionResultPromise;
    });
  } catch (e) {
    // if browser is closed due to cancellation
    // before it is able to finish evaluate we can safely ignore
    // and rethrow with current cancelError
    if (e.message.match(/^Protocol error \(.*?\): Target closed/) && cancellationToken.cancellationRequested) {
      cancellationToken.throwIfRequested();
    }

    throw e;
  }

  const {
    fileExecutionResultMap
  } = executionResult;
  const fileErrored = Object.keys(fileExecutionResultMap).find(fileRelativeUrl => {
    const fileExecutionResult = fileExecutionResultMap[fileRelativeUrl];
    return fileExecutionResult.status === "errored";
  });

  if (!collectCoverage) {
    Object.keys(fileExecutionResultMap).forEach(fileRelativeUrl => {
      delete fileExecutionResultMap[fileRelativeUrl].coverageMap;
    });
  }

  if (fileErrored) {
    const {
      exceptionSource
    } = fileExecutionResultMap[fileErrored];
    return {
      status: "errored",
      error: evalException(exceptionSource, {
        projectDirectoryUrl,
        compileServerOrigin
      }),
      namespace: fileExecutionResultMap,
      ...(collectCoverage ? {
        coverageMap: generateCoverageForPage(fileExecutionResultMap)
      } : {})
    };
  }

  return {
    status: "completed",
    namespace: fileExecutionResultMap,
    ...(collectCoverage ? {
      coverageMap: generateCoverageForPage(fileExecutionResultMap)
    } : {})
  };
};

const generateCoverageForPage = fileExecutionResultMap => {
  const coverageMap = composeCoverageMap(...Object.keys(fileExecutionResultMap).map(fileRelativeUrl => {
    return fileExecutionResultMap[fileRelativeUrl].coverageMap || {};
  }));
  return coverageMap;
};

const evalException = (exceptionSource, {
  projectDirectoryUrl,
  compileServerOrigin
}) => {
  const error = evalSource(exceptionSource);

  if (error && error instanceof Error) {
    const remoteRootRegexp = new RegExp(escapeRegexpSpecialCharacters(`${compileServerOrigin}/`), "g");
    error.stack = error.stack.replace(remoteRootRegexp, projectDirectoryUrl);
    error.message = error.message.replace(remoteRootRegexp, projectDirectoryUrl);
  }

  return error;
};

/* eslint-disable import/max-dependencies */
const chromiumSharing = createSharing();
const launchChromium = async ({
  cancellationToken = cancellation.createCancellationToken(),
  chromiumExecutablePath,
  browserServerLogLevel,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  headless = true,
  // about debug check https://github.com/microsoft/playwright/blob/master/docs/api.md#browsertypelaunchserveroptions
  debug = false,
  debugPort = 0,
  stopOnExit = true,
  share = false
}) => {
  const ressourceTracker = trackRessources();
  const sharingToken = share ? chromiumSharing.getSharingToken({
    chromiumExecutablePath,
    headless,
    debug,
    debugPort
  }) : chromiumSharing.getUniqueSharingToken();

  if (!sharingToken.isUsed()) {
    const launchOperation = launchBrowser("chromium", {
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: chromiumExecutablePath,
        ...(debug ? {
          devtools: true
        } : {}),
        args: [// https://github.com/GoogleChrome/puppeteer/issues/1834
        // https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#tips
        // "--disable-dev-shm-usage",
        ...(debug ? [`--remote-debugging-port=${debugPort}`] : [])]
      },
      stopOnExit
    });
    sharingToken.setSharedValue(launchOperation);
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue();
  ressourceTracker.registerCleanupCallback(stopUsingBrowser);
  const browser = await launchOperation;

  if (debug) {
    // https://github.com/puppeteer/puppeteer/blob/v2.0.0/docs/api.md#browserwsendpoint
    // https://chromedevtools.github.io/devtools-protocol/#how-do-i-access-the-browser-target
    const webSocketEndpoint = browser.wsEndpoint();
    const webSocketUrl = new URL(webSocketEndpoint);
    const browserEndpoint = `http://${webSocketUrl.host}/json/version`;
    const browserResponse = await fetchUrl(browserEndpoint, {
      cancellationToken,
      ignoreHttpsError: true
    });
    const {
      valid,
      message
    } = await validateResponseStatusIsOk(browserResponse);

    if (!valid) {
      throw new Error(message);
    }

    const browserResponseObject = JSON.parse(browserResponse.body);
    const {
      webSocketDebuggerUrl
    } = browserResponseObject;
    console.log(`Debugger listening on ${webSocketDebuggerUrl}`);
  }

  return {
    browser,
    name: "chromium",
    version: "82.0.4057.0",
    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      cancellationToken,
      ressourceTracker,
      browserServerLogLevel,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin
    })
  };
};
const launchChromiumTab = namedArgs => launchChromium({
  share: true,
  ...namedArgs
});
const firefoxSharing = createSharing();
const launchFirefox = async ({
  cancellationToken = cancellation.createCancellationToken(),
  firefoxExecutablePath,
  browserServerLogLevel,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  headless = true,
  stopOnExit = true,
  share = false
}) => {
  const ressourceTracker = trackRessources();
  const sharingToken = share ? firefoxSharing.getSharingToken({
    firefoxExecutablePath,
    headless
  }) : firefoxSharing.getUniqueSharingToken();

  if (!sharingToken.isUsed()) {
    const launchOperation = launchBrowser("firefox", {
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: firefoxExecutablePath
      },
      stopOnExit
    });
    sharingToken.setSharedValue(launchOperation);
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue();
  ressourceTracker.registerCleanupCallback(stopUsingBrowser);
  const browser = await launchOperation;
  return {
    browser,
    name: "firefox",
    version: "73.0b13",
    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      cancellationToken,
      ressourceTracker,
      browserServerLogLevel,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin
    })
  };
};
const launchFirefoxTab = namedArgs => launchFirefox({
  share: true,
  ...namedArgs
});
const webkitSharing = createSharing();
const launchWebkit = async ({
  cancellationToken = cancellation.createCancellationToken(),
  webkitExecutablePath,
  browserServerLogLevel,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  headless = true,
  stopOnExit = true,
  share = false
}) => {
  const ressourceTracker = trackRessources();
  const sharingToken = share ? webkitSharing.getSharingToken({
    webkitExecutablePath,
    headless
  }) : webkitSharing.getUniqueSharingToken();

  if (!sharingToken.isUsed()) {
    const launchOperation = launchBrowser("webkit", {
      cancellationToken,
      ressourceTracker,
      options: {
        headless,
        executablePath: webkitExecutablePath
      },
      stopOnExit
    });
    sharingToken.setSharedValue(launchOperation);
  }

  const [launchOperation, stopUsingBrowser] = sharingToken.useSharedValue();
  ressourceTracker.registerCleanupCallback(stopUsingBrowser);
  const browser = await launchOperation;
  return {
    browser,
    name: "webkit",
    version: "13.0.4",
    stop: ressourceTracker.cleanup,
    ...browserToRuntimeHooks(browser, {
      cancellationToken,
      ressourceTracker,
      browserServerLogLevel,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin
    })
  };
};
const launchWebkitTab = namedArgs => launchWebkit({
  share: true,
  ...namedArgs
});

const launchBrowser = async (browserName, {
  cancellationToken,
  ressourceTracker,
  options,
  stopOnExit
}) => {
  // eslint-disable-next-line import/no-dynamic-require
  const browserClass = require$1(`playwright-${browserName}`)[browserName];

  const launchOperation = cancellation.createStoppableOperation({
    cancellationToken,
    start: async () => {
      if (stopOnExit) {
        const unregisterProcessTeardown = nodeSignals.teardownSignal.addCallback(reason => {
          unregisterProcessTeardown();
          launchOperation.stop(`process ${reason}`);
        });
        ressourceTracker.registerCleanupCallback(unregisterProcessTeardown);
        cancellationToken.register(unregisterProcessTeardown);
      }

      try {
        const browser = await browserClass.launch({ ...options,
          // let's handle them to close properly browser + remove listener
          // instead of relying on playwright to do so
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false
        });
        return browser;
      } catch (e) {
        if (cancellationToken.cancellationRequested && isTargetClosedError(e)) {
          return e;
        }

        throw e;
      }
    },
    stop: async browser => {
      const disconnected = browser.isConnected() ? new Promise(resolve => {
        const disconnectedCallback = () => {
          browser.removeListener("disconnected", disconnectedCallback);
          resolve();
        };

        browser.on("disconnected", disconnectedCallback);
      }) : Promise.resolve(); // for some reason without this 100ms timeout
      // browser.close() never resolves (playwright does not like something)

      await new Promise(resolve => setTimeout(resolve, 100));
      await browser.close();
      await disconnected;
    }
  });
  ressourceTracker.registerCleanupCallback(launchOperation.stop);
  return launchOperation;
};

const browserToRuntimeHooks = (browser, {
  cancellationToken,
  ressourceTracker,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin
}) => {
  const disconnected = new Promise(resolve => {
    // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-disconnected
    browser.on("disconnected", resolve);
  });
  const errorCallbackArray = [];

  const registerErrorCallback = callback => {
    errorCallbackArray.push(callback);
  };

  const consoleCallbackArray = [];

  const registerConsoleCallback = callback => {
    consoleCallbackArray.push(callback);
  };

  const executeFile = async (fileRelativeUrl, {
    // because we use a self signed certificate
    collectCoverage,
    ignoreHTTPSErrors = true
  }) => {
    // open a tab to execute to the file
    const browserContext = await browser.newContext({
      ignoreHTTPSErrors
    });
    const page = await browserContext.newPage();
    ressourceTracker.registerCleanupCallback(async () => {
      try {
        await browserContext.close();
      } catch (e) {
        if (isTargetClosedError(e)) {
          return;
        }

        throw e;
      }
    }); // track tab error and console

    const stopTrackingToNotify = trackPageToNotify(page, {
      onError: error => {
        errorCallbackArray.forEach(callback => {
          callback(error);
        });
      },
      onConsole: ({
        type,
        text
      }) => {
        consoleCallbackArray.forEach(callback => {
          callback({
            type,
            text
          });
        });
      }
    });
    ressourceTracker.registerCleanupCallback(stopTrackingToNotify);
    return executeHtmlFile(fileRelativeUrl, {
      cancellationToken,
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      compileServerOrigin,
      page,
      collectCoverage
    });
  };

  return {
    disconnected,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile
  };
};

const isTargetClosedError = error => {
  if (error.message.match(/Protocol error \(.*?\): Target closed/)) {
    return true;
  }

  if (error.message.match(/Protocol error \(.*?\): Browser.*?closed/)) {
    return true;
  }

  return false;
};

const supportsDynamicImport = util.memoize(async () => {
  const fileUrl = util.resolveUrl("./src/internal/dynamicImportSource.js", jsenvCoreDirectoryUrl);
  const filePath = util.urlToFileSystemPath(fileUrl);
  const fileAsString = String(fs.readFileSync(filePath));

  try {
    return await evalSource$1(fileAsString, filePath);
  } catch (e) {
    return false;
  }
});

const evalSource$1 = (code, filePath) => {
  const script = new vm.Script(code, {
    filename: filePath
  });
  return script.runInThisContext();
};

const getCommandArgument = (argv, name) => {
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === name) {
      return {
        name,
        index: i,
        value: ""
      };
    }

    if (arg.startsWith(`${name}=`)) {
      return {
        name,
        index: i,
        value: arg.slice(`${name}=`.length)
      };
    }

    i++;
  }

  return null;
};
const removeCommandArgument = (argv, name) => {
  const argvCopy = argv.slice();
  const arg = getCommandArgument(argv, name);

  if (arg) {
    argvCopy.splice(arg.index, 1);
  }

  return argvCopy;
};

const AVAILABLE_DEBUG_MODE = ["none", "inherit", "inspect", "inspect-brk", "debug", "debug-brk"];
const createChildExecArgv = async ({
  cancellationToken = cancellation.createCancellationToken(),
  // https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_automatically-attach-debugger-to-nodejs-subprocesses
  processExecArgv = process.execArgv,
  processDebugPort = process.debugPort,
  debugPort = 0,
  debugMode = "inherit",
  debugModeInheritBreak = true,
  traceWarnings = "inherit",
  unhandledRejection = "inherit",
  jsonModules = "inherit"
} = {}) => {
  if (typeof debugMode === "string" && AVAILABLE_DEBUG_MODE.indexOf(debugMode) === -1) {
    throw new TypeError(logger.createDetailedMessage(`unexpected debug mode.`, {
      ["debug mode"]: debugMode,
      ["allowed debug mode"]: AVAILABLE_DEBUG_MODE
    }));
  }

  let childExecArgv = processExecArgv.slice();
  const {
    debugModeArg,
    debugPortArg
  } = getCommandDebugArgs(processExecArgv);
  let childDebugMode;

  if (debugMode === "inherit") {
    if (debugModeArg) {
      childDebugMode = debugModeArg.name.slice(2);

      if (debugModeInheritBreak === false) {
        if (childDebugMode === "--debug-brk") childDebugMode = "--debug";
        if (childDebugMode === "--inspect-brk") childDebugMode = "--inspect";
      }
    } else {
      childDebugMode = "none";
    }
  } else {
    childDebugMode = debugMode;
  }

  if (childDebugMode === "none") {
    // remove debug mode or debug port arg
    if (debugModeArg) {
      childExecArgv = removeCommandArgument(childExecArgv, debugModeArg.name);
    }

    if (debugPortArg) {
      childExecArgv = removeCommandArgument(childExecArgv, debugPortArg.name);
    }
  } else {
    // this is required because vscode does not
    // support assigning a child spwaned without a specific port
    const childDebugPort = debugPort === 0 ? await server.findFreePort(processDebugPort + 1, {
      cancellationToken
    }) : debugPort; // remove process debugMode, it will be replaced with the child debugMode

    const childDebugModeArgName = `--${childDebugMode}`;

    if (debugPortArg) {
      // replace the debug port arg
      const childDebugPortArgFull = `--${childDebugMode}-port${portToArgValue(childDebugPort)}`;
      childExecArgv[debugPortArg.index] = childDebugPortArgFull; // replace debug mode or create it (would be strange to have to create it)

      if (debugModeArg) {
        childExecArgv[debugModeArg.index] = childDebugModeArgName;
      } else {
        childExecArgv.push(childDebugModeArgName);
      }
    } else {
      const childDebugArgFull = `${childDebugModeArgName}${portToArgValue(childDebugPort)}`; // replace debug mode for child

      if (debugModeArg) {
        childExecArgv[debugModeArg.index] = childDebugArgFull;
      } // add debug mode to child
      else {
          childExecArgv.push(childDebugArgFull);
        }
    }
  }

  if (traceWarnings !== "inherit") {
    const traceWarningsArg = getCommandArgument(childExecArgv, "--trace-warnings");

    if (traceWarnings && !traceWarningsArg) {
      childExecArgv.push("--trace-warnings");
    } else if (!traceWarnings && traceWarningsArg) {
      childExecArgv.splice(traceWarningsArg.index, 1);
    }
  } // https://nodejs.org/api/cli.html#cli_unhandled_rejections_mode


  if (unhandledRejection !== "inherit") {
    const unhandledRejectionArg = getCommandArgument(childExecArgv, "--unhandled-rejections");

    if (unhandledRejection && !unhandledRejectionArg) {
      childExecArgv.push(`--unhandled-rejections=${unhandledRejection}`);
    } else if (unhandledRejection && unhandledRejectionArg) {
      childExecArgv[unhandledRejectionArg.index] = `--unhandled-rejections=${unhandledRejection}`;
    } else if (!unhandledRejection && unhandledRejectionArg) {
      childExecArgv.splice(unhandledRejectionArg.index, 1);
    }
  } // https://nodejs.org/api/cli.html#cli_experimental_json_modules


  if (jsonModules !== "inherit") {
    const jsonModulesArg = getCommandArgument(childExecArgv, "--experimental-json-modules");

    if (jsonModules && !jsonModulesArg) {
      childExecArgv.push(`--experimental-json-modules`);
    } else if (!jsonModules && jsonModulesArg) {
      childExecArgv.splice(jsonModulesArg.index, 1);
    }
  }

  return childExecArgv;
};

const portToArgValue = port => {
  if (typeof port !== "number") return "";
  if (port === 0) return "";
  return `=${port}`;
}; // https://nodejs.org/en/docs/guides/debugging-getting-started/


const getCommandDebugArgs = argv => {
  const inspectArg = getCommandArgument(argv, "--inspect");

  if (inspectArg) {
    return {
      debugModeArg: inspectArg,
      debugPortArg: getCommandArgument(argv, "--inspect-port")
    };
  }

  const inspectBreakArg = getCommandArgument(argv, "--inspect-brk");

  if (inspectBreakArg) {
    return {
      debugModeArg: inspectBreakArg,
      debugPortArg: getCommandArgument(argv, "--inspect-port")
    };
  }

  const debugArg = getCommandArgument(argv, "--debug");

  if (debugArg) {
    return {
      debugModeArg: debugArg,
      debugPortArg: getCommandArgument(argv, "--debug-port")
    };
  }

  const debugBreakArg = getCommandArgument(argv, "--debug-brk");

  if (debugBreakArg) {
    return {
      debugModeArg: debugBreakArg,
      debugPortArg: getCommandArgument(argv, "--debug-port")
    };
  }

  return {};
};

/* eslint-disable import/max-dependencies */

const killProcessTree = require$1("tree-kill");

const EVALUATION_STATUS_OK = "evaluation-ok"; // https://nodejs.org/api/process.html#process_signal_events

const SIGINT_SIGNAL_NUMBER = 2;
const SIGABORT_SIGNAL_NUMBER = 6;
const SIGTERM_SIGNAL_NUMBER = 15;
const SIGINT_EXIT_CODE = 128 + SIGINT_SIGNAL_NUMBER;
const SIGABORT_EXIT_CODE = 128 + SIGABORT_SIGNAL_NUMBER;
const SIGTERM_EXIT_CODE = 128 + SIGTERM_SIGNAL_NUMBER; // http://man7.org/linux/man-pages/man7/signal.7.html
// https:// github.com/nodejs/node/blob/1d9511127c419ec116b3ddf5fc7a59e8f0f1c1e4/lib/internal/child_process.js#L472

const GRACEFUL_STOP_SIGNAL = "SIGTERM";
const STOP_SIGNAL = "SIGKILL"; // it would be more correct if GRACEFUL_STOP_FAILED_SIGNAL was SIGHUP instead of SIGKILL.
// but I'm not sure and it changes nothing so just use SIGKILL

const GRACEFUL_STOP_FAILED_SIGNAL = "SIGKILL";
const launchNode = async ({
  cancellationToken = cancellation.createCancellationToken(),
  logger: logger$1,
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,
  debugPort,
  debugMode,
  debugModeInheritBreak,
  traceWarnings,
  unhandledRejection,
  jsonModules,
  env,
  remap = true,
  collectCoverage = false
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`);
  }

  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`);
  }

  if (typeof outDirectoryRelativeUrl !== "string") {
    throw new TypeError(`outDirectoryRelativeUrl must be a string, got ${outDirectoryRelativeUrl}`);
  }

  if (env === undefined) {
    env = { ...process.env
    };
  } else if (typeof env !== "object") {
    throw new TypeError(`env must be an object, got ${env}`);
  }

  const dynamicImportSupported = await supportsDynamicImport();
  const nodeControllableFileUrl = util.resolveUrl(dynamicImportSupported ? "./src/internal/node-launcher/nodeControllableFile.js" : "./src/internal/node-launcher/nodeControllableFile.cjs", jsenvCoreDirectoryUrl);
  await util.assertFilePresence(nodeControllableFileUrl);
  const execArgv = await createChildExecArgv({
    cancellationToken,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    traceWarnings,
    unhandledRejection,
    jsonModules
  });
  env.COVERAGE_ENABLED = collectCoverage;
  env.JSENV = true;
  const childProcess = child_process.fork(util.urlToFileSystemPath(nodeControllableFileUrl), {
    execArgv,
    // silent: true
    stdio: "pipe",
    env
  });
  logger$1.debug(`${process.argv[0]} ${execArgv.join(" ")} ${util.urlToFileSystemPath(nodeControllableFileUrl)}`);
  const childProcessReadyPromise = new Promise(resolve => {
    onceProcessMessage(childProcess, "ready", resolve);
  });
  const consoleCallbackArray = [];

  const registerConsoleCallback = callback => {
    consoleCallbackArray.push(callback);
  };

  installProcessOutputListener(childProcess, ({
    type,
    text
  }) => {
    consoleCallbackArray.forEach(callback => {
      callback({
        type,
        text
      });
    });
  }); // keep listening process outputs while child process is killed to catch
  // outputs until it's actually disconnected
  // registerCleanupCallback(removeProcessOutputListener)

  const errorCallbackArray = [];

  const registerErrorCallback = callback => {
    errorCallbackArray.push(callback);
  };

  let killing = false;
  installProcessErrorListener(childProcess, error => {
    if (!childProcess.connected && error.code === "ERR_IPC_DISCONNECTED") {
      return;
    } // on windows killProcessTree uses taskkill which seems to kill the process
    // with an exitCode of 1


    if (process.platform === "win32" && killing && error.exitCode === 1) {
      return;
    }

    errorCallbackArray.forEach(callback => {
      callback(error);
    });
  }); // keep listening process errors while child process is killed to catch
  // errors until it's actually disconnected
  // registerCleanupCallback(removeProcessErrorListener)
  // https://nodejs.org/api/child_process.html#child_process_event_disconnect

  let resolveDisconnect;
  const disconnected = new Promise(resolve => {
    resolveDisconnect = resolve;
    onceProcessMessage(childProcess, "disconnect", () => {
      resolve();
    });
  }); // child might exit without disconnect apparently, exit is disconnect for us

  childProcess.once("exit", () => {
    disconnectChildProcess();
  });

  const disconnectChildProcess = () => {
    try {
      childProcess.disconnect();
    } catch (e) {
      if (e.code === "ERR_IPC_DISCONNECTED") {
        resolveDisconnect();
      } else {
        throw e;
      }
    }

    return disconnected;
  };

  const killChildProcess = async ({
    signal
  }) => {
    killing = true;
    logger$1.debug(`send ${signal} to child process with pid ${childProcess.pid}`);
    await new Promise(resolve => {
      killProcessTree(childProcess.pid, signal, error => {
        if (error) {
          // on windows: process with pid cannot be found
          if (error.stack.includes(`The process "${childProcess.pid}" not found`)) {
            resolve();
            return;
          } // on windows: child process with a pid cannot be found


          if (error.stack.includes("Reason: There is no running instance of the task")) {
            resolve();
            return;
          } // windows too


          if (error.stack.includes("The operation attempted is not supported")) {
            resolve();
            return;
          }

          logger$1.error(logger.createDetailedMessage(`error while killing process tree with ${signal}`, {
            ["error stack"]: error.stack,
            ["process.pid"]: childProcess.pid
          })); // even if we could not kill the child
          // we will ask it to disconnect

          resolve();
          return;
        }

        resolve();
      });
    }); // in case the child process did not disconnect by itself at this point
    // something is keeping it alive and it cannot be propely killed
    // disconnect it manually.
    // something inside makeProcessControllable.cjs ensure process.exit()
    // when the child process is disconnected.

    return disconnectChildProcess();
  };

  const stop = ({
    gracefulFailed
  } = {}) => {
    return killChildProcess({
      signal: gracefulFailed ? GRACEFUL_STOP_FAILED_SIGNAL : STOP_SIGNAL
    });
  };

  const gracefulStop = () => {
    return killChildProcess({
      signal: GRACEFUL_STOP_SIGNAL
    });
  };

  const executeFile = async (fileRelativeUrl, {
    collectCoverage,
    executionId
  }) => {
    const execute = async () => {
      return new Promise(async (resolve, reject) => {
        onceProcessMessage(childProcess, "evaluate-result", ({
          status,
          value
        }) => {
          logger$1.debug(logger.createDetailedMessage(`child process sent the following evaluation result.`, {
            status,
            value
          }));
          if (status === EVALUATION_STATUS_OK) resolve(value);else reject(value);
        });
        const executeParams = {
          jsenvCoreDirectoryUrl,
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          fileRelativeUrl,
          compileServerOrigin,
          collectCoverage,
          executionId,
          remap
        };
        const source = await generateSourceToEvaluate({
          dynamicImportSupported,
          cancellationToken,
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin,
          executeParams
        });
        logger$1.debug(logger.createDetailedMessage(`ask child process to evaluate`, {
          source
        }));
        await childProcessReadyPromise;

        try {
          await sendToProcess(childProcess, "evaluate", source);
        } catch (e) {
          logger$1.error(logger.createDetailedMessage(`error while sending message to child`, {
            ["error stack"]: e.stack
          }));
          throw e;
        }
      });
    };

    const executionResult = await execute();
    const {
      status
    } = executionResult;

    if (status === "errored") {
      const {
        exceptionSource,
        coverageMap
      } = executionResult;
      return {
        status,
        error: evalException$1(exceptionSource, {
          compileServerOrigin,
          projectDirectoryUrl
        }),
        coverageMap
      };
    }

    const {
      namespace,
      coverageMap
    } = executionResult;
    return {
      status,
      namespace,
      coverageMap
    };
  };

  return {
    name: "node",
    version: process.version.slice(1),
    options: {
      execArgv // for now do not pass env, it make debug logs to verbose
      // because process.env is very big
      // env,

    },
    gracefulStop,
    stop,
    disconnected,
    registerErrorCallback,
    registerConsoleCallback,
    executeFile
  };
};

const evalException$1 = (exceptionSource, {
  compileServerOrigin,
  projectDirectoryUrl
}) => {
  const error = evalSource$2(exceptionSource);

  if (error && error instanceof Error) {
    const compileServerOriginRegexp = new RegExp(escapeRegexpSpecialCharacters(`${compileServerOrigin}/`), "g"); // const serverUrlRegExp = new RegExp(
    //   `(${escapeRegexpSpecialCharacters(`${compileServerOrigin}/`)}[^\\s]+)`,
    //   "g",
    // )

    error.message = error.message.replace(compileServerOriginRegexp, projectDirectoryUrl);
    error.stack = error.stack.replace(compileServerOriginRegexp, projectDirectoryUrl); // const projectDirectoryPath = urlToFileSystemPath(projectDirectoryUrl)
    // const projectDirectoryPathRegexp = new RegExp(
    //   `(?<!file:\/\/)${escapeRegexpSpecialCharacters(projectDirectoryPath)}`,
    //   "g",
    // )
    // error.stack = error.stack.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
    // error.message = error.message.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
  }

  return error;
};

const sendToProcess = async (childProcess, type, data) => {
  const source = _uneval.uneval(data, {
    functionAllowed: true
  });
  return new Promise((resolve, reject) => {
    childProcess.send({
      type,
      data: source
    }, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const installProcessOutputListener = (childProcess, callback) => {
  // beware that we may receive ansi output here, should not be a problem but keep that in mind
  const stdoutDataCallback = chunk => {
    callback({
      type: "log",
      text: String(chunk)
    });
  };

  childProcess.stdout.on("data", stdoutDataCallback);

  const stdErrorDataCallback = chunk => {
    callback({
      type: "error",
      text: String(chunk)
    });
  };

  childProcess.stderr.on("data", stdErrorDataCallback);
  return () => {
    childProcess.stdout.removeListener("data", stdoutDataCallback);
    childProcess.stderr.removeListener("data", stdoutDataCallback);
  };
};

const installProcessErrorListener = (childProcess, callback) => {
  // https://nodejs.org/api/child_process.html#child_process_event_error
  const errorListener = error => {
    removeExitListener(); // if an error occured we ignore the child process exitCode

    callback(error);
    onceProcessMessage(childProcess, "error", errorListener);
  };

  const removeErrorListener = onceProcessMessage(childProcess, "error", errorListener); // process.exit(1) in child process or process.exitCode = 1 + process.exit()
  // means there was an error even if we don't know exactly what.

  const removeExitListener = onceProcessEvent(childProcess, "exit", code => {
    if (code !== null && code !== 0 && code !== SIGINT_EXIT_CODE && code !== SIGTERM_EXIT_CODE && code !== SIGABORT_EXIT_CODE) {
      removeErrorListener();
      callback(createExitWithFailureCodeError(code));
    }
  });
  return () => {
    removeErrorListener();
    removeExitListener();
  };
};

const createExitWithFailureCodeError = code => {
  if (code === 12) {
    return new Error(`child exited with 12: forked child wanted to use a non available port for debug`);
  }

  const error = new Error(`child exited with ${code}`);
  error.exitCode = code;
  return error;
};

const onceProcessMessage = (childProcess, type, callback) => {
  return onceProcessEvent(childProcess, "message", message => {
    if (message.type === type) {
      // eslint-disable-next-line no-eval
      callback(message.data ? eval(`(${message.data})`) : "");
    }
  });
};

const onceProcessEvent = (childProcess, type, callback) => {
  childProcess.on(type, callback);
  return () => {
    childProcess.removeListener(type, callback);
  };
};

const generateSourceToEvaluate = async ({
  dynamicImportSupported,
  executeParams
}) => {
  if (dynamicImportSupported) {
    return `import { execute } from ${JSON.stringify(jsenvNodeSystemUrl)}

export default execute(${JSON.stringify(executeParams, null, "    ")})`;
  } // The compiled nodeRuntime file will be somewhere else in the filesystem
  // than the original nodeRuntime file.
  // It is important for the compiled file to be able to require
  // node modules that original file could access
  // hence the requireCompiledFileAsOriginalFile


  return `(() => {
  const { readFileSync } = require("fs")
  const Module = require('module')
  const { dirname } = require("path")

  const run = async () => {
    const nodeFilePath = ${JSON.stringify(util.urlToFileSystemPath(jsenvNodeSystemBuildUrl))}
    const { execute } = requireCompiledFileAsOriginalFile(nodeFilePath, nodeFilePath)

    return execute(${JSON.stringify(executeParams, null, "    ")})
  }

  const requireCompiledFileAsOriginalFile = (compiledFilePath, originalFilePath) => {
    const fileContent = String(readFileSync(compiledFilePath))
    const moduleObject = new Module(compiledFilePath)
    moduleObject.paths = Module._nodeModulePaths(dirname(originalFilePath))
    moduleObject._compile(fileContent, compiledFilePath)
    return moduleObject.exports
  }

  return {
    default: run()
  }
})()`;
};

const evalSource$2 = (code, href) => {
  const script = new vm.Script(code, {
    filename: href
  });
  return script.runInThisContext();
};

const startExploring = async ({
  cancellationToken = cancellation.createCancellationTokenForProcess(),
  explorableConfig = jsenvExplorableConfig,
  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  outDirectoryName,
  toolbar = true,
  livereloading = true,
  importMetaDev = true,
  importMetaEnvFileRelativeUrlForExploring = "env.dev.js",
  ...rest
}) => {
  return executeJsenvAsyncFunction(async () => {
    projectDirectoryUrl = assertProjectDirectoryUrl({
      projectDirectoryUrl
    });
    await assertProjectDirectoryExists({
      projectDirectoryUrl
    });
    const outDirectoryRelativeUrl = computeOutDirectoryRelativeUrl({
      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      outDirectoryName
    });
    const jsenvToolbarInjectorBuildRelativeUrlForProject = util.urlToRelativeUrl(jsenvToolbarInjectorBuildUrl, projectDirectoryUrl);
    const redirectFiles = createRedirectFilesService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl
    });
    const serveExploringData = createExploringDataService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      explorableConfig
    });
    const serveExplorableListAsJson = createExplorableListAsJsonService({
      projectDirectoryUrl,
      outDirectoryRelativeUrl,
      explorableConfig
    });
    const compileServer = await startCompileServer({
      cancellationToken,
      projectDirectoryUrl,
      keepProcessAlive: true,
      cors: true,
      livereloadSSE: livereloading,
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
      stopOnPackageVersionChange: true,
      watchAndSyncImportMap: true,
      compileGroupCount: 2,
      scriptInjections: [...(toolbar ? [{
        src: `/${jsenvToolbarInjectorBuildRelativeUrlForProject}`
      }] : [])],
      customServices: {
        "service:exploring-redirect": request => redirectFiles(request),
        "service:exploring-data": request => serveExploringData(request),
        "service:explorables": request => serveExplorableListAsJson(request)
      },
      jsenvDirectoryRelativeUrl,
      outDirectoryName,
      importMetaDev,
      importMetaEnvFileRelativeUrl: importMetaEnvFileRelativeUrlForExploring,
      ...rest
    });
    return compileServer;
  });
};

const createRedirectFilesService = ({
  projectDirectoryUrl
}) => {
  const jsenvExploringRedirectorHtmlRelativeUrlForProject = util.urlToRelativeUrl(jsenvExploringRedirectorHtmlUrl, projectDirectoryUrl);
  const jsenvExploringRedirectorJsBuildRelativeUrlForProject = util.urlToRelativeUrl(jsenvExploringRedirectorJsBuildUrl, projectDirectoryUrl);
  const jsenvExploringJsBuildRelativeUrlForProject = util.urlToRelativeUrl(jsenvExploringIndexJsBuildUrl, projectDirectoryUrl);
  const jsenvToolbarJsBuildRelativeUrlForProject = util.urlToRelativeUrl(jsenvToolbarJsBuildUrl, projectDirectoryUrl);
  return request => {
    // exploring redirection
    if (request.ressource === "/") {
      const jsenvExploringRedirectorHtmlServerUrl = `${request.origin}/${jsenvExploringRedirectorHtmlRelativeUrlForProject}`;
      return {
        status: 307,
        headers: {
          location: jsenvExploringRedirectorHtmlServerUrl
        }
      };
    }

    if (request.ressource === "/.jsenv/exploring.redirector.js") {
      const jsenvExploringRedirectorBuildServerUrl = `${request.origin}/${jsenvExploringRedirectorJsBuildRelativeUrlForProject}`;
      return {
        status: 307,
        headers: {
          location: jsenvExploringRedirectorBuildServerUrl
        }
      };
    } // exploring index


    if (request.ressource === "/.jsenv/exploring.index.js") {
      const jsenvExploringJsBuildServerUrl = `${request.origin}/${jsenvExploringJsBuildRelativeUrlForProject}`;
      return {
        status: 307,
        headers: {
          location: jsenvExploringJsBuildServerUrl
        }
      };
    } // toolbar


    if (request.ressource === "/.jsenv/toolbar.main.js") {
      const jsenvToolbarJsBuildServerUrl = `${request.origin}/${jsenvToolbarJsBuildRelativeUrlForProject}`;
      return {
        status: 307,
        headers: {
          location: jsenvToolbarJsBuildServerUrl
        }
      };
    } // unfortunately browser don't resolve sourcemap to url after redirection
    // but to url before. It means browser tries to load source map from
    // "/.jsenv/jsenv-toolbar.js.map"
    // we could also inline sourcemap but it's not yet possible
    // inside buildProject


    if (request.ressource === "/.jsenv/jsenv-toolbar.js.map") {
      const jsenvToolbarJsBuildSourcemapServerUrl = `${request.origin}/${jsenvToolbarJsBuildRelativeUrlForProject}.map`;
      return {
        status: 307,
        headers: {
          location: jsenvToolbarJsBuildSourcemapServerUrl
        }
      };
    }

    return null;
  };
};

const createExploringDataService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  explorableConfig
}) => {
  return request => {
    if (request.ressource === "/.jsenv/exploring.json" && request.method === "GET" && "x-jsenv" in request.headers) {
      const data = {
        projectDirectoryUrl,
        outDirectoryRelativeUrl,
        jsenvDirectoryRelativeUrl: util.urlToRelativeUrl(jsenvCoreDirectoryUrl, projectDirectoryUrl),
        exploringHtmlFileRelativeUrl: util.urlToRelativeUrl(jsenvExploringIndexHtmlUrl, projectDirectoryUrl),
        sourcemapMainFileRelativeUrl: util.urlToRelativeUrl(sourcemapMainFileUrl, jsenvCoreDirectoryUrl),
        sourcemapMappingFileRelativeUrl: util.urlToRelativeUrl(sourcemapMappingFileUrl, jsenvCoreDirectoryUrl),
        explorableConfig
      };
      const json = JSON.stringify(data);
      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(json)
        },
        body: json
      };
    }

    return null;
  };
};

const createExplorableListAsJsonService = ({
  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  explorableConfig
}) => {
  return async request => {
    if (request.ressource === "/.jsenv/explorables.json" && request.method === "GET" && "x-jsenv" in request.headers) {
      const structuredMetaMapRelativeForExplorable = {};
      Object.keys(explorableConfig).forEach(explorableGroup => {
        const explorableGroupConfig = explorableConfig[explorableGroup];
        structuredMetaMapRelativeForExplorable[explorableGroup] = {
          "**/.jsenv/": false,
          // temporary (in theory) to avoid visting .jsenv directory in jsenv itself
          ...explorableGroupConfig,
          [outDirectoryRelativeUrl]: false
        };
      });
      const structuredMetaMapForExplorable = util.normalizeStructuredMetaMap(structuredMetaMapRelativeForExplorable, projectDirectoryUrl);
      const matchingFileResultArray = await util.collectFiles({
        directoryUrl: projectDirectoryUrl,
        structuredMetaMap: structuredMetaMapForExplorable,
        predicate: meta => Object.keys(meta).some(explorableGroup => Boolean(meta[explorableGroup]))
      });
      const explorableFiles = matchingFileResultArray.map(({
        relativeUrl,
        meta
      }) => ({
        relativeUrl,
        meta
      }));
      const json = JSON.stringify(explorableFiles);
      return {
        status: 200,
        headers: {
          "cache-control": "no-store",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(json)
        },
        body: json
      };
    }

    return null;
  };
};

exports.buildProject = buildProject;
exports.convertCommonJsWithBabel = convertCommonJsWithBabel;
exports.convertCommonJsWithRollup = convertCommonJsWithRollup;
exports.execute = execute;
exports.executeTestPlan = executeTestPlan;
exports.getBabelPluginMapForNode = getBabelPluginMapForNode;
exports.jsenvBabelPluginCompatMap = jsenvBabelPluginCompatMap;
exports.jsenvBabelPluginMap = jsenvBabelPluginMap;
exports.jsenvBrowserScoreMap = jsenvBrowserScoreMap;
exports.jsenvCoverageConfig = jsenvCoverageConfig;
exports.jsenvExplorableConfig = jsenvExplorableConfig;
exports.jsenvNodeVersionScoreMap = jsenvNodeVersionScoreMap;
exports.jsenvPluginCompatMap = jsenvPluginCompatMap;
exports.jsenvServiceWorkerFinalizer = jsenvServiceWorkerFinalizer;
exports.launchChromium = launchChromium;
exports.launchChromiumTab = launchChromiumTab;
exports.launchFirefox = launchFirefox;
exports.launchFirefoxTab = launchFirefoxTab;
exports.launchNode = launchNode;
exports.launchWebkit = launchWebkit;
exports.launchWebkitTab = launchWebkitTab;
exports.startExploring = startExploring;

//# sourceMappingURL=main.cjs.map