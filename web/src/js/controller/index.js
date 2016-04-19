'use strict';

angular.module('myApp').controller('AccessCtrl', ['$scope', '$state', 'authentication', require('./accessCtrl')]);
angular.module('myApp').controller('HeaderCtrl', ['$scope', '$state', 'eventBus', 'authentication', 'authenticationEvents', 'authorization', 'authorizationEnums', 'userManager', require('./headerCtrl')]);
angular.module('myApp').controller('UserCtrl', ['$scope', '$http', '$state', '$stateParams', 'ajaxInfo', '$localStorage', '$q', 'eventBus', require('./userCtrl')]);