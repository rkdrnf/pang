var p2 = require('p2');

var c_item = function(game, id, radius, pos, type) {
  this.game = game;
  this.id = id;
  this.type = type;

  this.pos = {x:30, y:50};
  if (pos) {
    this.pos = pos;
  }

  this.p_body = new p2.Body({
    mass: 1,
    position: this.game.p_vec2(pos)
  });

  this.p_shape = new p2.Circle({
    radius: radius? radius : 10
  });

  console.log(game);
  this.p_shape.collisionGroup = this.game.collision_group.ITEM;
  this.p_shape.collisionMask = this.game.collision_group.GROUND || this.game.collision_group.PLAYER;

  this.p_body.addShape(this.p_shape);
  this.game.physics_world.addBody(this.p_body);
};

c_item.prototype.get_info = function() {
  return {
    id: this.id,
    pos: this.pos,
    radius: this.p_shape.radius,
    type: this.type
  };
};

c_item.prototype.draw = function() {
  this.p_body.draw();
};

c_item.prototype.destroy = function() {
  this.game.physics_world.removeBody(this.p_body);
  this.p_body.game_object = null;
  this.p_shape = null;
  this.p_body = null;
  this.game = null;
};

module.exports = c_item;
