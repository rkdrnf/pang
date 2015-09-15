var uuid = require('node-uuid');
var	p2 = require('p2');
var physics = require('../physicsjs/dist/physicsjs-full.min.js');

var frame_time = 60/1000;
if('undefined' != typeof(global)) frame_time = 45;

(function() {
	var lastTime =0;
	var vendors = [ 'ms', 'moz', 'webkit', 'o' ];

	for ( var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
		window.requestAnimationFrame = window[ vendors[x] + 'RequestAnimationFrame' ];
		window.cancelAnimationFrame = window[ vendors[x] + 'CancelAnimationFrame' ] || window[ vendors[x] + 'CancelRequestAnimationFrame' ];
	}

	if (!window.requestAnimationFrame) {
		window.requestAnimationFrame = function(callback, element) {
			var currTime = Date.now(), timeToCall = Math.max(0, frame_time - (currTime - lastTime));
			var id = window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};
	}

	if (!window.cancelAnimationFrame) {
		window.cancelAnimationFrame = function(id) { clearTimeout(id); };
	}
}());


var game_core = function(game_instance){
	this.instance = game_instance;
	this.server = this.instance !== undefined;

	this.initial_position = {x: 100, y: 40};

	this.world = {
		width : 720,
		height : 480
	};


	this.physics_world = physics({
		timestep: 0.015,
		maxIPF: 16
	});

	this.gravity = physics.behavior('constant-acceleration', {
		acc: { x: 0, y: 0.0004 }
	});
	
	this.physics_world.add(this.gravity);

	this.collision_group = {
		PLAYER: Math.pow(2,0),
		ENEMY: Math.pow(2,1),
		GROUND: Math.pow(2,2)
	};

	this.enemies = {};

	this.groundBody = physics.body('rectangle', {
		mass:1,
		width: 200,
		height: 10,
		x: 200,
		y: this.world.height - 40
	});
	console.log(this.groundBody);

	groundShape.collisionGroup = this.collision_group.GROUND;
	groundShape.collisionMask = this.collision_group.PLAYER | this.collision_group.ENEMY;
	this.physics_world.addBody(this.groundBody);

	if (this.server) {
		this.players = {};
	} else {
		this.players = {};
		this.players.self = {};
		this.ghosts = {};
	}

	this.stage = new stage(this);
	this.timers = {};

	this.playerspeed = 480;

	this._pdt = 0.0001;
	this._pdte = new Date().getTime();

	this.local_time = 0.016;
	this._dt = new Date().getTime();
	this._dte = new Date().getTime();

	this.create_physics_simulation();
	this.create_timer();
	this.stage.start();

	if (!this.server) {
		this.keyboard = new THREEx.KeyboardState();

		this.client_create_configuration();

		this.server_updates = [];
		this.client_connect_to_server();
		this.client_create_ping_timer();

		this.color = localStorage.getItem('color') || '#cc8822';
		localStorage.setItem('color', this.color);

		if (String(window.location).indexOf('debug') != -1) {
			this.client_create_debug_gui();
		}
	} else {
		this.server_time = 0;
		this.laststate = {};
	}
};

if ('undefined' != typeof(global)) {
	module.exports = global.game_core = game_core;
}

game_core.prototype.register_timer = function(timer) {
	timer.timer_id = uuid.v1();
	this.timers[timer.timer_id] = {
		job_queue: [],
		timer: timer
	};

	timer.timer_manager = this;
};

game_core.prototype.add_timer = function(timer_id, job_id, time) {
	if (!timer_id) {
		console.log('ERROR. unregistered timer added timer job');
	}

	this.timers[timer_id].job_queue.push({
		job_id: job_id,
		time: time
	});

	function sort_timer_job(a,b) {
		if (a.time < b.time)
			return -1;
		if (a.time > b.time)
			return 1;
		return 0;
	}

	this.timers[timer_id].job_queue.sort(sort_timer_job);
};

game_core.prototype.check_timers = function(dt) {
	for (var timer_id in this.timers) {
		this.timers[timer_id].timer.on_timer_tick(dt);
		while (true) {
			if (this.timers[timer_id].job_queue.length > 0) {
				var job = this.timers[timer_id].job_queue[0];
				if (job.time < 0) {
					var timer = this.timers[timer_id].timer;
					timer.on_timer(job.job_id);
					this.timers[timer_id].job_queue.splice(0,1);
				} else {
					//wrong implementation
					job.time -= dt;
					break;
				}
			} else {
				break;
			}
		}
	}
};

game_core.prototype.add_enemy = function(radius, pos) {
	var enemy_id = uuid.v1();
	var enemy = new c_enemy(this, enemy_id, radius, pos);
	this.enemies[enemy_id] = enemy;
};

game_core.prototype.receive_enemy_info = function(info) {
	info.forEach(function(enemy_info) {
		this.enemies[enemy_info.id] = new c_enemy(this, enemy_info.id, enemy_info.radius, enemy_info.pos);
	}.bind(this));
};

game_core.prototype.clear_enemies = function() {
	Object.keys(this.enemies).forEach(function(enemy) {
		delete this.enemies[enemy.id];
	}.bind(this));
};

game_core.prototype.new_player = function(player) {
	var new_player = new game_player(this, player, false);
	new_player.instance = player;
	new_player.pos = this.initial_position;
	new_player.color = this.color;
	new_player.id = player.user_id;

	if (Object.keys(this.players).length === 0) {
		new_player.is_dead = false;
	}

	this.players[player.user_id] = new_player;
	var existing_infos = [];

	this.for_each_player(function(gp) {
		existing_infos.push(gp.get_info());

		if (gp.id == player.user_id) {
			return;
		}

		//send new player info to existing players.
		gp.instance.emit('player_info', {
			players: [new_player.get_info()]
		});
	});

	//send existing player infos to new player.

	new_player.instance.emit('player_info', {
		players: existing_infos
	});

	var enemies_info = [];
	this.for_each_enemy(function(enemy) { 
		enemies_info.push({
			id: enemy.id,
			radius: enemy.p_shape.radius,
			pos: enemy.pos
		});
	});

	//send stage info to new player.
	new_player.instance.emit('current_stage', {
		time_left: this.stage.time_left,
		enemies_info: enemies_info
	});

};

