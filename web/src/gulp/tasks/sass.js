'use strict';

var config = require('../config').sass;
var handleErrors = require('../util/handleErrors');
var gulp = require('gulp');
var sass = require('gulp-sass');
var gulpif = require('gulp-if');
var browserSync = require('browser-sync');
var autoprefixer = require('gulp-autoprefixer');

gulp.task('sass', function() {

    return gulp.src(config.src)
            .pipe(sass({
                sourceComments: 'map',
                sourceMap: 'sass',
                outputStyle: 'compressed'
            }))
            .pipe(autoprefixer("last 2 versions", "> 1%", "ie 8"))
            .on('error', handleErrors)
            .pipe(gulp.dest(config.dest))
            .pipe(gulpif(browserSync.active, browserSync.reload({stream: true})));

});
