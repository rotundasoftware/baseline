var _ = require( 'underscore' );
var BaseService = require( './baseService' );
var Events = require( 'backbone-events-standalone' );
var uuid = require( 'node-uuid' );
var $ = require( 'jquery' );

var CollectionService = module.exports = BaseService.extend( {
	initialize : function( options ) {
		options = _.defaults( {}, options, {
			idFieldName : 'id',
			defaultAjaxErrorHandler : undefined
		} );

		if( _.isUndefined( this.collectionName ) ) throw new Error( 'The collectionName attribute must be defined on collection service instances.' );

		this._idFieldName = options.idFieldName;
		this._defaultAjaxErrorHandler = options.defaultAjaxErrorHandler;

		this.empty();

		Events.mixin( this );

		BaseService.prototype.initialize( options );
	},

	create : function( initialFieldValues, options ) {
		options = _.defaults( {}, options, { silent : false } );

		if( ! initialFieldValues ) initialFieldValues = {};

		var newRecordId = initialFieldValues[ this._idFieldName ];

		if( ! newRecordId )
			initialFieldValues[ this._idFieldName ] = newRecordId = this._getUniqueId();

		_.defaults( initialFieldValues, this.fields );

		var params = {
			collectionName : this.collectionName,
			fieldValues : initialFieldValues
		};

		this.merge( [ initialFieldValues ] );

		// this.trigger( 'operation', 'createRecord', params );
		this.trigger( 'create', initialFieldValues, options );

		this._newRecordIds.push( newRecordId );

		return newRecordId;
	},

	get : function( recordId, fieldName ) {
		if( ! this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.' );

		var fieldValue = this._recordsById[ recordId ][ fieldName ];
		if( _.isUndefined( fieldValue ) ) throw new Error( 'Field \'' + fieldName + '\' is not present for record id ' + recordId + ' in table \'' + this.collectionName + '\'.' );

		return this._copyFieldValue( fieldValue );
	},

	gets : function( recordId, fields ) {
		var _this = this;

		if( ! this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.' );

		if( _.isUndefined( fields ) ) fields = _.keys( this._recordsById[ recordId ] );

		if( ! _.isArray( fields ) ) fields = Array.prototype.slice.apply( arguments, [ 1 ] );
		var values = {};

		_.each( fields, function( thisFieldName ) {
			values[ thisFieldName ] = _this.get( recordId, thisFieldName );
		} );

		return values;
	},

	set : function( recordId, fieldName, fieldValue ) {
		this.rawSet.apply( this, arguments );
	},

	sets : function( recordId, fields ) {
		_.each( fields, function( thisFieldValue, thisFieldName ) {
			this.set( recordId, thisFieldName, thisFieldValue );
		}, this );
	},

	rawSet : function( recordId, fieldName, fieldValue ) {
		if( ! this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.' );
		
		if( fieldName === this._idFieldName && this._recordsById[ recordId ][ fieldName ] !== fieldValue ) throw new Error( 'Changing the id field of an existing record is not supported.' );
		
		// not sure we want to check if the data exists before setting it.. for example, we create a new record, and then want to fill
		// in fields.. of course data will not be there (unless we initilize all fields to their default values, which might make sense,
		// but jury is still out, so we will do it this way for now. we tried this more lax interpretation and doesn't seem to cause problems,
		// let's keep it as is. (The alternative would be to force setting non-present fields through merge.)
		// if( _.isUndefined( this._recordsById[ recordId ][ fieldName ] ) ) throw new Error( 'Field \'' + fieldName + '\' not present for record id ' + recordId + ' in table \'' + this.collectionName + '\'.' );

		if( _.isUndefined( fieldValue ) ) delete this._recordsById[ recordId ][ fieldName ];
		else this._recordsById[ recordId ][ fieldName ] = this._copyFieldValue( fieldValue );

		var params = {
			collectionName : this.collectionName,
			recordId : recordId,
			fieldName : fieldName,
			value : fieldValue
		};

		// this.trigger( 'operation', 'setField', params );
		this.trigger( 'set', recordId, fieldName, fieldValue );
		// this.trigger( 'set:' + recordId, fieldName, fieldValue );
	},

	destroy : function( recordIdOrIds, options ) {
		var _this = this;

		options = _.defaults( {}, options, {
			sync : true,
			success : null,
			error : null
		} );

		var deleteLocally = function() {
			_.each( _.isArray( recordIdOrIds ) ? recordIdOrIds : [ recordIdOrIds ], function( thisRecordId ) {
				if( ! _this._recordsById[ thisRecordId ] ) throw new Error( 'Record id ' + thisRecordId + ' is not present.' );
			
				_this._recordIds = _.without( _this._recordIds, thisRecordId );
				delete _this._recordsById[ thisRecordId ];
				_this.length--;

				var params = {
					collectionName : _this.collectionName,
					recordId : thisRecordId
				};

				// _this.trigger( 'operation', 'destroyRecord', params );
				_this.trigger( 'destroy', thisRecordId );
			} );
		}

		var recordIdsToDeleteRemotely = [];
		if( options.sync ) {
			recordIdsToDeleteRemotely = _.filter( _.isArray( recordIdOrIds ) ? recordIdOrIds : [ recordIdOrIds ], function( thisRecordId ) {
				return ! _this.isNew( thisRecordId );
			} );
		}

		if( recordIdsToDeleteRemotely.length > 0 ) {
			var url = this._getRESTEndpoint( 'delete', recordIdsToDeleteRemotely.length > 1 ? recordIdsToDeleteRemotely : recordIdsToDeleteRemotely[0] );

			return new Promise( function( resolve, reject ) {
				_this._sync( url, 'delete', recordIdsToDeleteRemotely.length > 1 ? recordIdsToDeleteRemotely : undefined, {
					success : function( returnedJson, textStatus, xhr ) {
						if( options.success ) options.success.apply( this, arguments );

						deleteLocally();

						resolve( { success : true, xhr : xhr } );
					},
					error : function( xhr ) {
						if( options.error ) options.error.apply( this, arguments );
						else if( _this._defaultAjaxErrorHandler ) _this._defaultAjaxErrorHandler.apply( this, arguments );
						resolve( { success : false, xhr : xhr } );
					}
				} );
			} );
		} else {
			deleteLocally();
			return Promise.resolve( { success : true } );
		}
	},

	ids : function() {
		// return a copy of the ids array
		return this._recordIds.slice( 0 );
	},

	isPresent : function( recordId, fieldName ) {
		// fieldName is optional.. if not supplied function will return true iff recordId is present

		if( _.isUndefined( this._recordsById[ recordId ] ) ) return false;
		if( ! _.isUndefined( fieldName ) && _.isUndefined( this._recordsById[ recordId ][ fieldName ] ) ) return false;

		return true;
	},

	isNew : function( recordId ) {
		return _.contains( this._newRecordIds, recordId )
	},

	empty : function() {
		this.length = 0;
		
		this._recordIds = [];
		this._recordsById = {};
		this._newRecordIds = [];
	},

	merge : function( newRecordDTOs ) {
		var _this = this;

		if( ! _.isArray( newRecordDTOs ) ) newRecordDTOs = [ newRecordDTOs ];

		_.each( newRecordDTOs, function( thisDto ) {
			_this._mergeDTO( thisDto, 'get' );
		}, this );
	},

	toJSON : function( options ) {
		var _this = this;

		options = _.defaults( {}, options, {
			recordIds : this._recordIds,
			fields : null
		} );

		if( options.fields ) {
			return _.map( options.recordIds, function( thisRecordId ) {
				if( ! _this.isPresent( thisRecordId ) ) throw new Error( 'Record id ' + thisRecordId + ' is not present.' );
			
				return this._copyRecord( _.pick( this._recordsById[ thisRecordId ], options.fields ) );
			}, this );
		} else {
			return _.map( options.recordIds, function( thisRecordId ) {
				if( ! _this.isPresent( thisRecordId ) ) throw new Error( 'Record id ' + thisRecordId + ' is not present.' );
		
				return this._copyRecord( this._recordsById[ thisRecordId ] );
			}, this );
		}
	},

	fetch : function( recordId, options ) {
		var _this = this;

		options = _.defaults( {}, options, {
			variablePartsOfEndpoint : {},
			success : undefined,
			error : undefined
		} );

		var url = this._getRESTEndpoint( 'get', recordId, options.variablePartsOfEndpoint );

		return new Promise( function( resolve, reject ) {
			_this._sync( url, 'get', null, {
				success : function( returnedJson, textStatus, xhr ) {
					_this._mergeDTO( returnedJson, 'get' );
					if( options.success ) options.success.apply( this, arguments );

					resolve( { success : true, xhr : xhr } );
				},
				error : function( xhr ) {
					if( options.error ) options.error.apply( this, arguments );
					else if( _this._defaultAjaxErrorHandler ) _this._defaultAjaxErrorHandler.apply( this, arguments );

					resolve( { success : false, xhr : xhr } );
				}
			} );
		} );
	},

	save : function( recordId, options ) {
		var _this = this;

		options = _.defaults( {}, options, {
			success : undefined,
			error : undefined,
			merge : true
		} );

		var method = this.isNew( recordId ) ? 'create' : 'update';
		var url = _this._getRESTEndpoint( method, recordId );
		var dto = this._recordToDTO( recordId, method );

		return new Promise( function( resolve, reject ) {
			_this._sync( url, method, dto, {
				success : function( returnedJson, textStatus, xhr ) {
					if( method === 'create' ) _this._newRecordIds = _.without( _this._newRecordIds, recordId );

					if( options.merge ) _this._mergeDTO( returnedJson, method );
					if( options.success ) options.success.call( this, xhr, options );

					resolve( { success : true, xhr : xhr } );
				},
				error : function( xhr ) {
					if( options.error ) options.error.call( this, xhr, options );
					else if( _this._defaultAjaxErrorHandler ) _this._defaultAjaxErrorHandler.call( this, xhr, options );

					resolve( { success : false, xhr : xhr } );
				}
			} );
		} );
	},

	// Return records with matching attributes. Useful for simple cases of
	// `filter`.
	where : function( attrs, first ) {
		var _this = this;
		if( _.isEmpty( attrs ) ) return first ? void 0 : [];
		return this[ first ? 'find' : 'filter' ]( function( thisRecordId ) {
			for( var key in attrs ) {
				if( attrs[ key ] !== _this._recordsById[ thisRecordId ][ key ] ) return false;
			}
			return true;
		} );
	},

	// Return the first model with matching attributes. Useful for simple cases
	// of `find`.
	findWhere : function( attrs ) {
		return this.where( attrs, true );
	},

	pluck : function( propertyName ) {
		return _.pluck( this._recordsById, propertyName );
	},

	registerTapeOperation : function( operationName, tapeOperationDescriptor ) {
		this.arbitrator.tapeOperations[ operationName ] = tapeOperationDescriptor.arbitrator;
		this.tapeOperations[ operationName ] = tapeOperationDescriptor.client;
	},

	_copyRecord : function( record ) {
		return JSON.parse( JSON.stringify( record ) );
	},

	_copyFieldValue : function( fieldValue ) {
		if( fieldValue instanceof Object )
			return JSON.parse( JSON.stringify( fieldValue ) );
		else
			return fieldValue;
	},

	_getUniqueId : function() {
		return uuid.v4();
	},

	_getRESTEndpoint : function( method, recordIdOrIds, variableParts ) {
		var _this = this;

		if( _.isUndefined( variableParts ) ) variableParts = {};

		var base = this.url;
		if( _.isFunction( base ) ) base = base.call( this );

		if( ! base ) throw new Error( 'A "url" property or function must be specified' );

		var endpoint = base;
		var recordId = recordIdOrIds;

		// if we have any pre-supplied variable parts, fill those in. necessary for cases
		// like fetching a record when we have no existing information in baseline regarding,
		// that record, so we can't build the url internally.
		_.each( variableParts, function( thisVariablePartValue, thisVariablePartKey ) {
			endpoint = endpoint.replace( ':' + thisVariablePartKey, thisVariablePartValue );
		} );

		endpoint = this._fillInVariablePartsOfRESTEndpoint( recordId, endpoint );

		if( method != 'create' && ! _.isArray( recordIdOrIds ) ) {
			endpoint = endpoint.replace( /([^\/])$/, '$1/' ) + encodeURIComponent( recordId );
		}

		return endpoint;
	},

	_fillInVariablePartsOfRESTEndpoint : function( recordId, endpoint ) {
		var _this = this;

		return endpoint.replace( /\/:(\w+)/g, function( match, fieldName ) {
			return '/' + _this.get( recordId, fieldName );
		} );
	},

	_recordToDTO : function( recordId, method ) {
		var dto = this.gets( recordId );
		if( method === 'update' ) delete dto.id;
		return dto;
	},

	_mergeDTO : function( dto, method ) {
		var recordId = dto[ this._idFieldName ];

		if( _.isUndefined( recordId ) ) {
			throw new Error( 'Each dto must define a unique id.' );
		}

		// make sure the attributes we end up storing are copies, in case
		// somebody is using the original newRecordDTOs.
		var recordIsNew = ! this._recordsById[ recordId ];
		if( recordIsNew ) {
			this._recordsById[ recordId ] = {};
			this._recordIds.push( recordId );
			this.length++;
		}

		_.extend( this._recordsById[ recordId ], dto );
	},

	_sync : function( url, method, payload, ajaxOptions ) {
		var options = _.defaults( {}, options );

		var methodMap = {
			'create' : 'POST',
			'update' : 'PUT',
			'patch' :  'PATCH',
			'delete' : 'DELETE',
			'get' :   'GET'
		};

		// Default JSON-request options.
		var params = {
			url : url,
			type : methodMap[ method ],
			dataType : 'json',
			contentType : 'application/json',
			data : method === 'get' ? undefined : JSON.stringify( payload )
		};

		// Make the request, allowing the user to override any Ajax options.
		var xhr = $.ajax( _.extend( params, ajaxOptions ) );
		return xhr;
	}
} );

// Underscore methods that we want to implement for each table.
var underscoreTableMethodNames = [ 'forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
	'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
	'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
	'max', 'min', 'sortedIndex', 'size', 'first', 'head', 'take',
	'initial', 'rest', 'tail', 'drop', 'last', 'without', 'indexOf', 'shuffle',
	'lastIndexOf', 'isEmpty' ];

// Mix in each Underscore method as a proxy to _recordIds.
_.each( underscoreTableMethodNames, function( thisMethodName ) {
	CollectionService.prototype[ thisMethodName ] = function() {
		var args = Array.prototype.slice.call( arguments );
		args.unshift( this._recordIds );
		return _[ thisMethodName ].apply( _, args );
	};
} );

// Underscore methods that take a property name as an argument.
var attributeMethods = [ 'groupBy', 'countBy' ]; // used to proxy sortBy, but unclear on use case here

// Use attributes instead of properties.
_.each( attributeMethods, function( method ) {
	CollectionService.prototype[ method ] = function( value, context ) {
		var _this = this;
		var iterator = _.isFunction( value ) ? value : function( thisRecordId ) {
			return _this._recordsById[ thisRecordId ][ value ];
		};
		
		return _[ method ]( this._recordIds, iterator, context );
	};
} );