game_core.prototype.on_new_stage = function(stage) {

	this.for_each_player(function(player) {
		player.p_body.position = this.p_vec2(this.initial_position);
		player.p_body.velocity = [0, 0];
		player.is_dead = false;
	}.bind(this));

	this.broadcast('new_stage', {
		time_left: stage.time_left
	});
};

game_core.prototype.on_stage_end = function(stage) {
};

game_core.prototype.client_on_new_stage = function(data) {
	this.stage.client_new_stage(data.time_left);
};

game_core.prototype.client_on_current_stage = function(data) {
	this.stage.client_current_stage(data.time_left, data.enemies_info);
};

// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };
//copies a 2d vector like object from one to another
game_core.prototype.pos = function(a) { return {x:a.x,y:a.y}; };
//convert physics vector2 to game vector2
game_core.prototype.g_vec2 = function(a) { return {x:a[0], y:a[1]}; };
//convert game vector2 to physics vector2
game_core.prototype.p_vec2 = function(a) { return [a.x, a.y]; };
//Add a 2d vector with another one and return the resulting vector
game_core.prototype.v_add = function(a,b) { return { x:(a.x+b.x).fixed(), y:(a.y+b.y).fixed() }; };
//Subtract a 2d vector with another one and return the resulting vector
game_core.prototype.v_sub = function(a,b) { return { x:(a.x-b.x).fixed(),y:(a.y-b.y).fixed() }; };
//Multiply a 2d vector with a scalar value and return the resulting vector
game_core.prototype.v_mul_scalar = function(a,b) { return {x: (a.x*b).fixed() , y:(a.y*b).fixed() }; };
//For the server, we need to cancel the setTimeout that the polyfill creates
game_core.prototype.stop_update = function() {  window.cancelAnimationFrame( this.updateid );  };
//Simple linear interpolation
game_core.prototype.lerp = function(p, n, t) { var _t = Number(t); _t = (Math.max(0, Math.min(1, _t))).fixed(); return (p + _t * (n - p)).fixed(); };
//Simple linear interpolation between 2 vectors
game_core.prototype.v_lerp = function(v,tv,t) { return { x: this.lerp(v.x, tv.x, t), y:this.lerp(v.y, tv.y, t) }; };

var c_enemy = function(game, id, radius, pos ) {
	this.game = game;
	this.id = id;

	this.pos = {x: 30, y: 50};

	if (pos) {
		this.pos = pos;
	}

	this.p_body = physics.body('circle', {
		mass: 1,
		x: pos.x,
		y: pos.y,
		radius: radius ? radius : 10
	});

	this.p_shape.collisionGroup = this.game.collision_group.PLAYER;
	this.p_shape.collisionMask = this.game.collision_group.GROUND;

	this.game.physics_world.add(this.p_body);
};

c_enemy.prototype.draw = function() {
	this.p_body.draw();
};

var game_player = function( game_instance, player_instance, is_ghost ) {

	//Store the instance, if any
	this.instance = player_instance;
	this.game = game_instance;


	//Set up initial values for our state information
	this.pos = { x:100, y:50 };
	this.size = { x:16, y:16, hx:8, hy:8 };
	this.state = 'not-connected';
	this.color = 'rgba(255,255,255,0.1)';
	this.info_color = 'rgba(255,255,255,0.1)';
	this.id = player_instance ? player_instance.user_id : undefined;

	//These are used in moving us around later
	this.old_state = {pos:{x:0,y:0}};
	this.cur_state = {pos:{x:0,y:0}};
	this.state_time = new Date().getTime();

	this.is_dead = true;

	//Our local history of inputs
	this.inputs = [];

	//physics initalization
	if (!is_ghost)
	{
		this.p_body = physics.body('rectangle', {
			x: 100,
			y: 50,
			mass: 1,
			width: 15,
			height: 15
		});

		this.p_shape.collisionGroup = this.game.collision_group.ENEMY;
		this.p_shape.collisionMask = this.game.collision_group.GROUND;
		this.game.physics_world.add(this.p_body);
	}


	//The world bounds we are confined to
	this.pos_limits = {
		x_min: this.size.hx,
		x_max: this.game.world.width - this.size.hx,
		y_min: this.size.hy,
		y_max: this.game.world.height - this.size.hy
	};

	//The 'host' of a game gets created with a player instance since
	//the server already knows who they are. If the server starts a game
	//with only a host, the other player is set up in the 'else' below

	this.get_info = function() {
		return {
			id: this.id,
				pos: this.pos,
				color: this.color,
				is_dead: this.is_dead

		};
	};

}; //game_player.constructor


game_player.prototype.draw = function(){
	if (!this.is_dead)
	{
		this.p_body.draw();
	}

	/*
	//Set the color for this player
	game.ctx.fillStyle = this.color;

	//Draw a rectangle for us
	game.ctx.fillRect(this.pos.x - this.size.hx, this.pos.y - this.size.hy, this.size.x, this.size.y);

	//Draw a status update
	game.ctx.fillStyle = this.info_color;
	game.ctx.fillText(this.state, this.pos.x+10, this.pos.y + 4);
	*/

}; //game_player.draw

/*

	 Common functions

	 These functions are shared between client and server, and are generic
	 for the game state. The client functions are client_* and server functions
	 are server_* so these have no prefix.

*/

//Main update loop
game_core.prototype.update = function(t) {

	//Work out the delta time
	this.dt = this.lastframetime ? ( (t - this.lastframetime)/1000.0).fixed() : 0.016;

	//Store the last frame time
	this.lastframetime = t;

	//Update the game specifics
	if(!this.server) {
		this.client_update();
	} else {
		this.server_update();
	}

	this.check_timers(this.dt, t);

	//schedule the next update
	this.updateid = window.requestAnimationFrame( this.update.bind(this), this.viewport );
}; //game_core.update


