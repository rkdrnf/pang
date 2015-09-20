var c_timer = module.exports = function() {
	this.timer_id = null;
	this.on_timer_tick = function(dt, t) {
		//implement in inherited class
	};
	this.on_timer = function(job_id) {
		//implement in inherited class
	};
};

c_timer.prototype.on_timer = function(job_id) {
	//implement
};

c_timer.prototype.on_timer_tick = function(dt, t) {
};


