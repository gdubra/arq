'use strict';

angular.module('myApp').config(['cfpLoadingBarProvider', require('./loadingBar')]);
angular.module('myApp').config(['$httpProvider', require('./authInterceptor')]);
angular.module('myApp').run(['$rootScope', '$state', 'authorization', 'userManager', 'eventBus', 'authenticationEvents', 'authorizationEnums', '$mdToast', 'cache', require('./urlInterceptor')]);
angular.module('myApp').run(['eventBus', '$localStorage', '$cacheFactory', 'authenticationEvents', require('./localStorage')]);