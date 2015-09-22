var game_server = module.exports = { games: {}, game_count: 0 };
var uuid = require('node-uuid');
var c_input = require('./input.js');


global.window = global.document = global;

require('./game_core.js');


game_server.local_time = 0;
game_server._dt = new Date().getTime();
game_server._dte = new Date().getTime();

game_server.messages = [];

setInterval(function(){
	game_server._dt = new Date().getTime() - game_server._dte;
	game_server._dte = new Date().getTime();
	game_server.local_time += game_server._dt / 1000.0;
}, 4);

game_server.onMessage = function(client, message) {
	var message_type = message.type;

	if (message_type == 'changeColor') {
		this.onChangeColor(client, message.content);
	}
};

game_server.onInput = function(client, input) {
	var input_commands = input.inputs;
	var input_time = input.time;
	var input_seq = input.seq;

	if (client && client.game && client.game.gamecore) {
		client.game.gamecore.handle_server_input(client, c_input.fromValue(input_commands), input_time, input_seq);
	}
};


game_server.createGame = function(player) {
	var the_game = {
		id: uuid.v1(),
		players: {},
		player_count: 0,
		max_player_count: 10
	};

	this.games[the_game.id] = the_game;
	this.game_count++;

	the_game.gamecore = new game_core(the_game);
	the_game.gamecore.update(new Date().getTime());

	console.log('game[' + the_game.id + '] created at ' + the_game.gamecore.local_time);

	this.startGame(the_game);

	this.joinGame(the_game, player);

	return the_game;
};

game_server.disconnect_player = function(game_id, user_id) {
	var the_game = this.games[game_id];

	if (the_game) {
		the_game.gamecore.player_disconnected(user_id);
		delete the_game.players[user_id];
		the_game.player_count--;
	}

	if (the_game.player_count === 0) {
		this.endGame(game_id);
	}
};

game_server.endGame = function(gameid, userid) {

	var the_game = this.games[gameid];

	if (the_game) {
		the_game.gamecore.stop_update();

		delete this.games[gameid];
		this.game_count--;

		console.log('game removed. now ' + this.game_conut + ' games left');
	}
};


game_server.startGame = function(game) {
	game.active = true;
};

game_server.joinGame = function(game, player) {
	game.player_count++;
	game.players[player.user_id] = player;
	game.players[player.user_id].emit('s.serverLocalTime', game.gamecore.local_time);
	game.players[player.user_id].game = game;

	game.gamecore.new_player(player);
};

game_server.findGame = function(player) {
	console.log('looking for a game. We have : ' + this.game_count);

	if(this.game_count) {
		var joined_a_game = false;

		for(var gameid in this.games) {

			if(!this.games.hasOwnProperty(gameid)) continue;

			var game_instance = this.games[gameid];

			if(game_instance.player_count < game_instance.max_player_count) {
				joined_a_game = true;


				this.joinGame(game_instance, player);
			}

		}

		if (!joined_a_game) {
			this.createGame(player);
		}
	} else {
		this.createGame(player);
	}
};