/*
	 Shared between server and client.
	 In this example, `item` is always of type game_player.
	 */
game_core.prototype.check_collision = function( item ) {

	//Left wall.
	if(item.pos.x <= item.pos_limits.x_min) {
		item.pos.x = item.pos_limits.x_min;
	}

	//Right wall
	if(item.pos.x >= item.pos_limits.x_max ) {
		item.pos.x = item.pos_limits.x_max;
	}

	//Roof wall.
	if(item.pos.y <= item.pos_limits.y_min) {
		item.pos.y = item.pos_limits.y_min;
	}

	//Floor wall
	if(item.pos.y >= item.pos_limits.y_max ) {
		item.pos.y = item.pos_limits.y_max;
	}

	//Fixed point helps be more deterministic
	item.pos.x = item.pos.x.fixed(4);
	item.pos.y = item.pos.y.fixed(4);

}; //game_core.check_collision


game_core.prototype.process_input = function( player ) {

	//It's possible to have recieved multiple inputs by now,
	//so we process each one
	var x_dir = 0;
	var y_dir = 0;
	var ic = player.inputs.length;
	if(ic) {
		for(var j = 0; j < ic; ++j) {
			//don't process ones we already have simulated locally
			if(player.inputs[j].seq <= player.last_input_seq) continue;

			var input = player.inputs[j].inputs;
			var c = input.length;
			for(var i = 0; i < c; ++i) {
				var key = input[i];
				if(key == 'l') {
					x_dir -= 1;
				}
				if(key == 'r') {
					x_dir += 1;
				}
				if(key == 'd') {
					y_dir += 1;
				}
				if(key == 'u') {
					y_dir -= 1;
				}
			} //for all input values

		} //for each input command
	} //if we have inputs

	//we have a direction vector now, so apply the same physics as the client
	var resulting_vector = this.physics_movement_vector_from_direction(x_dir,y_dir);
	if(player.inputs.length) {
		//we can now clear the array since these have been processed

		player.last_input_time = player.inputs[ic-1].time;
		player.last_input_seq = player.inputs[ic-1].seq;
	}

	//give it back
	return resulting_vector;

}; //game_core.process_input



game_core.prototype.physics_movement_vector_from_direction = function(x,y) {

	//Must be fixed step, at physics sync speed.
	return {
		x : (x * (this.playerspeed * 0.015)).fixed(3),
			y : (y * (this.playerspeed * 0.015)).fixed(3)
	};

}; //game_core.physics_movement_vector_from_direction

game_core.prototype.update_physics = function() {


	if(this.server) {
		this.server_update_physics();
	} else {
		this.client_update_physics();

	}

	this.physics_world.step(this._pdte);
	this.call_count++;

	this.after_step();

}; //game_core.prototype.update_physics

game_core.prototype.after_step = function() {
	Object.keys(this.players).forEach(function(id) {
		if (id == 'self') return;


		var player = this.players[id];

		player.pos = this.g_vec2(player.p_body.position);
	}.bind(this));

	Object.keys(this.enemies).forEach(function(id) {
		var enemy = this.enemies[id];
		enemy.pos = this.g_vec2(enemy.p_body.position);
	}.bind(this));
};
/*

	 Server side functions

	 These functions below are specific to the server side only,
	 and usually start with server_* to make things clearer.

*/

//Updated at 15ms , simulates the world state
game_core.prototype.server_update_physics = function() {

	//process physics function
	var process_physics = function(player) {
		player.old_state.pos = this.g_vec2(player.p_body.position);
		var new_dir = this.process_input(player);
		player.p_body.velocity = this.p_vec2({ x: new_dir.x, y: player.p_body.velocity[1] });
	}.bind(this);

	this.for_each_player(function(player) {
		process_physics(player);
		player.inputs = []; //we have cleared the input buffer, so remove this	
	});

	//Keep the physics position in the world
	this.for_each_player(function(player) {
		this.check_collision(player);
	});

}; //game_core.server_update_physics

//Makes sure things run smoothly and notifies clients of changes
//on the server side
game_core.prototype.server_update = function(){

	//Update the state of our local clock to match the timer
	this.server_time = this.local_time;

	var states = {};

	this.for_each_player(function(player) {
		states[player.id] = {
			pos: player.pos,
			is: player.last_input_seq,
			dead: player.is_dead
		};
	});

	var enemy_states = {};

	this.for_each_enemy(function(enemy) {
		enemy_states[enemy.id] = {
			pos: enemy.pos
		};
	});

	//Make a snapshot of the current state, for updating the clients
	this.laststate = {
		player_states : states,
		enemy_states : enemy_states,
		t   : this.server_time                      // our current local time on the server
	};

	this.broadcast('onserverupdate', this.laststate);
}; //game_core.server_update

game_core.prototype.handle_server_input = function(client, input, input_time, input_seq) {

	//Fetch which client this refers to
	var player = this.players[client.user_id];

	if (!player) return;

	//Store the input on the player instance for processing in the physics loop
	player.inputs.push({inputs: input, time: input_time, seq: input_seq});
}; //game_core.handle_server_input


/*

	 Client side functions

	 These functions below are specific to the client side only,
	 and usually start with client_* to make things clearer.

*/

