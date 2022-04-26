var _ = require( 'underscore' );
var BaseService = require( './baseService' );
var Events = require( 'backbone-events-standalone' );
var uuid = require( 'node-uuid' );
var $ = require( 'jquery' );
var matchesWhereQuery = require( 'matches-where-query' );

require('es6-promise').polyfill();

var CollectionService = module.exports = BaseService.extend( {
	initialize : function( options ) {
		options = _.defaults( {}, options, {
			idFieldName : 'id',
			defaultAjaxErrorHandler : undefined,
			ajax : function( options ) {
				return new Promise( function( resolve, reject ) {
					$.ajax( options ).done( function( data, textStatus, xhr ) {
						resolve( { success : true, xhr : xhr } );
					} ).fail( function( xhr, textStatus ) {
						resolve( { success : false, xhr: xhr } );
					} );
				} );
			}
		} );

		if( _.isUndefined( this.collectionName ) ) throw new Error( 'The collectionName attribute must be defined on collection service instances.' );

		this._idFieldName = options.idFieldName;
		this._ajax = options.ajax;

		// this._defaultAjaxErrorHandler = options.defaultAjaxErrorHandler;

		this.empty();

		Events.mixin( this );

		BaseService.prototype.initialize( options );
	},

	create : function( initialFieldValues, options ) {
		options = _.defaults( {}, options, { silent : false } );

		if( ! initialFieldValues ) initialFieldValues = {};
		else initialFieldValues = this._cloneRecord( initialFieldValues );

		var newRecordId = initialFieldValues[ this._idFieldName ];

		if( ! newRecordId )
			initialFieldValues[ this._idFieldName ] = newRecordId = this._getUniqueId();

		_.defaults( initialFieldValues, this.fields );

		this.merge( [ initialFieldValues ] );

		this.trigger( 'create', initialFieldValues, options );

		this._newRecordIds.push( newRecordId );

		return newRecordId;
	},

	id : function() {
		return this.get( this._idFieldName );
	},

	get : function( recordId, fieldName, options ) {
		options = Object.assign( {
			clone : false
		}, options );
		
		if( ! this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.' );

		var fieldValue = this._recordsById[ recordId ][ fieldName ];
		if( options.clone ) fieldValue = this._cloneFieldValue( fieldValue );

		if( _.isUndefined( fieldValue ) ) throw new Error( 'Field \'' + fieldName + '\' is not present for record id ' + recordId + ' in table \'' + this.collectionName + '\'.' );

		return fieldValue;
	},

	gets : function( recordId, fields, options ) {
		options = Object.assign( {
			clone : false
		}, options );

		var _this = this;

		if( ! this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.' );

		if( _.isUndefined( fields ) ) fields = _.keys( this._recordsById[ recordId ] );

		if( ! _.isArray( fields ) ) fields = Array.prototype.slice.apply( arguments, [ 1 ] );
		var values = {};

		_.each( fields, function( thisFieldName ) {
			values[ thisFieldName ] = _this.get( recordId, thisFieldName, { clone : options.clone } );
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
		else this._recordsById[ recordId ][ fieldName ] = this._cloneFieldValue( fieldValue );

		if( _.isObject( this._recordsById[ recordId ][ fieldName ] ) ) this._deepFreeze( this._recordsById[ recordId ][ fieldName ] );

 		this.trigger( 'set', recordId, fieldName, fieldValue );
	},

	destroy : function( recordId, options ) {
		var _this = this;

		options = _.defaults( {}, options, {
			sync : true,
			ajax : {}
		} );

		var deleteLocally = function() {
			if( ! _this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present.' );
		
			_this._recordIds = _.without( _this._recordIds, thisRecordId );
					
			delete this._recordsById[ thisRecordId ];					

			_this.trigger( 'destroy', recordId, options );
		}

		if( options.sync && ! _this.isNew( thisRecordId ) ) {
			var url = this._getRESTEndpoint( 'delete', thisRecordId );

			return _this._sync( url, 'DELETE', undefined, options.ajax ).then( function( result ) {
				if( result.success ) deleteLocally();

				return result;
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
			_this._mergeDTO( thisDto );
		}, this );
	},

	toJSON : function( options ) {
		var _this = this;

		options = _.defaults( {}, options, {
			recordIds : this._recordIds,
			fields : null,
			clone : false
		} );

		if( options.recordIds === this._recordIds && ! options.clone && ! options.fields ) {
			// optimization for simplest case
			return _.values( this._recordsById );
		} else if( options.fields ) {
			return _.map( options.recordIds, function( thisRecordId ) {
				if( ! _this.isPresent( thisRecordId ) ) throw new Error( 'Record id ' + thisRecordId + ' is not present.' );
			
				return this._cloneRecord( _.pick( this._recordsById[ thisRecordId ], options.fields ) );
			}, this );
		} else {
			return _.map( options.recordIds, function( thisRecordId ) {
				if( ! _this.isPresent( thisRecordId ) ) throw new Error( 'Record id ' + thisRecordId + ' is not present.' );
		
				return this._cloneRecord( this._recordsById[ thisRecordId ] );
			}, this );
		}
	},

	fetch : function( recordId, options ) {
		var _this = this;

		options = _.defaults( {}, options, {
			variablePartsOfEndpoint : {},
			ajax : {}
		} );

		var url = this._getRESTEndpoint( 'get', recordId, options.variablePartsOfEndpoint );

		return _this._sync( url, 'GET', null, options.ajax ).then( function( result ) {
			if( result.success ) _this._mergeDTO( result.data );

			return result;
		} );
	},

	save : function( recordId, options ) {
		var _this = this;

		options = _.defaults( {}, options, {
			merge : true,
			ajax : {}
		} );

		var method = this.isNew( recordId ) ? 'create' : 'update';
		var isUpdate = ! this.isNew( recordId );
		var url = _this._getRESTEndpoint( method, recordId );
		var dto = this._recordToDTO( recordId, method );

		return _this._sync( url, isUpdate ? 'PUT' : 'POST', dto, options.ajax ).then( function( result ) {
			if( result.success ) {
				if( ! isUpdate ) _this._newRecordIds = _.without( _this._newRecordIds, recordId );
				if( options.merge ) _this._mergeDTO( result.data );

				_this.trigger( 'save', recordId, isUpdate, options );
			}

			return result;
		} );
	},

	// Return records with matching attributes. Useful for simple cases of
	// `filter`. Unlike in underscore, if values of attrs is an array, then
	// a record will be included in the return if the corresponding attribute
	// on the record is included in the elements of attrs.

	where : function( attrs, options ) {
		var _this = this;
		
		options = _.defaults( {}, options, {
			first : false,
			ignoreMissingData : false,
		} );

		if( _.isEmpty( attrs ) ) return options.first ? void 0 : [];
		return this[ options.first ? 'find' : 'filter' ]( function( thisRecordId ) {
			if( ! options.ignoreMissingData ) {
				for( var key in attrs ) {
					if( _.isUndefined( _this._recordsById[ thisRecordId ][ key ] ) ) throw new Error( 'Field \'' + key + '\' is not present for record id ' + thisRecordId + ' in table \'' + _this.collectionName + '\'.' );
				}
			}

			return matchesWhereQuery( _this._recordsById[ thisRecordId ], attrs );
		} );
	},

	// Return the first model with matching attributes. Useful for simple cases
	// of `find`.
	findWhere : function( attrs, options ) {
		options = _.defaults( {}, options, {
			ignoreMissingData : false,
		} );

		return this.where( attrs, { first : true, ignoreMissingData : options.ignoreMissingData } );
	},

	pluck : function( propertyName ) {
		return _.pluck( this._recordsById, propertyName );
	},

	registerTapeOperation : function( operationName, tapeOperationDescriptor ) {
		this.arbitrator.tapeOperations[ operationName ] = tapeOperationDescriptor.arbitrator;
		this.tapeOperations[ operationName ] = tapeOperationDescriptor.client;
	},

	_cloneRecord : function( record ) {
		return JSON.parse( JSON.stringify( record ) );
	},

	_cloneFieldValue : function( fieldValue ) {
		if( fieldValue instanceof Object ) {
			return JSON.parse( JSON.stringify( fieldValue ) );
		} else {
			return fieldValue;
		}
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

		if( _.contains( [ 'update', 'delete', 'patch', 'get' ], method ) && ! _.isArray( recordIdOrIds ) ) {
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

	_mergeDTO : function( dto ) {
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

		for( field in dto ) {
			if( _.isObject( dto[ field ] ) ){
				this._recordsById[ recordId ][ field ] = _.clone( dto[ field ] );
				this._deepFreeze( this._recordsById[ recordId ][ field ] );
			} else this._recordsById[ recordId ][ field ] = dto[ field ];			
		}
	},

	_deepFreeze( obj ) {
		Object.freeze( obj );

		for( attribute in obj ) {
			if ( obj[ prop ] !== null && typeof obj[ attribute ] === "object" ) {
				deepFreeze( obj[ attribute ] );
			}
		};
		
		return obj;
	},

	_sync : function( url, verb, payload, ajaxOptions ) {
		var options = _.defaults( {}, options );

		// Default JSON-request options.
		var params = {
			url : url,
			type : verb,
			dataType : 'json',
			contentType : 'application/json',
			data : _.isEmpty( payload ) ? undefined : JSON.stringify( payload )
		};

		// Make the request, allowing the user to override any Ajax options.
		return this._ajax( _.extend( params, ajaxOptions ) );
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
		args.unshift( this.ids() );
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