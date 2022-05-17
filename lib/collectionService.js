"use strict";

var _underscore = _interopRequireDefault(require("underscore"));

var _baseService = _interopRequireDefault(require("./baseService"));

var _backboneEventsStandalone = _interopRequireDefault(require("backbone-events-standalone"));

var _nodeUuid = _interopRequireDefault(require("node-uuid"));

var _jquery = _interopRequireDefault(require("jquery"));

var _matchesWhereQuery = _interopRequireDefault(require("matches-where-query"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var CollectionService = module.exports = _baseService["default"].extend({
  initialize: function initialize(options) {
    var _this = this;

    options = _underscore["default"].defaults({}, options, {
      idFieldName: 'id',
      defaultAjaxErrorHandler: undefined,
      ajax: function ajax(options) {
        return new Promise(function (resolve) {
          _jquery["default"].ajax(options).done(function (data, textStatus, xhr) {
            resolve({
              success: true,
              xhr: xhr
            });
          }).fail(function (xhr) {
            resolve({
              success: false,
              xhr: xhr
            });
          });
        });
      }
    });
    if (_underscore["default"].isUndefined(this.collectionName)) throw new Error('The collectionName attribute must be defined on collection service instances.');
    this._idFieldName = options.idFieldName;
    this._ajax = options.ajax; // this._defaultAjaxErrorHandler = options.defaultAjaxErrorHandler;

    this.empty();

    _backboneEventsStandalone["default"].mixin(this); // Underscore methods that take a property name as an argument.


    var attributeMethods = ['groupBy', 'countBy']; // used to proxy sortBy, but unclear on use case here
    // Use attributes instead of properties.

    var _loop = function _loop() {
      var method = _attributeMethods[_i];

      CollectionService.prototype[method] = function (value, context) {
        var iterator = _underscore["default"].isFunction(value) ? value : function (thisRecordId) {
          return _this._recordsById[thisRecordId][value];
        };
        return _underscore["default"][method](_this._recordIds, iterator, context);
      };
    };

    for (var _i = 0, _attributeMethods = attributeMethods; _i < _attributeMethods.length; _i++) {
      _loop();
    }

    this._setupUnderscoreProxy();

    _baseService["default"].prototype.initialize(options);
  },
  create: function create(initialFieldValues, options) {
    options = _underscore["default"].defaults({}, options, {
      silent: false
    });
    if (!initialFieldValues) initialFieldValues = {};else initialFieldValues = this._cloneRecord(initialFieldValues);
    var newRecordId = initialFieldValues[this._idFieldName];

    if (!newRecordId) {
      initialFieldValues[this._idFieldName] = newRecordId = this._getUniqueId();
    }

    _underscore["default"].defaults(initialFieldValues, this.fields);

    this.merge([initialFieldValues]);
    this.trigger('create', initialFieldValues, options);

    this._newRecordIds.push(newRecordId);

    return newRecordId;
  },
  id: function id() {
    return this.get(this._idFieldName);
  },
  get: function get(recordId, fieldName, options) {
    options = Object.assign({
      clone: false
    }, options);
    if (!this._recordsById[recordId]) throw new Error('Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.');
    var fieldValue = this._recordsById[recordId][fieldName];
    if (options.clone) fieldValue = this._cloneFieldValue(fieldValue);
    if (_underscore["default"].isUndefined(fieldValue)) throw new Error('Field \'' + fieldName + '\' is not present for record id ' + recordId + ' in table \'' + this.collectionName + '\'.');
    return fieldValue;
  },
  gets: function gets(recordId, fields, options) {
    options = Object.assign({
      clone: false
    }, options);
    if (!this._recordsById[recordId]) throw new Error('Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.');
    if (_underscore["default"].isUndefined(fields)) fields = Object.keys(this._recordsById[recordId]);
    if (!Array.isArray(fields)) fields = Array.prototype.slice.apply(arguments, [1]);
    var values = {};

    var _iterator = _createForOfIteratorHelper(fields),
        _step;

    try {
      for (_iterator.s(); !(_step = _iterator.n()).done;) {
        var thisFieldName = _step.value;
        values[thisFieldName] = this.get(recordId, thisFieldName, {
          clone: options.clone
        });
      }
    } catch (err) {
      _iterator.e(err);
    } finally {
      _iterator.f();
    }

    return values;
  },
  // eslint-disable-next-line no-unused-vars
  set: function set(recordId, fieldName, fieldValue) {
    this.rawSet.apply(this, arguments);
  },
  sets: function sets(recordId, fields) {
    for (var thisFieldName in fields) {
      this.set(recordId, thisFieldName, fields[thisFieldName]);
    }
  },
  rawSet: function rawSet(recordId, fieldName, fieldValue) {
    if (!this._recordsById[recordId]) throw new Error('Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.');
    if (fieldName === this._idFieldName && this._recordsById[recordId][fieldName] !== fieldValue) throw new Error('Changing the id field of an existing record is not supported.'); // not sure we want to check if the data exists before setting it.. for example, we create a new record, and then want to fill
    // in fields.. of course data will not be there (unless we initilize all fields to their default values, which might make sense,
    // but jury is still out, so we will do it this way for now. we tried this more lax interpretation and doesn't seem to cause problems,
    // let's keep it as is. (The alternative would be to force setting non-present fields through merge.)
    // if( _.isUndefined( this._recordsById[ recordId ][ fieldName ] ) )
    // 	throw new Error( 'Field \'' + fieldName + '\' not present for record id ' + recordId + ' in table \'' + this.collectionName + '\'.' );

    if (_underscore["default"].isUndefined(fieldValue)) delete this._recordsById[recordId][fieldName];else this._recordsById[recordId][fieldName] = this._cloneFieldValue(fieldValue);
    if (_underscore["default"].isObject(this._recordsById[recordId][fieldName])) this._deepFreeze(this._recordsById[recordId][fieldName]);
    this.trigger('set', recordId, fieldName, fieldValue);
  },
  destroy: function destroy(recordId, options) {
    var _this2 = this;

    return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee() {
      var deleteLocally, url, result;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              options = _underscore["default"].defaults({}, options, {
                sync: true,
                ajax: {}
              });

              deleteLocally = function deleteLocally() {
                if (!_this2._recordsById[recordId]) throw new Error('Record id ' + recordId + ' is not present.');
                _this2._recordIds = _underscore["default"].without(_this2._recordIds, recordId);
                delete _this2._recordsById[recordId];
                _this2.length--;

                _this2.trigger('destroy', recordId, options);
              };

              if (!(options.sync && !_this2.isNew(recordId))) {
                _context.next = 11;
                break;
              }

              url = _this2._getRESTEndpoint('delete', recordId);
              _context.next = 6;
              return _this2._sync(url, 'DELETE', undefined, options.ajax);

            case 6:
              result = _context.sent;
              if (result.success) deleteLocally();
              return _context.abrupt("return", result);

            case 11:
              deleteLocally();
              return _context.abrupt("return", Promise.resolve({
                success: true
              }));

            case 13:
            case "end":
              return _context.stop();
          }
        }
      }, _callee);
    }))();
  },
  ids: function ids() {
    // return a copy of the ids array
    return this._recordIds.slice(0);
  },
  isPresent: function isPresent(recordId, fieldName) {
    // fieldName is optional.. if not supplied function will return true iff recordId is present
    if (_underscore["default"].isUndefined(this._recordsById[recordId])) return false;
    if (!_underscore["default"].isUndefined(fieldName) && _underscore["default"].isUndefined(this._recordsById[recordId][fieldName])) return false;
    return true;
  },
  isNew: function isNew(recordId) {
    return this._newRecordIds.includes(recordId);
  },
  empty: function empty() {
    this.length = 0;
    this._recordIds = [];
    this._recordsById = {};
    this._newRecordIds = [];
  },
  merge: function merge(newRecordDTOs) {
    if (!Array.isArray(newRecordDTOs)) newRecordDTOs = [newRecordDTOs];

    var _iterator2 = _createForOfIteratorHelper(newRecordDTOs),
        _step2;

    try {
      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
        var thisDto = _step2.value;

        this._mergeDTO(thisDto);
      }
    } catch (err) {
      _iterator2.e(err);
    } finally {
      _iterator2.f();
    }
  },
  toJSON: function toJSON(options) {
    var _this3 = this;

    options = _underscore["default"].defaults({}, options, {
      recordIds: this._recordIds,
      fields: null,
      clone: false
    });

    if (options.recordIds === this._recordIds && !options.clone && !options.fields) {
      // optimization for simplest case
      return Object.values(this._recordsById);
    } else if (options.fields) {
      return options.recordIds.map(function (thisRecordId) {
        if (!_this3.isPresent(thisRecordId)) throw new Error('Record id ' + thisRecordId + ' is not present.');
        return _this3._cloneRecord(_underscore["default"].pick(_this3._recordsById[thisRecordId], options.fields));
      });
    } else {
      return options.recordIds.map(function (thisRecordId) {
        if (!_this3.isPresent(thisRecordId)) throw new Error('Record id ' + thisRecordId + ' is not present.');
        return _this3._cloneRecord(_this3._recordsById[thisRecordId]);
      });
    }
  },
  fetch: function fetch(recordId, options) {
    var _this4 = this;

    return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2() {
      var url, result;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              options = _underscore["default"].defaults({}, options, {
                variablePartsOfEndpoint: {},
                ajax: {}
              });
              url = _this4._getRESTEndpoint('get', recordId, options.variablePartsOfEndpoint);
              _context2.next = 4;
              return _this4._sync(url, 'GET', null, options.ajax);

            case 4:
              result = _context2.sent;
              if (result.success) _this4._mergeDTO(result.data);
              return _context2.abrupt("return", result);

            case 7:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2);
    }))();
  },
  save: function save(recordId, options) {
    var _this5 = this;

    return _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3() {
      var method, isUpdate, url, dto, result;
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              options = _underscore["default"].defaults({}, options, {
                merge: true,
                ajax: {}
              });
              method = _this5.isNew(recordId) ? 'create' : 'update';
              isUpdate = !_this5.isNew(recordId);
              url = _this5._getRESTEndpoint(method, recordId);
              dto = _this5._recordToDTO(recordId, method);
              _context3.next = 7;
              return _this5._sync(url, isUpdate ? 'PUT' : 'POST', dto, options.ajax);

            case 7:
              result = _context3.sent;

              if (result.success) {
                if (!isUpdate) _this5._newRecordIds = _underscore["default"].without(_this5._newRecordIds, recordId);
                if (options.merge) _this5._mergeDTO(result.data);

                _this5.trigger('save', recordId, isUpdate, options);
              }

              return _context3.abrupt("return", result);

            case 10:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3);
    }))();
  },
  // Return records with matching attributes. Useful for simple cases of
  // `filter`. Unlike in underscore, if values of attrs is an array, then
  // a record will be included in the return if the corresponding attribute
  // on the record is included in the elements of attrs.
  where: function where(attrs, options) {
    var _this6 = this;

    options = _underscore["default"].defaults({}, options, {
      first: false,
      ignoreMissingData: false
    });

    if (_underscore["default"].isEmpty(attrs)) {
      return options.first ? void 0 : [];
    }

    return this[options.first ? 'find' : 'filter'](function (thisRecordId) {
      if (!options.ignoreMissingData) {
        for (var key in attrs) {
          if (_underscore["default"].isUndefined(_this6._recordsById[thisRecordId][key])) {
            throw new Error('Field \'' + key + '\' is not present for record id ' + thisRecordId + ' in table \'' + _this6.collectionName + '\'.');
          }
        }
      }

      return (0, _matchesWhereQuery["default"])(_this6._recordsById[thisRecordId], attrs);
    });
  },
  // Return the first model with matching attributes. Useful for simple cases
  // of `find`.
  findWhere: function findWhere(attrs, options) {
    options = _underscore["default"].defaults({}, options, {
      ignoreMissingData: false
    });
    return this.where(attrs, {
      first: true,
      ignoreMissingData: options.ignoreMissingData
    });
  },
  pluck: function pluck(propertyName) {
    return _underscore["default"].pluck(this._recordsById, propertyName);
  },
  _cloneRecord: function _cloneRecord(record) {
    return JSON.parse(JSON.stringify(record));
  },
  _cloneFieldValue: function _cloneFieldValue(fieldValue) {
    if (fieldValue instanceof Object) {
      return JSON.parse(JSON.stringify(fieldValue));
    } else {
      return fieldValue;
    }
  },
  _getUniqueId: function _getUniqueId() {
    return _nodeUuid["default"].v4();
  },
  _getRESTEndpoint: function _getRESTEndpoint(method, recordIdOrIds, variableParts) {
    // eslint-disable-next-line no-unused-vars
    if (_underscore["default"].isUndefined(variableParts)) variableParts = {};
    var base = this.url;
    if (_underscore["default"].isFunction(base)) base = base.call(this);
    if (!base) throw new Error('A "url" property or function must be specified');
    var endpoint = base;
    var recordId = recordIdOrIds; // if we have any pre-supplied variable parts, fill those in. necessary for cases
    // like fetching a record when we have no existing information in baseline regarding,
    // that record, so we can't build the url internally.

    for (var thisVariablePartKey in variableParts) {
      endpoint = endpoint.replace(':' + thisVariablePartKey, variableParts[thisVariablePartKey]);
    }

    endpoint = this._fillInVariablePartsOfRESTEndpoint(recordId, endpoint);

    if (['update', 'delete', 'patch', 'get'].includes(method) && !Array.isArray(recordIdOrIds)) {
      endpoint = endpoint.replace(/([^/])$/, '$1/') + encodeURIComponent(recordId);
    }

    return endpoint;
  },
  _fillInVariablePartsOfRESTEndpoint: function _fillInVariablePartsOfRESTEndpoint(recordId, endpoint) {
    var _this7 = this;

    return endpoint.replace(/\/:(\w+)/g, function (match, fieldName) {
      return '/' + _this7.get(recordId, fieldName);
    });
  },
  _recordToDTO: function _recordToDTO(recordId, method) {
    var dto = this.gets(recordId);
    if (method === 'update') delete dto.id;
    return dto;
  },
  _mergeDTO: function _mergeDTO(dto) {
    var recordId = dto[this._idFieldName];

    if (_underscore["default"].isUndefined(recordId)) {
      throw new Error('Each dto must define a unique id.');
    } // make sure the attributes we end up storing are copies, in case
    // somebody is using the original newRecordDTOs.


    var recordIsNew = !this._recordsById[recordId];

    if (recordIsNew) {
      this._recordsById[recordId] = {};

      this._recordIds.push(recordId);

      this.length++;
    }

    for (var field in dto) {
      if (_underscore["default"].isObject(dto[field])) {
        this._recordsById[recordId][field] = _underscore["default"].clone(dto[field]);

        this._deepFreeze(this._recordsById[recordId][field]);
      } else this._recordsById[recordId][field] = dto[field];
    }
  },
  _deepFreeze: function _deepFreeze(obj) {
    Object.freeze(obj);

    for (var attribute in obj) {
      if (obj[attribute] !== null && _typeof(obj[attribute]) === 'object') {
        this._deepFreeze(obj[attribute]);
      }
    }

    return obj;
  },
  _sync: function _sync(url, verb, payload, ajaxOptions) {
    var options = _underscore["default"].defaults({}, options); // Default JSON-request options.


    var params = {
      url: url,
      type: verb,
      dataType: 'json',
      contentType: 'application/json',
      data: _underscore["default"].isEmpty(payload) ? undefined : JSON.stringify(payload)
    }; // Make the request, allowing the user to override any Ajax options.

    return this._ajax(_underscore["default"].extend(params, ajaxOptions));
  },
  _setupUnderscoreProxy: function _setupUnderscoreProxy() {
    // Underscore methods that we want to implement for each table.
    var underscoreTableMethodNames = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl', 'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select', 'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke', 'max', 'min', 'sortedIndex', 'size', 'first', 'head', 'take', 'initial', 'rest', 'tail', 'drop', 'last', 'without', 'indexOf', 'shuffle', 'lastIndexOf', 'isEmpty']; // Mix in each Underscore method as a proxy to _recordIds.

    var _loop2 = function _loop2() {
      var thisMethodName = _underscoreTableMetho[_i2];

      CollectionService.prototype[thisMethodName] = function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(this.ids());
        return _underscore["default"][thisMethodName].apply(_underscore["default"], args);
      };
    };

    for (var _i2 = 0, _underscoreTableMetho = underscoreTableMethodNames; _i2 < _underscoreTableMetho.length; _i2++) {
      _loop2();
    }
  }
});