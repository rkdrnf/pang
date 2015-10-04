var p2 = require('p2');

var c_item = require('./items.js');

/* Shield */
var i_shield = module.exports = function(game, id, radius, pos, type) {
  c_item.call(this, game, id, type);

  this.pos = {x:30, y:50};
  if (pos) {
    this.pos = pos;
  }

  this.pray = 5;
  this.p_body = new p2.Body({
    mass: 1,
    position: this.game.p_vec2(pos)
  });

  this.p_shape = new p2.Circle({
    radius: radius? radius : 10
  });

  this.p_shape.collisionGroup = this.game.collision_group.ITEM;
  this.p_shape.collisionMask = this.game.collision_group.GROUND | this.game.collision_group.PLAYER | this.game.collision_group.WALL;

  this.p_body.addShape(this.p_shape);
  this.p_body.item_object = this;
  this.game.physics_world.addBody(this.p_body);
}

i_shield.prototype = Object.create(c_item.prototype);

i_shield.prototype.survive = function() {
  console.log("I'm survive! ", this.pray);
  if (this.pray > 0) {
    this.pray = this.pray - 1;
    return true;
  }

  return false;
}


