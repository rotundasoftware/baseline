import _ from 'underscore';
import matchesWhereQuery from 'matches-where-query';

import assertType from '@rotundasoftware/assert-type';

import BaseService from '../baseService.mjs';
import CollectionFilter from './collectionFilter.mjs';
import CollectionSorter from './collectionSorter.mjs';

/**
 * Baseline service used to manage collections of records.
 */
class CollectionService extends BaseService {
	static entity = null;
	static proxiedMethods = [ 'get', 'fetch', 'upsert', 'destroy', 'isPresent' ];

	#records = [];
	#throwOnCrudFailure;
	#collectionFilter = null;
	#collectionSorter = null;

	/**
	 * Constructor
	 * @param {object} crudStrategy - Instance of a CRUD strategy class.
	 * @param {object} options - Additional options.
	 * @param {Boolean} options.throwOnCrudFailure - Wether to throw or return { success : false } on CRUD failures.
	 */
	constructor( crudStrategy, options = {} ) {
		super();

		// Prevent instantiation of this abstract class
		if( this.constructor === CollectionService ) throw new Error( 'Cannot instantiate abstract class: CollectionService' );

		assertType( { crudStrategy, options }, 'object' );
		assertType( { entity : this.constructor.entity }, 'string' );

		const { throwOnCrudFailure = true } = options;

		assertType( { throwOnCrudFailure }, 'boolean' );

		this._crudStrategy = crudStrategy;
		this.#throwOnCrudFailure = throwOnCrudFailure;

		this.#collectionFilter = new CollectionFilter();
		this.#collectionSorter = new CollectionSorter();

		this._registerFilter( 'fieldValue', this.#filterFieldValue.bind( this ) );
		this._registerFilter( 'where', this.#filterWhere.bind( this ) );
	}

	/**
	 * Add records to the local store.
	 * @param {Array<object>} dtos - An array of DTOs to merge.
	 */
	merge( dtos ) {
		assertType( { dtos }, 'array' );

		dtos.forEach( dto => this.upsertLocal( dto ) );
	}

	/**
	 * Remove all records from the local store.
	 */
	empty() {
		this.#records = {};
	}

	/**
	 * List the IDs of all records in the local store.
	 * @returns {Array<UUID>}
	 */
	ids() {
		return Object.keys( this.#records );
	}

	/**
	 * Check if a record, or optionally, some of its fields, are present in the local store.
	 * @param {uuid} id - Record ID.
	 * @param {Array<string>|string|undefined} fields - If provided, also checks that this field or fields are present in the record.
	 * @returns {boolean}
	 */
	isPresent( id, fields ) {
		assertType( { fields }, 'array', 'string', 'undefined' );

		try {
			assertType( { id }, 'uuid' );
		} catch{
			return false;
		}

		if( ! fields ) fields = 'id';

		try {
			this.get( id, fields );
			return true;
		} catch{
			return false;
		}
	}

	/**
	 * Get a record from the local store.
	 * @param {uuid} id - Record ID.
	 * @param {Array<string>|string} fields - Field or fields to retrieve from the record.
	 * @param {object} options - Additional options.
	 * @param {boolean} options.clone - Clone record so it can be operated on. Records are frozen otherwise.
	 * @returns {any} - Field value, or object with field values.
	 */
	get( id, fields, options = {} ) {
		assertType( { id }, 'uuid' );
		assertType( { fields }, 'array', 'string' );
		assertType( { options }, 'object' );

		const { clone = false } = options;
		assertType( { clone }, 'boolean' );

		const { entity } = this.constructor;
		const record = this.#records[ id ];
		if( ! record ) throw new Error( `Local record not found: ${ entity } ${ id }` );

		if( fields ) {
			const validFields = Object.keys( record );
			const invalidFields = _.difference( [].concat( fields ), validFields );
			if( invalidFields.length > 0 ) throw new Error( `Fields "${ invalidFields.join( ', ' ) }" not found in local record: ${ entity } ${ id }` );
		}

		let result = typeof fields === 'string' ?
			record[ fields ] :
			_.pick( record, fields );

		if( clone && typeof result === 'object' ) result = this.#deepClone( result );

		return result;
	}

	/**
	 * List records from the local store that match the provided query.
	 * @param {object} attrs - A matches-where-query compliant query object.
	 * @param {object} options - Additional options.
	 * @param {boolean} options.ignoreMissingFields - Wether to throw if query object contains fields not present in the records.
	 * @returns {Array<object>} - List of records
	 */
	where( attrs, options = {} ) {
		assertType( { attrs, options }, 'object' );

		const { ignoreMissingFields = false } = options;

		assertType( { ignoreMissingFields }, 'boolean' );

		const fields = Object.keys( attrs ).concat( 'id' );
		const records = _.chain( this.ids() )
			.map( recordId => ignoreMissingFields ? this.#records[ recordId ] : this.get( recordId, fields ) )
			.filter( record => matchesWhereQuery( record, attrs ) )
			.pluck( 'id' )
			.value();

		return records;
	}

	/**
	 * Get the first value from the local store that matches the provided query.
	 * @param {object} attrs - A matches-where-query compliant query object.
	 * @param {object} options - Additional options.
	 * @param {boolean} options.ignoreMissingFields - Wether to throw if query object contains fields not present in the records.
	 * @returns {object|undefined} - Record, or undefined if not found.
	 */
	findWhere( attrs, options = {} ) {
		assertType( { attrs, options }, 'object' );

		const { ignoreMissingFields = false } = options;

		assertType( { ignoreMissingFields }, 'boolean' );

		const fields = Object.keys( attrs ).concat( 'id' );
		const record = _.chain( this.ids() )
			.map( recordId => ignoreMissingFields ? this.#records[ recordId ] : this.get( recordId, fields ) )
			.find( record => matchesWhereQuery( record, attrs ) )
			.value();

		return record?.id;
	}

	/**
	 * Get a list of field values from the local store.
	 * @param {string} field - Field name.
	 * @returns {Array} - Field values.
	 */
	pluck( field ) {
		assertType( { field }, 'string' );

		const values = _.chain( this.ids() )
			.map( recordId => this.get( recordId, field ) )
			.value();

		return values;
	}

	/**
	 * Retrieve a record from the server and add it to the local store.
	 * @param {uuid} id - Record ID.
	 * @param {Array<string>|string|undefined} fields - If provided, retrieve only these fields.
	 * @returns {object} - Object with operation status and record data.
	 */
	async fetch( id, fields ) {
		assertType( { id }, 'uuid' );
		assertType( { fields }, 'string', 'array', 'undefined' );

		if( fields ) fields = _.uniq( [ 'id' ].concat( fields ) );

		let dto;
		try {
			dto = await this._crudStrategy.fetch( id, fields, this.constructor.entity );
		} catch( err ) {
			if( this.#throwOnCrudFailure ) throw err;
			return { success : false };
		}

		this.upsertLocal( dto );

		return {
			success : true,
			data : dto
		};
	}

	/**
	 * Retrieve a list of records from the server that match the provided query, and add them to the local store.
	 * @param {object} where - A matches-where-query compliant query object.
	 * @param {Array<string>|string|undefined} fields - If provided, retrieve only these fields.
	 * @returns {object} - Object with operation status and a list of records found.
	 */
	// #TODO add pagination logic when it's available in Warehouse
	async fetchList( { where, fields } = {} ) {
		assertType( { where }, 'object', 'undefined' );
		assertType( { fields }, 'string', 'array', 'undefined' );

		if( fields ) fields = _.uniq( [ 'id' ].concat( fields ) );

		let dtos;
		try {
			dtos = await this._crudStrategy.fetchList( where, fields, this.constructor.entity );
		} catch( err ) {
			if( this.#throwOnCrudFailure ) throw err;
			return { success : false };
		}

		this.merge( dtos );

		return {
			success : true,
			data : dtos
		};
	}

	/**
	 * Create or update a record in the server and add/update it to the local store.
	 * The presence of the "id" field in the DTO determines if the operation is an update or a create.
	 * @param {object} dto - Record to persist.
	 * @returns {object} - Object with operation status and persisted record data, as returned from the server.
	 */
	async upsert( dto ) {
		assertType( { dto }, 'object' );

		const clonedDto = this.#deepClone( dto );
		let finalDto;

		try {
			finalDto = await this._crudStrategy.upsert( clonedDto, this.constructor.entity );
		} catch( err ) {
			if( this.#throwOnCrudFailure ) throw err;
			return { success : false };
		}

		this.upsertLocal( finalDto );

		return {
			success : true,
			data : finalDto
		};
	}

	/**
	 * Destroy a record in the server and remove it from the local store.
	 * @param {uuid} id - Record ID.
	 * @returns {object} - Object with operation status.
	 */
	async destroy( id ) {
		assertType( { id }, 'uuid' );

		try {
			await this._crudStrategy.destroy( id, this.constructor.entity );
		} catch( err ) {
			if( this.#throwOnCrudFailure ) throw err;
			return { success : false };
		}

		this.destroyLocal( id );

		return { success : true };
	}

	/**
	 * Destroy one or more records in the server and remove them from the local store.
	 * @param {Array<UUID>} ids - Record IDs.
	 * @returns {object} - Object with operation status.
	 */
	async destroyMultiple( ids ) {
		assertType( { ids }, 'array' );

		try {
			await this._crudStrategy.destroyMultiple( ids, this.constructor.entity );
		} catch( err ) {
			if( this.#throwOnCrudFailure ) throw err;
			return { success : false };
		}

		ids.forEach( id => this.destroyLocal( id ) );

		return { success : true };
	}

	/**
	 * Add or update a cloned & frozen version of the record provided in the local store.
	 * @param {object} dto - Record data. Must contain an "id" field.
	 */
	upsertLocal( dto ) {
		assertType( { dto }, 'object' );
		assertType( { 'dto.id' : dto.id }, 'uuid' );

		const isNew = ! ( dto.id in this.#records );
		let newLocalRecord;

		if( isNew ) {
			newLocalRecord = dto;
		} else {
			const localRecordClone = this.#deepClone( this.#records[ dto.id ] );
			newLocalRecord = Object.assign( localRecordClone, dto );
		}

		this.#deepFreeze( newLocalRecord );

		this.#records[ newLocalRecord.id ] = newLocalRecord;
	}

	/**
	 * Remove a record from the local store.
	 * @param {uuid} id - Record ID.
	 */
	destroyLocal( id ) {
		assertType( { id }, 'uuid' );

		delete this.#records[ id ];
	}

	/**
	 * Deep clone object
	 * @param {object} dto
	 * @returns {object}
	 */
	#deepClone( dto ) {
		assertType( { dto }, 'object' );

		return JSON.parse( JSON.stringify( dto ) );
	}

	/**
	 * Deep freeze an object.
	 * Notice that freeze operations don't return anything.
	 * @param {object} dto
	 */
	#deepFreeze( dto ) {
		assertType( { dto }, 'object', 'array' );

		Object.freeze( dto );

		Object.values( dto ).forEach( value => {
			if( value && typeof value === 'object' ) this.#deepFreeze( value );
		} );
	}
	/**
			 * Creates a proxy for a record, accesible in the service's "active" property.
			 * @param {uuid} id - Record ID.
			 */
	setActive( id ) {
		assertType( { id }, 'uuid', 'null' );

		this.active = id ? this.createProxy( id ) : null;
	}

	/**
			 * Make a proxy object: an object that contains all methods listed in the static property "proxiedMethods",
			 * partially applied with the provided record ID.
			 * @param {uuid} id - Record ID.
			 * @returns {object}
			 */
	createProxy( id ) {
		// This will trhow an error if the record is not present
		this.get( id, 'id' );

		const proxy = {};
		this.constructor.proxiedMethods.forEach( method => {
			proxy[ method ] = _.bind( this[ method ], this, id );
		} );

		return proxy;
	}

	/**
			 * Filtering API
			 * See CollectionFilter for additional information.
			 */
	compileFilter( filterNode ) {
		return this.#collectionFilter.compileFilter( filterNode );
	}

	_registerFilter( filterName, filterFunction ) {
		this.#collectionFilter.registerFilter( filterName, filterFunction );
	}

	_registerComparator( comparatorName, comparatorFunction ) {
		this.#collectionFilter.registerComparator( comparatorName, comparatorFunction );
	}

	_getComparator( comparatorName, needle ) {
		return this.#collectionFilter.getComparator( comparatorName, needle );
	}

	/**
			 * Filter node: record passes based on a configurable comparison against one of its fields.
			 * @param {oject} options
			 * @param {string} options.fieldName - Existing record field name.
			 * @param {string} options.comparator - Registered comparator name.
			 * @param {string} options.needle - Value to compare against.
			 * @returns {function}
			 */
	#filterFieldValue( options ) {
		assertType( { options }, 'object' );

		const { fieldName, comparator, needle } = options;

		assertType( { fieldName, comparator }, 'string' );

		const comparatorFunction = this._getComparator( comparator, needle );

		return recordId => {
			const fieldValue = this.get( recordId, fieldName );
			return comparatorFunction( fieldValue );
		};
	}

	/**
			 * Filter node: compare a filter object against the record's.
			 * For each fieldName/targetValue pair in the needle, record passes if its field value matches (or is included in the) targetValue.
			 * @param {object} options
			 * @param {string} options.needle - Target values keyed by field name.
			 * @returns {function}
			 */
	#filterWhere( options ) {
		assertType( { options }, 'object' );

		const { needle } = options;

		assertType( { needle }, 'object' );

		return recordId => {
			Object.keys( needle ).all( fieldName => {
				const targetValue = needle[ fieldName ];
				const fieldValue = this.get( recordId, fieldName );

				return Array.isArray( targetValue ) ?
					targetValue.includes( fieldValue ) :
					fieldValue === targetValue;
			} );
		};
	}

	/**
			 * Sorting API
			 * See CollectionSorter for additional information.
			 */
	sort( recordIds, sortBy ) {
		assertType( { recordIds }, 'array' );

		// Canonicalize sortBy shape.
		// 1. Wrap in array.
		sortBy = [].concat( sortBy );

		// 2. Validate individual sortBy elements.
		sortBy.forEach( thisSortBy => {
			assertType( { thisSortBy }, 'string', 'function', 'object' );
		} );

		// 3. Map to array of objects with the shape { criteria, descending },
		// transforming any non-registered sort function name into a field getter.
		sortBy = sortBy
			.map( thisSortBy => typeof thisSortBy !== 'object' ? { criteria : thisSortBy } : thisSortBy )
			.map( thisSortBy => {
				const { criteria, descending } = thisSortBy;
				assertType( { criteria }, 'string', 'function' );
				assertType( { descending }, 'boolean', 'undefined' );

				const criteriaExists = typeof criteria === 'function' || this.#collectionSorter.hasSortFunction( criteria );

				return {
					criteria : criteriaExists ?
						criteria :
						recordId => this.get( recordId, criteria ),
					descending
				};
			} );

		return this.#collectionSorter.sort( recordIds, sortBy );
	}

	_registerSortFunction( name, sortFunction ) {
		this.#collectionSorter.registerSortFunction( name, sortFunction );
	}
}

export default CollectionService;