game_core.prototype.client_handle_input = function(){

	//if(this.lit > this.local_time) return;
	//this.lit = this.local_time+0.5; //one second delay

	//This takes input from the client and keeps a record,
	//It also sends the input information to the server immediately
	//as it is pressed. It also tags each input with a sequence number.

	var x_dir = 0;
	var y_dir = 0;
	var input = [];
	this.client_has_input = false;

	if( this.keyboard.pressed('A') ||
			this.keyboard.pressed('left')) {

				x_dir = -1;
				input.push('l');

			} //left

	if( this.keyboard.pressed('D') ||
			this.keyboard.pressed('right')) {

				x_dir = 1;
				input.push('r');

			} //right

	if( this.keyboard.pressed('S') ||
			this.keyboard.pressed('down')) {

				y_dir = 1;
				input.push('d');

			} //down

	if( this.keyboard.pressed('W') ||
			this.keyboard.pressed('up')) {

				y_dir = -1;
				input.push('u');

			} //up

	if(input.length) {

		//Update what sequence we are on now
		this.input_seq += 1;

		//Store the input state as a snapshot of what happened.
		this.players.self.inputs.push({
			inputs : input,
			time : this.local_time.fixed(3),
			seq : this.input_seq
		});

		//Send the packet of information to the server.
		//The input packets are labelled with an 'i' in front.
		var server_packet = {
			inputs: input,
			t: this.local_time.toFixed(3),
			seq: this.input_seq
		};

		this.socket.emit('client_input', server_packet);

		//Return the direction if needed
		return this.physics_movement_vector_from_direction( x_dir, y_dir );

	} else {

		return {x:0,y:0};

	}

}; //game_core.client_handle_input

game_core.prototype.client_process_net_prediction_correction = function() {

	//No updates...
	if(!this.server_updates.length) return;

	//The most recent server update
	var latest_server_data = this.server_updates[this.server_updates.length-1];

	var my_server_state = latest_server_data.player_states[this.players.self.id];
	//Our latest server position
	var my_server_pos = my_server_state.pos;

	//Update the debug server position block
	this.ghosts[this.players.self.id].server_pos.pos = this.pos(my_server_pos);

	//here we handle our local input prediction ,
	//by correcting it with the server and reconciling its differences

	var my_last_input_on_server = my_server_state.is;
	if(my_last_input_on_server) {
		//The last input sequence index in my local input list
		var lastinputseq_index = -1;
		//Find this input in the list, and store the index
		for(var i = 0; i < this.players.self.inputs.length; ++i) {
			if(this.players.self.inputs[i].seq == my_last_input_on_server) {
				lastinputseq_index = i;
				break;
			}
		}

		//Now we can crop the list of any updates we have already processed
		if(lastinputseq_index != -1) {
			//so we have now gotten an acknowledgement from the server that our inputs here have been accepted
			//and that we can predict from this known position instead

			//remove the rest of the inputs we have confirmed on the server
			var number_to_clear = Math.abs(lastinputseq_index - (-1));
			this.players.self.inputs.splice(0, number_to_clear);
			//The player is now located at the new server position, authoritive server
			this.players.self.p_body.position = this.p_vec2(my_server_pos);
			this.players.self.cur_state.pos = this.pos(my_server_pos);
			this.players.self.last_input_seq = lastinputseq_index;
			//Now we reapply all the inputs that we have locally that
			//the server hasn't yet confirmed. This will 'keep' our position the same,
			//but also confirm the server position at the same time.
			this.client_update_physics();
			this.client_update_local_position();

		} // if(lastinputseq_index != -1)
	} //if my_last_input_on_server

}; //game_core.client_process_net_prediction_correction

game_core.prototype.client_process_net_updates = function() {

	//No updates...
	if(!this.server_updates.length) return;

	//First : Find the position in the updates, on the timeline
	//We call this current_time, then we find the past_pos and the target_pos using this,
	//searching throught the server_updates array for current_time in between 2 other times.
	// Then :  other player position = lerp ( past_pos, target_pos, current_time );

	//Find the position in the timeline of updates we stored.
	var current_time = this.client_time;
	var count = this.server_updates.length-1;
	var target = null;
	var previous = null;

	//We look from the 'oldest' updates, since the newest ones
	//are at the end (list.length-1 for example). This will be expensive
	//only when our time is not found on the timeline, since it will run all
	//samples. Usually this iterates very little before breaking out with a target.
	for(var i = 0; i < count; ++i) {

		var point = this.server_updates[i];
		var next_point = this.server_updates[i+1];

		//Compare our point in time with the server times we have
		if(current_time > point.t && current_time < next_point.t) {
			target = next_point;
			previous = point;
			break;
		}
	}

	//With no target we store the last known
	//server position and move to that instead
	if(!target) {
		target = this.server_updates[0];
		previous = this.server_updates[0];
	}

	//Now that we have a target and a previous destination,
	//We can interpolate between then based on 'how far in between' we are.
	//This is simple percentage maths, value/target = [0,1] range of numbers.
	//lerp requires the 0,1 value to lerp to? thats the one.

	if(target && previous) {

		this.target_time = target.t;

		var difference = this.target_time - current_time;
		var max_difference = (target.t - previous.t).fixed(3);
		var time_point = (difference/max_difference).fixed(3);

		//Because we use the same target and previous in extreme cases
		//It is possible to get incorrect values due to division by 0 difference
		//and such. This is a safe guard and should probably not be here. lol.
		if( isNaN(time_point) ) time_point = 0;
		if(time_point == -Infinity) time_point = 0;
		if(time_point == Infinity) time_point = 0;

		//The most recent server update
		var latest_server_data = this.server_updates[ this.server_updates.length-1 ];

		//state update
		for(var id in this.players) {
			if (id == 'self') continue;
			if (!latest_server_data.player_states[id]) continue;

			this.players[id].is_dead = latest_server_data.player_states[id].dead;
		}

		(function() {
			for(var id in this.players) {
				if (id == this.players.self.id || id == 'self') continue;
				if (!latest_server_data.player_states[id]) continue;
				if (!target.player_states[id] || !previous.player_states[id]) continue;

				//These are the exact server positions from this tick, but only for the ghost
				var other_server_pos = latest_server_data.player_states[id].pos;
				//The other players positions in this timeline, behind us and in front of us
				var other_target_pos = target.player_states[id].pos;
				var other_past_pos = previous.player_states[id].pos;

				//update the dest block, this is a simple lerp
				//to the target from the previous point in the server_updates buffer
				this.ghosts[id].server_pos.pos = this.pos(other_server_pos);
				this.ghosts[id].client_pos.pos = this.v_lerp(other_past_pos, other_target_pos, time_point);


				var other = this.players[id];
				if (this.client_smoothing) {
					other.p_body.position = this.p_vec2(this.v_lerp(other.pos, this.ghosts[id].client_pos.pos, this._pdt*this.client_smooth));
				} else {
					other.p_body.position = this.p_vec2(this.pos(this.ghosts[id].client_pos.pos));
				}
			}
		})();




		(function() {
			for (var id in this.enemies) {
				if (!latest_server_data.enemy_states[id]) continue;
				if (!target.enemy_states[id] || !previous.enemy_states[id]) continue;

				//The other players positions in this timeline, behind us and in front of us
				var other_target_pos = target.enemy_states[id].pos;
				var other_past_pos = previous.enemy_states[id].pos;

				//update the dest block, this is a simple lerp
				//to the target from the previous point in the server_updates buffer
				var client_pos = this.v_lerp(other_past_pos, other_target_pos, time_point);

				var other = this.enemies[id];
				if (this.client_smoothing) {
					other.p_body.position = this.p_vec2(this.v_lerp(other.pos, client_pos, this._pdt*this.client_smooth));
				} else {
					other.p_body.position = this.p_vec2(this.pos(client_pos));
				}
			}
		})();


		//Now, if not predicting client movement , we will maintain the local player position
		//using the same method, smoothing the players information from the past.
		if(!this.client_predict && !this.naive_approach) {

			var my_id = this.players.self.id;
			//These are the exact server positions from this tick, but only for the ghost
			var my_server_pos = latest_server_data.player_states[my_id].pos;

			//The other players positions in this timeline, behind us and in front of us
			var my_target_pos = target.player_states[my_id].pos;
			var my_past_pos = previous.player_states[my_id].pos;

			//Snap the ghost to the new server position
			this.ghosts[my_id].server_pos.pos = this.pos(my_server_pos);
			var local_target = this.v_lerp(my_past_pos, my_target_pos, time_point);

			//Smoothly follow the destination position
			if(this.client_smoothing) {
				this.players.self.p_body.position = this.p_vec2(this.v_lerp( this.players.self.pos, local_target, this._pdt*this.client_smooth));
			} else {
				this.players.self.p_body.position = this.p_vec2(this.pos( local_target ));
			}
		}

	} //if target && previous

}; //game_core.client_process_net_updates

