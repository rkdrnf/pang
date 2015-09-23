var c_bullet = require('./bullet.js');
var uuid = require('node-uuid');

var p2 = require('p2');

var game_player = module.exports = function( game_instance, player_instance, is_ghost ) {

	//Store the instance, if any
	this.instance = player_instance;
	this.game = game_instance;


	//Set up initial values for our state information
	this.state = 'not-connected';
	this.color = 'rgba(255,255,255,0.1)';
	this.info_color = 'rgba(255,255,255,0.1)';
	this.id = player_instance ? player_instance.user_id : undefined;

	//These are used in moving us around later
	this.old_state = {pos:{x:0,y:0}};
	this.cur_state = {pos:{x:0,y:0}};
	this.state_time = new Date().getTime();

	this.is_dead = true;

	this.weapon = c_bullet;
	this.fire_timer = 0;
	this.fire_rate = 2;

	this.width = 1;
	this.height = 1;

	//Our local history of inputs
	this.inputs = [];

	//physics initalization
	if (!is_ghost)
	{
		this.p_body = new p2.Body({
			mass: 1,
			position: [this.game.initial_position.x, this.game.initial_position.y]
		});
		this.p_shape = new p2.Box({
			width: this.width,
			height: this.height
		});

		this.p_shape.collisionGroup = this.game.collision_group.PLAYER;
		this.p_shape.collisionMask = this.game.collision_group.GROUND | this.game.collision_group.ENEMY | this.game.collision_group.ITEM;
		this.p_body.addShape(this.p_shape);
		this.p_body.game_object = this;
	}


	//The world bounds we are confined to
	this.pos_limits = {
		x_min: this.width / 2,
		x_max: this.game.world.width - (this.width / 2),
		y_min: this.height / 2,
		y_max: this.game.world.height - (this.height / 2)
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

	this.game.register_timer(this);

}; //game_player.constructor

game_player.prototype.on_timer_tick = function(dt) {
	this.fire_timer -= dt;
};

game_player.prototype.fire = function(){
	this.weapon.fire();
}; //game_player.fire

game_player.prototype.fire_weapon = function() {
	if (this.fire_timer < 0) {
		var projectile = new this.weapon(uuid.v1(), this);
		this.fire_timer = this.fire_rate;
		return projectile;
	} else {
		return null;
	}
};

game_player.prototype.die = function() {
	console.log('player is dead');
	this.is_dead = true;
	this.game.physics_world.removeBody(this.p_body);
};

game_player.prototype.revive = function() {
	console.log('player revived');
	this.is_dead = false;
	this.p_body.position = [this.game.initial_position.x, this.game.initial_position.y];
	this.p_body.velocity = [0, 0];
	this.p_body.force = [0, 0];
	this.game.physics_world.addBody(this.p_body);
};

game_player.prototype.draw = function(){
	if (!this.is_dead)
	{
		this.p_body.draw();
	}
};

game_player.prototype.destroy = function() {
	if (this.destroyed) return;

	this.destroyed = true;
	this.game.remove_physics(this.id, this.p_body);
	this.p_body.game_object = null;
	this.p_body = null;
	this.p_shape = null;
	this.game = null;
};

game_player.prototype.applyitem = function(type) {
  if (type == this.game.item_effect.WEAPON) {
    this.color = 'rgba(0,0,255,0.1)';
    this.info_color = 'rgba(255,255,255,0.1)';
  }else {
    this.color = 'rgba(255,0,0,0.1)';
    this.info_color = 'rgba(255,255,255,0.1)';
	}
};
