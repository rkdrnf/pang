var uuid = require('node-uuid');
var	p2 = require('p2');
var c_enemy = require('./enemy.js');
var i_shield = require('./item/shield.js');
var game_player = require('./game_player.js');
var c_timer = require('./timer.js');
var c_stage = require('./stage.js');
var c_projectile = require('./projectile.js');
var c_bullet = require('./bullet.js');
var c_ui_manager = require('./ui_manager');
var c_main_text_ui = require('./main_text_ui');
var Const = require('./const.js');

var frame_time = 60/1000;
if('undefined' != typeof(global.GLOBAL)) frame_time = 15;

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

	this.weapon_list = {};
	this.weapon_list.bullet = c_bullet;

	this.initial_position = {x: 15, y: 2};

	this.world = {
width : 30,
		height : 20
	};

	this.init_physics_world();

	this.m2x = 16;
	this.x2m = 0.0625;

	this.collision_group = {
		PLAYER: Math.pow(2,0),
		ENEMY: Math.pow(2,1),
		GROUND: Math.pow(2,2),
		ITEM: Math.pow(2,3),
		BULLET: Math.pow(2,4),
		WALL: Math.pow(2,5)
	};


	this.enemy_materials = [];
	this.enemy_material_level = 8;

	this.ground_material = new p2.Material();
	this.player_material = new p2.Material();
	
	this.make_ground_and_wall();

	this.make_enemy_materials(this.enemy_material_level);


	this.physics_change_list = {};
	this.after_physics = [];

  // create objects in game.
	this.enemies = {};
  this.items = {};



	if (this.server) {
		this.players = {};
		this.projectiles = {};
	} else {
		this.players = {};
		this.players.self = {};
		this.ghosts = {};
		this.projectiles = {};
	}

this.timers = {};

this.playerspeed = 480;

this._pdt = 0.0001;
this._pdte = new Date().getTime();

this.physics_time = 0;

this.local_time = 0.016;
this._dt = new Date().getTime();
this._dte = new Date().getTime();

this.create_physics_simulation();
this.create_timer();

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

	this.ui_manager = new c_ui_manager(this);
	this.ui_manager.add(c_main_text_ui);
	this.create_stage();

} else {
	this.server_time = 0;
	this.laststate = {};
}
};

game_core.prototype.init_physics_world = function() {
	this.physics_world = new p2.World({
		gravity:[0, 9.87]
	});

	var player_enemy_col = function(data) {
		var s_A = data.shapeA;
		var s_B = data.shapeB;

		var playerShape = s_A.collisionGroup == this.collision_group.PLAYER ? s_A : s_B;
		var enemyShape = s_A.collisionGroup == this.collision_group.ENEMY ? s_A : s_B;

		var player_obj = playerShape.body.game_object;
		if (player_obj) {
      if (player_obj.isDead()) {
			  this.after_physics.push({
          func: function() {
            this.player_die(player_obj);
            },
          caller: this
        });
      }
		}
	};

	var player_item_col = function(data) {
		var s_A = data.shapeA;
		var s_B = data.shapeB;

		var playershape = s_A.collisionGroup == this.collision_group.PLAYER ? s_A : s_B;
		var itemshape = s_A.collisionGroup == this.collision_group.ITEM ? s_A : s_B;

		var player_obj = playershape.body.game_object;
		var item_obj = itemshape.body.item_object;

		if (player_obj && item_obj) {
			this.after_physics.push({
				func: function() {
						player_obj.applyitem(item_obj);
						item_obj.destroy();
						delete this.items[item_obj.id];
					},
				caller: this
			});
		}
	};

	var enemy_ground_col = function(data) {
		var s_A = data.shapeA;
		var s_B = data.shapeB;

		var enemyshape = s_A.collisionGroup == this.collision_group.ENEMY ? s_A : s_B;

		var enemy_obj = enemyshape.body.game_object;

		if (enemy_obj) {
			enemy_obj.on_collide_with_ground();
		}
	};

	this.physics_world.on('beginContact', function(data) {
		var s_A = data.shapeA;
		var s_B = data.shapeB;

		if ((s_A.collisionGroup | s_B.collisionGroup) == (this.collision_group.PLAYER | this.collision_group.ENEMY)) {
			player_enemy_col.call(this, data);
			return;
		}

    if ((s_A.collisionGroup | s_B.collisionGroup) == (this.collision_group.PLAYER | this.collision_group.ITEM)) {
			player_item_col.call(this, data);
			return;
		}

		if ((s_A.collisionGroup | s_B.collisionGroup) == (this.collision_group.ENEMY | this.collision_group.GROUND)) {
			enemy_ground_col.call(this, data);
			return;
		}
	}.bind(this));
};