game_core.prototype.client_onserverupdate_recieved = function(data){

	//Lets clarify the information we have locally. One of the players is 'hosting' and
	//the other is a joined in client, so we name these host and client for making sure
	//the positions we get from the server are mapped onto the correct local sprites

	//Store the server time (this is offset by the latency in the network, by the time we get it)
	this.server_time = data.t;
	//Update our local offset time from the last server update
	this.client_time = this.server_time - (this.net_offset/1000);

	//One approach is to set the position directly as the server tells you.
	//This is a common mistake and causes somewhat playable results on a local LAN, for example,
	//but causes terrible lag when any ping/latency is introduced. The player can not deduce any
	//information to interpolate with so it misses positions, and packet loss destroys this approach
	//even more so. See 'the bouncing ball problem' on Wikipedia.

	if(this.naive_approach) {
		for(var id in data.player_states) {
			this.players[id].p_body.position = this.p_vec2(data.player_states[id]).pos;
		}
	} else {

		//Cache the data from the server,
		//and then play the timeline
		//back to the player with a small delay (net_offset), allowing
		//interpolation between the points.
		this.server_updates.push(data);

		//we limit the buffer in seconds worth of updates
		//60fps*buffer seconds = number of samples
		if(this.server_updates.length >= ( 60*this.buffer_size )) {
			this.server_updates.splice(0,1);
		}

		//We can see when the last tick we know of happened.
		//If client_time gets behind this due to latency, a snap occurs
		//to the last tick. Unavoidable, and a reallly bad connection here.
		//If that happens it might be best to drop the game after a period of time.
		this.oldest_tick = this.server_updates[0].t;

		//Handle the latest positions from the server
		//and make sure to correct our local predictions, making the server have final say.
		this.client_process_net_prediction_correction();

	} //non naive

}; //game_core.client_onserverupdate_recieved

game_core.prototype.client_update_local_position = function(){

	if(this.client_predict && this.players.self && this.players.self.state == 'connected') {

		//Work out the time we have since we updated the state
		var t = (this.local_time - this.players.self.state_time) / this._pdt;

		//Then store the states for clarity,
		var old_state = this.players.self.old_state.pos;
		var current_state = this.players.self.cur_state.pos;

		//Make sure the visual position matches the states we have stored
		//this.players.self.pos = this.v_add( old_state, this.v_mul_scalar( this.v_sub(current_state,old_state), t )  );
		this.players.self.pos = current_state;

		//We handle collision on client if predicting.
		this.check_collision( this.players.self );

	}  //if(this.client_predict)

}; //game_core.prototype.client_update_local_position

game_core.prototype.client_update_physics = function() {

	//Fetch the new direction from the input buffer,
	//and apply it to the state so we can smooth it in the visual state

	if(this.client_predict) {
		if (!(this.players.self) || this.players.self.state != 'connected') return;

		this.players.self.old_state.pos = this.g_vec2(this.players.self.p_body.position);
		var nd = this.process_input(this.players.self);
		this.players.self.p_body.velocity = [nd.x, this.players.self.p_body.velocity[1]];
		this.players.self.state_time = this.local_time;

	}
}; //game_core.client_update_physics

