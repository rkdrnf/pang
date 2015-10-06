var buff = module.exports = function(player, info) {
	this.buff_name = '';
	this.buff_level = 0;
	this.player = player;

	if (info) {
		this.buff_level = info.buff_level;
	}
};


buff.prototype.apply_effect = function(player) {
};

buff.prototype.remove_effect = function(player) {
};

buff.prototype.duplicate = function() {
	this.buff_level++;
};



buff.prototype.draw = function(player) {
};

buff.prototype.destroy = function() {
	this.player = null;
};

buff.prototype.get_info = function() {
	return {
		name: this.buff_name,
		buff_level: this.buff_level
	};
};
