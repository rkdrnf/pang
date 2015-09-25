var c_ui_manager = module.exports = function(game) {
	this.game = game;
	this.uis = {};

	this.game.register_timer(this);
};


c_ui_manager.prototype.add = function(c_ui, t) {
	if (!t) t = 0;

	this.uis[c_ui.id] = {
		ui: new c_ui(this),
		time: t
	};

	if (t > 0) {
		this.game.add_timer(this.timer_id, c_ui.id, t);
	}

	this.uis[c_ui.id].ui.on_start();
};


c_ui_manager.prototype.remove = function(ui_id) {
	var ui_info = this.uis[ui_id];

	if (ui_info) {
		if (ui_info.time > 0) {
			this.game.cancel_timer_job(this.timer_id, ui_id);
		} 

		ui_info.ui.destroy();
		delete this.uis[ui_id];
	}
};


c_ui_manager.prototype.on_timer_tick = function(dt) {
	this.for_each_ui(function(ui_info) {
		var ui = ui_info.ui;
		ui.on_timer_tick(dt);
	});
};

c_ui_manager.prototype.send_event = function(ui_id, e) {
	var ui_info = this.uis[ui_id];
	if (ui_info) {
		ui_info.ui.handle_event(e);
	}	
};

c_ui_manager.prototype.draw = function() {
	this.for_each_ui(function(ui_info) {
		ui_info.ui.draw();
	});
};

c_ui_manager.prototype.for_each_ui = function(func) {
	Object.keys(this.uis).forEach(function(id) {
		func.call(this, this.uis[id]);
	}.bind(this));
};
