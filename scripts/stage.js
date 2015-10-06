var c_timer = require('./timer.js');
var Const = require('./const.js');

var c_stage = module.exports = function(game_instance) {
	this.stage_time = 13;
	this.ready_time = 5;
	this.end_time = 3;

	this.time_left = this.stage_time;
	this.game = game_instance;

	this.level = 0;

	this.enemy_spawn_infos = [];

	this.item_spawn_infos = [
	{ time : 2, pos: {x: 4, y: 4}, radius: 0.5, type: Const.item.shield},
	/*{ time : 3, pos: {x: 5, y: 3}, radius: 0.5, type: this.game.item_effect.VIAGRA},
	{ time : 4, pos: {x: 7, y: 6}, radius: 0.5, type: this.game.item_effect.WEAPON},
	{ time : 5, pos: {x: 9, y: 5}, radius: 0.5, type: this.game.item_effect.VIAGRA},
*/	];

	this.timer_job = {
		STAGE_END 	: 0,
		STAGE_READY : 1,
		STAGE_NEW 	: 2,
		SPAWN_ENEMY : 3,
		SPAWN_ITEM 	: 4
	};

	this.new_stage_reason = {
		NEW_GAME : 0,
		GAME_OVER : 1,
		NEXT_STAGE : 2
	};

	this.state_type = {
		IN_STAGE : 'IN_STAGE',
		STAGE_END : 'STAGE_END',
		READY : 'READY',
		BOSS : 'BOSS'
	};

	this.state = this.state_type.READY;
};


c_stage.prototype = Object.create(c_timer.prototype);

c_stage.prototype.start = function() {
	this.game.register_timer(this);
	console.log('stage timer registered');

	if (this.game.server) {
		this.ready_stage(this.new_stage_reason.NEW_GAME, this.ready_time);
	}
};

c_stage.prototype.new_stage = function(reason, time) {
	if (this.state !== this.state_type.READY) {
		console.log('Invalid stage state conversion. ' + this.state + ' to ' + this.state_type.IN_STAGE);
	}
	this.state = this.state_type.IN_STAGE;
	this.time_left = time;

	if (this.game.server) {
		this.on_server_new_stage(reason);
	} else { 
		this.on_client_new_stage(reason, time);
	}
};

c_stage.prototype.on_server_new_stage = function(reason) {
	this.adjust_difficulty(reason);

	this.game.add_timer(this.timer_id, this.timer_job.STAGE_END, this.time_left, { reason: this.new_stage_reason.NEXT_STAGE });

	this.make_random_enemies();

	this.enemy_spawn_infos.forEach(function(info) {
		this.game.add_timer(this.timer_id, this.timer_job.SPAWN_ENEMY, info.time, info);
	}.bind(this));

	this.item_spawn_infos.forEach(function(info) {
		this.game.add_timer(this.timer_id, this.timer_job.SPAWN_ITEM, info.time, info);
	}.bind(this));

	this.make_players_vulnerable();

	this.game.broadcast('new_stage', {
		reason: reason,
		time_left: this.time_left
	});
};

c_stage.prototype.on_client_new_stage = function(reason, time) {
	this.game.ui_manager.send_event(Const.ui.main_text_ui, 'show_start');
};

c_stage.prototype.send_stage_info = function(player) { 
	var enemies_info = [];
	this.game.for_each_enemy(function(enemy) {
		enemies_info.push(enemy.get_info());
	});

	var items_info = [];
	this.game.for_each_item(function(item) {
		items_info.push(item.get_info());
	});

	player.instance.emit('current_stage', {
		state: this.state,
		time_left: this.time_left,
		enemies_info: enemies_info,
		items_info: items_info
	});
};

c_stage.prototype.client_current_stage = function(state, t, enemies_info, items_info) {
	this.state = state;
	this.time_left = t;
	this.game.receive_enemy_info(enemies_info);
	this.game.receive_item_info(items_info);
};

c_stage.prototype.adjust_difficulty = function(reason) {
	if (reason === this.new_stage_reason.NEW_GAME) {
		console.log('Initial Stage');
		this.level = 0;
		return;
	}

	if (reason === this.new_stage_reason.GAME_OVER) {
		console.log('Stage after GAME OVER');
		this.level = 0;
		return;
	}

	if (reason === this.new_stage_reason.NEXT_STAGE) {
		console.log('Next stage');
		this.level++;
		return;
	}

};

c_stage.prototype.end_stage = function(reason, time) {
	if (this.state !== this.state_type.IN_STAGE) {
		console.log('Invalid stage state conversion. ' + this.state + ' to ' + this.state_type.END_STAGE);
	}
	this.state = this.state_type.STAGE_END;

	if (this.game.server) {
		this.on_server_stage_end(reason);
	} else {
		this.on_client_stage_end(reason);
	}
};

c_stage.prototype.on_server_stage_end = function(reason) {
	if (reason === this.new_stage_reason.GAME_OVER) {
		this.game.cancel_timer_job(this.timer_id, this.timer_job.STAGE_END);
	}

	if (reason === this.new_stage_reason.NEXT_STAGE) {
		this.make_players_invulnerable();
	}

	this.game.cancel_timer_job(this.timer_id, this.timer_job.SPAWN_ENEMY);
	this.game.cancel_timer_job(this.timer_id, this.timer_job.SPAWN_ITEM);

	this.game.add_timer(this.timer_id, this.timer_job.STAGE_READY, this.end_time, { reason: reason });

	this.game.broadcast('end_stage', {
		time_left: this.end_time,
		reason: reason
	});
};

