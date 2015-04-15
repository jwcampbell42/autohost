var _ = require( 'lodash' );
var SocketStream = require( './socketStream.js' );

function parseCookies( socket ) {
	var cookies = socket.headers.cookie.split( ';' );
	return _.reduce( cookies, function( acc, cookie ) {
		var parts = cookie.split( '=' );
		acc[ parts[ 0 ] ] = parts[ 1 ];
		return acc;
	}, {} );
}

function SocketEnvelope( topic, message, socket, metricKey, timer ) {
	this.transport = 'websocket';
	this.context = socket.context;
	this.data = message.data || message || {};
	this.cookies = socket.cookies || parseCookies( socket );
	this.headers = socket.headers;
	this.logout = function() {
		socket.logout();
	};
	this.metricKey = metricKey;
	this.params = {};
	this.replyTo = this.data.replyTo || topic;
	this.responseStream = new SocketStream( this.replyTo || topic, socket );
	this.session = socket.session;
	this.timer = timer;
	this.topic = topic;
	this.user = socket.user;
	this._original = {
		message: message,
		socket: socket
	};
}

SocketEnvelope.prototype.forwardTo = function( /* options */ ) {
	this.recordTime();
	this.reply( { data: 'The API call \'' + this.topic + '\' is not supported via websockets. Sockets do not support proxying via forwardTo.' } );
};

SocketEnvelope.prototype.recordTime = function() {
	this.timer.record();
};

SocketEnvelope.prototype.redirect = function( /* options */ ) {
	this.recordTime();
	this.reply( { data: 'The resource you are trying to reach has moved.' } );
	throw new Error( 'Sockets do not support redirection.' );
};

SocketEnvelope.prototype.reply = function( envelope ) {
	var publish = this._original.message.data ? envelope : envelope.data;
	if ( _.isArray( publish ) ) {
		publish = { data: publish };
	}
	if ( envelope.headers && !publish.headers ) {
		publish._headers = envelope.headers;
	}
	this._original.socket.publish( this.replyTo, publish );
	this.recordTime();
};

SocketEnvelope.prototype.replyWithFile = function( contentType, fileName, fileStream ) {
	this._original.socket.publish( this.replyTo, { start: true, fileName: fileName, contentType: contentType } );
	fileStream.pipe( this.responseStream );
	this.recordTime();
};

module.exports = SocketEnvelope;
