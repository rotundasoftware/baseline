/**
 * This class defines the methods neeeded to implement a CRUD strategy.
 */
export default class BaseStrategy {
	// eslint-disable-next-line no-unused-vars
	async fetch( id, fields, entity ) {
		throw new Error( 'Method not implemented: fetch' );
	}

	// eslint-disable-next-line no-unused-vars
	async fetchList( options, fields, entity ) {
		throw new Error( 'Method not implemented: fetchList' );
	}

	// eslint-disable-next-line no-unused-vars
	async upsert( dto, entity ) {
		throw new Error( 'Method not implemented: upsert' );
	}

	// eslint-disable-next-line no-unused-vars
	async destroy( id, entity ) {
		throw new Error( 'Method not implemented: destroy' );
	}
}