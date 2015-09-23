var p2 = require('p2');


var c_enemy = module.exports = function(game, id, radius, pos ) {
	this.game = game;
	this.id = id;

	this.pos = {x: 30, y: 30};

	var color_vari = { 
		min: {r: 0xf2, g: 0xf0, b: 0xb8}, 
		max: {r: 0xf2, g: 0x5e, b: 0x5e}
	};
	var radius_vari = {
		min: 1,
		max: 7
  };

	if (pos) {
		this.pos = pos;
	}

	this.p_body = new p2.Body({
		mass: 1,
		position: [pos.x, pos.y]
	});
	
	this.p_shape = new p2.Circle({
		radius: radius
	});

	this.p_shape.collisionGroup = this.game.collision_group.ENEMY;
	this.p_shape.collisionMask = this.game.collision_group.GROUND | this.game.collision_group.PLAYER;

	this.p_body.addShape(this.p_shape);
	this.p_body.game_object = this;

	if (this.game.server) {				//server
		this.game.physics_world.addBody(this.p_body);
	} else {											//client
		var color_rate = (radius - radius_vari.min) / (radius_vari.max - radius_vari.min);
		var color_r = Math.round(color_vari.min.r + (color_vari.max.r - color_vari.min.r) * color_rate);
		var color_g = Math.round(color_vari.min.g + (color_vari.max.g - color_vari.min.g) * color_rate);
		var color_b = Math.round(color_vari.min.b + (color_vari.max.b - color_vari.min.b) * color_rate);
		this.color = 'rgb(' + color_r + ',' + color_g + ',' + color_b + ')';
	}
};

c_enemy.prototype.get_info = function() {
	return {
		id: this.id,
		pos: this.pos,
		radius: this.p_shape.radius
	};
};

c_enemy.prototype.draw = function() {
	this.p_body.draw(this.color);
};

c_enemy.prototype.destroy = function() {
	if (this.destroyed) return;

	this.destroyed = true;
	this.game.remove_physics(this.id, this.p_body);
	this.p_body.game_object = null;
	this.p_shape = null;
	this.p_body = null;
	this.game = null;
};

