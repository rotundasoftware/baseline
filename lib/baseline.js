"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _underscore = _interopRequireDefault(require("underscore"));

var _classConLeche = _interopRequireDefault(require("class-con-leche"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _default = _classConLeche["default"].extend({
  initialize: function initialize(services) {
    this.services = services;
    console.log(JSON.stringify(this.services)); // hook up dependencies

    for (var thisServiceIdent in this.services) {
      this.services[thisServiceIdent].baseline = this;

      for (var thisOtherServiceIdent in this.services) {
        this.services[thisServiceIdent].setDependency(thisOtherServiceIdent, this.services[thisOtherServiceIdent]);
      }
    }
  },
  merge: function merge(data, options) {
    options = _underscore["default"].extend({}, {
      empty: false
    }, options);

    if (data) {
      for (var thisServiceIdent in data) {
        if (this.services[thisServiceIdent] && _underscore["default"].isFunction(this.services[thisServiceIdent].merge)) {
          if (options.empty) this.services[thisServiceIdent].empty();
          this.services[thisServiceIdent].merge(data[thisServiceIdent]);
        }
      }
    }
  },
  toJSON: function toJSON() {
    var json = {};

    for (var thisServiceIdent in this.services) {
      var thisService = this.services[thisServiceIdent];

      if (_underscore["default"].isFunction(thisService.toJSON)) {
        json[thisServiceIdent] = thisService.toJSON();
      }
    }

    return json;
  }
}); // eslint-disable-next-line no-unused-vars


exports["default"] = _default;

function _isServer() {
  return typeof window === 'undefined';
}