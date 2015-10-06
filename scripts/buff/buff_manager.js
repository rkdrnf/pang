var Const = require('../const.js');

var g_buffs = [
	[Const.buff.stage_invulnerable, require('./stage_invulnerable')],
];

var buff_manager = function() {
	this.buffs = {};

	g_buffs.forEach(function(buff_pair) {
		var buff_name = buff_pair[0];
		this.buffs[buff_name] = buff_pair[1];
	}.bind(this));
};

buff_manager.prototype.get = function(buff_name) {
	 return this.buffs[buff_name];
};

buff_manager.prototype.new_buff = function(player, buff_name, info) {
	return new this.buffs[buff_name](player, info);
};






var g_buff_manager = module.exports = new buff_manager();
