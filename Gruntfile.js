module.exports = function(grunt) {
    var watchFiles = [
        'json/trimdata.json',
    ];

    var pkg = grunt.file.readJSON('package.json');

    grunt.initConfig({
        dir: {
            src: 'src',
            img: {
                'org': 'org',
                'dest': 'dest'
            },
            json: {
                'org':  'json',
                'bkup': 'json/bkup'
            }
        },

        execute: {
            convert: {
                src: ['script.js']
            }
        },

        copy: {
            json: {
                expand: true,
                cwd: '<%= dir.json.org %>/',
                src: ['trimdata.json'],
                dest: '<%= dir.json.bkup %>/'
            }
        },

        watch: {
            files: watchFiles,
            tasks: ['execute:convert', 'copy']
        },

        express: {
            dev: {
                options: {
                    background: true,
                    port: 3000,
                    cmd: "forever",
                    args: ["-w"],
                    script: "./express/app.js",
                    delay: 0,
                    debug: true
                }
            }
        },

        image: {
            static: {
                options: {
                    pngquant: true,
                    optipng: true,
                    advpng: false,
                    zopflipng: false,
                    pngcrush: false,
                    pngout: false,
                    jpegtran: false,
                    jpegRecompress: false,
                    jpegoptim: false,
                    gifsicle: false,
                    svgo: false
                },
                files: {}
            },
            all: {
                files: [{
                    expand: true,
                    cwd: 'img/dest/',
                    src: ['**/*.{png,jpg,gif,svg}'],
                    dest: 'img/dest/'
                }]
            },
            dynamic: {
                files: [{
                    expand: true,
                    cwd: 'img/dest/:imageId/',
                    src: ['**/*.{png,jpg,gif,svg}'],
                    dest: 'img/dest/:imageId/'
                }]
            }
        }
    });

    // loadNpmTasksを変更
    // grunt.loadNpmTasks('grunt-contrib-watch');
    var taskName;
    for(taskName in pkg.devDependencies) {
        if(taskName.substring(0, 6) == 'grunt-') {
            grunt.loadNpmTasks(taskName);
        }
    }

    grunt.registerTask('default', ['express:dev', 'watch']);
    grunt.registerTask('server', ['express:dev']);
    grunt.registerTask('exec', ['execute:convert']);
    grunt.registerTask('optimizeimage-all', ['image:all']);
    grunt.registerTask('optimizeimage-dynamic', ['image:dynamic']);
    grunt.registerTask('optimizeimage-perId', 'image compressor for spcific image', function(imageId) {
        if (!imageId) {
            return;
        }
        var config = grunt.config();
        config.image.dynamic.files[0].cwd = config.image.dynamic.files[0].cwd.replace(/:imageId/g, imageId);
        config.image.dynamic.files[0].dest = config.image.dynamic.files[0].dest.replace(/:imageId/g, imageId);
        grunt.initConfig(config);
        grunt.task.run(['optimizeimage-dynamic']);
    });
};
