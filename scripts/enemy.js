var p2 = require('p2');


var c_enemy = module.exports = function(game, id, radius, pos ) {
	this.game = game;
	this.id = id;

	this.pos = {x: 30, y: 30};

	if (pos) {
		this.pos = pos;
	}

	this.p_body = new p2.Body({
		mass: 1,
		position: [pos.x, pos.y]
	});
	
	this.p_shape = new p2.Circle({
		radius: radius ? radius: 4
	});

	this.p_shape.collisionGroup = this.game.collision_group.ENEMY;
	this.p_shape.collisionMask = this.game.collision_group.GROUND | this.game.collision_group.PLAYER;

	this.p_body.addShape(this.p_shape);
	this.p_body.game_object = this;
	this.game.physics_world.addBody(this.p_body);
};

c_enemy.prototype.get_info = function() {
	return {
		id: this.id,
		pos: this.pos,
		radius: this.p_shape.radius
	};
};

c_enemy.prototype.draw = function() {
	this.p_body.draw();
};

c_enemy.prototype.destroy = function() {
	this.game.physics_world.removeBody(this.p_body);
	this.p_body.game_object = null;
	this.p_shape = null;
	this.p_body = null;
	this.game = null;
};