c_stage.prototype.on_client_stage_end = function(reason) {
	if (reason === this.new_stage_reason.GAME_OVER) {
		this.game.ui_manager.send_event(Const.ui.main_text_ui, 'show_end');
	} else if (reason === this.new_stage_reason.NEXT_STAGE) {
		this.game.ui_manager.send_event(Const.ui.main_text_ui, 'show_next');
	}
};

c_stage.prototype.ready_stage= function(reason, time) {
	if (this.state !== this.state_type.STAGE_END) {
		console.log('Invalid stage conversion. ' + this.state + ' to ' + this.state_type.READY);
	}

	this.state = this.state_type.READY;
	this.time_left = time;

	this.game.clear_enemies();
	this.game.clear_items();

	if (this.game.server) {
		this.on_server_stage_ready(reason);
	} else {
		this.on_client_stage_ready(reason);
	}
};

c_stage.prototype.on_server_stage_ready = function(reason) {
	this.game.add_timer(this.timer_id, this.timer_job.STAGE_NEW, this.ready_time, { reason: reason });

	this.game.for_each_player(function(player) {
		player.revive();
	}.bind(this));

	this.game.broadcast('ready_stage', {
		time_left: this.ready_time,
		reason: reason
	});
};

c_stage.prototype.on_client_stage_ready = function(reason) {
	this.game.ui_manager.send_event(Const.ui.main_text_ui, 'show_ready');
};

c_stage.prototype.make_random_enemies = function() {
	this.enemy_spawn_infos = [];
	var enemies_count = this.level * 5 + 20;

	var radius_variance = { min: 1, max: 3 + this.level * 0.2 };
	var bounce_count_variance = { min: 0, max: 1 + this.level * 0.5 };
	var bounciness_variance = { min: 2, max: this.game.enemy_material_level };
	var velocity_variance = { 
		x: { min: -1.5 - this.level * 0.4, max: 1.5 + this.level * 0.4 },
		y: { min: 0, max: this.level * 0.3 }
	}

	for(var i = 0; i < enemies_count; i++) {
		var spawn_time = Math.random() * (this.stage_time - 4);
		var radius = Math.random() * (radius_variance.max - radius_variance.min) + radius_variance.min;
		var mass = 1 + radius / 3;
		var vel = {
			x: Math.random() * (velocity_variance.x.max - velocity_variance.x.min) + velocity_variance.x.min,
			y: Math.random() * (velocity_variance.y.max - velocity_variance.y.min) + velocity_variance.y.min
		};
		var bounce_count = Math.floor(Math.random() * (bounce_count_variance.max - bounce_count_variance.min) + bounce_count_variance.min);
		var bounciness = Math.floor(Math.random() * (bounciness_variance.max - bounciness_variance.min) + bounciness_variance.min);
		var spawn_coord = {
			x: Math.random() * (this.game.world.width - (radius * 2)) + radius, 
			y: -(radius + 1)
		};

		this.enemy_spawn_infos.push({
			time: spawn_time,
			pos: spawn_coord,
			vel: vel,
			radius: radius,
			mass: mass,
			bounciness: bounciness,
			bounce_count: bounce_count
		});
	}
};

c_stage.prototype.on_player_die = function(player) {
	var any_alive = Object.keys(this.game.players).some(function(id) {
		return this.game.players[id].is_dead === false;
	}.bind(this));

	if (!any_alive) {
		console.log('all dead');
		this.on_all_died();
	}
};

c_stage.prototype.on_all_died = function() {
	this.game_over();
};

c_stage.prototype.game_over = function() {
	var reason = this.new_stage_reason.GAME_OVER;
	this.end_stage(reason, this.end_time);
};

c_stage.prototype.make_players_invulnerable = function() {
	this.game.for_each_player(function(player) {
		player.give_buff(Const.buff.stage_invulnerable);
	});
};

c_stage.prototype.make_players_vulnerable = function() {
	this.game.for_each_player(function(player) {
		player.remove_buff(Const.buff.stage_invulnerable);
	});
};

//add enemies by stage's own rule
c_stage.prototype.add_enemy = function(info) {
	this.game.add_enemy(info);
};

c_stage.prototype.add_item = function(info) {
	this.game.add_item(info.radius, info.pos, info.type);
};

c_stage.prototype.clear_items = function() {
	this.game.clear_items();
};

c_stage.prototype.on_timer = function(job_id, info) {
	if (job_id === this.timer_job.STAGE_END) {
		this.end_stage(info.reason, this.end_time);
		return;
	}

	if (job_id === this.timer_job.STAGE_READY) {
		this.ready_stage(info.reason, this.ready_time);
		return;
	}

	if (job_id === this.timer_job.STAGE_NEW) {
		this.new_stage(info.reason, this.stage_time);
		return;
	}

	if (job_id === this.timer_job.SPAWN_ENEMY) {
		this.add_enemy(info);
		return;
	}

	if(job_id === this.timer_job.SPAWN_ITEM) {
		this.add_item(info);
		return;
	}
};

c_stage.prototype.on_timer_tick = function(dt, t) {
	this.time_left -= dt;
};
