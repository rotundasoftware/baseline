import assertType from '@rotundasoftware/assert-type';

export default class BaseService {
	constructor() {
		// Prevent instantiation of this abstract class
		if( this.constructor === BaseService ) throw new Error( 'Cannot instantiate abstract class: BaseService' );

		this._baseline = null;
	}

	setBaseline( baseline ) {
		assertType( { baseline }, 'object' );

		this._baseline = baseline;
	}

	// eslint-disable-next-line no-unused-vars
	merge( data ) {
		throw new Error( 'Method not implemented: merge' );
	}

	empty() {
		throw new Error( 'Method not implemented: empty' );
	}
}