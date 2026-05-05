import assertType from '@rotundasoftware/assert-type';

export default class Baseline {
	#services = {};
	#data = {};

	constructor( services = {} ) {
		assertType( { services }, 'object' );

		Object.values( services ).forEach( service => service.setBaseline( this ) );
		Object.assign( this, services );
		this.#services = services;
	}

	merge( data ) {
		assertType( { data }, 'object' );

		Object.keys( data ).forEach( key => {
			if( this.#services[ key ] ) {
				this.#services[ key ].merge( data[ key ] );
			} else {
				const value = data[ key ];
				const storedValue = value && typeof value === 'object' ? this.#deepClone( value ) : value;
				if( storedValue && typeof storedValue === 'object' ) this.#deepFreeze( storedValue );
				this.#data[ key ] = storedValue;
			}
		} );
	}

	empty() {
		this.#services.forEach( service => service.empty() );
		this.#data = {};
	}

	hasKey( key ) {
		assertType( { key }, 'string' );

		try {
			this.get( key );
			return true;
		} catch{
			return false;
		}
	}

	hasKeys( keys ) {
		assertType( { keys }, 'array' );

		return keys.every( key => this.hasKey( key ) );
	}

	get( key, options = {} ) {
		assertType( { key }, 'string' );
		assertType( { options }, 'object' );

		const { clone = false } = options;
		assertType( { clone }, 'boolean' );

		if( key in this.#data ) {
			let result = this.#data[ key ];
			if( clone && typeof result === 'object' ) result = this.#deepClone( result );
			return result;
		} else {
			throw new Error( `Key "${ key }" not found in Baseline store` );
		}
	}

	/**
	 * Deep clone object
	 * @param {object} obj
	 * @returns {object}
	 */
	#deepClone( obj ) {
		assertType( { obj }, 'object' );

		return JSON.parse( JSON.stringify( obj ) );
	}

	/**
	 * Deep freeze an object.
	 * @param {object} obj
	 */
	#deepFreeze( obj ) {
		assertType( { obj }, 'object', 'array' );

		Object.freeze( obj );

		Object.values( obj ).forEach( value => {
			if( value && typeof value === 'object' ) this.#deepFreeze( value );
		} );
	}
}