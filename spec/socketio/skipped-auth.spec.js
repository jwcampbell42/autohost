var should = require( 'should' );
var path = require( 'path' );
var _ = require( 'lodash' );
var requestor = require( 'request' ).defaults( { jar: false } );
var metrics = require( 'cluster-metrics' );
var debug = require( 'debug' )( 'autohost-spec:skipped-auth' );
var when = require( 'when' );
var port = 88988;
var config = {
		port: port,
		socketio: true,
		websocket: true
	};

var authProvider, passport, middleware, http, socket;

describe( 'with socketio and no users', function() {
	var client;

	before( function( done ) {
		authProvider = require( '../auth/mock.js' )( config );
		passport = require( '../../src/http/passport.js' )( config, authProvider, metrics );
		middleware = require( '../../src/http/middleware.js' )( config, metrics );
		http = require( '../../src/http/http.js' )( config, requestor, passport, middleware, metrics );
		socket = require( '../../src/websocket/socket.js' )( config, http );

		http.start();
		socket.start( passport );
		var onConnect = function() {
			onConnect = function() {};
			done();
		};
		authProvider.users = {};
		passport.resetUserCheck();
		var io = require( 'socket.io-client', {} );
		client = io( 'http://localhost:88988', { query: 'token=blorp' } );
		client.once( 'connect', onConnect );
		client.once( 'reconnect', onConnect );
		client.io.open();

		var events = [ 
			'connect',
			'connect_error',
			'connect_timeout',
			'reconnect',
			'reconnect_attempt',
			'reconnecting',
			'reconnect_error',
			'reconnect_failed'
		];

		_.each( events, function( ev ) {
			client.on( ev, function( d ) { debug( '%s JUST. HAPPENED. %s', ev, d ); } );
		} );
	} );

	describe( 'when skipping authentication', function() {
		var fromClient,
			fromServer;

		before( function( done ) {
			socket.on( 'client.message', function( msg, client ) {
				if( msg.txt === 'ohhai' ) {
					fromClient = msg;
					client.publish( msg.replyTo, { txt: 'hulloo!' } );
				}
			} );

			client.once( 'server.message', function( msg ) {
				fromServer = msg;
				done();
			} );
			client.emit( 'client.message', { txt: 'ohhai', replyTo: 'server.message' } );
		} );

		it( 'should get client message', function() {
			fromClient.should.eql( { txt: 'ohhai', replyTo: 'server.message' } );
		} );

		it( 'should get server response', function() {
			fromServer.should.eql( { txt: 'hulloo!' } );
		} );

		it( 'should have a connected socket', function() {
			client.connected.should.be.true;
		} );
	} );

	after( function() {
		client.io.close();
		client.removeAllListeners();
		socket.stop();
		http.stop();
	} );
} );