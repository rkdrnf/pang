module.exports = function(grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		jshint: {
			options: {
				ignores: ['scripts/client_game.js']
			},
			all: ['Gruntfile.js', 'scripts/*.js'],

		},
		watch: {
			scripts: {
				files: 'scripts/*.js',
				tasks: ['jshint'],
				options: {
					interrupt: true
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.loadNpmTasks('grunt-contrib-jshint');

	grunt.registerTask('default', ['jshint']);
};