game_core.prototype.make_enemy_materials = function(level) {
	for(var i = 0; i < level; i++) {
		var material = new p2.Material();
		this.enemy_materials.push(material);

		var enemy_ground_c_material = new p2.ContactMaterial(material, this.ground_material, {
			restitution: Math.min(1, 1.2 * (1 - (1 / i))),
			stiffness: Number.MAX_VALUE
		});
		
		var enemy_player_c_material = new p2.ContactMaterial(material, this.player_material, {
			restitution: Math.min(1, 1.2 * ((1 - 1 / i))),
			stiffness: Number.MAX_VALUE
		});
		
		this.physics_world.addContactMaterial(enemy_ground_c_material);
		this.physics_world.addContactMaterial(enemy_player_c_material);
	}
};

game_core.prototype.make_ground_and_wall = function() {
	this.groundBody = new p2.Body({
		mass:0,
		angle: Math.PI,
		position: [0, this.world.height - 1]
	});
	var groundShape = new p2.Plane();

	groundShape.collisionGroup = this.collision_group.GROUND;
	groundShape.collisionMask = this.collision_group.PLAYER | this.collision_group.ENEMY | this.collision_group.ITEM;
	groundShape.material = this.ground_material;
	this.groundBody.addShape(groundShape);
	this.physics_world.addBody(this.groundBody);

	this.leftWall = new p2.Body({
		mass:0,
		angle: -Math.PI / 2.0,
		position: [0, 0]
	});
	var leftWallShape = new p2.Plane();

	leftWallShape.collisionGroup = this.collision_group.WALL;
	leftWallShape.collisionMask = this.collision_group.PLAYER | this.collision_group.ENEMY | this.collision_group.ITEM;
	leftWallShape.material = this.ground_material;
	this.leftWall.addShape(leftWallShape);
	this.physics_world.addBody(this.leftWall);

	this.rightWall = new p2.Body({
		mass: 0,
		angle: Math.PI / 2.0,
		position: [this.world.width, 0]
	});
	var rightWallShape = new p2.Plane();

	rightWallShape.collisionGroup = this.collision_group.WALL;
	rightWallShape.collisionMask = this.collision_group.PLAYER | this.collision_group.ENEMY | this.collision_group.ITEM;
	rightWallShape.material = this.ground_material;
	this.rightWall.addShape(rightWallShape);
	this.physics_world.addBody(this.rightWall);
};

module.exports = global.game_core = game_core;

game_core.prototype.register_timer = function(timer) {
	timer.timer_id = uuid.v1();
	this.timers[timer.timer_id] = {
job_queue: [],
		   timer: timer
	};

	timer.timer_manager = this;
};

