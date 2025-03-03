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
				this.#data[ key ] = data[ key ];
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

	get( key ) {
		assertType( { key }, 'string' );

		if( key in this.#data ) {
			return this.#data[ key ];
		} else {
			throw new Error( `Key "${ key }" not found in Baseline store` );
		}
	}
}