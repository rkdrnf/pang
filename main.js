var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var uuid = require('node-uuid');

app.use(express.static('client'));

app.set('views', '../views');

app.get('/', function(req, res){
  res.sendfile('views/index.html', { root:__dirname });
});


app.get('/*', function(req, res, next) {
	var file = req.params[0];
	res.sendfile(__dirname + '/' + file);
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

var game_server = require('./scripts/game_server.js');

io.on('connection', function(client){

  client.user_id = uuid.v1();
  client.emit('onconnected', { id: client.user_id });

  game_server.findGame(client);

  console.log('player[' + client.user_id + '] connected');


  client.on('message', function(m){
		game_server.onMessage(client, m);
	});

	client.on('ping', function(m) {
		game_server.onPing(client, m);
	});

	client.on('client_input', function(m){
		game_server.onInput(client, m);
	});

	client.on('disconnect', function(){

		console.log('client disconnected' + client.user_id + ' ' + client.game_id);

		if (client.game) {
			game_server.disconnect_player(client.game.id, client.user_id);
			//game_server.endGame(client.game.id, client.user_id);
		}
	});
});




