var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var uuid = require('uuid');

app.use(session({
	genid: function(req) {
		return uuid.v1();
	},
	secret: 'mysecret'
}));


app.use(express.static('client'));

app.set('views', './views');
app.set('view engine', 'jade');

app.get('/', function(req, res){
	res.render('game');
});

http.listen(3000, function(){
	console.log('listening on *:3000');
});

var game_server = require('./game_server.js');

io.on('connection', function(client){

	client.user_id = uuid.v1();
	client.emit('onconnected', { id: client.user_id });

	game_server.findGame(client);

	console.log('player[' + client.user_id + '] connected');


	client.on('message', function(m){
		game_server.onMessage(client, m);
	});

	client.on('disconnect', function(){

		console.log('client disconnected' + client.user_id + ' ' + client.game_id);

		if (client.game) {
			game_server.endGame(client.game);
		}
	});
});




