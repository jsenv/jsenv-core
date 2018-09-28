"use strict";

var _path = _interopRequireDefault(require("path"));

var _openCompileServer = require("./openCompileServer.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var rootLocation = _path.default.resolve(__dirname, "../../../");

(0, _openCompileServer.openCompileServer)({
  url: "http://127.0.0.1:8998",
  rootLocation: rootLocation
}).then(function (_ref) {
  var url = _ref.url;
  console.log("compiling ".concat(rootLocation, " at ").concat(url));
});
//# sourceMappingURL=openCompileServer.test.js.map