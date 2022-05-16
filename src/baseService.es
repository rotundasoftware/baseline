import Class from 'class-con-leche';

module.exports = Class.extend( {
	initialize() {

	},
	
	setDependency( name, serviceInstance ) {
		if( this[ name ] ) throw new Error( 'Service dependency "' + name + '" conflicts with existing property.' );

		this[ name ] = serviceInstance;
	},

	empty() {
	},

	// eslint-disable-next-line no-unused-vars
	merge( data ) {
	},

	_isServer() {
		return ( typeof window === 'undefined' );
	}
} );