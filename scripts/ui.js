var c_ui = module.exports = function (ui_manager) {
	this.manager = ui_manager;
	this.event_handler = {};
};

c_ui.prototype.on_start = function() {
	console.log('UI registered. id: ' + this.id);
};

c_ui.prototype.destroy = function() {
	this.manager = null;
};

c_ui.prototype.on_timer_tick = function() {};

c_ui.prototype.draw = function() {};

c_ui.prototype.handle_event = function(e) {
	var handler = this.event_handler[e];

	if (handler) {
		this.before_event(e);
		handler.call(this);
		this.after_event(e);
	} else {
		console.log('No ui event handler found. event: ' + e);
	}
};

c_ui.prototype.add_event_handler = function(e, handler) {
	this.event_handler[e] = handler;
};

c_ui.prototype.before_event = function(e) {};
c_ui.prototype.after_event = function(e) {};
