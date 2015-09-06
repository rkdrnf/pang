var game_server = module.exports = { games: {}, game_count: 0 };
var uuid = require('uuid');


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
  var message_type = message['type'];

  if(message_type == 'input') {
    this.onInput(client, message['content']);
  } else if (message_type == 'changeColor') {
    this.onChangeColor(client, message['content']);
  }
};

game_server.onInput = function(client, input) {
  var input_commands = input['inputs'];
  var input_time = input['time'];
  var input_seq = input['seq'];

  if (client && client.game && client.game.gamecore) {
    client.game.gamecore.handle_server_input(client, input_commands, input_time, input_seq);
  }
};

game_server.createGame = function(player) {
  var the_game = {
    id: uuid.v1();
    players: {},
    player_count: 1
  };

  players[player.id] = player;

  this.games[the_game.id] = the_game;
  this.game_count++;

  the_game.gamecore = new game_core(the_game);
  the_game.gamecore.update(new Date().getTime());

  the_game.gamecore.new_player(player);


  player.emit('s_gameLocalTime', the_game.gamecore.local_time);
  console.log('game created at ' + the_game.gamecore.local_time);
  player.game = the_game;


  startGame(the_game);

  return the_game;
};

game_server.endGame = function(gameid, userid) {

  var the_game = this.games[gameid];

  if (the_game) {
    the_game.gamecore.player_disconnected(userid);

    if (game.player.count == 0) {
        the_game.gamecore.stop_update();

        delete this.games[gameid];
        this.game_count--;

        console.log('game removed. now ' + this.game_conut + ' games left');
    }
  }
};

game_server.startGame = function(game) {
  game.active = true;
};

game_server.joinGame = function(game, player) {
  game.players[player.id].emit('s.playerIDs', game.getPlayerIDs());
  game.players[player.id].game = game;

  game.players[player.id].emit('s.serverLocalTime', game.gamecore.local_time);
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

        game_instance.players[player.id] = player;
        game_instance.gamecore.new_player(player);
        //game_instance.gamecore.players[player.id].instance = player;
        game_instance.player_count++;

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
