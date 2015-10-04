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
};


c_stage.prototype = Object.create(c_timer.prototype);

c_stage.prototype.start = function() {
	this.game.register_timer(this);
	console.log('stage timer registered');
	if (this.game.server) {
		this.ready_stage(this.new_stage_reason.NEW_GAME);
	}
};

c_stage.prototype.server_new_stage= function(reason) {
	this.adjust_difficulty(reason);

	this.time_left = this.stage_time;
	this.game.add_timer(this.timer_id, this.timer_job.STAGE_END, this.time_left, { reason: this.new_stage_reason.NEXT_STAGE });

	this.make_random_enemies();

	this.enemy_spawn_infos.forEach(function(info) {
		this.game.add_timer(this.timer_id, this.timer_job.SPAWN_ENEMY, info.time, info);
	}.bind(this));

	this.item_spawn_infos.forEach(function(info) {
		this.game.add_timer(this.timer_id, this.timer_job.SPAWN_ITEM, info.time, info);
	}.bind(this));

	this.game.on_new_stage(this);
};

c_stage.prototype.client_new_stage = function(t) {
	this.time_left = t;

	this.game.ui_manager.send_event(Const.ui.main_text_ui, 'show_start');
};

c_stage.prototype.client_current_stage = function(t, enemies_info, items_info) {
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

c_stage.prototype.end_stage = function(reason) {
	if (this.game.server) {
		if (reason === this.new_stage_reason.GAME_OVER) {
			this.game.cancel_timer_job(this.timer_id, this.timer_job.STAGE_END);
		}

		this.game.cancel_timer_job(this.timer_id, this.timer_job.SPAWN_ENEMY);
		this.game.cancel_timer_job(this.timer_id, this.timer_job.SPAWN_ITEM);

		this.game.on_stage_end(this.end_time, reason);

		this.game.add_timer(this.timer_id, this.timer_job.STAGE_READY, this.end_time, { reason: reason });
	} else {
		if (reason === this.new_stage_reason.GAME_OVER) {
			this.game.ui_manager.send_event(Const.ui.main_text_ui, 'show_end');
		} else if (reason === this.new_stage_reason.NEXT_STAGE) {
			this.game.ui_manager.send_event(Const.ui.main_text_ui, 'show_next');
	  }
	}
};

c_stage.prototype.ready_stage= function(reason) {
	this.time_left = this.ready_time;

	this.game.on_stage_ready(this.ready_time, reason);

	if (this.game.server) {
		this.game.add_timer(this.timer_id, this.timer_job.STAGE_NEW, this.ready_time, { reason: reason });
	} else {
		this.game.ui_manager.send_event(Const.ui.main_text_ui, 'show_ready');
	}
};

c_stage.prototype.make_random_enemies = function() {
	this.enemy_spawn_infos = [];
	var enemies_count = this.level * 5 + 20;

	var radius_variance = { min: 1, max: 3 + this.level * 0.2 };

	for(var i = 0; i < enemies_count; i++) {
		var spawn_time = Math.random() * (this.stage_time - 4);
		var radius = Math.random() * (radius_variance.max - radius_variance.min) + radius_variance.min;
		var spawn_coord = {
			x: Math.random() * (this.game.world.width),
			y: -(radius + 1)
		};

		this.enemy_spawn_infos.push({
			time: spawn_time,
			pos: spawn_coord,
			radius: radius
		});
	}
};

c_stage.prototype.game_over = function() {
	var reason = this.new_stage_reason.GAME_OVER;
	this.end_stage(reason);
};

//add enemies by stage's own rule
c_stage.prototype.add_enemy = function(info) {
	this.game.add_enemy(info.radius, info.pos);
};

c_stage.prototype.add_item = function(info) {
	this.game.add_item(info.radius, info.pos, info.type);
};

c_stage.prototype.clear_items = function() {
	this.game.clear_items();
};

c_stage.prototype.on_timer = function(job_id, info) {
	if (job_id === this.timer_job.STAGE_END) {
		this.end_stage(info.reason);
		return;
	}

	if (job_id === this.timer_job.STAGE_READY) {
		this.ready_stage(info.reason);
		return;
	}

	if (job_id === this.timer_job.STAGE_NEW) {
		this.server_new_stage(info.reason);
		return;
	}

	if (job_id === this.timer_job.SPAWN_ENEMY) {
		this.add_enemy(info);
		return;
	}

	if(job_id == this.timer_job.SPAWN_ITEM) {
		this.add_item(info);
		return;
	}
};

c_stage.prototype.on_timer_tick = function(dt, t) {
	this.time_left -= dt;
};
