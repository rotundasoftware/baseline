import _ from 'underscore';
import Class from 'class-con-leche';

export default Class.extend( {
	initialize( services ) {
		const _this = this;

		this.services = services;

		// hook up dependencies
		_.each( this.services, function( thisService ) {
			thisService.baseline = _this;

			_.each( _this.services, function( thisOtherService, thisOtherServiceIdent ) {
				thisService.setDependency( thisOtherServiceIdent, thisOtherService );
			} );
		} );
	},

	merge( data, defaultOptions ) {
		const options = _.extend( {}, { empty : false }, defaultOptions );
		const _this = this;

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
		const json = {};

		_.each( this.services, function( thisService, thisServiceIdent ) {
			if( _.isFunction( thisService.toJSON ) ) {
				json[ thisServiceIdent ] = thisService.toJSON();
			}
		} );

		return json;
	}
} );

// eslint-disable-next-line no-unused-vars
function _isServer() {
	return ( typeof window === 'undefined' );
}
