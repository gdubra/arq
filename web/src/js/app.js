// Browserify entry point for the app bundle
'use strict';

// Init
angular.module('myApp', ['ui.router', 'angular-loading-bar', 'ngMaterial' ,'ngAnimate', 'ngSanitize', 'ngMessages', 'ngStorage']);

require('./shared');
require('./config');
require('./service');
require('./routing');
require('./controller');

