
var projectile = module.exports = function(id, type){
	this.id = id;
	this.type = type;
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
	console.log('projec draw called');
	console.log('projecpos');
	console.log(this.p_body.position);
	this.p_body.draw();
};

projectile.prototype.destroy = function() {
	this.game.physics_world.removeBody(this.p_body);
	this.p_body.game_object = null;
	this.p_shape = null;
	this.p_body = null;
	this.game = null;
};

