import _ from 'underscore';
import escapeStringRegexp from 'escape-string-regexp';

import assertType from '@rotundasoftware/assert-type';

/**
 * API for filtering collection records based on complex criteria
 */
export default class CollectionFilter {
	#filters = {};
	#comparators = {};

	constructor() {
		this.registerFilter( 'and', this.#filterAnd.bind( this ) );
		this.registerFilter( 'or', this.#filterOr.bind( this ) );

		this.registerComparator( 'equals', this.#comparatorEquals );
		this.registerComparator( 'doesNotEqual', this.#comparatorDoesNotEqual );
		this.registerComparator( 'isGreaterThan', this.#comparatorIsGreaterThan );
		this.registerComparator( 'isLessThan', this.#comparatorIsLessThan );
		this.registerComparator( 'isGreaterThanOrEqualTo', this.#comparatorIsGreaterThanOrEqualTo );
		this.registerComparator( 'isLessThanOrEqualTo', this.#comparatorIsLessThanOrEqualTo );
		this.registerComparator( 'containsAWordThatStartsWith', this.#comparatorContainsAWordThatStartsWith );
		this.registerComparator( 'startsWith', this.#comparatorStartsWith );
		this.registerComparator( 'endsWith', this.#comparatorEndsWith );
		this.registerComparator( 'containsText', this.#comparatorContainsText );
		this.registerComparator( 'contains', this.#comparatorContains );
		this.registerComparator( 'doesNotContain', this.#comparatorDoesNotContain );
		this.registerComparator( 'containsSome', this.#comparatorContainsSome );
		this.registerComparator( 'containsAll', this.#comparatorContainsAll );
		this.registerComparator( 'isContained', this.#comparatorIsContained );
		this.registerComparator( 'isEmpty', this.#comparatorIsEmpty );
		this.registerComparator( 'isNotEmpty', this.#comparatorIsNotEmpty );
	}

	/**
	 * Register a filter factory function that can later be referenced by name.
	 * @param {string} name
	 * @param {function} filterFunction
	 */
	registerFilter( name, filterFunction ) {
		assertType( { name }, 'string' );
		assertType( { filterFunction }, 'function' );

		this.#filters[ name ] = filterFunction;
	}

	/**
	 * Register a comparator factory function that can be referenced by name.
	 * @param {string} name
	 * @param {function} comparatorFunction
	 */
	registerComparator( name, comparatorFunction ) {
		assertType( { name }, 'string' );
		assertType( { comparatorFunction }, 'function' );

		this.#comparators[ name ] = comparatorFunction;
	}

	/**
	 * Get a comparator function from a registered comparator factory method.
	 * @param {string} name - Comparator name
	 * @param  {any} needle - Value to compare against
	 * @returns {function}
	 */
	getComparator( name, needle ) {
		assertType( { name }, 'string' );

		return this.#comparators[ name ]( needle );
	}

	/**
	 * Compile a filter node into an actual filter function.
	 * @param {function|null|Array|object} filterNode
	 * @returns {function}
	 */
	compileFilter( filterNode ) {
		assertType( { filterNode }, 'function', 'null', 'array', 'object' );

		let compiledFilter;
		if( typeof filterNode === 'function' ) {
			compiledFilter = filterNode;
		} else if( filterNode === null ) {
			compiledFilter = () => true;
		} else if( Array.isArray( filterNode ) ) {
			compiledFilter = this.#filters.and( { children : filterNode } );
		} else {
			compiledFilter = this.#filters[ filterNode.type ]( filterNode );
		}

		return compiledFilter;
	}

	#filterAnd( options ) {
		assertType( { options }, 'object' );

		const { children } = options;

		assertType( { children }, 'array' );

		const childrenFilters = children.map( childNode => this.compileFilter( childNode ) );
		const filter = recordId => childrenFilters.every( childFilter => childFilter( recordId ) );
		return filter;
	}

	#filterOr( options ) {
		assertType( { options }, 'object' );

		const { children } = options;

		assertType( { children }, 'array' );

		const childrenFilters = children.map( childNode => this.compileFilter( childNode ) );
		const filter = recordId => childrenFilters.some( childFilter => childFilter( recordId ) );
		return filter;
	}

	#comparatorEquals( needle ) {
		return value => value === needle;
	}

	#comparatorDoesNotEqual( needle ) {
		return value => value !== needle;
	}

	#comparatorIsGreaterThan( needle ) {
		assertType( { needle }, 'integer', 'string' );

		return value => value > needle;
	}

	#comparatorIsGreaterThanOrEqualTo( needle ) {
		assertType( { needle }, 'integer', 'string' );

		return value => value >= needle;
	}

	#comparatorIsLessThan( needle ) {
		assertType( { needle }, 'integer', 'string' );

		return value => value < needle;
	}

	#comparatorIsLessThanOrEqualTo( needle ) {
		assertType( { needle }, 'integer', 'string' );

		return value => value <= needle;
	}

	#comparatorContainsAWordThatStartsWith( needle ) {
		assertType( { needle }, 'string' );

		const substringRegex = new RegExp( '\\b' + escapeStringRegexp( needle ), 'i' );
		return value => value ?
			value.search( substringRegex ) !== -1 :
			false;
	}

	#comparatorStartsWith( needle ) {
		assertType( { needle }, 'string' );

		if( needle ) needle = needle.toLowerCase();
		return value => ( value || '' ).toLowerCase().startsWith( needle );
	}

	#comparatorEndsWith( needle ) {
		assertType( { needle }, 'string' );

		if( needle ) needle = needle.toLowerCase();
		return value => ( value || '' ).toLowerCase().endsWith( needle );
	}

	#comparatorContainsText( needle ) {
		assertType( { needle }, 'string' );

		needle = needle.toLowerCase();
		return value => value.toLowerCase().includes( needle );
	}

	#comparatorContains( needle ) {
		return value => value.includes( needle );
	}

	#comparatorDoesNotContain( needle ) {
		return value => ! value.includes( needle );
	}

	#comparatorContainsSome( needle ) {
		assertType( { needle }, 'array' );

		return value => needle.some( entry => value.includes( entry ) );
	}

	#comparatorContainsAll( needle ) {
		assertType( { needle }, 'array' );

		return value => needle.all( entry => value.includes( entry ) );
	}

	#comparatorIsContained( needle ) {
		assertType( { needle }, 'array' );

		return value => needle.includes( value );
	}

	#comparatorIsEmpty() {
		return value => _.isEmpty( value );
	}

	#comparatorIsNotEmpty() {
		return value => ! _.isEmpty( value );
	}
}
