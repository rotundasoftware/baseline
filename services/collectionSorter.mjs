import _ from 'underscore';

import assertType from '@rotundasoftware/assert-type';

/**
 * API for sorting collections of records based on complex criteria.
 */
export default class CollectionSorter {
	#sortFunctions = {};

	/**
	 * Register a sort function that can be later referenced by name.
	 * Sort functions map a record ID to a value that will be used for sorting.
	 * @param {string} name
	 * @param {function} sortfunction
	 */
	registerSortFunction( name, sortfunction ) {
		assertType( { name }, 'string' );
		assertType( { sortfunction }, 'function' );

		this.#sortFunctions[ name ] = sortfunction;
	}

	/**
	 * Check if a sort function exist
	 * @param {string} name
	 * @returns {boolean}
	 */
	hasSortFunction( name ) {
		assertType( { name }, 'string' );

		return Boolean( this.#sortFunctions[ name ] );
	}

	/**
	 * Sort a collection of record IDs based on the provided criteria.
	 * "sortBy" is an array of objects with the shape { criteria, descending } where:
	 * - "criteria" can be a custom sort function, or a string referencing a registered sort function.
	 * - "descending" is a boolean used to reverse sort order.
	 * @param {Array<UUID>} recordIds
	 * @param {Array<object>} sortBy
	 * @returns {Array<UUID>}
	 */
	sort( recordIds, sortBy ) {
		assertType( { recordIds, sortBy }, 'array' );

		const sortComparators = sortBy.map( ( { criteria, descending } ) => this.#getSortComparator( criteria, descending ) );
		const masterSortComparator = this.#getMasterSortComparator( sortComparators );

		return _.clone( recordIds ).sort( masterSortComparator );
	}

	/**
	 * Transforms a sort criteria into an comparator function that can be used to compare records.
	 * @param {string|function} criteria
	 * @param {boolean} descending
	 * @returns {function}
	 */
	#getSortComparator( criteria, descending = false ) {
		assertType( { criteria }, 'string', 'function' );
		assertType( { descending }, 'boolean' );

		const sortFunction = typeof criteria === 'function' ? criteria : this.#sortFunctions[ criteria ];
		if( typeof sortFunction !== 'function' ) throw new Error( `Sort function not found: ${ criteria }` );

		const sortComparator = ( recordId_a, recordId_b ) => {
			const value_a = sortFunction.call( this, recordId_a );
			const value_b = sortFunction.call( this, recordId_b );

			if( value_a === value_b ) return 0;

			const result = value_a > value_b ? 1 : -1;

			return descending ? -result : result;
		};

		return sortComparator;
	}

	/**
	 * Consolidate a sequence of comparator functions into a single function that can be used to compare records.
	 * @param {Array<function>} sortFunctions
	 * @returns {function}
	 */
	#getMasterSortComparator( sortFunctions ) {
		assertType( { sortFunctions }, 'array' );

		return ( recordId_a, recordId_b ) => {
			for( const sortFunction of sortFunctions ) {
				const result = sortFunction( recordId_a, recordId_b );
				if( result !== 0 ) return result;
			}

			return 0;
		};
	}
}