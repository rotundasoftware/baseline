var _ = require( 'underscore' );
var Class = require( 'class-con-leche' );

module.exports = Class.extend( {
	initialize : function( services ) {
		var _this = this;

		this.services = services;

		// hook up dependencies
		_.each( this.services, function( thisService ) {
			thisService.baseline = _this;

			_.each( _this.services, function( thisOtherService, thisOtherServiceIdent ) {
				thisService.setDependency( thisOtherServiceIdent, thisOtherService );
			} );
		} );
	},

	merge : function( data, options ) {
		var options = _.extend( {}, { empty : false }, options );
		var _this = this;

		if( data ) {
			_.each( data, function( thisServiceData, thisServiceIdent ) {
				if( _this.services[ thisServiceIdent ] && _.isFunction( _this.services[ thisServiceIdent ].merge ) ) {
					if( options.empty ) _this.services[ thisServiceIdent ].empty();
					_this.services[ thisServiceIdent ].merge( thisServiceData );
				}
			} );
		}
	},

	resolveDependencies : function( obj ) {
		var _this = this;
		
		if( obj.dependencies ) {
			var dependencies = _.result( obj, 'dependencies' );
			if( ! _.isArray( dependencies ) ) throw new Error( '`dependencies` property must be an array of service identifiers.' );

			_.each( dependencies, function( thisDependency ) {
				var thisDependencyService = _this.services[ thisDependency ];
				if( _.isUndefined( thisDependencyService ) ) {
					throw new Error( 'The service \'' + thisDependency + '\' is not available on this page.' );
				}

				obj[ thisDependency ] = thisDependencyService;
			} );
		}
	}
} );

function _isServer() {
	return( typeof window === 'undefined' );
}