game_core.prototype.client_update = function() {

	//Clear the screen area
	this.ctx.clearRect(0,0,720,480);

	//draw help/information if required
	this.client_draw_info();

	//Capture inputs from the player
	this.client_handle_input();

	//Network player just gets drawn normally, with interpolation from
	//the server updates, smoothing out the positions from the past.
	//Note that if we don't have prediction enabled - this will also
	//update the actual local client position on screen as well.
	if( !this.naive_approach ) {
		this.client_process_net_updates();
	}

	//Now they should have updated, we can draw the entity

	//When we are doing client side prediction, we smooth out our position
	//across frames using local input states we have stored.
	this.client_update_local_position();

	for(var id in this.players)
	{
		if (id == 'self') continue;

		this.players[id].draw();

		if(this.show_dest_pos && !this.naive_approach) {
			if (id == this.players.self.id) continue;
			this.ghosts[id].client_pos.draw();
		}

		if(this.show_server_pos && !this.naive_approach) {
			this.ghosts[id].server_pos.draw();
		}
	}

	for(var e_id in this.enemies) {
		this.enemies[e_id].draw();
	}

	this.groundBody.draw();

	//Work out the fps average
	this.client_refresh_fps();

}; //game_core.update_client

game_core.prototype.create_timer = function(){
	setInterval(function(){
		this._dt = new Date().getTime() - this._dte;
		this._dte = new Date().getTime();
		this.local_time += this._dt/1000.0;
	}.bind(this), 4);
};

game_core.prototype.create_physics_simulation = function() {
	this.physics_start = new Date().getTime();
	this.call_count = 0;

	setInterval(function(){
		this._pdt = (new Date().getTime() - this._pdte)/1000.0;
		this._pdte = new Date().getTime();

		this.update_physics();
	}.bind(this), 15);

}; //game_core.client_create_physics_simulation


game_core.prototype.client_create_ping_timer = function() {

	//Set a ping timer to 1 second, to maintain the ping/latency between
	//client and server and calculated roughly how our connection is doing

	setInterval(function(){

		this.last_ping_time = new Date().getTime() - this.fake_lag;
		this.socket.send('p.' + (this.last_ping_time) );

	}.bind(this), 1000);

}; //game_core.client_create_ping_timer


game_core.prototype.client_create_configuration = function() {

	this.show_help = false;             //Whether or not to draw the help text
	this.naive_approach = false;        //Whether or not to use the naive approach
	this.show_server_pos = false;       //Whether or not to show the server position
	this.show_dest_pos = false;         //Whether or not to show the interpolation goal
	this.client_predict = true;         //Whether or not the client is predicting input
	this.input_seq = 0;                 //When predicting client inputs, we store the last input as a sequence number
	this.client_smoothing = true;       //Whether or not the client side prediction tries to smooth things out
	this.client_smooth = 25;            //amount of smoothing to apply to client update dest

	this.net_latency = 0.001;           //the latency between the client and the server (ping/2)
	this.net_ping = 0.001;              //The round trip time from here to the server,and back
	this.last_ping_time = 0.001;        //The time we last sent a ping
	this.fake_lag = 0;                //If we are simulating lag, this applies only to the input client (not others)
	this.fake_lag_time = 0;

	this.net_offset = 100;              //100 ms latency between server and client interpolation for other clients
	this.buffer_size = 2;               //The size of the server history to keep for rewinding/interpolating.
	this.target_time = 0.01;            //the time where we want to be in the server timeline
	this.oldest_tick = 0.01;            //the last time tick we have available in the buffer

	this.client_time = 0.01;            //Our local 'clock' based on server time - client interpolation(net_offset).
	this.server_time = 0.01;            //The time the server reported it was at, last we heard from it

	this.dt = 0.016;                    //The time that the last frame took to run
	this.fps = 0;                       //The current instantaneous fps (1/this.dt)
	this.fps_avg_count = 0;             //The number of samples we have taken for fps_avg
	this.fps_avg = 0;                   //The current average fps displayed in the debug UI
	this.fps_avg_acc = 0;               //The accumulation of the last avgcount fps samples

	this.lit = 0;
	this.llt = new Date().getTime();

};//game_core.client_create_configuration

game_core.prototype.client_create_debug_gui = function() {

	this.gui = new dat.GUI();

	var _playersettings = this.gui.addFolder('Your settings');

	this.colorcontrol = _playersettings.addColor(this, 'color');

	//We want to know when we change our color so we can tell
	//the server to tell the other clients for us
	this.colorcontrol.onChange(function(value) {
		this.players.self.color = value;
		localStorage.setItem('color', value);
		this.socket.send('c.' + value);
	}.bind(this));

	_playersettings.open();

	var _othersettings = this.gui.addFolder('Methods');

	_othersettings.add(this, 'naive_approach').listen();
	_othersettings.add(this, 'client_smoothing').listen();
	_othersettings.add(this, 'client_smooth').listen();
	_othersettings.add(this, 'client_predict').listen();

	var _debugsettings = this.gui.addFolder('Debug view');

	_debugsettings.add(this, 'show_help').listen();
	_debugsettings.add(this, 'fps_avg').listen();
	_debugsettings.add(this, 'show_server_pos').listen();
	_debugsettings.add(this, 'show_dest_pos').listen();
	_debugsettings.add(this, 'local_time').listen();

	_debugsettings.open();

	var _consettings = this.gui.addFolder('Connection');
	_consettings.add(this, 'net_latency').step(0.001).listen();
	_consettings.add(this, 'net_ping').step(0.001).listen();

	//When adding fake lag, we need to tell the server about it.
	var lag_control = _consettings.add(this, 'fake_lag').step(0.001).listen();
	lag_control.onChange(function(value){
		this.socket.send('l.' + value);
	}.bind(this));

	_consettings.open();

	var _netsettings = this.gui.addFolder('Networking');

	_netsettings.add(this, 'net_offset').min(0.01).step(0.001).listen();
	_netsettings.add(this, 'server_time').step(0.001).listen();
	_netsettings.add(this, 'client_time').step(0.001).listen();
	//_netsettings.add(this, 'oldest_tick').step(0.001).listen();

	_netsettings.open();

}; //game_core.client_create_debug_gui
game_core.prototype.client_on_receive_player_info = function(data) {
	data.players.forEach(function(p_info, index, arr) {
		var player = new game_player(this, undefined, false);
		player.state = 'connected';
		player.online = 'true';
		player.id = p_info.id;
		this.players[p_info.id] = player;
		this.players[p_info.id].pos = p_info.pos;
		this.players[p_info.id].color = '#ffffff';
		this.players[p_info.id].is_dead = p_info.is_dead;
		this.ghosts[p_info.id] = {
			server_pos: new game_player(this, undefined, true),
		client_pos: new game_player(this, undefined, true)
		};

		if(this.players.self.id == p_info.id) {
			var self = this.players.self;

			this.players.self = player;
			player.color = '#cc0000';
			player.id = self.id;
			player.info_color = '#cc0000';
		}
	}.bind(this));
};

