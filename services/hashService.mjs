import _ from 'underscore';

import assertType from '@rotundasoftware/assert-type';
import BaseService from './baseService.mjs';

/**
 * Baseline service used to manage single hashes of data.
 */
export default class HashService extends BaseService {
	#data = {};

	/**
	 * Constructor
	 * @param {object} data - Initial data.
	 */
	constructor( data = {} ) {
		assertType( { data }, 'object' );

		super();

		// Prevent instantiation of this abstract class
		if( this.constructor === HashService ) throw new Error( 'Cannot instantiate abstract class: HashService' );

		this.#data = data;
	}

	/**
	 * Add additional keys to the local store.
	 * @param {object} data
	 */
	merge( data ) {
		assertType( { data }, 'object' );

		const newData = {
			...this.#data,
			...data
		};

		this.#deepFreeze( newData );

		this.#data = newData;
	}

	/**
	 * Remove all fields from the local store.
	 */
	empty() {
		const newData = this.#deepFreeze( {} );
		this.#data = newData;
	}

	/**
	 * Check if a key exists in the local store.
	 * @param {string} key
	 * @returns {boolean}
	 */
	hasKey( key ) {
		assertType( { key }, 'string' );

		try {
			this.get( key );
			return true;
		} catch( err ) {
			return false;
		}
	}

	/**
	 * Check if a one or more keys exist in the local store.
	 * @param {string} key
	 * @returns {boolean}
	 */
	hasKeys( keys ) {
		assertType( { keys }, 'array' );

		return keys.every( key => this.hasKey( key ) );
	}

	/**
	 * Get one or more values from the local store.
	 * @param {Array<string>|string} keys
	 * @param {object} options - Additional options.
	 * @param {boolean} options.clone - Clone object values so they can be operated on. Objects are frozen otherwise.
	 * @returns {any} - Field values.
	 */
	get( keys, options = {} ) {
		assertType( { keys }, 'array', 'string' );
		assertType( { options }, 'object' );

		const { clone = false } = options;
		assertType( { clone }, 'boolean' );

		const data = this.#data;

		if( keys ) {
			const validKeys = Object.keys( data );
			const invalidKeys = _.difference( [].concat( keys ), validKeys );
			if( invalidKeys.length > 0 ) throw new Error( `Keys "${ invalidKeys.join( ', ' ) }" not found in local data` );
		}

		let result = typeof keys === 'string' ?
			data[ keys ] :
			_.pick( data, keys );

		if( clone && typeof result === 'object' ) result = this.#deepClone( result );

		return result;
	}

	/**
	 * Deep clone object
	 * @param {object} dto
	 * @returns {object}
	 */
	#deepClone( obj ) {
		assertType( { obj }, 'object' );

		return JSON.parse( JSON.stringify( obj ) );
	}

	/**
	 * Deep freeze an object.
	 * Notice that freeze operations don't return anything.
	 * @param {object} dto
	 */
	#deepFreeze( obj ) {
		assertType( { obj }, 'object', 'array' );

		Object.freeze( obj );

		Object.values( obj ).forEach( value => {
			if( value && typeof value === 'object' ) this.#deepFreeze( value );
		} );
	}
}