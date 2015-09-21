
var projectile = module.exports = function(id){
	this.id = id;
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