game_core.prototype.client_on_player_disconnected = function(data) {
	var player = this.players[data.id];
	if (player)
	{
		delete this.players[data.id];
	}
};

game_core.prototype.client_reset_positions = function() {

	for(var id in this.players) {
		this.players[id].pos = { x: 20, y: 20 };

		this.ghosts[id].server_pos.pos = this.pos(this.players[id].pos);
		this.ghosts[id].client_pos.pos = this.pos(this.players[id].pos);
	}

	//Make sure the local player physics is updated
	this.players.self.old_state.pos = this.pos(this.players.self.pos);
	this.players.self.pos = this.pos(this.players.self.pos);
	this.players.self.cur_state.pos = this.pos(this.players.self.pos);

}; //game_core.client_reset_positions


// this function is not called.
game_core.prototype.client_onreadygame = function(data) {

	var server_time = parseFloat(data.replace('-','.'));

	this.local_time = server_time + this.net_latency;
	console.log('server time is about ' + this.local_time);

	//Update their information
	for(var id in this.players) {
		this.players[id].state = 'local_pos';
	}

	//Make sure colors are synced up
	this.socket.send('c.' + this.players.self.color);

}; //client_onreadygame

//this function is not called
game_core.prototype.client_onjoingame = function(data) {

	//We are not the host
	this.players.self.host = false;
	//Update the local state
	this.players.self.state = 'connected.joined.waiting';
	this.players.self.info_color = '#00bb00';

	//Make sure the positions match servers and other clients
	this.client_reset_positions();

}; //client_onjoingame

//this function is not called
game_core.prototype.client_onhostgame = function(data) {

	//The server sends the time when asking us to host, but it should be a new game.
	//so the value will be really small anyway (15 or 16ms)
	var server_time = parseFloat(data.replace('-','.'));

	//Get an estimate of the current time on the server
	this.local_time = server_time + this.net_latency;

	//Set the flag that we are hosting, this helps us position respawns correctly
	this.players.self.host = true;

	//Update debugging information to display state
	this.players.self.state = 'hosting.waiting for a player';
	this.players.self.info_color = '#cc0000';

	//Make sure we start in the correct place as the host.
	this.client_reset_positions();

}; //client_onhostgame

game_core.prototype.client_onconnected = function(data) {

	//The server responded that we are now in a game,
	//this lets us store the information about ourselves and set the colors
	//to show we are now ready to be playing.

	this.players.self.id = data.id;
	this.players.self.info_color = '#cc0000';
	this.players.self.state = 'connected';
	this.players.self.online = true;

	console.log('received client id : ' + data.id);
}; //client_onconnected

game_core.prototype.client_on_otherclientcolorchange = function(data) {

	this.players.other.color = data;

}; //game_core.client_on_otherclientcolorchange

game_core.prototype.client_onping = function(data) {

	this.net_ping = new Date().getTime() - parseFloat( data );
	this.net_latency = this.net_ping/2;

}; //client_onping

game_core.prototype.client_onnetmessage = function(data) {

	var commands = data.split('.');
	var command = commands[0];
	var subcommand = commands[1] || null;
	var commanddata = commands[2] || null;

	switch(command) {
		case 's': //server message

			switch(subcommand) {

				case 'h' : //host a game requested
					this.client_onhostgame(commanddata); break;

				case 'j' : //join a game requested
					this.client_onjoingame(commanddata); break;

				case 'r' : //ready a game requested
					this.client_onreadygame(commanddata); break;

				case 'e' : //end game requested
					this.client_ondisconnect(commanddata); break;

				case 'p' : //server ping
					this.client_onping(commanddata); break;

				case 'c' : //other player changed colors
					this.client_on_otherclientcolorchange(commanddata); break;

			} //subcommand

			break; //'s'
	} //command

}; //client_onnetmessage

game_core.prototype.player_disconnected = function(player_id) {
	var player = this.players[player_id];

	if (player) {
		delete this.players[player_id];
	}

	this.broadcast('player_disconnected', { id: player_id });
};

game_core.prototype.for_each_player = function(func) {
	Object.keys(this.players).forEach(function(id) {
		if (id === 'self') return;

		func.call(this, this.players[id]);
	}.bind(this));
};

game_core.prototype.for_each_enemy = function(func) {
	Object.keys(this.enemies).forEach(function(id) {
		func.call(this, this.enemies[id]);
	}.bind(this));
};

game_core.prototype.broadcast = function(name, message) {
	for(var id in this.players) {
		if (this.players[id].instance) {
			this.players[id].instance.emit(name, message);
		}
	}
};

game_core.prototype.client_ondisconnect = function(data) {

	//When we disconnect, we don't know if the other player is
	//connected or not, and since we aren't, everything goes to offline

	for(var id in this.players) {
		if(id == 'self') continue;
		this.players[id].info_color = 'rgba(255, 255, 255, 0.1)';
		this.players[id].state= 'not-connected';
	}

	this.players.self.online = false;
}; //client_ondisconnect

