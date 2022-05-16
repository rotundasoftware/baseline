import _ from 'underscore';
import Class from 'class-con-leche';

export default Class.extend( {
	initialize( services ) {
		this.services = services;

		// hook up dependencies
		for( const thisServiceIdent in this.services ) {
			this.services[ thisServiceIdent ].baseline = this;

			for( const thisOtherServiceIdent in this.services ) {
				this.services[ thisServiceIdent ].setDependency( thisOtherServiceIdent, this.services[ thisOtherServiceIdent ] );
			}
		}
	},

	merge( data, options ) {
		options = _.extend( {}, { empty : false }, options );

		if( data ) {
			for( const thisServiceIdent in data ) {
				if( this.services[ thisServiceIdent ] && _.isFunction( this.services[ thisServiceIdent ].merge ) ) {
					if( options.empty ) this.services[ thisServiceIdent ].empty();
					this.services[ thisServiceIdent ].merge( data[ thisServiceIdent ] );
				}
			}
		}
	},

	toJSON() {
		const json = {};

		for( const thisServiceIdent in this.services ) {
			const thisService = this.services[ thisServiceIdent ];

			if( _.isFunction( thisService.toJSON ) ) {
				json[ thisServiceIdent ] = thisService.toJSON();
			}
		}

		return json;
	}
} );

// eslint-disable-next-line no-unused-vars
function _isServer() {
	return ( typeof window === 'undefined' );
}