game_core.prototype.add_timer = function(timer_id, job_id, time, info) {
	if (!timer_id) {
		//winston.error('Unregistered timer added timer[%d] job[%d]. job execution time[%f]', timer_id, job_id, time);
	}

	this.timers[timer_id].job_queue.push({
job_id: job_id,
time: time,
info: info
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

game_core.prototype.cancel_timer_job = function(timer_id, job_id) {
	if (!timer_id) {
		console.log('Unregistered timer canceled job. timer_id :' + timer_id + ' job_id : ' + job_id);
	}

	this.timers[timer_id].job_queue = this.timers[timer_id].job_queue.filter(function(job) {
		return job.job_id !== job_id;
	}.bind(this));
};

game_core.prototype.check_timers = function(dt) {
	var pass_tick = function(queued_job) {
		queued_job.time -= dt;
	};

	for (var timer_id in this.timers) {
		this.timers[timer_id].timer.on_timer_tick(dt);

		this.timers[timer_id].job_queue.forEach(pass_tick);

		while (true) {
			if (this.timers[timer_id].job_queue.length > 0) {
				var next_job = this.timers[timer_id].job_queue[0];
				if (next_job.time < 0) {
					var timer = this.timers[timer_id].timer;
					timer.on_timer(next_job.job_id, next_job.info);
					this.timers[timer_id].job_queue.splice(0,1);
				} else {
					break;
				}

			}
			else {
				break;
			}

		}
	}
};

game_core.prototype.fire_weapon = function(player) {
	var projectile = player.fire_weapon();

	if (!projectile) return;

	this.projectiles[projectile.id] = projectile;
	this.broadcast('spawn_projectile', projectile.get_info());
};

// methods deal with add, spawn, clear enemies
game_core.prototype.add_enemy = function(info) {
	var enemy_id = uuid.v1();
	var enemy = new c_enemy(this, enemy_id, info);
	this.enemies[enemy_id] = enemy;

	this.broadcast('spawn_enemy', enemy.get_info());
};

game_core.prototype.client_spawn_enemy = function(info) {
	console.log('On receive spawn enemy');
	this.enemies[info.id] = new c_enemy(this, info.id, info);
};

game_core.prototype.client_spawn_projectile = function(info) {
	console.log('On receive spawn projectile');
	this.projectiles[info.id] = new this.weapon_list[info.type](info.id, this.players[info.player_id]);
};

game_core.prototype.receive_enemy_info = function(info) {
	info.forEach(function(enemy_info) {
		this.client_spawn_enemy(enemy_info);
	}.bind(this));
};

game_core.prototype.client_enemy_change_border_color = function(info) {
	var enemy = this.enemies[info.id];
	if (enemy) {
		enemy.client_change_border_color(info.bounce_count);
	}
};

game_core.prototype.client_destroy_enemy = function(id) {
	var enemy =	this.enemies[id];

	if (enemy) {
		enemy.destroy();
		this.remove_enemy(id);
	}
};
game_core.prototype.clear_enemies = function() {
	console.log('Clear enemies');
	this.for_each_enemy(function(enemy) {
		enemy.destroy();
		this.remove_enemy(enemy.id);
	}.bind(this));
};

game_core.prototype.remove_enemy = function(id) {
	delete this.enemies[id];
};

// methods deal with add, spawn, clear items
game_core.prototype.add_item = function(radius, pos, type) {
  var item_id = uuid.v1();
  if (type === Const.item.shield) {
    var item = new i_shield(this, item_id, radius, pos, type);
    this.items[item_id] = item;
    this.broadcast('spawn_item', item.get_info());
  }
}
game_core.prototype.client_spawn_item = function(info) {
  console.log('On receive spawn item');
  if (info.type == Const.item.shield) {
    this.items[info.id] = new i_shield(this, info.id, info.radius, info.pos, info.type);
  }
};

game_core.prototype.receive_item_info = function(info) {
  info.forEach(function(item_info) {
    this.client_spawn_item(item_info);
  }.bind(this));
};

game_core.prototype.clear_items = function() {
  this.for_each_item(function(item) {
    item.destroy();
    delete this.items[item.id];
  }.bind(this));
};

game_core.prototype.new_player = function(player) {
	var new_player = new game_player(this, player, false);
	new_player.instance = player;
	new_player.pos = this.initial_position;
	new_player.color = this.color;
	new_player.id = player.user_id;

	this.players[player.user_id] = new_player;
	var existing_infos = [];

	this.for_each_player(function(gp) {
		existing_infos.push(gp.get_info());

		//send new player info to existing players.
		if (gp.id == new_player.id) {
			return;
		}
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
		enemies_info.push(enemy.get_info());
		});

  var items_info = [];
  this.for_each_item(function(item) {
    items_info.push(item.get_info());
  });

	//create stage if stage is null
	if (!this.stage) {
		console.info('Start stage create');
		this.create_stage();
	}
	else {
		//send current stage info to new player.
		new_player.instance.emit('current_stage', {
			time_left: this.stage.time_left,
			enemies_info: enemies_info,
      items_info: items_info
		});
}

};

game_core.prototype.create_stage = function() {
	this.stage = new c_stage(this);
	this.stage.start();
};

game_core.prototype.on_new_stage = function(stage) {
	this.broadcast('new_stage', {
		time_left: stage.time_left
	});
};

game_core.prototype.on_stage_end = function(time, reason) {
	this.broadcast('end_stage', {
		time_left: time,
		reason: reason
	});
};

game_core.prototype.on_stage_ready = function(time, reason) {
	this.clear_enemies();
	this.clear_items();

	if (this.server) {
		this.for_each_player(function(player) {
			this.player_revive(player);
		}.bind(this));

		this.broadcast('ready_stage', {
			time_left: time,
			reason: reason
		});
	}
}

game_core.prototype.client_on_new_stage = function(data) {
	console.log('On receive new stage');
	this.stage.client_new_stage(data.time_left);
};

game_core.prototype.client_on_current_stage = function(data) {
	console.log('On receive current stage');
	this.stage.client_current_stage(data.time_left, data.enemies_info, data.items_info);
};

game_core.prototype.client_on_stage_ready = function(data) {
	console.log('On receive stage ready');
	this.stage.ready_stage(data.reason);
};

game_core.prototype.client_on_stage_end = function(data) {
	console.log('On receive stage end');
	this.stage.end_stage(data.reason);
}

game_core.prototype.player_die = function(player) {
	player.die();

	if (this.server) {
		this.on_player_die();
	}
};

game_core.prototype.player_revive = function(player) {
	player.revive();
};

game_core.prototype.on_player_die = function() {
	var any_alive = Object.keys(this.players).some(function(id) {
		return this.players[id].is_dead === false;
	}.bind(this));

	if (!any_alive) {
		console.log('all dead');
		this.on_all_died();
	}
};

game_core.prototype.on_all_died = function() {
	this.stage.game_over();
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
game_core.prototype.lerp = function(p, n, t) { return (p + t * (n - p)).fixed(); };
//Simple linear interpolation between 2 vectors
game_core.prototype.v_lerp = function(v,tv,t) { return { x: this.lerp(v.x, tv.x, t), y:this.lerp(v.y, tv.y, t) }; };

game_core.prototype.hermite_lerp = function(p0, p1, p2, p3, mu, tension, bias) {
	var m0,m1,mu2,mu3;
	var a0,a1,a2,a3;

	mu2 = mu * mu;
	mu3 = mu2 * mu;
	m0  = (y1-y0)*(1+bias)*(1-tension)/2;
	m0 += (y2-y1)*(1-bias)*(1-tension)/2;
	m1  = (y2-y1)*(1+bias)*(1-tension)/2;
	m1 += (y3-y2)*(1-bias)*(1-tension)/2;
	a0 =  2*mu3 - 3*mu2 + 1;
	a1 =    mu3 - 2*mu2 + mu;
	a2 =    mu3 -   mu2;
	a3 = -2*mu3 + 3*mu2;

	return(a0*y1+a1*m0+a2*m1+a3*y2);
};

game_core.prototype.hermite_v_lerp = function(v0, v1, v2, v3, mu) {
	return {
		x: hermite_lerp(v0.x, v1.x, v2.x, v3.x, mu, 0, 0),
		y: hermite_lerp(v0.y, v1.y, v2.y, v3.y, mu, 0, 0)
  };
}


/*


//Draw a rectangle for us
game.ctx.fillRect(this.pos.x - this.size.hx, this.pos.y - this.size.hy, this.size.x, this.size.y);

//Draw a status update
game.ctx.fillStyle = this.info_color;
game.ctx.fillText(this.state, this.pos.x+10, this.pos.y + 4);
*/

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
				if(key == 'x') {
					if (this.server) {
						this.fire_weapon(player);
					}
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

	this.physics_world.step(0.015, this._pdt, 10);
	this.call_count++;

	this.after_step();

	if ('undefined' != typeof(global.GLOBAL) && Object.keys(this.players).length > 0 && this.physics_time < 2) {
		var player = this.players[Object.keys(this.players)[0]];
		this.physics_time += this._pdt;
		//console.log('up time: ' + this.physics_time + '_pdt: ' + this._pdt);
		//console.log('p_pos: ' + player.pos.y + 'p_p_pos' + player.p_body.position[1] + 'p_vel: ' + player.p_body.velocity[1] + 'p_force: ' + player.p_body.force[1]);
	}

}; //game_core.prototype.update_physics

game_core.prototype.after_step = function() {
	this.apply_physics_change();

	Object.keys(this.players).forEach(function(id) {
		if (id == 'self') return;

		var player = this.players[id];

		player.pos = this.g_vec2(player.p_body.position);

	}.bind(this));

	Object.keys(this.enemies).forEach(function(id) {
		var enemy = this.enemies[id];
		enemy.pos = this.g_vec2(enemy.p_body.position);
	}.bind(this));

  Object.keys(this.items).forEach(function(id) {
    var item = this.items[id];
    item.pos = this.g_vec2(item.p_body.position);
  }.bind(this));

};

game_core.prototype.apply_physics_change = function() {
	this.after_physics.forEach(function(func_info) {
		func_info.func.call(func_info.caller);
	});

	this.after_physics = [];

	Object.keys(this.physics_change_list).forEach(function(id) {
		var change_info = this.physics_change_list[id];
		if (change_info.op === 'add') {
			this.physics_world.addBody(change_info.body);
		} else if (change_info.op === 'remove') {
			this.physics_world.removeBody(change_info.body);
		}
	}.bind(this));

	this.physics_change_list = {};
};

game_core.prototype.add_physics = function(id, body) {
	var change = this.physics_change_list[id];

	if (change && change.op === 'remove') {
		delete this.physics_change_list[id];
	} else {
		this.physics_change_list[id] = {
			body: body,
			op: 'add'
		};
	}
};

game_core.prototype.remove_physics = function(id, body) {
	var change = this.physics_change_list[id];

	if (change && change.op == 'add') {
		delete this.physics_change_list[id];
	} else {
		this.physics_change_list[id] = {
			body: body,
			op: 'remove'
		};
	}
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
		player.p_body.velocity = [new_dir.x, player.p_body.velocity[1]];
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

  var item_states = {};

  this.for_each_item(function(item) {
    item_states[item.id] = {
      pos: item.pos
    };
  });

	//Make a snapshot of the current state, for updating the clients
	this.laststate = {
		player_states : states,
		enemy_states : enemy_states,
    item_states : item_states,
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

	if( this.keyboard.pressed('X')) {

		input.push('x');

	} //shoot


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
			//
			//remove the rest of the inputs we have confirmed on the server
			var number_to_clear = Math.abs(lastinputseq_index);
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

	//calculate update delay
	if (this.network_delay > 0.1 && this.delay_timer <= 0) {
		console.log('Server packet is start to be delayed.. delay_time: ' + this.network_delay.fixed(3)
				+ ' last_server_time: ' + this.server_time.fixed(3) + ' client_time: ' + this.client_time.fixed(3)
				+ ' stable_time: ' + (this.server_time - this.client_time).fixed(3));
		this.delay_timer = this.delay_time;
	}

	if (this.last_server_time != this.server_time) {
		var delay = (this.server_time - this.last_server_time).fixed(3);
		if (delay > 0.1) {
			console.log('Server update delayed for ' + this.network_delay + 'sec');
		}
	}
	this.last_server_time = this.server_time;

	//Find the position in the timeline of updates we stored.
	var current_time = this.client_time;
	var count = this.server_updates.length-1;
	var target = null;
	var previous = null;

	//We look from the 'oldest' updates, since the newest ones
	//are at the end (list.length-1 for example). This will be expensive
	//only when our time is not found on the timeline, since it will run all
	//samples. Usually this iterates very little before breaking out with a target.
	//
	//reversed order. now scan from latest data.
	for(var i = count; i > 0 ; --i) {

		var point = this.server_updates[i - 1];
		var next_point = this.server_updates[i];

		if (current_time > point.t && current_time <= next_point.t) {
			previous = point;
			target = next_point;
			break;
		}
	}

	//With no target we store the last known
	//server position and move to that instead
	if(!target && this.server_updates.length > 1) {
		var latest_time = this.server_updates[count].t;
		var oldest_time = this.server_updates[0].t;
		console.log('Cannot find interpolation data. current_time : ' + current_time.fixed(3) + ' update_count: ' + this.server_updates.length + ' lastest data :' + latest_time.fixed(3) + ' oldest_data : ' + oldest_time.fixed(3));
		target = this.server_updates[count];
		previous = this.server_updates[count - 1];
	}

	//Now that we have a target and a previous destination,
	//We can interpolate between then based on 'how far in between' we are.
	//This is simple percentage maths, value/target = [0,1] range of numbers.
	//lerp requires the 0,1 value to lerp to? thats the one.

	if(target && previous) {
		this.target_time = target.t;

		var difference = current_time - previous.t;
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
		this.for_each_player(function(player) {
			var id = player.id;
			if (!latest_server_data.player_states[id]) return;

			if (player.is_dead !== latest_server_data.player_states[id].dead) {
				if (latest_server_data.player_states[id].dead) {
					this.player_die(player);
				} else {
					this.player_revive(player);
				}
			}
		});

		this.for_each_player(function(player) {
			var id = player.id;
			if (id === this.players.self.id) return;
			if (!latest_server_data.player_states[id]) return;
			if (!target.player_states[id] || !previous.player_states[id]) return;

			//These are the exact server positions from this tick, but only for the ghost
			var other_server_pos = latest_server_data.player_states[id].pos;
			//The other players positions in this timeline, behind us and in front of us
			var other_target_pos = target.player_states[id].pos;
			var other_past_pos = previous.player_states[id].pos;

			//update the dest block, this is a simple lerp
			//to the target from the previous point in the server_updates buffer
			this.ghosts[id].server_pos.pos = this.pos(other_server_pos);
			this.ghosts[id].client_pos.pos = this.v_lerp(other_past_pos, other_target_pos, time_point);


			if (this.client_smoothing) {
				player.p_body.position = this.p_vec2(this.pos(this.ghosts[id].client_pos.pos));
			} else {
				player.p_body.position = this.p_vec2(this.pos(this.ghosts[id].client_pos.pos));
			}
		}.bind(this));

		this.for_each_enemy(function(enemy) {
			var id = enemy.id;
			if (!target.enemy_states[id] || !previous.enemy_states[id]) return;

			//The other players positions in this timeline, behind us and in front of us
			var other_target_pos = target.enemy_states[id].pos;
			var other_past_pos = previous.enemy_states[id].pos;

			//update the dest block, this is a simple lerp
			//to the target from the previous point in the server_updates buffer
			var client_pos = this.v_lerp(other_past_pos, other_target_pos, time_point);

			if (this.client_smoothing) {
				enemy.p_body.position = this.p_vec2(this.pos(client_pos));
				//enemy.p_body.position = this.p_vec2(this.v_lerp(enemy.pos, client_pos, this._pdt*this.client_smooth));
				if (other_target_pos.y - enemy.p_body.position[1] > 0.4) {
					console.log('enemy position difference : ' + (other_target_pos.y - enemy.p_body.position[1]).fixed(3)
					+ ' client_pos difference: ' + (other_target_pos.y - client_pos.y).fixed(3)
					+ ' latest_pos difference: ' + (latest_server_data.enemy_states[id].pos.y - other_target_pos.y).fixed(3)
					);
				}
			} else {
				enemy.p_body.position = this.p_vec2(this.pos(client_pos));
			}

		}.bind(this));


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

	if (this.server_time > data.t) {
		console.log('Rotten data received. server_time : ' + this.server_time + ' data_time: '+ data.t);
		return;
	}

	this.delay_timer = 0;

	if (this.network_delay > 0.1) {
		console.log('Server update delay ended. delayed_time: ' + this.network_delay.fixed(3)
				+ ' last_server_time: ' + this.server_time.fixed(3) + 'new_server_time: ' + data.t.fixed(3)
				+ ' client_time: ' + this.client_time.fixed(3));
	}

	//Store the server time (this is offset by the latency in the network, by the time we get it)
	this.server_time = data.t;
	//Update our local offset time from the last server update
	var target_client_time = this.server_time - (this.net_offset/1000);

	if (this.client_time > data.t) {
		console.log('Server update has no future data. client_time: ' + this.client_time.fixed(3) + ' latest_server_time: ' + data.t.fixed(3) + ' difference: ' + (this.client_time - data.t).fixed(3));
	}

	//use recent one as client time
	this.client_time = this.server_time - (this.net_offset/1000);
	this.network_delay= 0.0;

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
	this.ctx.clearRect(0,0,this.world.width * game.viewport.res_mul, this.world.height * game.viewport.res_mul);

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

	for(var id in this.players) {
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

	for(var i_id in this.items) {
		this.items[i_id].draw();
	}

	for(var e_id in this.enemies) {
		this.enemies[e_id].draw();
	}

	for(var p_id in this.projectiles) {
		this.projectiles[p_id].draw();
	}

	this.groundBody.draw();

	this.ui_manager.draw();

	//Work out the fps average
	this.client_refresh_fps();

}; //game_core.update_client

game_core.prototype.create_timer = function(){
	setInterval(function(){
			this._dt = new Date().getTime() - this._dte;
			this._dte = new Date().getTime();
			this.local_time += this._dt/1000.0;
			if (this.client_time) {
				this.client_time += this._dt/1000.0;
				this.network_delay += this._dt/1000.0;
				this.delay_timer -= this._dt/1000.0;
			}
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
			this.socket.emit('ping', this.last_ping_time);

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

	this.net_offset = 20;              //100 ms latency between server and client interpolation for other clients
	this.buffer_size = 2;               //The size of the server history to keep for rewinding/interpolating.
	this.target_time = 0.01;            //the time where we want to be in the server timeline
	this.oldest_tick = 0.01;            //the last time tick we have available in the buffer

	this.client_time = 0.01;            //Our local 'clock' based on server time - client interpolation(net_offset).
	this.server_time = 0.01;            //The time the server reported it was at, last we heard from it

	this.network_delay = 0.0;						//packet delay from server. minimum delay is packet sending period of server.
	this.delay_time = 0.3;							//delay log time


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
	console.log('On receive player info');
	data.players.forEach(function(p_info, index, arr) {
		var player = new game_player(this, undefined, false);
		if (p_info.is_dead) {
			this.player_die(player);
		} else {
			this.player_revive(player);
		}

		player.state = 'connected';
		player.online = 'true';
		player.id = p_info.id;
		this.players[p_info.id] = player;
		this.players[p_info.id].pos = p_info.pos;
		//this.players[p_info.id].color = '#ffffff';
		this.ghosts[p_info.id] = {
			server_pos: new game_player(this, undefined, true),
			client_pos: new game_player(this, undefined, true)
		};

		if(this.players.self.id == p_info.id) {
			var self = this.players.self;

			this.players.self = player;
			//player.color = '#cc0000';
			player.id = self.id;
			//player.info_color = '#cc0000';
		}
	}.bind(this));
};

game_core.prototype.client_on_player_disconnected = function(data) {
	var player = this.players[data.id];
	if (player)	{
			player.destroy();
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

				case 'c' : //other player changed colors
					this.client_on_otherclientcolorchange(commanddata); break;

			} //subcommand

			break; //'s'
	} //command

}; //client_onnetmessage

game_core.prototype.player_disconnected = function(player_id) {
	var player = this.players[player_id];

	if (player) {
		player.destroy();
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

game_core.prototype.for_each_item = function(func) {
  Object.keys(this.items).forEach(function(id) {
    func.call(this, this.items[id]);
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
	this.socket.on('ping', this.client_onping.bind(this));
	//On error we just show that we are not connected for now. Can print the data.
	this.socket.on('error', this.client_ondisconnect.bind(this));
	//On message from the server, we parse the commands and send it to the handlers
	this.socket.on('player_info', this.client_on_receive_player_info.bind(this));
	this.socket.on('new_stage', this.client_on_new_stage.bind(this));
	this.socket.on('end_stage', this.client_on_stage_end.bind(this));
	this.socket.on('ready_stage', this.client_on_stage_ready.bind(this));
	this.socket.on('current_stage', this.client_on_current_stage.bind(this));
	this.socket.on('message', this.client_onnetmessage.bind(this));
	this.socket.on('player_disconnected', this.client_on_player_disconnected.bind(this));
	this.socket.on('spawn_enemy', this.client_spawn_enemy.bind(this));
	this.socket.on('spawn_item', this.client_spawn_item.bind(this));
	this.socket.on('spawn_projectile', this.client_spawn_projectile.bind(this));
	this.socket.on('destroy_enemy', this.client_destroy_enemy.bind(this));
	this.socket.on('enemy_change_border_color', this.client_enemy_change_border_color.bind(this));
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

	this.ctx.font = "10px Arial";
	this.ctx.textAlign = "start"
	this.ctx.fillText('time left : ' + this.stage.time_left.fixed(3), 30, 30);

};

p2.Body.prototype.draw = function(color, border_color) {
	this.shapes.forEach(function(shape){
		shape.draw({
			x: this.position[0],
			y: this.position[1]
		}, color, border_color);
	}.bind(this));
};

p2.Circle.prototype.draw = function(pos, color, border_color) {
	if (color) {
		game.ctx.fillStyle = color;
	} else {
		game.ctx.fillStyle = '#ffffff';
	}

	game.ctx.lineWidth = 5;
	if (border_color) {
		game.ctx.strokeStyle = border_color;
	} else {
		game.ctx.strokeStyle = '#ffffff';
	}

	game.ctx.beginPath();
	game.ctx.arc(pos.x * game.viewport.res_mul, pos.y * game.viewport.res_mul, this.radius * game.viewport.res_mul, 0, 2 * Math.PI, false);
	game.ctx.closePath();
	game.ctx.fill();
	game.ctx.stroke();
};

p2.Box.prototype.draw = function(pos, color) {
  if (color) {
    game.ctx.fillStyle = color;
  }else {
    game.ctx.fillStyle = '#ffffff';
  }

	game.ctx.fillRect((pos.x - this.width / 2.0) * game.viewport.res_mul, (pos.y - this.height / 2.0) * game.viewport.res_mul, this.width * game.viewport.res_mul, this.height * game.viewport.res_mul);
};

p2.Plane.prototype.draw = function(pos) {
	game.ctx.fillStyle = '#eeeeee';

	game.ctx.fillRect(0, pos.y * game.viewport.res_mul, game.world.width * game.viewport.res_mul, (game.world.height - pos.y) * game.viewport.res_mul);
};