game_core.prototype.client_connect_to_server = function() {

	//Store a local reference to our connection to the server
	this.socket = io.connect();

	//When we connect, we are not 'connected' until we have a server id
	//and are placed in a game by the server. The server sends us a message for that.
	this.socket.on('connect', function(){
		this.players.self.state = 'connecting';
	}.bind(this));

	//Sent when we are disconnected (network, server down, etc)
	this.socket.on('disconnect', this.client_ondisconnect.bind(this));
	//Sent each tick of the server simulation. This is our authoritive update
	this.socket.on('onserverupdate', this.client_onserverupdate_recieved.bind(this));
	//Handle when we connect to the server, showing state and storing id's.
	this.socket.on('onconnected', this.client_onconnected.bind(this));
	//On error we just show that we are not connected for now. Can print the data.
	this.socket.on('error', this.client_ondisconnect.bind(this));
	//On message from the server, we parse the commands and send it to the handlers
	this.socket.on('player_info', this.client_on_receive_player_info.bind(this));
	this.socket.on('new_stage', this.client_on_new_stage.bind(this));
	this.socket.on('current_stage', this.client_on_current_stage.bind(this));
	this.socket.on('message', this.client_onnetmessage.bind(this));
	this.socket.on('player_disconnected', this.client_on_player_disconnected.bind(this));

}; //game_core.client_connect_to_server


game_core.prototype.client_refresh_fps = function() {

	//We store the fps for 10 frames, by adding it to this accumulator
	this.fps = 1/this.dt;
	this.fps_avg_acc += this.fps;
	this.fps_avg_count++;

	//When we reach 10 frames we work out the average fps
	if(this.fps_avg_count >= 10) {

		this.fps_avg = this.fps_avg_acc/10;
		this.fps_avg_count = 1;
		this.fps_avg_acc = this.fps;

	} //reached 10 frames

}; //game_core.client_refresh_fps


game_core.prototype.client_draw_info = function() {

	//We don't want this to be too distracting
	this.ctx.fillStyle = 'rgba(255,255,255,0.3)';

	//They can hide the help with the debug GUI
	if(this.show_help) {

		this.ctx.fillText('net_offset : local offset of others players and their server updates. Players are net_offset "in the past" so we can smoothly draw them interpolated.', 10 , 30);
		this.ctx.fillText('server_time : last known game time on server', 10 , 70);
		this.ctx.fillText('client_time : delayed game time on client for other players only (includes the net_offset)', 10 , 90);
		this.ctx.fillText('net_latency : Time from you to the server. ', 10 , 130);
		this.ctx.fillText('net_ping : Time from you to the server and back. ', 10 , 150);
		this.ctx.fillText('fake_lag : Add fake ping/lag for testing, applies only to your inputs (watch server_pos block!). ', 10 , 170);
		this.ctx.fillText('client_smoothing/client_smooth : When updating players information from the server, it can smooth them out.', 10 , 210);
		this.ctx.fillText(' This only applies to other clients when prediction is enabled, and applies to local player with no prediction.', 170 , 230);

	} //if this.show_help

	//Reset the style back to full white.
	this.ctx.fillStyle = 'rgba(255,255,255,1)';


	this.ctx.fillText('time left : ' + this.stage.time_left.fixed(3), 30, 30);

};


var stage = function(game_instance) {
	this.stage_time = 30;
	this.time_left = this.stage_time;
	this.game = game_instance;

	this.timer_job = {
		STAGE_END : 0
	};

	this.start = function() {
		this.game.register_timer(this);
		if (this.game.server) {
			this.server_new_stage();
		}
	};

	this.server_new_stage = function() {
		this.time_left = this.stage_time;
		this.game.add_timer(this.timer_id, this.timer_job.STAGE_END, this.time_left);
		this.add_enemies();
		this.game.on_new_stage(this);
	};

	this.client_new_stage = function(t) {
		this.time_left = t;
		this.clear_enemies();
	};

	this.client_current_stage = function(t, enemies_info) {
		this.time_left = t;
		this.game.receive_enemy_info(enemies_info);
	};

	//add enemies by stage's own rule
	this.add_enemies = function() {
		this.game.add_enemy(25, {x: 30, y: 50});
	};

	this.clear_enemies = function() {
		this.game.clear_enemies();
	};


	this.on_timer = function(job_id) {
		if (job_id == this.timer_job.STAGE_END) {
			this.game.on_stage_end(this);
			this.server_new_stage();
		}
	};

	this.on_timer_tick = function(dt, t) {
		this.time_left -= dt;
	};
};



var c_timer = function() {
	this.timer_id = null;
	this.on_timer_tick = function(dt, t) {
		//implement in inherited class
	};
	this.on_timer = function(job_id) {
		//implement in inherited class
	};
};

c_timer.prototype.on_timer = function(job_id) {
	//implement
};

c_timer.prototype.on_timer_tick = function(dt, t) {
};

stage.prototype = Object.create(c_timer.prototype);


p2.Body.prototype.draw = function() {
	this.shapes.forEach(function(shape){
		shape.draw({
			x: this.position[0],
			y: this.position[1]
		});
	}.bind(this));
};

p2.Circle.prototype.draw = function(pos) {
	game.ctx.fillStyle = '#ffffff';

	game.ctx.beginPath();
	game.ctx.arc(pos.x, pos.y, this.radius, 0, 2 * Math.PI, false);
	game.ctx.fill();
};

p2.Box.prototype.draw = function(pos) {
	game.ctx.fillStyle = '#ffffff';

	game.ctx.fillRect(pos.x - this.width / 2.0, pos.y - this.height / 2.0, this.width, this.height);
};

p2.Plane.prototype.draw = function(pos) {
	game.ctx.fillStyle = '#eeeeee';

	game.ctx.fillRect(0, pos.y, game.world.width, game.world.height - pos.y);
};
