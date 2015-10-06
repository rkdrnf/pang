var c_buff = require('./buff.js');
var Const = require('../const.js');

var stage_invulnerable = module.exports = function(player, info) {
	c_buff.call(this, player, info);

	this.buff_name = Const.buff.stage_invulnerable;

	this.draw_radius = 1.2;
};

stage_invulnerable.prototype = Object.create(c_buff.prototype);

stage_invulnerable.prototype.draw = function(player) {
game.ctx.lineWidth = 2;
game.ctx.strokeStyle = '#92f7ec';

game.ctx.beginPath();
game.ctx.arc(player.pos.x * game.viewport.res_mul, player.pos.y * game.viewport.res_mul, this.draw_radius * game.viewport.res_mul, 0, 2 * Math.PI, false);
game.ctx.closePath();
game.ctx.stroke();
}



