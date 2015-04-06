window.Geocoder = function() {
	this.init();
};
window.Geocoder.prototype = {
	_GOOGLE_PLACES_API_KEY: 'AIzaSyCqwzPRKM7DMNsdd-lrq96-4HdkAsdxjKM',
	_GOOGLE_PLACES_IMG_URL: 'https://maps.googleapis.com/maps/api/place/photo?maxwidth=<%= width %>&photoreference=<%= ref %>&sensor=false&key=<%= key %>',
	_PLACES_PROXY: 'http://www.sonatalocal.com/proxy/?url=',
	_GEOCODER_URL: 'https://nominatim.openstreetmap.org/search?format=json&q=',
	_GOOGLE_GEOCODER_URL: 'http://maps.googleapis.com/maps/api/geocode/json?sensor=false&',
	_REVERSEGEOCODER_URL: 'https://open.mapquestapi.com/nominatim/v1/reverse?format=json&zoom=4&',
	_REVERSEADDRESSGEOCODER_URL: 'http://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&',
	_GOOGLE_PLACES_URL: 'https://maps.googleapis.com/maps/api/place/search/json?sensor=false',
	_GOOGLE_TIMEZONE_URL: 'https://maps.googleapis.com/maps/api/timezone/json?location=',
	_CITY_RADIUS: 20000,
	_DEFAULT_COUNTRY: 'Spain',
	_FOURSQUARE_SEARCH_URL: 'https://api.foursquare.com/v2/venues/search?',
	_FOURSQUARE_API_KEY: 'client_id=HMPO4KICO22QXEPYEXTLQ155OI2NPOVUAMU12SL3FAL1JWSJ&client_secret=GV2YMDNRLW5ILBWUVZOIVYPH0GJ20UL3TKO4AQINLPLNLK2B&v=20130528',
	_FOURSQUARE_PHOTO_URL_PRE: 'https://api.foursquare.com/v2/venues/',
	_FOURSQUARE_PHOTO_URL_SUF: '/photos?',
	_FOURSQUARE_SEARCH_LIMIT: 20,
	_FOURSQUARE_DISTANCE: 0.1,
	_PHOTO_WIDTH_LIMIT: 320,
	_PHOTO_HEIGHT_LIMIT: 180,
	__SOURCES_LOGO: {
		foursquare: 'assets/img/img_foursquare_logo.png',
		google: 'assets/img/img_google_logo.png'
	},

	_cached_addresses: {},
	_cached_places: {},

	init: function() {},

	_placesUrl: function( location, name ) {
		// name = name.replace(/ /g,'%22'); <- WTF!!! 22 === "
		var url = this._GOOGLE_PLACES_URL +
			'&key=' + this._GOOGLE_PLACES_API_KEY +
			'&radius=' + this._CITY_RADIUS +
			'&location=' + location +
			'&name=' + name;

		var encodedUrl = this._PLACES_PROXY + encodeURIComponent( url );
		return encodedUrl;
	},

	_placesNextUrl: function( token ) {
		var url = this._GOOGLE_PLACES_URL +
			'&key=' + this._GOOGLE_PLACES_API_KEY +
			'&pagetoken=' + token;

		return this._PLACES_PROXY + encodeURIComponent( url );
	},

	_timezoneUrl: function( lat, lng ) {
		var url = this._GOOGLE_TIMEZONE_URL +
			lat +
			',' +
			lng +
			// '&timestamp=' + Math.floor(new Date().getTime() / 1000) +
			'&timestamp=' +
			moment().unix() +
			'&sensor=false';
		return url;
	},
	_reverseAddressGeocodeUrl: function( latlng, zoom ) {
		if ( ! zoom ) {
			zoom = 18;
		}
		var url = this._REVERSEADDRESSGEOCODER_URL +
			'lat=' + latlng.lat +
			'&lon=' + latlng.lng +
			'&zoom=' + zoom;
		// var encodedUrl = this._PLACES_PROXY + encodeURIComponent(url);
		return url;
	},

	_reverseGeocodeUrl: function( latlng ) {
		var url = this._REVERSEGEOCODER_URL +
			'lat=' + latlng.lat +
			'&lon=' + latlng.lng;
		// var encodedUrl = this._PLACES_PROXY + encodeURIComponent(url);
		return url;
	},
	_FourSquareSearchUrl: function( name, city, country ) {
		var url = this._FOURSQUARE_SEARCH_URL +
			'near=' + city +
			'&query=' + name +
			'&venuePhotos=1' +
			'&limit=' + this._FOURSQUARE_SEARCH_LIMIT +
			'&' + this._FOURSQUARE_API_KEY;
		var encodedUrl = url;
		return encodedUrl;
	},

	_FourSquarePhotoUrl: function( id ) {
		var url = this._FOURSQUARE_PHOTO_URL_PRE +
			id +
			this._FOURSQUARE_PHOTO_URL_SUF +
			this._FOURSQUARE_API_KEY;
		var encodedUrl = url;
		return encodedUrl;
	},
	_geocoderUrl: function( address, country ) {
		var geocoderUrl = this._GOOGLE_GEOCODER_URL + 'address=' + address;
		if ( country ) {
			geocoderUrl += '&region=' + country;
		}
		return geocoderUrl;
	},

	pictureUrl: function( ref, width ) {
		if ( ! width ) {
			width = 400;
		}
		return _.template( this._GOOGLE_PLACES_IMG_URL, {
			ref: ref,
			width: width,
			key: this._GOOGLE_PLACES_API_KEY
		} );
	},

	search: function( options ) {
		var self = this;
		var dfd = $.Deferred();
		if ( options.address ) {
			$.when( this._searchAddress( options.address, options.country ) ).done( function( res ) {
				var result = {
					places: self.commonFormat( res.results )
				};
				dfd.resolve( result );
			} );
		} else {
			var calls = [];
			if ( options.token ) {
				calls.push( self._searchNextPlaces( options.token ) );
			} else {
				calls.push( self._searchPlaces( options.name, options.city, options.country ) );
			}
			calls.push( self._searchFoursSquare( options.name, options.city, options.country ) );
			$.when.apply( self, calls )
				.done( function( res, resFS ) {
					var result = {
						places: self.commonFormat( res.results ),
						next: res.next_page_token
					};
					result.places = self.addFourSquareID( result.places, resFS );
					dfd.resolve( result );
				} );
		}
		return dfd.promise();
	},

	searchLatLng: function( latlng ) {
		var dfd = $.Deferred();
		if ( latlng ) {
			this._searchReverse( latlng )
				.done( function( res ) {
					dfd.resolve( res );
				} )
				.fail( dfd.reject );
		} else {
			dfd.reject();
		}
		return dfd.promise();
	},
	searchAddressByLatLng: function( latlng ) {
		var self = this;
		var dfd = $.Deferred();
		$.ajax( {
			url: self._reverseAddressGeocodeUrl( latlng ),
			dataType: 'json',
			success: function( res ) {
				dfd.resolve( res );
			},
			error: function( err ) {
				dfd.reject( err );
			}
		} );
		return dfd.promise();
	},
	commonFormat: function( places ) {
		var commonFormattedPlaces = [];
		for ( var p in places ) {
			var place = {};
			if ( places[ p ].lat ) {
				place.lat = places[ p ].lat;
				place.lng = places[ p ].lon;
				place.address = places[ p ].display_name;
			} else {
				place.name = places[ p ].name;
				place.lat = places[ p ].geometry.location.lat;
				place.lng = places[ p ].geometry.location.lng;
				place.address = places[ p ].vicinity || places[ p ].formatted_address;
				if ( places[ p ].photos && places[ p ].photos.length > 0 ) {
					place.photos = JSON.stringify( places[ p ].photos );
				}
			}
			commonFormattedPlaces.push( place );
		}
		return commonFormattedPlaces;
	},
	_searchReverse: function( latlng ) {
		var self = this;
		var dfd = $.Deferred();
		$.ajax( {
			url: self._reverseGeocodeUrl( latlng ),
			dataType: 'json',
			success: function( res ) {
				dfd.resolve( res );
			},
			error: function( err ) {
				dfd.reject( err );
			}
		} );
		return dfd.promise();
	},
	_searchPlaces: function( place, city, country ) {
		var self = this;
		var dfd = $.Deferred();
		this._searchAddress( city, country )
			.done( function( res ) {
				if ( res.length > 0 ) {
					var latlng = res[ 0 ].lat + ',' + res[ 0 ].lon;
					$.ajax( {
						url: self._placesUrl( latlng, place ),
						dataType: 'json',
						success: function( res ) {
							dfd.resolve( res );
						},
						error: function() {
							dfd.reject();
						}
					} );
				} else {
					dfd.resolve( [] );
				}
			} );
		return dfd.promise();
	},
	_searchNextPlaces: function( token ) {
		var self = this,
			dfd = $.Deferred();
		$.ajax( {
			url: self._placesNextUrl( token ),
			dataType: 'json',
			success: function( res ) {
				dfd.resolve( res );
			},
			error: function() {
				dfd.reject();
			}
		} );
		return dfd.promise();
	},
	searchTimezone: function( lat, lng ) {
		var self = this;
		var dfd = $.Deferred();
		$.ajax( {
			url: self._timezoneUrl( lat, lng ),
			dataType: 'json',
			success: function( res ) {
				dfd.resolve( res );
			},
			error: function( err ) {
				dfd.reject( err );
			}
		} );
		return dfd.promise();
	},


	_searchAddress: function( address, country ) {
		var dfd = $.Deferred();
		if ( ! country ) {
			country = this._DEFAULT_COUNTRY;
		}
		if ( ( address + country ) in this._cached_addresses ) {
			dfd.resolve( this._cached_addresses[ address + country ] );
		} else {
			$.ajax( {
				url: this._geocoderUrl( address, country ),
				dataType: 'json',
				success: function( res ) {
					dfd.resolve( res );
				},
				error: function( err ) {
					dfd.reject( err );
				}
			} );
		}
		return dfd.promise();
	},

	_searchFoursSquare: function( place, city, country ) {
		var self = this;
		var dfd = $.Deferred();
		$.ajax( {
			url: self._FourSquareSearchUrl( place, city, country ),
			dataType: 'json',
			success: function( res ) {
				dfd.resolve( res.response.venues );
			},
			error: function() {
				dfd.resolve( [] );
			}
		} );
		return dfd.promise();
	},
	addFourSquareID: function( places, resFS ) {
		var self = this,
			length1 = places.length,
			length2 = resFS.length;
		for ( var i = 0; i < length1; i++ ) {
			places[ i ].foursquareID = [];
			for ( var j = 0; j < length2; j++ ) {
				if ( self.calcDistance( places[ i ].lat, places[ i ].lng, resFS[ j ].location.lat, resFS[ j ].location.lng ) <= this._FOURSQUARE_DISTANCE ) {
					places[ i ].foursquareID.push( {
						id: resFS[ j ].id
					} );
				}

			}
			places[ i ].foursquareID = JSON.stringify( places[ i ].foursquareID );
		}
		return places;
	},
	calcDistance: function( lat1, lon1, lat2, lon2 ) {
		var rad = function( x ) {
			return x * Math.PI / 180;
		};
		var R = 6378.137; //Radio de la tierra en km
		var dLat = rad( lat2 - lat1 );
		var dLong = rad( lon2 - lon1 );

		var a = Math.sin( dLat / 2 ) * Math.sin( dLat / 2 ) + Math.cos( rad( lat1 ) ) * Math.cos( rad( lat2 ) ) * Math.sin( dLong / 2 ) * Math.sin( dLong / 2 );
		var c = 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) );
		var d = R * c;

		return d.toFixed( 2 );
	},

	/**
	 *
	 * Receives an array of Foursquare venue obj (returned by a _searchFoursSquare)
	 * Returns a flattened array of photo objects {id, image, source, thumbnail}
	 *
	 * */

	getPhotosFourSquare: function( venuesid ) {
		var self = this;

		var imagePromises = venuesid.map( function( id ) {
			return self._searchPhotoFourSquareId( id );
		} );

		return $.when.all( imagePromises );
	},

	_searchPhotoFourSquareId: function( ids ) {
		var self = this;
		var dfd = $.Deferred();
		var images = [];
		$.ajax( {
			url: self._FourSquarePhotoUrl( ids.id ),
			dataType: 'json',
			success: function( photoObj ) {
				var res = photoObj.response.photos.items;
				images = self.filterPhotoItems( res );
				dfd.resolve( images );
			},
			error: function( e ) {
				dfd.resolve( [] );
			}
		} );
		return dfd.promise();
	},

	filterPhotoItems: function( photoItems ) {
		var self = this;
		var res = photoItems;
		var images = [];
		var images = photoItems.map( function( photo ) {
			if ( photo.width >= self._PHOTO_WIDTH_LIMIT && photo.height >= self._PHOTO_HEIGHT_LIMIT ) {
				var src = photo.prefix + 'original' + photo.suffix;
				return {
					image: src,
					thumbnail: src,
					source: 'foursquare',
					id: photo.id
				};
			}
		} );
		images = images.length > 0 ? images : null;
		return images;
	}
};

