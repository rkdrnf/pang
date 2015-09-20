var p2 = require('p2');

var c_item = function(game, id, radius, pos) {
  this.game = game;
  this.id = id;

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

  this.p_shape.collisionGroup = this.game.collision_group.ENEMY;
  this.p_shape.collisionMask = this.game.collision_group.GROUND;

  this.p_body.addShape(this.p_shape);
  this.game.physics_world.addBody(this.p_body);
};

c_item.prototype.get_info = function() {
  return {
    id: this.id,
    pos: this.pos,
    radius: this.p_shape.radius
  };
};

c_item.prototype.draw = function() {
  this.p_body.draw();
};

module.exports = c_item;
