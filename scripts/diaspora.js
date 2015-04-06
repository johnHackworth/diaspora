window.Diaspora = function( id ) {
	this.init( id );
};

window.Diaspora.prototype = {
	init: function( id ) {
		this.geocoder = new Geocoder();
		this.map = L.map( id ).setView( [ 51.505, -0.09 ], 2 );
		L.tileLayer( 'https://{s}.tiles.mapbox.com/v4/examples.ra3sdcxr/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6IlhHVkZmaW8ifQ.hAMX5hSW-QnTeRCMAy9A8Q', {
		} ).addTo( this.map );
		this.map.on( 'zoomend', this.checkZoomLevel.bind( this ) );
		this.loadData().done( this.renderData.bind( this ) );
		$( '.hidePanel' ).on( 'click', this.hidePanel.bind( this ) );
		$( '.peopleMenu' ).on( 'click', this.showPanel.bind( this ) );
		this.initIntro();
	},
	initIntro: function( n ) {
		n = n || 12;
		if ( n - 1 <= 0 ) {
			return;
		}
		if ( this.data && ! this.personClicked && this.data.length ) {
			var company = this.data[ Math.floor( Math.random() * this.data.length ) ];
			if ( company.latlng && n < 10 ) {
				this.map.panTo( company.latlng );
				this.map.setZoom( 12 );
			}
			setTimeout( this.initIntro.bind( this, n - 1 ), 1000 );
		} else {
			setTimeout( this.initIntro.bind( this ), 1000 );
		}
	},
	checkZoomLevel: function() {
		this.data.forEach( function( company ) {
			if ( company.marker ) {
				if ( this.map.getZoom() < 12 ) {
					company.marker.setOpacity( 0 );
				} else {
					company.marker.setOpacity( 0.6 );
				}
			}
		}.bind( this ) );
	},
	showPanel: function() {
		$( '.peopleMenu' ).removeClass( 'hidden' );
	},
	hidePanel: function( ev ) {
		ev.preventDefault();
		ev.stopPropagation();
		$( '.peopleMenu' ).addClass( 'hidden' );
	},
	addTitle: function( json ) {
		$( '.intro .title' ).html( json.title );
		$( '.intro .text' ).html( json.text );
	},

	getDataOrigin: function() {
		return location.hash.replace( '#', '' );
	},

	loadData: function() {
		var self = this,
			dfd = $.Deferred();

		$.getJSON( 'data/' + this.getDataOrigin() + '.json', function( json ) {
			var promises = [];
			self.addTitle( json );
			self.data = json.data;
			self.data.forEach( function( company ) {
				var promise = $.when(
					self.getImage( encodeURIComponent( company.name + ' logo' ) ),
					self.getPeopleLogos( company.people )
				);
				promises.push( promise );
				promise.done( function( logo, images ) {
					company.nameLogo = logo;
					company.peopleImages = images;
					company.people = company.people.split( ',' );
				} );
			} );
			$.when.apply( self, promises ).done( dfd.resolve );
		} );
		return dfd.promise();
	},

	getPeopleLogos: function( people ) {
		var peopleArray = people.split( ',' ),
			self = this,
			dfd = $.Deferred();

		promises = [];
		peopleArray.forEach( function( person ) {
			if ( person[ 0 ] === '@' ) {
				promises.push( self.getImage( encodeURIComponent( 'twitter ' + person ) ) );
			} else {
				promises.push( self.getImage( encodeURIComponent( 'person placeholder' ) ) );
			}
		} );
		$.when.apply( this, promises )
			.done( function() {
				dfd.resolve( arguments );
			} );

		return dfd.promise();
	},

	renderData: function() {
		this.addMarkers();
		this.addPeople();
	},

	addMarkers: function() {
		var self = this;
		this.data.forEach( function( company ) {
			self.geocoder._searchFoursSquare( company.address || company.name, company.city, company.country )
				.done( self.addcompanyToMap.bind( self, company ) );

		} );
	},

	getLogoSize: function( format, divisor ) {
		var sizes = {
			normal: [ 40, 20 ],
			long: [ 60, 20 ],
			square: [ 20, 20 ]
		};
		var size = sizes[ format ] || sizes.normal;

		return [ size[ 0 ] / divisor, size[ 1 ] / divisor ];
	},
	getLogoURL: function( company ) {
		try {
			return company.nameLogo.split( '<img src="' )[ 1 ].split( '"' )[ 0 ];
		} catch ( err ) {}
	},
	addcompanyToMap: function( company, data ) {
		var place = data[ 0 ],
			self = this;
		if ( place ) {
			var latlng = {
				lat: place.location.lat + Math.random() / 5000 - Math.random() / 5000,
				lng: place.location.lng + Math.random() / 5000 - Math.random() / 5000
			};
			company.latlng = latlng;
			var logoUrl = this.getLogoURL( company );
			if ( logoUrl ) {
				company.icon = L.icon( {
					iconUrl: logoUrl,
					iconSize: this.getLogoSize( company.logoFormat, 1 ),
					iconAnchor: this.getLogoSize( company.logoFormat, 2 ),
					shadowUrl: logoUrl,
					shadowRetinaUrl: logoUrl,
					shadowSize: [ 0, 0 ],
					shadowAnchor: [ 22, 94 ]
				} );
			}
			this.geocoder._searchPhotoFourSquareId( place ).done( function( pictures ) {
				var options = {
					className: 'pointTitle',
					title: company.name
				};
				if ( company.icon ) {
					options.icon = company.icon;
				}
				var marker = L.marker( [ latlng.lat, latlng.lng ], options ).addTo( self.map );
				company.marker = marker;
				var circle = L.circleMarker( [ latlng.lat, latlng.lng ], {
					className: 'point',
					title: company.name
				} ).addTo( self.map );
				company.marker = company.marker || circle;

				self.addPopup( company.marker, company, pictures );


			} );

		}
	},
	getImage: function( searchTerm ) {
		var dfd = $.Deferred();
		$.ajax( {
			dataType: 'jsonp',
			url: 'https://ajax.googleapis.com/ajax/services/search/images?v=1.0&q=' + ( searchTerm )
		} ).done( function( images ) {
			var img = '';
			if ( images.responseData && images.responseData.results && images.responseData.results.length ) {
				img = '<img src="' + images.responseData.results[ 0 ].unescapedUrl + '" />';
			}
			dfd.resolve( img );
		} );
		return dfd.promise();
	},
	addPopup: function( circle, company, pictures ) {
		return this.createPopup( circle, company, pictures );
	},
	createPopup: function( circle, company, pictures ) {
		var txt = '',
			self = this,
			logo = company.nameLogo ? company.nameLogo + ' ' + company.name : company.name;
		txt += '<div class="companyTitle">' + logo + '</div>';
		txt += '<div class="companyInfo">';
		txt += '<div class="description">' + company.desc + '</div>';
		txt += '</div>';
		txt += '<div class="people">';
		for ( var i = 0, l = company.people.length; i < l; i++ ) {
			txt += '<a target="_blank" href="http://www.twitter.com/' + company.people[ i ] + '" class="person">' + company.peopleImages[ i ] + '<div class="name">' + company.people[ i ] + '</div></a>';
		}
		txt += '</div>';
		circle.bindPopup( txt );
	},
	getPeople: function() {
		var self = this;
		this.people = [];

		this.data.forEach( function( company ) {
			company.people.forEach( function( person, n ) {
				self.people.push( {
					name: person,
					image: company.peopleImages[ n ],
					company: company
				} );
			} );
		} );
		return this.people;
	},
	addPeople: function() {
		var people = this.getPeople(),
			self = this;
		people.sort( this.randomSort );
		people.forEach( function( person ) {
			var $personCard = $( self.personTemplate( person ) );
			$personCard.on( 'click', self.clickPerson.bind( self, person ) );
			$( '.attribution' ).before( $personCard );
		} );
	},
	personTemplate: function( person ) {
		var template = '<div class="personCard">';
		template += '<div class="column">';
		template += '<span class="personImage">' + person.image + '</span>';

		template += '</div><div class="column">';
		template += '<div class="personName">' + this.getPersonLink( person ) + '</div>';
		template += '<div class="personCompany">' + person.company.nameLogo + '</div>';
		template += '</div>';
		template += '</div>';
		return template;
	},
	randomSort: function() {
		return Math.random() - 0.5;
	},
	culitoDeSheila: function() {
		// sheila guapa
		return '( )( )';
	},
	getPersonLink: function( person ) {
		return '<a target="_blank" href="http://www.twitter.com/' + person.name + '">' + person.name + '</a>';
	},
	clickPerson: function( person ) {
		this.map.panTo( person.company.latlng );
		person.company.marker.fire( 'click' );
		this.map.setZoom( 12 );
		this.personClicked = true;
	}

};




