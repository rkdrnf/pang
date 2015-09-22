var c_timer = require('./timer.js');

var c_stage = module.exports = function(game_instance) {
	this.stage_time = 13;
	this.time_left = this.stage_time;
	this.game = game_instance;

	this.enemy_spawn_infos = [
		/*{ time: 2, pos: {x: 5, y: -5}, radius: 1.0 },
		{ time: 3, pos: {x: 7, y: -5}, radius: 2.0 },
		{ time: 4, pos: {x: 4, y: -5}, radius: 1.5},
		{ time: 5, pos: {x: 15, y: -5}, radius: 3.0},
		{ time: 6, pos: {x: 9, y: -5}, radius: 2.0},
		{ time: 7, pos: {x: 23, y: -5}, radius: 2.5},*/
	];

  this.item_spawn_infos = [
    { time : 2, pos: {x: 4, y: 4}, radius: 0.5, type: this.game.item_effect.WEAPON},
    { time : 3, pos: {x: 5, y: 3}, radius: 0.5, type: this.game.item_effect.VIAGRA},
    { time : 4, pos: {x: 7, y: 6}, radius: 0.5, type: this.game.item_effect.WEAPON},
    { time : 5, pos: {x: 9, y: 5}, radius: 0.5, type: this.game.item_effect.VIAGRA},
  ];

	this.timer_job = {
		STAGE_END : 0,
		SPAWN_ENEMY : 1,
    SPAWN_ITEM : 2
  };

	this.start = function() {
		this.game.register_timer(this);
		console.log('stage timer registered');
		if (this.game.server) {
			this.server_new_stage();
		}
	};

	this.server_new_stage = function() {
		this.time_left = this.stage_time;
		this.game.add_timer(this.timer_id, this.timer_job.STAGE_END, this.time_left);

		this.enemy_spawn_infos.forEach(function(info) {
			this.game.add_timer(this.timer_id, this.timer_job.SPAWN_ENEMY, info.time, info);
		}.bind(this));

    this.item_spawn_infos.forEach(function(info) {
      this.game.add_timer(this.timer_id, this.timer_job.SPAWN_ITEM, info.time, info);
    }.bind(this));

    this.game.on_new_stage(this);
	};

	this.client_new_stage = function(t) {
		this.time_left = t;
		this.clear_enemies();
    this.clear_items();
	};

	this.client_current_stage = function(t, enemies_info, items_info) {
		this.time_left = t;
		this.game.receive_enemy_info(enemies_info);
    this.game.receive_item_info(items_info);
	};

	//add enemies by stage's own rule
	this.add_enemy = function(info) {
		this.game.add_enemy(info.radius, info.pos);
	};

	this.clear_enemies = function() {
		this.game.clear_enemies();
	};

  this.add_item = function(info) {
    this.game.add_item(info.radius, info.pos);
  };

  this.clear_items = function() {
    this.game.clear_items();
  };

	this.on_timer = function(job_id, info) {
		if (job_id === this.timer_job.STAGE_END) {
			this.game.on_stage_end(this);
			this.server_new_stage();
			return;
		}

		if (job_id === this.timer_job.SPAWN_ENEMY) {
			this.add_enemy(info);
		}

    if(job_id == this.timer_job.SPAWN_ITEM) {
      this.add_item(info);
    }
	};

	this.on_timer_tick = function(dt, t) {
		this.time_left -= dt / 1000.0;
	};
};


c_stage.prototype = Object.create(c_timer.prototype);


