"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.buildGroup = void 0;

var _projectStructureCompileBabel = require("@dmail/project-structure-compile-babel");

var stringifyGroups = function stringifyGroups(groups) {
  var groupMap = {};
  groups.forEach(function (group) {
    groupMap[group.id] = {
      pluginNames: group.pluginNames,
      compatMap: group.compatMap
    };
  });
  return JSON.stringify(groupMap, null, "  ");
};

var buildGroup = function buildGroup(_ref) {
  var root = _ref.root;

  var _createGetGroupForPla = (0, _projectStructureCompileBabel.createGetGroupForPlatform)({
    moduleOutput: "systemjs"
  }),
      getGroupForPlatform = _createGetGroupForPla.getGroupForPlatform,
      getAllGroup = _createGetGroupForPla.getAllGroup;

  var groups = getAllGroup();
  var sortedGroups = groups.sort(function (a, b) {
    return a.pluginNames.length - b.pluginNames.length;
  });
  sortedGroups[0].id = "worst";
  sortedGroups.slice(1, -1).forEach(function (intermediateGroup, index) {
    intermediateGroup.id = "intermediate-".concat(index + 1);
  });
  sortedGroups[sortedGroups.length - 2].id = "best";
  sortedGroups[sortedGroups.length - 1].id = "ideal";
  (0, _projectStructureCompileBabel.writeFileFromString)("".concat(root, "/group.config.json"), stringifyGroups(groups));
  return {
    getGroupIdForPlatform: function getGroupIdForPlatform(_ref2) {
      var platformName = _ref2.platformName,
          platformVersion = _ref2.platformVersion;
      return getGroupForPlatform({
        platformName: platformName,
        platformVersion: platformVersion
      }).id;
    },
    getPluginsFromGroupId: function getPluginsFromGroupId(groupId) {
      return groups.find(function (group) {
        return group.id === groupId;
      }).plugins;
    }
  };
};

exports.buildGroup = buildGroup;
//# sourceMappingURL=buildGroup.js.map