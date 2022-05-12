"use strict";

var _classConLeche = _interopRequireDefault(require("class-con-leche"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

module.exports = _classConLeche["default"].extend({
  initialize: function initialize() {},
  setDependency: function setDependency(name, serviceInstance) {
    if (this[name]) throw new Error('Service dependency "' + name + '" conflicts with existing property.');
    this[name] = serviceInstance;
  },
  empty: function empty() {},
  // eslint-disable-next-line no-unused-vars
  merge: function merge(data) {},
  _isServer: function _isServer() {
    return typeof window === 'undefined';
  }
});