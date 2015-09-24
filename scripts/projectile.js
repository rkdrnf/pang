
var projectile = module.exports = function(id){
	this.id = id;

	console.log(this.id);
};

projectile.prototype.fire = function(){
	
	this.p_body.velocity = this.velocity;

};

projectile.prototype.get_info = function(){
	return {
		id: this.id,
		type: this.type,
		player_id: this.player.id
	};
};

projectile.prototype.draw = function(){
	this.p_body.draw();
};

projectile.prototype.destroy = function() {
	if (this.destroyed) return;

	this.destroyed = true;
	this.game.physics_world.removeBody(this.p_body);
	this.p_body.game_object = null;
	this.p_shape = null;
	this.p_body = null;
	this.game = null;
};


projectile.prototype.network_destroy = function() {
	if (this.destroyed) return;

	this.game.broadcast('destroy_projectile', { id: this.id });
	this.destroy();
};
