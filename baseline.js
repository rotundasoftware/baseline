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

	toJSON() {
		var json = {};

		_.each( _this.services, function( thisService, thisServiceIdent ) {
			if( _.isFunction( thisService.toJSON ) ) {
				json[ thisServiceIdent ] = thisService.toJSON();
			}
		} );

		return json;
	}
} );

function _isServer() {
	return( typeof window === 'undefined' );
}
