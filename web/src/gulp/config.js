
module.exports = {
    browserSync: {
        server: {
            // Serve up our build folder
            baseDir: './../'
        }
    },
    sass: {
        src: "./scss/*.{sass,scss}",
        dest: "./../css/"
    },
    browserify: {
        // bundle config in the list below
        bundleConfigs: [
            // Web Client JS
            {
                entries: './js/app.js',
                dest: './../js/',
                outputName: 'app_bundle.js'
            },
            // Web Client depedencies
            /*{
                entries: './js/lib.js',
                dest: './../js/',
                outputName: 'lib_bundle.js'
            }*/
            ]
    }
    
};