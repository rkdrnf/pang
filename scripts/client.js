/*  Copyright (c) 2012 Sven "FuzzYspo0N" Bergström

		written by : http://underscorediscovery.com
		written for : http://buildnewgames.com/real-time-multiplayer/

		MIT Licensed.
		*/

//A window global for our game root variable.
var game = {};

window.onload = function(){

	//Create our game client instance.
	game = new game_core();

	//Fetch the viewport
	game.viewport = document.getElementById('viewport');

	//Adjust their size
	game.viewport.res_mul = 16;
	game.viewport.width = game.world.width * game.viewport.res_mul;
	game.viewport.height = game.world.height * game.viewport.res_mul;

	//Fetch the rendering contexts
	game.ctx = game.viewport.getContext('2d');

	//Set the draw style for the font
	game.ctx.font = '11px "Helvetica"';

	//Finally, start the loop
	game.update( new Date().getTime() );
};
