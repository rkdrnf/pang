var p2 = require('p2');


var c_enemy = module.exports = function(game, id, info) {
	this.game = game;
	this.id = id;

	this.pos = {x: 30, y: 30};

	var color_vari = { 
		min: {r: 0xf2, g: 0xf0, b: 0xb8}, 
		max: {r: 0xf2, g: 0x5e, b: 0x5e}
	};
	var radius_vari = {  //for calculation of color variance. not actual radius variance.
		min: 1,
		max: 7
  };

	this.bounce_color_vari = {
		min: {r: 0xff, g: 0xff, b: 0xff},
		max: {r: 0x6d, g: 0x1e, b: 0x70}
	};

	this.bounce_vari = {
		min: 0,
		max: 8
	};

	if (info.pos) {
		this.pos = info.pos;
	}

	var vel = {x: 0,  y: 0};

	if (info.vel) {
		vel = info.vel;	
	}

	this.p_body = new p2.Body({
		mass: info.mass,
		position: [info.pos.x, info.pos.y],
		velocity: [vel.x, vel.y]
	});

	this.p_body.damping = 0;
	this.p_body.angularDamping = 0;
	
	this.p_shape = new p2.Circle({
		radius: info.radius 
	});

	this.bounciness = info.bounciness;
	this.bounce_count = info.bounce_count;

	this.p_material = this.game.enemy_materials[info.bounciness];

	this.p_shape.collisionGroup = this.game.collision_group.ENEMY;
	this.p_shape.collisionMask = this.game.collision_group.GROUND | this.game.collision_group.PLAYER | this.game.collision_group.WALL;
	this.p_shape.material = this.p_material;

	this.p_body.addShape(this.p_shape);
	this.p_body.game_object = this;

	if (this.game.server) {				//server
		this.game.physics_world.addBody(this.p_body);
	} else {											//client
		var color_rate = Math.min(1, Math.sin(Math.PI / 2 * ((info.radius - radius_vari.min) / (radius_vari.max - radius_vari.min))));
		var color_r = Math.round(color_vari.min.r + (color_vari.max.r - color_vari.min.r) * color_rate);
		var color_g = Math.round(color_vari.min.g + (color_vari.max.g - color_vari.min.g) * color_rate);
		var color_b = Math.round(color_vari.min.b + (color_vari.max.b - color_vari.min.b) * color_rate);
		this.color = 'rgb(' + color_r + ',' + color_g + ',' + color_b + ')';

		this.border_color = this.get_border_color(this.bounce_count);
	}
};

c_enemy.prototype.on_collide_with_ground = function() {
	if (this.bounce_count == 0) {
		this.game.after_physics.push({
			func: function() {
				var game = this.game;
				this.network_destroy();
				game.remove_enemy(this.id);
			},
			caller: this
		});

		return;
	}

	this.bounce_count = Math.max(this.bounce_count - 1, 0);
	this.server_change_border_color(this.bounce_count);
};

c_enemy.prototype.server_change_border_color = function(bounce_count) {
	this.game.broadcast('enemy_change_border_color', {
		id: this.id,
		bounce_count: bounce_count
	});
};

c_enemy.prototype.client_change_border_color = function(bounce_count) {
	this.border_color = this.get_border_color(bounce_count);
};


c_enemy.prototype.get_border_color = function(b_count) {
	var color_rate = Math.min(1, (b_count - this.bounce_vari.min) / (this.bounce_vari.max - this.bounce_vari.min));
	var color_r = Math.round(this.bounce_color_vari.min.r + (this.bounce_color_vari.max.r - this.bounce_color_vari.min.r) * color_rate);
	var color_g = Math.round(this.bounce_color_vari.min.g + (this.bounce_color_vari.max.g - this.bounce_color_vari.min.g) * color_rate);
	var color_b = Math.round(this.bounce_color_vari.min.b + (this.bounce_color_vari.max.b - this.bounce_color_vari.min.b) * color_rate);

	return 'rgb(' + color_r + ',' + color_g + ',' + color_b + ')';
};

c_enemy.prototype.get_info = function() {
	return {
		id: this.id,
		pos: this.pos,
		radius: this.p_shape.radius,
		mass: this.p_body.mass,
		bounciness: this.bounciness,
		bounce_count: this.bounce_count
	};
};

c_enemy.prototype.draw = function() {
	this.p_body.draw(this.color, this.border_color);
};

c_enemy.prototype.network_destroy = function() {
	if (this.destroyed) return;

	this.game.broadcast('destroy_enemy', this.id);
	this.destroy();
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

