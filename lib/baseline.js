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
    var _this = this;

    this.services = services; // hook up dependencies

    _underscore["default"].each(this.services, function (thisService) {
      thisService.baseline = _this;

      _underscore["default"].each(_this.services, function (thisOtherService, thisOtherServiceIdent) {
        thisService.setDependency(thisOtherServiceIdent, thisOtherService);
      });
    });
  },
  merge: function merge(data, defaultOptions) {
    var options = _underscore["default"].extend({}, {
      empty: false
    }, defaultOptions);

    var _this = this;

    if (data) {
      _underscore["default"].each(data, function (thisServiceData, thisServiceIdent) {
        if (_this.services[thisServiceIdent] && _underscore["default"].isFunction(_this.services[thisServiceIdent].merge)) {
          if (options.empty) _this.services[thisServiceIdent].empty();

          _this.services[thisServiceIdent].merge(thisServiceData);
        }
      });
    }
  },
  toJSON: function toJSON() {
    var json = {};

    _underscore["default"].each(this.services, function (thisService, thisServiceIdent) {
      if (_underscore["default"].isFunction(thisService.toJSON)) {
        json[thisServiceIdent] = thisService.toJSON();
      }
    });

    return json;
  }
}); // eslint-disable-next-line no-unused-vars


exports["default"] = _default;

function _isServer() {
  return typeof window === 'undefined';
}