var p2 = require('p2');

var c_projectile = require('./projectile.js');
var c_player = require('./game_player.js');

//bullet
var bullet = module.exports = function(id, player) {
	c_projectile.call(this, id);

	this.player = player;
	this.game = player.game;

	this.type = 'bullet';

	this.pos = player.pos;


	this.p_body = new p2.Body({
		mass: 0,
		position: [this.pos.x, this.pos.y - 1]
	});

	this.p_body.velocity = [0, -10];

	this.p_shape = new p2.Circle({
		radius: 1
	});

	this.p_shape.collisionGroup = this.game.collision_group.BULLET;
	this.p_shape.collisionMask = this.game.collision_group.ENEMY;

	this.p_body.addShape(this.p_shape);
	this.p_body.game_object = this;


	if (this.game.server) {
		this.game.physics_world.addBody(this.p_body);
	}
};
/*
bullet.prototype.destroy = function() {
	if (this.destroyed) return;

	this.destroyed = true;	
  this.game.physics_world.removeBody(this.p_body);
  this.p_body.game_object = null;
  this.p_body.bullet_object = null;
  this.p_shape = null;
  this.p_body = null;
  this.game = null;
};
*/

bullet.prototype = Object.create(c_projectile.prototype);
