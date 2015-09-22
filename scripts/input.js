var input = module.exports = function(l, r, u, d, f) {
	this.left = l;		//bool
	this.right = r;		//bool
	this.up = u;			//bool
	this.down = d;		//bool
	this.fire = f;		//bool

};

input.prototype.toString = function() {
	return [this.left, this.right, this.up, this.down].filter(function(val) {
		return val;
	}).join('.');
};

input.prototype.valueOf = function() {
	return {
		l: this.left,
		r: this.right,
		u: this.up,
		d: this.down,
		f: this.fire
	};
};

input.prototype.movement_vector = function() {
	return { 
		x: (this.left ? -1 : 0) + (this.right ? 1 : 0),
		y: (this.up ? -1 : 0) + (this.down ?1 : 0)
  };
};

input.fromValue = function(val) {
	return new input(val.l, val.r, val.u, val.d, val.f);
}
