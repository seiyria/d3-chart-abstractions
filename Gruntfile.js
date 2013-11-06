module.exports = function(grunt) {

	grunt.task.loadNpmTasks("grunt-contrib-watch");
	grunt.task.loadNpmTasks("grunt-contrib-uglify");
	grunt.task.loadNpmTasks("grunt-contrib-cssmin");
	grunt.task.loadNpmTasks("grunt-contrib-jshint");
	grunt.task.loadNpmTasks("grunt-contrib-connect");
	grunt.task.loadNpmTasks("grunt-remove-logging");
	grunt.task.loadNpmTasks("grunt-mocha-test");
	grunt.task.loadNpmTasks("grunt-reload");
	grunt.task.loadNpmTasks("grunt-open");

	grunt.initConfig({

		pkg: grunt.file.readJSON("package.json"),

		jshint: {
			default: ["src/**/*.js"],
			options: {
				'-W014': true
			}
		},

		watch: {
			deploy: {
				files: ["src/**/*"],
				tasks: ["jshint","uglify","mochaTest"]
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

		reload: {
			port: 6001,
			proxy: {
				host: 'localhost',
				port: 9000
			}
		},

		connect: {
			bar: {
				options: {
					port: "9000"
				}
			}
		},

		open: {
			bar: {
				path: "http://localhost:9000/bar.html"
			}
		}

	});

	grunt.registerTask("clean", ["jshint"]);
	grunt.registerTask("minify", ["uglify:bar"]);

	grunt.registerTask("test", ["clean", "minify", "mochaTest"]);
	grunt.registerTask("bar", ["connect:bar","open:bar", "reload", "watch"]);
	grunt.registerTask("deploy", ["uglify:deploy", "cssmin:deploy"]);

}