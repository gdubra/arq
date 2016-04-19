'use strict';

angular.module('myApp').factory('eventBus', ['$rootScope', require('./eventBus')]);
angular.module('myApp').factory('authentication', ['$q', 'eventBus', '$http', 'ajaxInfo', 'authenticationEvents', require('./authentication')]);
angular.module('myApp').factory('authorization', ['userAccess', 'authorizationEnums', require('./authorization')]);
angular.module('myApp').factory('userManager', ['userAccess', 'eventBus', 'authenticationEvents', 'authorization', 'authorizationEnums',  'cache',require('./userManager')]);
angular.module('myApp').factory('cache', ['$localStorage', 'eventBus', require('./cache')]);
angular.module('myApp').factory('userAccess', ['$localStorage', require('./userAccess')]);
