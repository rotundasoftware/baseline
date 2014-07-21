var Class = require( 'class-con-leche' );

var CollectionService = module.exports = Class.extend( {
	initialize : function() {

	},
	
	setDependency : function( name, serviceInstance ) {
		if( this[ name ] ) throw new Error( 'Service dependency "' + name + '" conflicts with existing property.' );

		this[ name ] = serviceInstance;
	},

	createContainer : function() {
	},

	merge : function( data ) {
	}
} );