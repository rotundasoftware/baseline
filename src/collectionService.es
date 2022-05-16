import _ from 'underscore';
import BaseService from './baseService';
import Events from 'backbone-events-standalone';
import uuid from 'node-uuid';
import $ from 'jquery';
import matchesWhereQuery from 'matches-where-query';

const CollectionService = module.exports = BaseService.extend( {
	initialize( options ) {
		options = _.defaults( {}, options, {
			idFieldName : 'id',
			defaultAjaxErrorHandler : undefined,
			ajax( options ) {
				return new Promise( function( resolve ) {
					$.ajax( options ).done( function( data, textStatus, xhr ) {
						resolve( { success : true, xhr } );
					} ).fail( xhr => {
						resolve( { success : false, xhr } );
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

	create( initialFieldValues, options ) {
		options = _.defaults( {}, options, { silent : false } );

		if( ! initialFieldValues ) initialFieldValues = {};
		else initialFieldValues = this._cloneRecord( initialFieldValues );

		let newRecordId = initialFieldValues[ this._idFieldName ];

		if( ! newRecordId ) {
			initialFieldValues[ this._idFieldName ] = newRecordId = this._getUniqueId();
		}

		_.defaults( initialFieldValues, this.fields );

		this.merge( [ initialFieldValues ] );

		this.trigger( 'create', initialFieldValues, options );

		this._newRecordIds.push( newRecordId );

		return newRecordId;
	},

	id() {
		return this.get( this._idFieldName );
	},

	get( recordId, fieldName, options ) {
		options = Object.assign( {
			clone : false
		}, options );
		
		if( ! this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.' );

		let fieldValue = this._recordsById[ recordId ][ fieldName ];
		if( options.clone ) fieldValue = this._cloneFieldValue( fieldValue );

		if( _.isUndefined( fieldValue ) ) throw new Error( 'Field \'' + fieldName + '\' is not present for record id ' + recordId + ' in table \'' + this.collectionName + '\'.' );

		return fieldValue;
	},

	gets( recordId, fields, options ) {
		options = Object.assign( {
			clone : false
		}, options );

		if( ! this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.' );

		if( _.isUndefined( fields ) ) fields = _.keys( this._recordsById[ recordId ] );

		if( ! _.isArray( fields ) ) fields = Array.prototype.slice.apply( arguments, [ 1 ] );
		const values = {};

		for( const thisFieldName of fields ) {
			values[ thisFieldName ] = this.get( recordId, thisFieldName, { clone : options.clone } );
		}

		return values;
	},

	// eslint-disable-next-line no-unused-vars
	set( recordId, fieldName, fieldValue ) {
		this.rawSet.apply( this, arguments );
	},

	sets( recordId, fields ) {
		for( const thisFieldName in fields ) {
			this.set( recordId, thisFieldName, fields[ thisFieldName ] );
		}
	},

	rawSet( recordId, fieldName, fieldValue ) {
		if( ! this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.' );
		
		if( fieldName === this._idFieldName && this._recordsById[ recordId ][ fieldName ] !== fieldValue ) throw new Error( 'Changing the id field of an existing record is not supported.' );
		
		// not sure we want to check if the data exists before setting it.. for example, we create a new record, and then want to fill
		// in fields.. of course data will not be there (unless we initilize all fields to their default values, which might make sense,
		// but jury is still out, so we will do it this way for now. we tried this more lax interpretation and doesn't seem to cause problems,
		// let's keep it as is. (The alternative would be to force setting non-present fields through merge.)
		// if( _.isUndefined( this._recordsById[ recordId ][ fieldName ] ) )
		// 	throw new Error( 'Field \'' + fieldName + '\' not present for record id ' + recordId + ' in table \'' + this.collectionName + '\'.' );

		if( _.isUndefined( fieldValue ) ) delete this._recordsById[ recordId ][ fieldName ];
		else this._recordsById[ recordId ][ fieldName ] = this._cloneFieldValue( fieldValue );

		if( _.isObject( this._recordsById[ recordId ][ fieldName ] ) ) this._deepFreeze( this._recordsById[ recordId ][ fieldName ] );

		this.trigger( 'set', recordId, fieldName, fieldValue );
	},

	async destroy( recordId, options ) {
		const _this = this;

		options = _.defaults( {}, options, {
			sync : true,
			ajax : {}
		} );

		const deleteLocally = function() {
			if( ! _this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present.' );
		
			_this._recordIds = _.without( _this._recordIds, recordId );
			delete _this._recordsById[ recordId ];
			_this.length--;

			_this.trigger( 'destroy', recordId, options );
		};

		if( options.sync && ! _this.isNew( recordId ) ) {
			const url = this._getRESTEndpoint( 'delete', recordId );

			const result = await _this._sync( url, 'DELETE', undefined, options.ajax );
			if( result.success ) deleteLocally();

			return result;
		} else {
			deleteLocally();
			return Promise.resolve( { success : true } );
		}
	},

	ids() {
		// return a copy of the ids array
		return this._recordIds.slice( 0 );
	},

	isPresent( recordId, fieldName ) {
		// fieldName is optional.. if not supplied function will return true iff recordId is present

		if( _.isUndefined( this._recordsById[ recordId ] ) ) return false;
		if( ! _.isUndefined( fieldName ) && _.isUndefined( this._recordsById[ recordId ][ fieldName ] ) ) return false;

		return true;
	},

	isNew( recordId ) {
		return this._newRecordIds.includes( recordId );
	},

	empty() {
		this.length = 0;
		
		this._recordIds = [];
		this._recordsById = {};
		this._newRecordIds = [];
	},

	merge( newRecordDTOs ) {
		const _this = this;

		if( ! _.isArray( newRecordDTOs ) ) newRecordDTOs = [ newRecordDTOs ];

		_.each( newRecordDTOs, function( thisDto ) {
			_this._mergeDTO( thisDto );
		}, this );
	},

	toJSON( options ) {
		const _this = this;

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

	async fetch( recordId, options ) {
		const _this = this;

		options = _.defaults( {}, options, {
			variablePartsOfEndpoint : {},
			ajax : {}
		} );

		const url = this._getRESTEndpoint( 'get', recordId, options.variablePartsOfEndpoint );

		const result = await _this._sync( url, 'GET', null, options.ajax );
		if( result.success ) _this._mergeDTO( result.data );

		return result;
	},

	async save( recordId, options ) {
		options = _.defaults( {}, options, {
			merge : true,
			ajax : {}
		} );

		const method = this.isNew( recordId ) ? 'create' : 'update';
		const isUpdate = ! this.isNew( recordId );
		const url = this._getRESTEndpoint( method, recordId );
		const dto = this._recordToDTO( recordId, method );

		const result = await this._sync( url, isUpdate ? 'PUT' : 'POST', dto, options.ajax );
		
		if( result.success ) {
			if( ! isUpdate ) this._newRecordIds = _.without( this._newRecordIds, recordId );
			if( options.merge ) this._mergeDTO( result.data );

			this.trigger( 'save', recordId, isUpdate, options );
		}

		return result;
	},

	// Return records with matching attributes. Useful for simple cases of
	// `filter`. Unlike in underscore, if values of attrs is an array, then
	// a record will be included in the return if the corresponding attribute
	// on the record is included in the elements of attrs.

	where( attrs, options ) {
		options = _.defaults( {}, options, {
			first : false,
			ignoreMissingData : false
		} );

		if( _.isEmpty( attrs ) ) {
			return options.first ? void 0 : [];
		}

		return this[ options.first ? 'find' : 'filter' ]( thisRecordId => {
			if( ! options.ignoreMissingData ) {
				for( const key in attrs ) {
					if( _.isUndefined( this._recordsById[ thisRecordId ][ key ] ) ) {
						throw new Error( 'Field \'' + key + '\' is not present for record id ' + thisRecordId + ' in table \'' + this.collectionName + '\'.' );
					}
				}
			}

			return matchesWhereQuery( this._recordsById[ thisRecordId ], attrs );
		} );
	},

	// Return the first model with matching attributes. Useful for simple cases
	// of `find`.
	findWhere( attrs, options ) {
		options = _.defaults( {}, options, {
			ignoreMissingData : false
		} );

		return this.where( attrs, { first : true, ignoreMissingData : options.ignoreMissingData } );
	},

	pluck( propertyName ) {
		return _.pluck( this._recordsById, propertyName );
	},

	_cloneRecord( record ) {
		return JSON.parse( JSON.stringify( record ) );
	},

	_cloneFieldValue( fieldValue ) {
		if( fieldValue instanceof Object ) {
			return JSON.parse( JSON.stringify( fieldValue ) );
		} else {
			return fieldValue;
		}
	},

	_getUniqueId() {
		return uuid.v4();
	},

	_getRESTEndpoint( method, recordIdOrIds, variableParts ) {
		// eslint-disable-next-line no-unused-vars
		const _this = this;

		if( _.isUndefined( variableParts ) ) variableParts = {};

		let base = this.url;
		if( _.isFunction( base ) ) base = base.call( this );

		if( ! base ) throw new Error( 'A "url" property or function must be specified' );

		let endpoint = base;
		const recordId = recordIdOrIds;

		// if we have any pre-supplied variable parts, fill those in. necessary for cases
		// like fetching a record when we have no existing information in baseline regarding,
		// that record, so we can't build the url internally.
		for( const thisVariablePartKey in variableParts ) {
			endpoint = endpoint.replace( ':' + thisVariablePartKey, variableParts[ thisVariablePartKey ] );
		}

		endpoint = this._fillInVariablePartsOfRESTEndpoint( recordId, endpoint );

		if( [ 'update', 'delete', 'patch', 'get' ].includes( method ) && ! _.isArray( recordIdOrIds ) ) {
			endpoint = endpoint.replace( /([^/])$/, '$1/' ) + encodeURIComponent( recordId );
		}

		return endpoint;
	},

	_fillInVariablePartsOfRESTEndpoint( recordId, endpoint ) {
		const _this = this;

		return endpoint.replace( /\/:(\w+)/g, function( match, fieldName ) {
			return '/' + _this.get( recordId, fieldName );
		} );
	},

	_recordToDTO( recordId, method ) {
		const dto = this.gets( recordId );
		if( method === 'update' ) delete dto.id;
		return dto;
	},

	_mergeDTO( dto ) {
		const recordId = dto[ this._idFieldName ];

		if( _.isUndefined( recordId ) ) {
			throw new Error( 'Each dto must define a unique id.' );
		}

		// make sure the attributes we end up storing are copies, in case
		// somebody is using the original newRecordDTOs.
		const recordIsNew = ! this._recordsById[ recordId ];

		if( recordIsNew ) {
			this._recordsById[ recordId ] = {};
			this._recordIds.push( recordId );
			this.length++;
		}

		for( const field in dto ) {
			if( _.isObject( dto[ field ] ) ) {
				this._recordsById[ recordId ][ field ] = _.clone( dto[ field ] );
				this._deepFreeze( this._recordsById[ recordId ][ field ] );
			} else this._recordsById[ recordId ][ field ] = dto[ field ];
		}
	},

	_deepFreeze( obj ) {
		Object.freeze( obj );

		for( const attribute in obj ) {
			if( obj[ attribute ] !== null && typeof obj[ attribute ] === 'object' ) {
				this._deepFreeze( obj[ attribute ] );
			}
		}
		
		return obj;
	},

	_sync( url, verb, payload, ajaxOptions ) {
		const options = _.defaults( {}, options );

		// Default JSON-request options.
		const params = {
			url,
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
const underscoreTableMethodNames = [ 'forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
	'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
	'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
	'max', 'min', 'sortedIndex', 'size', 'first', 'head', 'take',
	'initial', 'rest', 'tail', 'drop', 'last', 'without', 'indexOf', 'shuffle',
	'lastIndexOf', 'isEmpty' ];

// Mix in each Underscore method as a proxy to _recordIds.
for( const thisMethodName of underscoreTableMethodNames ) {
	CollectionService.prototype[ thisMethodName ] = function() {
		const args = Array.prototype.slice.call( arguments );
		args.unshift( this.ids() );
		return _[ thisMethodName ].apply( _, args );
	};
}

// Underscore methods that take a property name as an argument.
const attributeMethods = [ 'groupBy', 'countBy' ]; // used to proxy sortBy, but unclear on use case here

// Use attributes instead of properties.
for( const method of attributeMethods ) {
	CollectionService.prototype[ method ] = function( value, context ) {
		const iterator = _.isFunction( value ) ? value : thisRecordId => {
			return this._recordsById[ thisRecordId ][ value ];
		};
		
		return _[ method ]( this._recordIds, iterator, context );
	};
}
