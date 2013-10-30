module.exports = function(grunt) {

	grunt.task.loadNpmTasks("grunt-contrib-watch");
	grunt.task.loadNpmTasks("grunt-contrib-uglify");
	grunt.task.loadNpmTasks("grunt-contrib-cssmin");
	grunt.task.loadNpmTasks("grunt-contrib-jshint");
	grunt.task.loadNpmTasks("grunt-contrib-csslint");
	grunt.task.loadNpmTasks("grunt-contrib-connect");
	grunt.task.loadNpmTasks("grunt-remove-logging");
	grunt.task.loadNpmTasks("grunt-mocha-test");
	grunt.task.loadNpmTasks("grunt-open");

	grunt.initConfig({

		pkg: grunt.file.readJSON("package.json"),

		jshint: {
			default: ["src/**/*.js"]
		},

		csslint: {
			default: {
				src: ["src/**/*.css"]
			}
		},

		watch: {
			deploy: {
				files: ["src/**/*.js"],
				tasks: ["jshint","uglify:bar"]
			}
		},

		mochaTest: {
			default: {
				options: {
					ui: 'bdd',
					reporter: 'nyan'
				},
				src: "test/**/*.js"
			}
		},

		uglify: {
			bar: {
				options: {
					compress: false,
					beautify: true,
					mangle: false
				},
				files: {
					"dist/development/bar.js": "src/bar/**/*.js"
				}
			},
			combine: {

			},
			deploy: {
				options: {
					sourceMap: 'dist/production/d3ca.map.js'
				},
				files: {
					'dist/production/d3ca.min.js': ['dist/development/**/*.js']
				}
			}
		},

		cssmin: {
			bar: {
				files: {
					"dist/development/bar.css": ["src/bar/**/*.css"]
				}
			},
			combine: {

			},
			deploy: {
				files: {
					"dist/production/d3ca.min.css": ["dist/development/**/*.css"]
				}
			}
		},

		connect: {

		}

	});

	//TODO restructure these better
	grunt.registerTask("clean", ["jshint", "csslint"]);
	grunt.registerTask("minify", ["uglify:bar", "cssmin:bar"]);

	grunt.registerTask("test", ["clean", "minify", "mochaTest"]);
	grunt.registerTask("dev", ["connect","watch"]);
	grunt.registerTask("deploy", ["uglify:deploy", "cssmin:deploy"]);

}