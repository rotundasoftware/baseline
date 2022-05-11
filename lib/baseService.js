"use strict";

var Class = require('class-con-leche');

module.exports = Class.extend({
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