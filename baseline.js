var _ = require( "underscore" );
var Class = require( "class-con-leche" );
var steamer = require( "steamer" );

module.exports = Class.extend( {
	initialize : function( services ) {
		var _this = this;

		this.services = services;

		this._tape = [];
		this._recording = true;

		// hook up dependencies
		_.each( this.services, function( thisService ) {
			_.each( thisService.dependencies, function( thisDependency ) {
				thisService.setDependency( thisDependency, _this.services[ thisDependency ] );
			} );
		} );
	},

	createBoat : function( manifest ) {
		var containers = {};

		_.each( this.services, function( thisService, thisServiceIdent ) {
			containers[ thisServiceIdent ] = thisService.createContainer();
		} );

		var boat = new steamer.Boat( containers );

		if( manifest ) boat.add( manifest );

		return boat;
	},

	fetch : function( manifest, callback ) {
		var _this = this;

		var onGotResults = function( err, boatContents ) {
			if( err ) return callback( err );

			try {
				_.each( boatContents, function( containerContents, containerName ) {
					_this.services[ containerName ].merge( containerContents );
				} );
			} catch( err ) {
				return callback( err );
			}

			callback();
		};

		if( _isServer() ) {
			var boat = this.createBoat( manifest );
			boat.stuff( onGotResults );
		}
		else {
			// on the client side we have to do a remote sync request via our sync url. 
			if( ! this._syncUrl ) return callback( new Error( "Attempt to sync but no syncUrl has been supplied." ) );

			return $.ajax( {
				url : this._syncUrl,
				contentType : "application/json",
				type : "POST",
				data : JSON.stringify( manifest ),
				dataType : "json",
				success : function( boatContents ) {
					onGotResults( null, boatContents );
				},
				error : function( errorObj, error ) {
					callback( new Error( "Baseline sync failed: " + errorObj.responseText ) );
				}
			} );
		}
	},

	merge : function( data ) {
		var _this = this;

		if( data ) {
			_.each( data, function( thisServiceData, thisServiceIdent ) {
				if( _this.services[ thisServiceIdent ] && _.isFunction( _this.services[ thisServiceIdent ].merge ) )
					_this.services[ thisServiceIdent ].merge( thisServiceData );
			} );
		}
	},

	resolveDependencies : function( obj ) {
		var _this = this;
		
		if( obj.dependencies ) {
			var dependencies = _.result( obj, "dependencies" );
			if( ! _.isArray( dependencies ) ) throw new Error( "`dependencies` property must be an array of service identifiers." );

			_.each( dependencies, function( thisDependency ) {
				var thisDependencyService = _this.services[ thisDependency ];
				if( _.isUndefined( thisDependencyService ) )
					throw new Error( "The service \"" + thisDependency + "\" is not available on this page." );

				obj[ thisDependency ] = thisDependencyService;
			} );
		}
	}
} );

function _isServer() {
	return( typeof window === "undefined" );
}
