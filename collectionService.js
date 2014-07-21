var _ = require( 'underscore' );
var BaseService = require( './baseService' );
var steamer = require( 'steamer' );
var Events = require( 'backbone-events-standalone' );

var mMachineId = parseInt( Math.random() * 0xFFFFFF, 10 );
var mProcessId = typeof( process ) === 'object' && typeof( process.pid ) === 'number' ? process.pid : Math.floor( Math.random() * 32767 );
var mUniqueIdIncrement = 0;

var CollectionService = module.exports = BaseService.extend( {
	initialize : function( options ) {
		options = _.defaults( {}, options, {
			idFieldName : "_id"
		} );

		if( _.isUndefined( this.collectionName ) ) throw new Error( 'The collectionName attribute must be defined on collection service instances.' );
		//if( _.isUndefined( this.fieldNames ) ) throw new Error( 'The fieldNames attribute must be defined on data service instances.' );

		this.length = 0;
		
		//this._fieldNames = this.fieldNames;
		this._recordIds = [];
		this._recordsById = {};

		this._idFieldName = options.idFieldName;

		Events.mixin( this );

		BaseService.prototype.initialize( options );
	},

	createContainer : function() {
		return new steamer.MongoCollectionContainer( {
			collection : this.collectionName
		} );
	},

	create : function( initialFieldValues, options ) {
		options = _.defaults( {}, options, { silent : false } );

		if( ! initialFieldValues ) initialFieldValues = {};

		if( ! initialFieldValues[ this._idFieldName ] )
			initialFieldValues[ this._idFieldName ] = this._getUniqueId();

		_.defaults( initialFieldValues, this.fields );

		var params = {
			collectionName : this.collectionName,
			fieldValues : initialFieldValues
		};

		this.merge( [ initialFieldValues ] );

		this.trigger( 'operation', 'createRecord', params );
		this.trigger( 'create', initialFieldValues, options );

		return initialFieldValues[ this._idFieldName ];
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

		if( fields === '*' ) fields = _.keys( this._recordsById[ recordId ] );

		if( ! _.isArray( fields ) ) fields = Array.prototype.slice.apply( arguments, 1 );
		var values = {};

		_.each( fields, function( thisFieldName ) {
			values[ thisFieldName ] = _this.get( recordId, thisFieldName );
		} );

		return values;
	},

	set : function( recordId, fieldName, fieldValue ) {
		if( _.isArray( fieldName ) ) this.setMultiple( recordId, fieldName ); // uuu, why do we have sets & setMultiple if we are doing this? also shouldn't this be if _.isObject()?
		else this.rawSet.apply( this, arguments );
	},

	sets : function( recordId, fields ) {
		_.each( fields, function( thisFieldValue, thisFieldName ) {
			this.set( recordId, thisFieldName, thisFieldValue );
		}, this );
	},

	rawSet : function( recordId, fieldName, fieldValue ) {
		if( ! this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present in table \'' + this.collectionName + '\'.' );
		
		if( fieldName === this._idFieldName ) throw new Error( 'Changing the id field of an existing record is not supported.' );
		
		// not sure we want to check if the data exists before setting it.. for example, we create a new record, and then want to fill
		// in fields.. of course data will not be there (unless we initilize all fields to their default values, which might make sense,
		// but jury is still out, so we will do it this way for now.
		//if( _.isUndefined( this._recordsById[ recordId ][ fieldName ] ) ) throw new Error( 'Field \'' + fieldName + '\' not present for record id ' + recordId + ' in table \'' + this.collectionName + '\'.' );
		this._recordsById[ recordId ][ fieldName ] = this._copyFieldValue( fieldValue );

		var params = {
			collectionName : this.collectionName,
			recordId : recordId,
			fieldName : fieldName,
			value : fieldValue
		};

		this.trigger( 'operation', 'setField', params );
		this.trigger( 'set', recordId, fieldName, fieldValue );
	},

	destroy : function( recordId ) {
		if( ! this._recordsById[ recordId ] ) throw new Error( 'Record id ' + recordId + ' is not present.' );
	
		this._recordIds = _.without( this._recordIds, recordId );
		delete this._recordsById[ recordId ];
		this.length--;

		var params = {
			collectionName : this.collectionName,
			recordId : recordId
		};

		this.trigger( 'operation', 'destroyRecord', params );
		this.trigger( 'destroy', recordId );
	},

	ids : function() {
		// return a copy of the ids array
		return this._recordIds.slice( 0 );
	},

	sortIds : function( ids ) {
		var allIds = this.ids();

		var sortedIds = [];

		for( var i = 0, len = allIds.length; i < len; i++ ) {
			if( ids.indexOf( allIds[ i ] ) !== -1 )
				sortedIds.push( allIds[ i ] );
		}

		return sortedIds;

		// not sure why were were doing this below? we were returning just 'ids', but
		// this seems equivilent to just returning sortedIds at this point
		// // copy the sortedIds back to ids so its as if we did it in place
		// for( i = 0, len = sortedIds.length; i < len; i++ ) {
		// 	ids[ i ] = sortedIds[ i ];
		// }

		// return ids;
	},

	isPresent : function( recordId, fieldName ) {
		// fieldName is optional.. if not supplied function will return true iff recordId is present

		if( _.isUndefined( this._recordsById[ recordId ] ) ) return false;
		if( ! _.isUndefined( fieldName ) && _.isUndefined( this._recordsById[ recordId ][ fieldName ] ) ) return false;

		return true;
	},

	sort: function() {
		var _this = this;
		if( ! this.comparator )
			throw new Error( 'Cannot sort without a comparator' );
		
		if( _.isString( this.comparator ) || this.comparator.length === 1 )
			this._recordIds = this.sortBy( this.comparator, this );
		else
			this._recordIds.sort( _.bind( this.comparator, this ) );
	},

	merge : function( newRecords, options ) {
		_.each( newRecords, function( thisRecord ) {
			var recordId = thisRecord[ this._idFieldName ];

			if( _.isUndefined( recordId ) )
				throw new Error( 'Each record must define a unique id.' );

			// make sure the attributes we end up storing are copies, in case
			// somebody is using the original newRecords.
			var copiedRecord = this._copyRecord( thisRecord );

			if( ! this._recordsById[ recordId ] ) this._recordsById[ recordId ] = {};
			_.defaults( this._recordsById[ recordId ], copiedRecord );

			this._recordIds.push( recordId );
			this.length++;
		}, this );

		if( ! _.isUndefined( this.comparator ) ) {
			this.sort();
		}
	},

	toJSON : function( recordIds ) {
		if( _.isUndefined( recordIds ) ) recordIds = this._recordIds;

		return _.map( recordIds, function( thisRecordId ) {
			return this._copyRecord( this._recordsById[ thisRecordId ] );
		}, this );
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
		var timestamp = Math.floor( new Date().valueOf() / 1000 ).toString( 16 ).substr( 0, 8 );
		var machineId = mMachineId.toString( 16 ).substr( 0, 6 );
		var processId =  mProcessId.toString( 16 ).substr( 0, 4 );

		if( mUniqueIdIncrement > 0xffffff ) mUniqueIdIncrement = 0;
		var increment = mUniqueIdIncrement.toString( 16 ).substr( 0, 6 );

		mUniqueIdIncrement++;

		return '00000000'.substr( 0, 8 - timestamp.length ) + timestamp +
           '000000'.substr( 0, 6 - machineId.length ) + machineId +
           '0000'.substr( 0, 4 - processId.length ) + processId +
           '000000'.substr( 0, 6 - increment.length ) + increment;
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
var attributeMethods = [ 'groupBy', 'countBy', 'sortBy' ];

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
