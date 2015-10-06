module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		jshint: {
			options: {
				ignores: ['scripts/client_game.js']
			},
			all: ['Gruntfile.js', 'scripts/*.js', 'scripts/**/*.js'],

		},
		watch: {
			scripts: {
				files: 'scripts/*.js',
				tasks: ['jshint'],
				options: {
					interrupt: true
				}
			}
		},
		browserify: {
			client: {
				files: {
					'scripts/client_game.js' : [
						'scripts/game_core.js', 
						'scripts/!(game_server|client|client_game).js', 
						'scripts/buff/*.js',
						'scripts/item/*.js']
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadNpmTasks('grunt-newer');
	grunt.loadNpmTasks('grunt-contrib-jshint');

	grunt.registerTask('default', ['newer:jshint']);
	grunt.registerTask('nw', ['newer:browserify']);
};
