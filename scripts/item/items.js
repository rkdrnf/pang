var c_item = function(game, id, pos, radius, type) {
  this.game = game;
  this.id = id;
  this.type = type;

  this.pos = {x:30, y:50};
  if (pos) {
    this.pos = pos;
  }
};

c_item.prototype.get_info = function() {
  return {
    id: this.id,
    pos: this.pos,
    radius: this.p_shape.radius,
    type: this.type
  };
};
/*
c_item.prototype.survive = function() {
  console.log("can i survive item?");
  return true;
}
*/
c_item.prototype.draw = function() {
  this.p_body.draw();
};

c_item.prototype.destroy = function() {
	if (this.destroyed) return;

	this.destroyed = true;
  this.game.physics_world.removeBody(this.p_body);
  this.p_body.game_object = null;
  this.p_shape = null;
  this.p_body = null;
  this.game = null;
};

module.exports = c_item;
