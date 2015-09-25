var c_ui = require('./ui.js');
var Const = require('./const.js');
var c_main_text_ui = module.exports = function(manager) {
	c_ui.call(this, manager);

	this.text = '';
	this.show_time = 0;
	this.show_timer = 0;
	this.enabled = false;

	this.color = '#ffffff';

	this.add_event_handler('show_end', this.show_end_message);
	this.add_event_handler('show_ready', this.show_ready_message);
	this.add_event_handler('show_start', this.show_start_message);
	this.add_event_handler('show_next', this.show_next_message);
}


c_main_text_ui.id = Const.ui.main_text_ui;

c_main_text_ui.prototype = Object.create(c_ui.prototype);


c_main_text_ui.prototype.on_timer_tick = function(dt) {
	if (this.enabled == false || this.show_time == 0) return;

	this.show_timer -= dt;

	if (this.show_timer < 0) {
		this.end_show();
	}
};

c_main_text_ui.prototype.draw = function() {
	if (this.enabled == false || this.show_timer < 0) return;
	
	game.ctx.fillStyle = this.color;
	game.ctx.font = "50px Arial";
	game.ctx.textAlign = "center";
	game.ctx.fillText(this.text, game.world.width * game.viewport.res_mul / 2, 10 * game.viewport.res_mul);
};

c_main_text_ui.prototype.before_event = function(e) {
	this.end_show();
};

c_main_text_ui.prototype.after_event = function(e) {
	this.show_timer = this.show_time;
};

c_main_text_ui.prototype.show_end_message = function() {
	this.enabled = true;
	this.text = 'GAME OVER';
	this.show_time = 0;
};

c_main_text_ui.prototype.show_next_message = function() {
	this.enabled = true;
	this.text = 'NEXT STAGE';
	this.show_time = 0;
};

c_main_text_ui.prototype.show_ready_message = function() {
	this.enabled = true;
	this.text = 'READY';
	this.show_time = 0;
};

c_main_text_ui.prototype.show_start_message = function() {
	this.enabled = true;
	this.text = 'START';
	this.show_time = 1;
};

c_main_text_ui.prototype.end_show = function() {
	this.enabled = false;
};
