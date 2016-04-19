(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Browserify entry point for the app bundle
'use strict';

// Init
angular.module('myApp', ['ui.router', 'angular-loading-bar', 'ngMaterial' ,'ngAnimate', 'ngSanitize', 'ngMessages', 'ngStorage']);

require('./shared');
require('./config');
require('./service');
require('./routing');
require('./controller');


},{"./config":3,"./controller":9,"./routing":13,"./service":19,"./shared":25}],2:[function(require,module,exports){
module.exports = function ($httpProvider) {
    
    $httpProvider.interceptors.push(function ($q, $injector) {
        return {
            request: function (config) {
                config.headers = config.headers || {};
                var $localStorage = $injector.get('$localStorage');
                if ($localStorage.hasOwnProperty('userModel')) {
                    
                    // Setup the authorization token
                    config.headers.Authorization = 'Bearer ' + $localStorage.userModel.token;
                }
                return config;
            },
            responseError: function (response) {
                
                var eventBus = $injector.get('eventBus');
                var authenticationEvents = $injector.get('authenticationEvents');
                var $state = $injector.get('$state');
                
                // If got a 401 (not authorized) from the server, and not already in the login page, forward to it
                if (response.status === 401 && !$state.is('root.access.login')) {
                    
                    // Broadcast user's session has timed out
                    eventBus.broadcast(authenticationEvents.sessionTimedOut);
                    
                    // Then trigger a state change start event so the user will get into the login page and then back to where it was before
                    // (get redirected back to either were he/she was when got the 401 for an ajax call)
                    $state.reload();
                    
                }
                
                // If got a 403 (forbidden) forward the user to it's default screen and show a notification
                if (response.status === 403) {
                    
                    // Send to default screen
                    var userManager = $injector.get('userManager');
                    $state.go(userManager.getDefaultScreen());
                    
                    // Show a toast notification
                    var $mdToast = $injector.get('$mdToast');
                    $mdToast.show(
                        $mdToast.simple()
                            .textContent('You don\'t have permissions to do that action. You can contact an admin user to adjust your executive access settings.')
                            .position('top left')
                            .hideDelay(15000)
                    );
            
                }
                
                // Reject the promise
                return $q.reject(response);
            }
        };
    });
    
};

},{}],3:[function(require,module,exports){
'use strict';

angular.module('myApp').config(['cfpLoadingBarProvider', require('./loadingBar')]);
angular.module('myApp').config(['$httpProvider', require('./authInterceptor')]);
angular.module('myApp').run(['$rootScope', '$state', 'authorization', 'userManager', 'eventBus', 'authenticationEvents', 'authorizationEnums', '$mdToast', 'cache', require('./urlInterceptor')]);
angular.module('myApp').run(['eventBus', '$localStorage', '$cacheFactory', 'authenticationEvents', require('./localStorage')]);
},{"./authInterceptor":2,"./loadingBar":4,"./localStorage":5,"./urlInterceptor":6}],4:[function(require,module,exports){
module.exports = function (cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;
};

},{}],5:[function(require,module,exports){
module.exports = function (eventBus, $localStorage, $cacheFactory, authenticationEvents) {

    var clearAllLocalStorageAndCache = function (clearLoggedInInfo) {
        
        if (clearLoggedInInfo === undefined) {
            clearLoggedInInfo = true;
        }
        
        // Clean the local storage ($reset function is not working as expected)
        for (var k in $localStorage) {
            if ('$' !== k[0]) {
                // Do not delete a few keys unless clearing all info (clearLoggedInInfo set to true)
                var omitKeys = ['userModel'];
                if (clearLoggedInInfo || (omitKeys.indexOf(k) == -1)) {
                    delete $localStorage[k];
                }
            }
        }
        
        // Clean the http cache
        $cacheFactory.get('$http').removeAll();
    };

    // Clear both localStorage and http cache when a user logs in 
    eventBus.subscribe(authenticationEvents.userLoggedIn, function () {
        clearAllLocalStorageAndCache(false);
    });

    // Clear both localStorage and http cache when a user logs out or it's session time sout
    eventBus.subscribe(authenticationEvents.userLoggedOut, function () {
        clearAllLocalStorageAndCache();
    });
    eventBus.subscribe(authenticationEvents.sessionTimedOut, function () {
        clearAllLocalStorageAndCache();
    });
    
};
},{}],6:[function(require,module,exports){
module.exports = function($rootScope, $state, authorization, userManager, eventBus, authenticationEvents, authorizationEnums, $mdToast, cache) {
    
    var stateChangeRequiredAfterLogin = false;
    var loginRedirectUrl;
    
    $rootScope.$on('$stateChangeStart', function(event, next) {
        assessAuthorizationToAccessState(event, next);
    });
    
    var assessAuthorizationToAccessState = function (event, next) {
        
        var authorizationResult;
        
        // If next state has access data then get the authorised level result. Else get the default one
        if (next.access) {
            authorizationResult = authorization.getAuthorizationLevel(next.access.loginRequired, next.access.permissions, next.access.permissionCheckType);
        } else {
            authorizationResult = authorization.getAuthorizationLevel();
        }
        
        // Cache the current state authorization level
        cache.set('currentStateAuthLevel', authorizationResult);
        
        // Forward to login page if login is required
        if (authorizationResult === authorizationEnums.authorised.loginRequired) {
            stateChangeRequiredAfterLogin = true;
            loginRedirectUrl = next.name;
            $state.go('root.access.login');
            event.preventDefault();
            
        // Forward to customer dashboard page if user is logged in but with insufficient permissions for the requested page
        } else if (authorizationResult === authorizationEnums.authorised.notAuthorised) {
            
            // Forward to default page
            $state.go(userManager.getDefaultScreen());
            
            // Show a toast notification
            $mdToast.show(
                $mdToast.simple()
                    .textContent('You don\'t have permissions to view this page. You can contact an admin user to adjust your executive access settings.')
                    .position('top left')
                    .hideDelay(15000)
            );
    
            event.preventDefault();
            
        // User is authorized to view or to admin the page/state
        } else if (
                authorizationResult === authorizationEnums.authorised.authorisedToView ||
                authorizationResult === authorizationEnums.authorised.authorisedToAdmin
                ) {
            
            // Forward to previously requested page only if already logged in
            if (userManager.isUserLoggedIn() && stateChangeRequiredAfterLogin) {
                stateChangeRequiredAfterLogin = false;
                // Pass as parameter if it has been authorized to admin the page/state
                $state.go(loginRedirectUrl);
                event.preventDefault();
            }
            
        }

    };

    eventBus.subscribe(authenticationEvents.userLoggedOut, function(event, eventData) {
        var redirect = eventData.redirectToLogin != undefined ? eventData.redirectToLogin : true;
        if(redirect) {
            $state.go('root.access.login');
        }
    });
};



},{}],7:[function(require,module,exports){
module.exports = function ($scope, $state, authentication) {

    $scope.loginModel = {};
    $scope.isBusy = false;

    $scope.init = function () {

    };
    
    $scope.$on('$stateChangeSuccess', function () {
        switch ($state.current.name) {
            case 'root.access.login':
                $scope.initAccessLogin();
                break;
            case 'root.access.logout':
                $scope.logout();
                break;
        }
    });
    
    $scope.initAccessLogin = function() {
        if ($scope.loginModel._csrf_token == undefined) {
            authentication.requestLoginCSRFToken().then(function(response) {
                $scope.loginModel._csrf_token = response.csrf_token;
            }, function(data) {
                $scope.globalError = 'Oops! Our log in system is having some technical difficulties right now.';
            })['finally'](function() {
                $scope.isBusy = false;
            });
        }
    };
    
    $scope.login = function () {
        
        $scope.globalError = null;
        $scope.isBusy = true;
        
        authentication.login($scope.loginModel).then(function (response) {
            $state.go('root.homepage', {}, {reload: true});
        }, function (data) {
            $scope.globalError = 'Oops! It appears that either your username or password is incorrect.';
        })['finally'](function () {
            $scope.isBusy = false;
        });
    };

    $scope.logout = function(){
        authentication.logout();
    };  

    $scope.init();

};

},{}],8:[function(require,module,exports){

module.exports = function ($scope, $state, eventBus, authentication, authenticationEvents, authorization, authorizationEnums, userManager, viewEditMode) {
    
    var menusToShow = [];

    $scope.init = function () {

        $scope.logout = authentication.logout;
        

        $scope.logSelectValue = '';
        $scope.loggedInUserName;
        
        if (userManager.isUserLoggedIn()) {
            setLoggedInData();
        }
    };

    $scope.$on('$destroy', eventBus.subscribe(authenticationEvents.userLoggedIn, function () {

        // When the user logs in
        setLoggedInData();
        
    }));

    var setupMenusToShow = function () {
        
        unsetMenusToShow();
        
        var menuCandidates = [
            {
                name: 'admin',
                loginRequired: true,
                permissions: ['ROLE_MANAGER']
            },
            {
                name: 'opportunities_viewer',
                loginRequired: true,
                permissions: ['net_worth_view', 'estate_plan_view', 'tax_plan_view', 'risk_management_view', 'charitable_plan_view']
            }
        ];
        var menuCandidate;
        var authLevel;
        for (var i = 0 ; i < menuCandidates.length ; i++) {
            menuCandidate = menuCandidates[i];
            authLevel = authorization.getAuthorizationLevel(menuCandidate.loginRequired, menuCandidate.permissions, authorizationEnums.permissionCheckType.atLeastOneRequired);
            if (authLevel == authorizationEnums.authorised.authorisedToView || authLevel == authorizationEnums.authorised.authorisedToAdmin) {
                menusToShow.push(menuCandidate.name);
            }
        };
        
    };
    
    var unsetMenusToShow = function () {
        menusToShow = [];
    };

    var setLoggedInData = function() {
        
        // Setup logged in user's name
        $scope.loggedInUserName = userManager.getUserModel().name;

        // Set menus to show
        setupMenusToShow();
        
        $scope.isUserLoggedIn = true;
        
    };

    var setLoggedOutData = function () {

        // When the user logs out...

        // Unset logged in user's name
        $scope.loggedInUserName = undefined;

        // Unet menus to show
        unsetMenusToShow();
        
        $scope.isUserLoggedIn = false;

    };
    $scope.$on('$destroy', eventBus.subscribe(authenticationEvents.userLoggedOut, setLoggedOutData));
    $scope.$on('$destroy', eventBus.subscribe(authenticationEvents.sessionTimedOut, setLoggedOutData));

    $scope.$on('$stateChangeSuccess', function () {
        $scope.active_tab = $state.current.activeTab;
    });
    
    /*
     * If we are on a customer dashboard screen simply broadcast a tabSelected event
     * else load the desired customer dashboard with a regular state.go
     * @param string pillarNameId
     * @returns none
     */
    $scope.hrefCustomerDashboard = function () {
        if ($state.current.name.indexOf('root.customer_dashboard') > -1) {
            
            // Broadcast to the customer dashboard controller a "tabSelected" event
            eventBus.broadcast('customer_dashboard.tabSelected');
            
        } else {
            
            // Regular state change
            $state.go('root.customer_dashboard');
            
        }
    };
    
    $scope.shouldShowMenu = function(menuName) {
        if (menuName == 'admin') {
            return  menusToShow.indexOf(menuName) != -1;
        } else {
            return menusToShow.indexOf(menuName) != -1;
        }
    };
    
    // Initialize controller
    $scope.init();
    
};

},{}],9:[function(require,module,exports){
'use strict';

angular.module('myApp').controller('AccessCtrl', ['$scope', '$state', 'authentication', require('./accessCtrl')]);
angular.module('myApp').controller('HeaderCtrl', ['$scope', '$state', 'eventBus', 'authentication', 'authenticationEvents', 'authorization', 'authorizationEnums', 'userManager', require('./headerCtrl')]);
angular.module('myApp').controller('UserCtrl', ['$scope', '$http', '$state', '$stateParams', 'ajaxInfo', '$localStorage', '$q', 'eventBus', require('./userCtrl')]);
},{"./accessCtrl":7,"./headerCtrl":8,"./userCtrl":10}],10:[function(require,module,exports){

module.exports = function ($scope, $http, $state, $stateParams, ajaxInfo, $localStorage, $q, eventBus) {
    
    $scope.init = function () {
        $scope.users = {};
        $scope.user = {};
    };
    
    var initNgState = function () {
        switch ($state.current.name) {
            case 'root.user.index':
                $scope.initUserIndex();
                break;
            case 'root.user.show':
                $scope.initUserShow($stateParams.userId);
                break;
            case 'root.user.edit':
                $scope.initUserShow($stateParams.userId);
                break;
        }
    };

    $scope.$on('$destroy', eventBus.subscribe('modelEntity:perspective:switch', function () {
        initNgState();
    }));

    $scope.$on('$stateChangeSuccess', function () {
        initNgState();
    });

    $scope.initUserIndex = function () {
        setupUsersIndexFromBackEnd().then(function () {
            $scope.users = $localStorage.users;
        });
    };

    $scope.initUserShow = function (userId) {
        // Retrieve user from backend
        $scope.errors = new Array();
        $scope.setupUser(userId);

    };

    $scope.setupUser = function (userId) {
        var defer = $q.defer();
        var backEndPromise = $http.get(ajaxInfo.USER_GET.url.replace(':userId', userId));
        backEndPromise.success(function (data) {
            $scope.user = data
        });
        return backEndPromise;
    };
    
    $scope.deleteUser = function (userId) {
        $http.delete(ajaxInfo.USER_DELETE.url.replace(':userId', userId)).success(function (data) {
            delete $localStorage.users[userId];
        });
    };

    $scope.createUser = function () {
        var successCallback = function (response) {
            $state.go('root.user.edit', { userId: response.data.id});
        };
        var errorCallback = function (response) {
            $scope.errors = response.data.errors;
        };
        var parameters = {
            'user': $scope.user
        };
        $http.post(ajaxInfo.USER_CREATE.url, parameters).then(successCallback, errorCallback);
    };

    $scope.updateUserField = function (fieldName) {
        var entityTypeName = 'user';
        var formName = 'userForm';
        
        //if its not valid or has not been changed
        if(!$scope[formName][fieldName].$valid || $scope[formName][fieldName].$pristine) {
            return;
        }
        
        var entity = {};
        
        entity[fieldName] = $scope[formName][fieldName].$modelValue;
        var parameters = {};
        parameters[entityTypeName] = entity;
        var successCallback = function (response) {
            $scope[formName][fieldName].$pristine = true;
            $scope[formName][fieldName].$dirty = true;
        };
        var errorCallback = function (response) {
            $scope.errors = response.errors;
        };
        return $http.put(ajaxInfo.USER_UPDATE.url.replace(':userId', $scope.user.id), parameters)
                .success(successCallback).error(errorCallback);
    };

    var setupUsersIndexFromBackEnd = function () {
        // Retrieve users list from backend
        var backEndPromise = $http.get(ajaxInfo.USER_INDEX.url);
        backEndPromise.then(function (response) {
            $localStorage.users = response.data;
        });

        return backEndPromise;
    };

    // Initialize controller
    $scope.init();

};

},{}],11:[function(require,module,exports){

module.exports = function ($locationProvider, $stateProvider, $urlRouterProvider, $urlMatcherFactoryProvider) {

    $stateProvider.state('root.access', {
        url: '/access',
        abstract: true
    });

    $stateProvider.state('root.access.login', {
        url: '/login',
        views: {
            'container@': {
                controller: 'AccessCtrl',
                templateUrl: 'web/html/access/login.html'
            }
        }
    });

    $stateProvider.state('root.access.not_authorized', {
        url: '/forbidden',
        views: {
            'container@': {
                controller: 'AccessCtrl',
                templateUrl: 'web/html/access/not_authorized.html'
            }
        }
    });

    $stateProvider.state('root.access.logout', {
        url: '/logout',
        views: {
            'container@': {
                controller: 'AccessCtrl'
            }
        }
    });
    
};

},{}],12:[function(require,module,exports){
/**
 * 
 * UI-Router states configuration.
 */
module.exports = function ($locationProvider, $stateProvider, $urlRouterProvider, $urlMatcherFactoryProvider) {

    $locationProvider.html5Mode({
        enabled: true
    });

    $urlMatcherFactoryProvider.strictMode(false);
    $urlRouterProvider.otherwise(function ($injector) {
        var $state = $injector.get("$state");
        $state.go("root.homepage");
    });

    $stateProvider.state('root', {
        url: '',
        abstract: true,
        views: {
            'header': {
                templateUrl: 'web/html/default/bootstrap_header.html',
                controller: 'HeaderCtrl'
            },
            'footer': {
                templateUrl: 'web/html/default/footer.html'
            }
        }
    });

    $stateProvider.state('root.homepage', {
        url: '/',
        activeTab: 'home',
        views: {
            'container@': {
                templateUrl: 'web/html/default/home.html'
            }
        }
    });
};

},{}],13:[function(require,module,exports){
'use strict';
angular.module('myApp').config(require('./default'));
angular.module('myApp').config(require('./access'));
angular.module('myApp').config(require('./user'));
},{"./access":11,"./default":12,"./user":14}],14:[function(require,module,exports){

module.exports = function ($stateProvider, authorizationEnums) {

    $stateProvider.state('root.user', {
        url: '/users',
        abstract: true
    });

    $stateProvider.state('root.user.index', {
        url: '',
        activeTab: 'user',
        views: {
            'container@': {
                controller: 'UserCtrl',
                templateUrl: 'web/html/user/index.html'
            }
        },
        access: {
            loginRequired: true,
            permissions: {
                'view': ['ROLE_MANAGER'],
                'admin': ['ROLE_MANAGER']
            },
            permissionCheckType: authorizationEnums.permissionCheckType.atLeastOneRequired
        }
    });
    
    $stateProvider.state('root.user.new', {
        url: '/new',
        activeTab: 'user',
        views: {
            'container@': {
                controller: 'UserCtrl',
                templateUrl: 'web/html/user/form.html'
            }
        },
        access: {
            loginRequired: true,
            permissions: {
                'view': ['ROLE_MANAGER'],
                'admin': ['ROLE_MANAGER']
            },
            permissionCheckType: authorizationEnums.permissionCheckType.atLeastOneRequired
        }
    });
    
    $stateProvider.state('root.user.edit', {
        url: '/edit/:userId',
        activeTab: 'user',
        views: {
            'container@': {
                controller: 'UserCtrl',
                templateUrl: 'web/html/user/form.html'
            }
        },
        access: {
            loginRequired: true,
            permissions: {
                'view': ['ROLE_MANAGER'],
                'admin': ['ROLE_MANAGER']
            },
            permissionCheckType: authorizationEnums.permissionCheckType.atLeastOneRequired
        }
    });
    
    $stateProvider.state('root.user.show', {
        url: '/:userId',
        activeTab: 'user',
        views: {
            'container@': {
                controller: 'UserCtrl',
                templateUrl: 'web/html/user/show.html'
            }
        },
        access: {
            loginRequired: true,
            permissions: {
                'view': ['ROLE_MANAGER'],
                'admin': ['ROLE_MANAGER']
            },
            permissionCheckType: authorizationEnums.permissionCheckType.atLeastOneRequired
        }
    });
    
};

},{}],15:[function(require,module,exports){
module.exports = function ($q, eventBus, $http, ajaxInfo, authenticationEvents) {

    var login = function (loginModel) {
        var defer = $q.defer();
        var url = ajaxInfo.LOGIN_CHECK.url;
        var parameters = loginModel;
        $http.post(url, parameters).success(function (response) {
            eventBus.broadcast(authenticationEvents.loginCheckSuccess, {
                responseData: response.data,
                responseToken: response.token
            });
            defer.resolve(response);
        }).error(function (data) {
            defer.reject(data);
            return;
        });
        return defer.promise;
    };
    
    var requestLoginCSRFToken = function () {
        var defer = $q.defer();
        var url = ajaxInfo.LOGIN_REQUEST.url;
        $http.get(url).success(function (response) {
            defer.resolve(response);
        }).error(function (data) {
            defer.reject(data);
            return;
        });
        return defer.promise;
    };

    var resetPassword = function (fosUserResettingForm, token) {
        var defer = $q.defer();
        var url = ajaxInfo.USER_RESET_PASSWORD_AND_AUTHENTICATE_USER.url.replace(':token', token);
        var parameters = {
            fos_user_resetting_form: fosUserResettingForm
        };
        $http.post(url, parameters).success(function (response) {
            eventBus.broadcast(authenticationEvents.loginCheckSuccess, {
                responseData: response.data,
                responseToken: response.token
            });
            defer.resolve(response);
        }).error(function (data) {
            defer.reject(data);
            return;
        });
        return defer.promise;
    };

    var logout = function (redirectToLogin) {
        
        // The userModel is deleted on localStorage.js config
        eventBus.broadcast(authenticationEvents.userLoggedOut, {
        	redirectToLogin:redirectToLogin
        });
        
    };

    return {
        login: login,
        requestLoginCSRFToken: requestLoginCSRFToken,
        resetPassword: resetPassword,
        logout: logout
    };

};

},{}],16:[function(require,module,exports){
module.exports = function (userAccess, authorizationEnums) {

    var getAuthorizationLevel = function (loginRequired, requiredPermissions, permissionCheckType) {

        var result;
        var requiredPermissionsToView = [];
        var requiredPermissionsToAdmin = [];
        
        // Permissions can be an array of strings or an object with 2 arrays: one for view permissions and one for admin permissions
       
        // If it's a simple array of strings it means these are requiredPermissionsToView
        if (Array.isArray(requiredPermissions)) {
            
            requiredPermissionsToView = requiredPermissions;
            
        } else if (requiredPermissions !== null && typeof requiredPermissions === 'object') {
            
            // If it is an object then search for view and admin permissions
            if (requiredPermissions['view'] !== undefined) {
                requiredPermissionsToView = requiredPermissions['view'];
            }
            if (requiredPermissions['admin'] !== undefined) {
                requiredPermissionsToAdmin = requiredPermissions['admin'];
            }
            
        }

        if (loginRequired === true) {

            if (userAccess.isUserLoggedIn()) {

                if (requiredPermissionsToView.length === 0 && requiredPermissionsToAdmin.length === 0) {

                    // Login is required but no specific permissions are specified
                    result = authorizationEnums.authorised.authorisedToAdmin;

                } else {

                    // Login AND specific permissions are required

                    var grantedPermissions = userAccess.getUserModel().permissions;

                    // If the user is a manager (or more), then authorize right away
                    if (grantedPermissions.indexOf('ROLE_MANAGER') > -1) {

                        result = authorizationEnums.authorised.authorisedToAdmin;

                    } else {

                        permissionCheckType = permissionCheckType || authorizationEnums.permissionCheckType.atLeastOneRequired;
                        var hasPermissionToView;
                        var hasPermissionToAdmin;
                        var i;

                        if (permissionCheckType === authorizationEnums.permissionCheckType.allRequired) {

                            // All permissions are required. Halt if any permission is not found

                            // Check for user roles and for perspective pillar permissions
                            
                            // First see if it can be authorized to admin
                            hasPermissionToAdmin = true;
                            for (i = 0; i < requiredPermissionsToAdmin.length; i += 1) {
                                if (grantedPermissions.indexOf(requiredPermissionsToAdmin[i]) == -1) {
                                    hasPermissionToAdmin = false;
                                    break;
                                }
                            }
                            
                            // If it does not have permission to admin then check if it has permission to view
                            if (hasPermissionToAdmin === false) {
                                hasPermissionToView = true;
                                for (i = 0; i < requiredPermissionsToView.length; i += 1) {
                                    if (grantedPermissions.indexOf(requiredPermissionsToView[i]) == -1) {
                                        hasPermissionToView = false;
                                        break;
                                    }
                                }
                            }

                        } else if (permissionCheckType === authorizationEnums.permissionCheckType.atLeastOneRequired) {

                            // At least one permission is required. Halt if any permission is found
                            
                            // Check for user roles and for perspective pillar permissions
                            
                            // First see if it can be authorized to admin
                            hasPermissionToAdmin = false;
                            for (i = 0; i < requiredPermissionsToAdmin.length; i += 1) {
                                if (
                                        grantedPermissions.indexOf(requiredPermissionsToAdmin[i]) > -1 
                                        ) {
                                    hasPermissionToAdmin = true;
                                    break;
                                }
                            }

                            // If it does not have permission to admin then check if it has permission to view
                            if (hasPermissionToAdmin === false) {
                                hasPermissionToView = false;
                                for (i = 0; i < requiredPermissionsToView.length; i += 1) {
                                    if (
                                            grantedPermissions.indexOf(requiredPermissionsToView[i]) > -1
                                            ) {
                                        hasPermissionToView = true;
                                        break;
                                    }
                                }
                            }
                        }

                        // Set authorizedToAdmin, authorizedToView or notAuthorized based on permissions found
                        if (hasPermissionToAdmin === true) {
                            result = authorizationEnums.authorised.authorisedToAdmin;
                        } else if (hasPermissionToView === true) {
                            result = authorizationEnums.authorised.authorisedToView;
                        } else {
                            result = authorizationEnums.authorised.notAuthorised;
                        }

                    }

                }

            } else {

                // Login is required but the user is not logged in
                result = authorizationEnums.authorised.loginRequired;

            }

        } else {

            // No login is required
            result = authorizationEnums.authorised.authorisedToView;

        }

        return result;
    };

    return {
        getAuthorizationLevel: getAuthorizationLevel
    };

};
},{}],17:[function(require,module,exports){
module.exports = function ($localStorage) {

    var set = function (key, value) {
        if ($localStorage.customCache == undefined) {
            $localStorage.customCache = {};
        }
        $localStorage.customCache[key] = value;
    };
    
    var unset = function (key) {
        if ($localStorage.customCache != undefined) {
            $localStorage.customCache[key] = undefined;
        }
    };
    
    var get = function (key) {
        if ($localStorage.customCache != undefined && $localStorage.customCache[key] != undefined) {
            return $localStorage.customCache[key];
        } else {
            return undefined;
        }
    };
    
    return {
        set: set,
        unset: unset,
        get: get
    };

};
},{}],18:[function(require,module,exports){

/**
 * @ngdoc service
 * @name eventBus
 * @requires $rootScope
 *
 * @description
 * Provides a eventing mechanism when a user can broadcast and subscribe to application wide events.
 */
module.exports = function($rootScope) {
    
    /**
     * @description
     * Subscribes a callback to the given application wide event
     *
     * @param {String} eventName The name of the event to subscribe to.
     * @param {Function} callback A callback which is fire when the event is raised.
     * @return {Function} A function tht can be called to unsubscrive to the event.
     */
    var subscribe = function(eventName, callback) {
        return $rootScope.$on(eventName, callback);
    },
    
    /**
     * @description
     * Broadcasts the given event and data.
     *
     * @param {String} eventName The name of the event to broadcast.
     * @param {object} data A data object that will be passed along with the event.
     */
    broadcast = function(eventName, data) {
        $rootScope.$emit(eventName, data);
    };

    return {
        subscribe: subscribe,
        broadcast: broadcast
    };
    
};

},{}],19:[function(require,module,exports){
'use strict';

angular.module('myApp').factory('eventBus', ['$rootScope', require('./eventBus')]);
angular.module('myApp').factory('authentication', ['$q', 'eventBus', '$http', 'ajaxInfo', 'authenticationEvents', require('./authentication')]);
angular.module('myApp').factory('authorization', ['userAccess', 'authorizationEnums', require('./authorization')]);
angular.module('myApp').factory('userManager', ['userAccess', 'eventBus', 'authenticationEvents', 'authorization', 'authorizationEnums',  'cache',require('./userManager')]);
angular.module('myApp').factory('cache', ['$localStorage', 'eventBus', require('./cache')]);
angular.module('myApp').factory('userAccess', ['$localStorage', require('./userAccess')]);

},{"./authentication":15,"./authorization":16,"./cache":17,"./eventBus":18,"./userAccess":20,"./userManager":21}],20:[function(require,module,exports){
module.exports = function ($localStorage) {
    
    var getUserModel = function () {
        return $localStorage.userModel;
    };
    
    var setUserModel = function (userModel) {
        $localStorage.userModel = userModel;
    };

    var isUserLoggedIn = function () {
        var userModel = getUserModel();
        return userModel !== undefined && userModel.token !== undefined;
    };
    
    return {
        getUserModel: getUserModel,
        setUserModel: setUserModel,
        isUserLoggedIn: isUserLoggedIn
    };

};

},{}],21:[function(require,module,exports){
module.exports = function (userAccess, eventBus, authenticationEvents, authorization, authorizationEnums, cache) {
    
    var createUserModel = function (userData, token) {
        createUpdateUserModel(userData, token);
    };
    
    var updateUserModel = function (userData) {
        createUpdateUserModel(userData);
    };
    
    var createUpdateUserModel = function (userData, token) {
        
        var userModel = userAccess.getUserModel();
        
        if (userModel === undefined) {
            userModel = {};
        }
        
        // Setup token
        if (token !== undefined) {
            userModel.token = token;
        }
        
        // Setup id
        if (userData.id !== undefined) {
            userModel.id = userData.id;
        }
        
        // Setup username
        if (userData.username !== undefined) {
            userModel.username = userData.username;
        }
        
        // Setup name
        if (userData.name !== undefined) {
            userModel.name = userData.name;
        }
        
        // Setup permissions
        if (userData.roles !== undefined) {
            userModel.permissions = userData.roles;
        }
        
        // Finally update the local storage with the updated user model
        userAccess.setUserModel(userModel);
        
    };

    var getUserModel = function () {
        return userAccess.getUserModel();
    };

    var isUserLoggedIn = function () {
        return userAccess.isUserLoggedIn();
    };
    
    eventBus.subscribe(authenticationEvents.loginCheckSuccess, function (event, eventData) {
        
        // Setup user model after successfull login check
        createUserModel(eventData.responseData, eventData.responseToken);
        
        // Broadcast user has logged in
        eventBus.broadcast(authenticationEvents.userLoggedIn, getUserModel());
        
    });
    
    var getDefaultScreen = function () {
        
        if (isUserLoggedIn()) {
            // Get authorization cache
            var authCache = getAuthorizationsCache();
            console.log(authCache);
            // If user has manager role granted, then go to manager dashboard
            if (authCache.hasRoleManagerGranted === true) {
                return 'root.dashboard';
            }

            return 'root.homepage'
            
        }

        // Else forward to a no access page
        return 'root.access.no_access';
        
    };

    var setAuthorizationCache = function () {
        // Set the cached values
        cache.set('authorizationsCache', {
            'hasRoleManagerGranted': authorization.getAuthorizationLevel(true, {'admin': ['ROLE_MANAGER']}) == authorizationEnums.authorised.authorisedToAdmin
        });
        
    };

    
    var getAuthorizationsCache = function () {
        var authorizationsCache = cache.get('authorizationsCache');
        if (authorizationsCache == undefined) {
            setAuthorizationCache();
            authorizationsCache = cache.get('authorizationsCache');
        }
        return authorizationsCache;
    };
    
    return {
        createUserModel: createUserModel,
        updateUserModel: updateUserModel,
        getUserModel: getUserModel,
        isUserLoggedIn: isUserLoggedIn,
        getDefaultScreen: getDefaultScreen,
        getAuthorizationsCache: getAuthorizationsCache
    };

};

},{}],22:[function(require,module,exports){

// API URLs
var request_format = '.json';
var api_version = '';
var api_base_url = '';
if (window.api_base_url != undefined) {
    api_base_url = window.api_base_url;
}


module.exports = {
        
    "LOGIN_REQUEST": {
        "url": api_base_url + api_version + "/" + "login_request"
    },
    "LOGIN_CHECK": {
        "url": api_base_url + api_version + "/" + "login_check"
    },
    "USER_INDEX": {
        "url": api_base_url + api_version + "/" + "users" + request_format
    },
    "USER_GET": {
        "url": api_base_url + api_version + "/" + "users" + "/" + ":userId" + request_format
    },
    "USER_UPDATE": {
        "url": api_base_url + api_version + "/" + "users" + "/" + ":userId" + request_format
    },
    "USER_CREATE": {
        "url": api_base_url + api_version + "/" + "users" + request_format
    },
    "USER_DELETE": {
        "url": api_base_url + api_version + "/" + "users" + "/" + ":userId" + request_format
    },
    "USER_GET_ALL_ROLES": {
        "url": api_base_url + api_version + "/" + "users" + '/roles' + request_format
    }
        
};

},{}],23:[function(require,module,exports){
module.exports = {
    loginCheckSuccess: 'auth:loginCheck:success',
    userLoggedIn: 'auth:user:loggedIn',
    userLoggedOut: 'auth:user:loggedOut',
    sessionTimedOut: 'auth:user:sessionTimedOut'
};
},{}],24:[function(require,module,exports){
module.exports = {
    authorised: {
        loginRequired: 'loginRequired',
        notAuthorised: 'notAuthorised',
        authorisedToView: 'authorisedToView',
        authorisedToAdmin: 'authorisedToAdmin'
    },
    permissionCheckType: {
        atLeastOneRequired: 'atLeastOneRequired',
        allRequired: 'allRequired'
    }
};
},{}],25:[function(require,module,exports){
'use strict';

angular.module('myApp').constant('authorizationEnums', require('./authorizationEnums'));
angular.module('myApp').value('ajaxInfo', require('./apiEndpoints'));
angular.module('myApp').value('authenticationEvents', require('./authenticationEvents'));

},{"./apiEndpoints":22,"./authenticationEvents":23,"./authorizationEnums":24}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJqcy9hcHAuanMiLCJqcy9jb25maWcvYXV0aEludGVyY2VwdG9yLmpzIiwianMvY29uZmlnL2luZGV4LmpzIiwianMvY29uZmlnL2xvYWRpbmdCYXIuanMiLCJqcy9jb25maWcvbG9jYWxTdG9yYWdlLmpzIiwianMvY29uZmlnL3VybEludGVyY2VwdG9yLmpzIiwianMvY29udHJvbGxlci9hY2Nlc3NDdHJsLmpzIiwianMvY29udHJvbGxlci9oZWFkZXJDdHJsLmpzIiwianMvY29udHJvbGxlci9pbmRleC5qcyIsImpzL2NvbnRyb2xsZXIvdXNlckN0cmwuanMiLCJqcy9yb3V0aW5nL2FjY2Vzcy5qcyIsImpzL3JvdXRpbmcvZGVmYXVsdC5qcyIsImpzL3JvdXRpbmcvaW5kZXguanMiLCJqcy9yb3V0aW5nL3VzZXIuanMiLCJqcy9zZXJ2aWNlL2F1dGhlbnRpY2F0aW9uLmpzIiwianMvc2VydmljZS9hdXRob3JpemF0aW9uLmpzIiwianMvc2VydmljZS9jYWNoZS5qcyIsImpzL3NlcnZpY2UvZXZlbnRCdXMuanMiLCJqcy9zZXJ2aWNlL2luZGV4LmpzIiwianMvc2VydmljZS91c2VyQWNjZXNzLmpzIiwianMvc2VydmljZS91c2VyTWFuYWdlci5qcyIsImpzL3NoYXJlZC9hcGlFbmRwb2ludHMuanMiLCJqcy9zaGFyZWQvYXV0aGVudGljYXRpb25FdmVudHMuanMiLCJqcy9zaGFyZWQvYXV0aG9yaXphdGlvbkVudW1zLmpzIiwianMvc2hhcmVkL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyBCcm93c2VyaWZ5IGVudHJ5IHBvaW50IGZvciB0aGUgYXBwIGJ1bmRsZVxuJ3VzZSBzdHJpY3QnO1xuXG4vLyBJbml0XG5hbmd1bGFyLm1vZHVsZSgnbXlBcHAnLCBbJ3VpLnJvdXRlcicsICdhbmd1bGFyLWxvYWRpbmctYmFyJywgJ25nTWF0ZXJpYWwnICwnbmdBbmltYXRlJywgJ25nU2FuaXRpemUnLCAnbmdNZXNzYWdlcycsICduZ1N0b3JhZ2UnXSk7XG5cbnJlcXVpcmUoJy4vc2hhcmVkJyk7XG5yZXF1aXJlKCcuL2NvbmZpZycpO1xucmVxdWlyZSgnLi9zZXJ2aWNlJyk7XG5yZXF1aXJlKCcuL3JvdXRpbmcnKTtcbnJlcXVpcmUoJy4vY29udHJvbGxlcicpO1xuXG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgkaHR0cFByb3ZpZGVyKSB7XG4gICAgXG4gICAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaChmdW5jdGlvbiAoJHEsICRpbmplY3Rvcikge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmVxdWVzdDogZnVuY3Rpb24gKGNvbmZpZykge1xuICAgICAgICAgICAgICAgIGNvbmZpZy5oZWFkZXJzID0gY29uZmlnLmhlYWRlcnMgfHwge307XG4gICAgICAgICAgICAgICAgdmFyICRsb2NhbFN0b3JhZ2UgPSAkaW5qZWN0b3IuZ2V0KCckbG9jYWxTdG9yYWdlJyk7XG4gICAgICAgICAgICAgICAgaWYgKCRsb2NhbFN0b3JhZ2UuaGFzT3duUHJvcGVydHkoJ3VzZXJNb2RlbCcpKSB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBTZXR1cCB0aGUgYXV0aG9yaXphdGlvbiB0b2tlblxuICAgICAgICAgICAgICAgICAgICBjb25maWcuaGVhZGVycy5BdXRob3JpemF0aW9uID0gJ0JlYXJlciAnICsgJGxvY2FsU3RvcmFnZS51c2VyTW9kZWwudG9rZW47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBjb25maWc7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVzcG9uc2VFcnJvcjogZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgdmFyIGV2ZW50QnVzID0gJGluamVjdG9yLmdldCgnZXZlbnRCdXMnKTtcbiAgICAgICAgICAgICAgICB2YXIgYXV0aGVudGljYXRpb25FdmVudHMgPSAkaW5qZWN0b3IuZ2V0KCdhdXRoZW50aWNhdGlvbkV2ZW50cycpO1xuICAgICAgICAgICAgICAgIHZhciAkc3RhdGUgPSAkaW5qZWN0b3IuZ2V0KCckc3RhdGUnKTtcbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBJZiBnb3QgYSA0MDEgKG5vdCBhdXRob3JpemVkKSBmcm9tIHRoZSBzZXJ2ZXIsIGFuZCBub3QgYWxyZWFkeSBpbiB0aGUgbG9naW4gcGFnZSwgZm9yd2FyZCB0byBpdFxuICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwMSAmJiAhJHN0YXRlLmlzKCdyb290LmFjY2Vzcy5sb2dpbicpKSB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAvLyBCcm9hZGNhc3QgdXNlcidzIHNlc3Npb24gaGFzIHRpbWVkIG91dFxuICAgICAgICAgICAgICAgICAgICBldmVudEJ1cy5icm9hZGNhc3QoYXV0aGVudGljYXRpb25FdmVudHMuc2Vzc2lvblRpbWVkT3V0KTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIFRoZW4gdHJpZ2dlciBhIHN0YXRlIGNoYW5nZSBzdGFydCBldmVudCBzbyB0aGUgdXNlciB3aWxsIGdldCBpbnRvIHRoZSBsb2dpbiBwYWdlIGFuZCB0aGVuIGJhY2sgdG8gd2hlcmUgaXQgd2FzIGJlZm9yZVxuICAgICAgICAgICAgICAgICAgICAvLyAoZ2V0IHJlZGlyZWN0ZWQgYmFjayB0byBlaXRoZXIgd2VyZSBoZS9zaGUgd2FzIHdoZW4gZ290IHRoZSA0MDEgZm9yIGFuIGFqYXggY2FsbClcbiAgICAgICAgICAgICAgICAgICAgJHN0YXRlLnJlbG9hZCgpO1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgLy8gSWYgZ290IGEgNDAzIChmb3JiaWRkZW4pIGZvcndhcmQgdGhlIHVzZXIgdG8gaXQncyBkZWZhdWx0IHNjcmVlbiBhbmQgc2hvdyBhIG5vdGlmaWNhdGlvblxuICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQwMykge1xuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgLy8gU2VuZCB0byBkZWZhdWx0IHNjcmVlblxuICAgICAgICAgICAgICAgICAgICB2YXIgdXNlck1hbmFnZXIgPSAkaW5qZWN0b3IuZ2V0KCd1c2VyTWFuYWdlcicpO1xuICAgICAgICAgICAgICAgICAgICAkc3RhdGUuZ28odXNlck1hbmFnZXIuZ2V0RGVmYXVsdFNjcmVlbigpKTtcbiAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgIC8vIFNob3cgYSB0b2FzdCBub3RpZmljYXRpb25cbiAgICAgICAgICAgICAgICAgICAgdmFyICRtZFRvYXN0ID0gJGluamVjdG9yLmdldCgnJG1kVG9hc3QnKTtcbiAgICAgICAgICAgICAgICAgICAgJG1kVG9hc3Quc2hvdyhcbiAgICAgICAgICAgICAgICAgICAgICAgICRtZFRvYXN0LnNpbXBsZSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnRleHRDb250ZW50KCdZb3UgZG9uXFwndCBoYXZlIHBlcm1pc3Npb25zIHRvIGRvIHRoYXQgYWN0aW9uLiBZb3UgY2FuIGNvbnRhY3QgYW4gYWRtaW4gdXNlciB0byBhZGp1c3QgeW91ciBleGVjdXRpdmUgYWNjZXNzIHNldHRpbmdzLicpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLnBvc2l0aW9uKCd0b3AgbGVmdCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmhpZGVEZWxheSgxNTAwMClcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAvLyBSZWplY3QgdGhlIHByb21pc2VcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcbiAgICBcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmFuZ3VsYXIubW9kdWxlKCdteUFwcCcpLmNvbmZpZyhbJ2NmcExvYWRpbmdCYXJQcm92aWRlcicsIHJlcXVpcmUoJy4vbG9hZGluZ0JhcicpXSk7XG5hbmd1bGFyLm1vZHVsZSgnbXlBcHAnKS5jb25maWcoWyckaHR0cFByb3ZpZGVyJywgcmVxdWlyZSgnLi9hdXRoSW50ZXJjZXB0b3InKV0pO1xuYW5ndWxhci5tb2R1bGUoJ215QXBwJykucnVuKFsnJHJvb3RTY29wZScsICckc3RhdGUnLCAnYXV0aG9yaXphdGlvbicsICd1c2VyTWFuYWdlcicsICdldmVudEJ1cycsICdhdXRoZW50aWNhdGlvbkV2ZW50cycsICdhdXRob3JpemF0aW9uRW51bXMnLCAnJG1kVG9hc3QnLCAnY2FjaGUnLCByZXF1aXJlKCcuL3VybEludGVyY2VwdG9yJyldKTtcbmFuZ3VsYXIubW9kdWxlKCdteUFwcCcpLnJ1bihbJ2V2ZW50QnVzJywgJyRsb2NhbFN0b3JhZ2UnLCAnJGNhY2hlRmFjdG9yeScsICdhdXRoZW50aWNhdGlvbkV2ZW50cycsIHJlcXVpcmUoJy4vbG9jYWxTdG9yYWdlJyldKTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChjZnBMb2FkaW5nQmFyUHJvdmlkZXIpIHtcbiAgICBjZnBMb2FkaW5nQmFyUHJvdmlkZXIuaW5jbHVkZVNwaW5uZXIgPSBmYWxzZTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChldmVudEJ1cywgJGxvY2FsU3RvcmFnZSwgJGNhY2hlRmFjdG9yeSwgYXV0aGVudGljYXRpb25FdmVudHMpIHtcblxuICAgIHZhciBjbGVhckFsbExvY2FsU3RvcmFnZUFuZENhY2hlID0gZnVuY3Rpb24gKGNsZWFyTG9nZ2VkSW5JbmZvKSB7XG4gICAgICAgIFxuICAgICAgICBpZiAoY2xlYXJMb2dnZWRJbkluZm8gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY2xlYXJMb2dnZWRJbkluZm8gPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBDbGVhbiB0aGUgbG9jYWwgc3RvcmFnZSAoJHJlc2V0IGZ1bmN0aW9uIGlzIG5vdCB3b3JraW5nIGFzIGV4cGVjdGVkKVxuICAgICAgICBmb3IgKHZhciBrIGluICRsb2NhbFN0b3JhZ2UpIHtcbiAgICAgICAgICAgIGlmICgnJCcgIT09IGtbMF0pIHtcbiAgICAgICAgICAgICAgICAvLyBEbyBub3QgZGVsZXRlIGEgZmV3IGtleXMgdW5sZXNzIGNsZWFyaW5nIGFsbCBpbmZvIChjbGVhckxvZ2dlZEluSW5mbyBzZXQgdG8gdHJ1ZSlcbiAgICAgICAgICAgICAgICB2YXIgb21pdEtleXMgPSBbJ3VzZXJNb2RlbCddO1xuICAgICAgICAgICAgICAgIGlmIChjbGVhckxvZ2dlZEluSW5mbyB8fCAob21pdEtleXMuaW5kZXhPZihrKSA9PSAtMSkpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlICRsb2NhbFN0b3JhZ2Vba107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBDbGVhbiB0aGUgaHR0cCBjYWNoZVxuICAgICAgICAkY2FjaGVGYWN0b3J5LmdldCgnJGh0dHAnKS5yZW1vdmVBbGwoKTtcbiAgICB9O1xuXG4gICAgLy8gQ2xlYXIgYm90aCBsb2NhbFN0b3JhZ2UgYW5kIGh0dHAgY2FjaGUgd2hlbiBhIHVzZXIgbG9ncyBpbiBcbiAgICBldmVudEJ1cy5zdWJzY3JpYmUoYXV0aGVudGljYXRpb25FdmVudHMudXNlckxvZ2dlZEluLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNsZWFyQWxsTG9jYWxTdG9yYWdlQW5kQ2FjaGUoZmFsc2UpO1xuICAgIH0pO1xuXG4gICAgLy8gQ2xlYXIgYm90aCBsb2NhbFN0b3JhZ2UgYW5kIGh0dHAgY2FjaGUgd2hlbiBhIHVzZXIgbG9ncyBvdXQgb3IgaXQncyBzZXNzaW9uIHRpbWUgc291dFxuICAgIGV2ZW50QnVzLnN1YnNjcmliZShhdXRoZW50aWNhdGlvbkV2ZW50cy51c2VyTG9nZ2VkT3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNsZWFyQWxsTG9jYWxTdG9yYWdlQW5kQ2FjaGUoKTtcbiAgICB9KTtcbiAgICBldmVudEJ1cy5zdWJzY3JpYmUoYXV0aGVudGljYXRpb25FdmVudHMuc2Vzc2lvblRpbWVkT3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNsZWFyQWxsTG9jYWxTdG9yYWdlQW5kQ2FjaGUoKTtcbiAgICB9KTtcbiAgICBcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigkcm9vdFNjb3BlLCAkc3RhdGUsIGF1dGhvcml6YXRpb24sIHVzZXJNYW5hZ2VyLCBldmVudEJ1cywgYXV0aGVudGljYXRpb25FdmVudHMsIGF1dGhvcml6YXRpb25FbnVtcywgJG1kVG9hc3QsIGNhY2hlKSB7XG4gICAgXG4gICAgdmFyIHN0YXRlQ2hhbmdlUmVxdWlyZWRBZnRlckxvZ2luID0gZmFsc2U7XG4gICAgdmFyIGxvZ2luUmVkaXJlY3RVcmw7XG4gICAgXG4gICAgJHJvb3RTY29wZS4kb24oJyRzdGF0ZUNoYW5nZVN0YXJ0JywgZnVuY3Rpb24oZXZlbnQsIG5leHQpIHtcbiAgICAgICAgYXNzZXNzQXV0aG9yaXphdGlvblRvQWNjZXNzU3RhdGUoZXZlbnQsIG5leHQpO1xuICAgIH0pO1xuICAgIFxuICAgIHZhciBhc3Nlc3NBdXRob3JpemF0aW9uVG9BY2Nlc3NTdGF0ZSA9IGZ1bmN0aW9uIChldmVudCwgbmV4dCkge1xuICAgICAgICBcbiAgICAgICAgdmFyIGF1dGhvcml6YXRpb25SZXN1bHQ7XG4gICAgICAgIFxuICAgICAgICAvLyBJZiBuZXh0IHN0YXRlIGhhcyBhY2Nlc3MgZGF0YSB0aGVuIGdldCB0aGUgYXV0aG9yaXNlZCBsZXZlbCByZXN1bHQuIEVsc2UgZ2V0IHRoZSBkZWZhdWx0IG9uZVxuICAgICAgICBpZiAobmV4dC5hY2Nlc3MpIHtcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25SZXN1bHQgPSBhdXRob3JpemF0aW9uLmdldEF1dGhvcml6YXRpb25MZXZlbChuZXh0LmFjY2Vzcy5sb2dpblJlcXVpcmVkLCBuZXh0LmFjY2Vzcy5wZXJtaXNzaW9ucywgbmV4dC5hY2Nlc3MucGVybWlzc2lvbkNoZWNrVHlwZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhdXRob3JpemF0aW9uUmVzdWx0ID0gYXV0aG9yaXphdGlvbi5nZXRBdXRob3JpemF0aW9uTGV2ZWwoKTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gQ2FjaGUgdGhlIGN1cnJlbnQgc3RhdGUgYXV0aG9yaXphdGlvbiBsZXZlbFxuICAgICAgICBjYWNoZS5zZXQoJ2N1cnJlbnRTdGF0ZUF1dGhMZXZlbCcsIGF1dGhvcml6YXRpb25SZXN1bHQpO1xuICAgICAgICBcbiAgICAgICAgLy8gRm9yd2FyZCB0byBsb2dpbiBwYWdlIGlmIGxvZ2luIGlzIHJlcXVpcmVkXG4gICAgICAgIGlmIChhdXRob3JpemF0aW9uUmVzdWx0ID09PSBhdXRob3JpemF0aW9uRW51bXMuYXV0aG9yaXNlZC5sb2dpblJlcXVpcmVkKSB7XG4gICAgICAgICAgICBzdGF0ZUNoYW5nZVJlcXVpcmVkQWZ0ZXJMb2dpbiA9IHRydWU7XG4gICAgICAgICAgICBsb2dpblJlZGlyZWN0VXJsID0gbmV4dC5uYW1lO1xuICAgICAgICAgICAgJHN0YXRlLmdvKCdyb290LmFjY2Vzcy5sb2dpbicpO1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIFxuICAgICAgICAvLyBGb3J3YXJkIHRvIGN1c3RvbWVyIGRhc2hib2FyZCBwYWdlIGlmIHVzZXIgaXMgbG9nZ2VkIGluIGJ1dCB3aXRoIGluc3VmZmljaWVudCBwZXJtaXNzaW9ucyBmb3IgdGhlIHJlcXVlc3RlZCBwYWdlXG4gICAgICAgIH0gZWxzZSBpZiAoYXV0aG9yaXphdGlvblJlc3VsdCA9PT0gYXV0aG9yaXphdGlvbkVudW1zLmF1dGhvcmlzZWQubm90QXV0aG9yaXNlZCkge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBGb3J3YXJkIHRvIGRlZmF1bHQgcGFnZVxuICAgICAgICAgICAgJHN0YXRlLmdvKHVzZXJNYW5hZ2VyLmdldERlZmF1bHRTY3JlZW4oKSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIC8vIFNob3cgYSB0b2FzdCBub3RpZmljYXRpb25cbiAgICAgICAgICAgICRtZFRvYXN0LnNob3coXG4gICAgICAgICAgICAgICAgJG1kVG9hc3Quc2ltcGxlKClcbiAgICAgICAgICAgICAgICAgICAgLnRleHRDb250ZW50KCdZb3UgZG9uXFwndCBoYXZlIHBlcm1pc3Npb25zIHRvIHZpZXcgdGhpcyBwYWdlLiBZb3UgY2FuIGNvbnRhY3QgYW4gYWRtaW4gdXNlciB0byBhZGp1c3QgeW91ciBleGVjdXRpdmUgYWNjZXNzIHNldHRpbmdzLicpXG4gICAgICAgICAgICAgICAgICAgIC5wb3NpdGlvbigndG9wIGxlZnQnKVxuICAgICAgICAgICAgICAgICAgICAuaGlkZURlbGF5KDE1MDAwKVxuICAgICAgICAgICAgKTtcbiAgICBcbiAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICBcbiAgICAgICAgLy8gVXNlciBpcyBhdXRob3JpemVkIHRvIHZpZXcgb3IgdG8gYWRtaW4gdGhlIHBhZ2Uvc3RhdGVcbiAgICAgICAgfSBlbHNlIGlmIChcbiAgICAgICAgICAgICAgICBhdXRob3JpemF0aW9uUmVzdWx0ID09PSBhdXRob3JpemF0aW9uRW51bXMuYXV0aG9yaXNlZC5hdXRob3Jpc2VkVG9WaWV3IHx8XG4gICAgICAgICAgICAgICAgYXV0aG9yaXphdGlvblJlc3VsdCA9PT0gYXV0aG9yaXphdGlvbkVudW1zLmF1dGhvcmlzZWQuYXV0aG9yaXNlZFRvQWRtaW5cbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gRm9yd2FyZCB0byBwcmV2aW91c2x5IHJlcXVlc3RlZCBwYWdlIG9ubHkgaWYgYWxyZWFkeSBsb2dnZWQgaW5cbiAgICAgICAgICAgIGlmICh1c2VyTWFuYWdlci5pc1VzZXJMb2dnZWRJbigpICYmIHN0YXRlQ2hhbmdlUmVxdWlyZWRBZnRlckxvZ2luKSB7XG4gICAgICAgICAgICAgICAgc3RhdGVDaGFuZ2VSZXF1aXJlZEFmdGVyTG9naW4gPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAvLyBQYXNzIGFzIHBhcmFtZXRlciBpZiBpdCBoYXMgYmVlbiBhdXRob3JpemVkIHRvIGFkbWluIHRoZSBwYWdlL3N0YXRlXG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKGxvZ2luUmVkaXJlY3RVcmwpO1xuICAgICAgICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIGV2ZW50QnVzLnN1YnNjcmliZShhdXRoZW50aWNhdGlvbkV2ZW50cy51c2VyTG9nZ2VkT3V0LCBmdW5jdGlvbihldmVudCwgZXZlbnREYXRhKSB7XG4gICAgICAgIHZhciByZWRpcmVjdCA9IGV2ZW50RGF0YS5yZWRpcmVjdFRvTG9naW4gIT0gdW5kZWZpbmVkID8gZXZlbnREYXRhLnJlZGlyZWN0VG9Mb2dpbiA6IHRydWU7XG4gICAgICAgIGlmKHJlZGlyZWN0KSB7XG4gICAgICAgICAgICAkc3RhdGUuZ28oJ3Jvb3QuYWNjZXNzLmxvZ2luJyk7XG4gICAgICAgIH1cbiAgICB9KTtcbn07XG5cblxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoJHNjb3BlLCAkc3RhdGUsIGF1dGhlbnRpY2F0aW9uKSB7XG5cbiAgICAkc2NvcGUubG9naW5Nb2RlbCA9IHt9O1xuICAgICRzY29wZS5pc0J1c3kgPSBmYWxzZTtcblxuICAgICRzY29wZS5pbml0ID0gZnVuY3Rpb24gKCkge1xuXG4gICAgfTtcbiAgICBcbiAgICAkc2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VTdWNjZXNzJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBzd2l0Y2ggKCRzdGF0ZS5jdXJyZW50Lm5hbWUpIHtcbiAgICAgICAgICAgIGNhc2UgJ3Jvb3QuYWNjZXNzLmxvZ2luJzpcbiAgICAgICAgICAgICAgICAkc2NvcGUuaW5pdEFjY2Vzc0xvZ2luKCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdyb290LmFjY2Vzcy5sb2dvdXQnOlxuICAgICAgICAgICAgICAgICRzY29wZS5sb2dvdXQoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgICRzY29wZS5pbml0QWNjZXNzTG9naW4gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaWYgKCRzY29wZS5sb2dpbk1vZGVsLl9jc3JmX3Rva2VuID09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgYXV0aGVudGljYXRpb24ucmVxdWVzdExvZ2luQ1NSRlRva2VuKCkudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICRzY29wZS5sb2dpbk1vZGVsLl9jc3JmX3Rva2VuID0gcmVzcG9uc2UuY3NyZl90b2tlbjtcbiAgICAgICAgICAgIH0sIGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICAkc2NvcGUuZ2xvYmFsRXJyb3IgPSAnT29wcyEgT3VyIGxvZyBpbiBzeXN0ZW0gaXMgaGF2aW5nIHNvbWUgdGVjaG5pY2FsIGRpZmZpY3VsdGllcyByaWdodCBub3cuJztcbiAgICAgICAgICAgIH0pWydmaW5hbGx5J10oZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgJHNjb3BlLmlzQnVzeSA9IGZhbHNlO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgICRzY29wZS5sb2dpbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgXG4gICAgICAgICRzY29wZS5nbG9iYWxFcnJvciA9IG51bGw7XG4gICAgICAgICRzY29wZS5pc0J1c3kgPSB0cnVlO1xuICAgICAgICBcbiAgICAgICAgYXV0aGVudGljYXRpb24ubG9naW4oJHNjb3BlLmxvZ2luTW9kZWwpLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAkc3RhdGUuZ28oJ3Jvb3QuaG9tZXBhZ2UnLCB7fSwge3JlbG9hZDogdHJ1ZX0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgJHNjb3BlLmdsb2JhbEVycm9yID0gJ09vcHMhIEl0IGFwcGVhcnMgdGhhdCBlaXRoZXIgeW91ciB1c2VybmFtZSBvciBwYXNzd29yZCBpcyBpbmNvcnJlY3QuJztcbiAgICAgICAgfSlbJ2ZpbmFsbHknXShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkc2NvcGUuaXNCdXN5ID0gZmFsc2U7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAkc2NvcGUubG9nb3V0ID0gZnVuY3Rpb24oKXtcbiAgICAgICAgYXV0aGVudGljYXRpb24ubG9nb3V0KCk7XG4gICAgfTsgIFxuXG4gICAgJHNjb3BlLmluaXQoKTtcblxufTtcbiIsIlxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoJHNjb3BlLCAkc3RhdGUsIGV2ZW50QnVzLCBhdXRoZW50aWNhdGlvbiwgYXV0aGVudGljYXRpb25FdmVudHMsIGF1dGhvcml6YXRpb24sIGF1dGhvcml6YXRpb25FbnVtcywgdXNlck1hbmFnZXIsIHZpZXdFZGl0TW9kZSkge1xuICAgIFxuICAgIHZhciBtZW51c1RvU2hvdyA9IFtdO1xuXG4gICAgJHNjb3BlLmluaXQgPSBmdW5jdGlvbiAoKSB7XG5cbiAgICAgICAgJHNjb3BlLmxvZ291dCA9IGF1dGhlbnRpY2F0aW9uLmxvZ291dDtcbiAgICAgICAgXG5cbiAgICAgICAgJHNjb3BlLmxvZ1NlbGVjdFZhbHVlID0gJyc7XG4gICAgICAgICRzY29wZS5sb2dnZWRJblVzZXJOYW1lO1xuICAgICAgICBcbiAgICAgICAgaWYgKHVzZXJNYW5hZ2VyLmlzVXNlckxvZ2dlZEluKCkpIHtcbiAgICAgICAgICAgIHNldExvZ2dlZEluRGF0YSgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgICRzY29wZS4kb24oJyRkZXN0cm95JywgZXZlbnRCdXMuc3Vic2NyaWJlKGF1dGhlbnRpY2F0aW9uRXZlbnRzLnVzZXJMb2dnZWRJbiwgZnVuY3Rpb24gKCkge1xuXG4gICAgICAgIC8vIFdoZW4gdGhlIHVzZXIgbG9ncyBpblxuICAgICAgICBzZXRMb2dnZWRJbkRhdGEoKTtcbiAgICAgICAgXG4gICAgfSkpO1xuXG4gICAgdmFyIHNldHVwTWVudXNUb1Nob3cgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIFxuICAgICAgICB1bnNldE1lbnVzVG9TaG93KCk7XG4gICAgICAgIFxuICAgICAgICB2YXIgbWVudUNhbmRpZGF0ZXMgPSBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2FkbWluJyxcbiAgICAgICAgICAgICAgICBsb2dpblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIHBlcm1pc3Npb25zOiBbJ1JPTEVfTUFOQUdFUiddXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdvcHBvcnR1bml0aWVzX3ZpZXdlcicsXG4gICAgICAgICAgICAgICAgbG9naW5SZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBwZXJtaXNzaW9uczogWyduZXRfd29ydGhfdmlldycsICdlc3RhdGVfcGxhbl92aWV3JywgJ3RheF9wbGFuX3ZpZXcnLCAncmlza19tYW5hZ2VtZW50X3ZpZXcnLCAnY2hhcml0YWJsZV9wbGFuX3ZpZXcnXVxuICAgICAgICAgICAgfVxuICAgICAgICBdO1xuICAgICAgICB2YXIgbWVudUNhbmRpZGF0ZTtcbiAgICAgICAgdmFyIGF1dGhMZXZlbDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgbWVudUNhbmRpZGF0ZXMubGVuZ3RoIDsgaSsrKSB7XG4gICAgICAgICAgICBtZW51Q2FuZGlkYXRlID0gbWVudUNhbmRpZGF0ZXNbaV07XG4gICAgICAgICAgICBhdXRoTGV2ZWwgPSBhdXRob3JpemF0aW9uLmdldEF1dGhvcml6YXRpb25MZXZlbChtZW51Q2FuZGlkYXRlLmxvZ2luUmVxdWlyZWQsIG1lbnVDYW5kaWRhdGUucGVybWlzc2lvbnMsIGF1dGhvcml6YXRpb25FbnVtcy5wZXJtaXNzaW9uQ2hlY2tUeXBlLmF0TGVhc3RPbmVSZXF1aXJlZCk7XG4gICAgICAgICAgICBpZiAoYXV0aExldmVsID09IGF1dGhvcml6YXRpb25FbnVtcy5hdXRob3Jpc2VkLmF1dGhvcmlzZWRUb1ZpZXcgfHwgYXV0aExldmVsID09IGF1dGhvcml6YXRpb25FbnVtcy5hdXRob3Jpc2VkLmF1dGhvcmlzZWRUb0FkbWluKSB7XG4gICAgICAgICAgICAgICAgbWVudXNUb1Nob3cucHVzaChtZW51Q2FuZGlkYXRlLm5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBcbiAgICB9O1xuICAgIFxuICAgIHZhciB1bnNldE1lbnVzVG9TaG93ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBtZW51c1RvU2hvdyA9IFtdO1xuICAgIH07XG5cbiAgICB2YXIgc2V0TG9nZ2VkSW5EYXRhID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIFxuICAgICAgICAvLyBTZXR1cCBsb2dnZWQgaW4gdXNlcidzIG5hbWVcbiAgICAgICAgJHNjb3BlLmxvZ2dlZEluVXNlck5hbWUgPSB1c2VyTWFuYWdlci5nZXRVc2VyTW9kZWwoKS5uYW1lO1xuXG4gICAgICAgIC8vIFNldCBtZW51cyB0byBzaG93XG4gICAgICAgIHNldHVwTWVudXNUb1Nob3coKTtcbiAgICAgICAgXG4gICAgICAgICRzY29wZS5pc1VzZXJMb2dnZWRJbiA9IHRydWU7XG4gICAgICAgIFxuICAgIH07XG5cbiAgICB2YXIgc2V0TG9nZ2VkT3V0RGF0YSA9IGZ1bmN0aW9uICgpIHtcblxuICAgICAgICAvLyBXaGVuIHRoZSB1c2VyIGxvZ3Mgb3V0Li4uXG5cbiAgICAgICAgLy8gVW5zZXQgbG9nZ2VkIGluIHVzZXIncyBuYW1lXG4gICAgICAgICRzY29wZS5sb2dnZWRJblVzZXJOYW1lID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIC8vIFVuZXQgbWVudXMgdG8gc2hvd1xuICAgICAgICB1bnNldE1lbnVzVG9TaG93KCk7XG4gICAgICAgIFxuICAgICAgICAkc2NvcGUuaXNVc2VyTG9nZ2VkSW4gPSBmYWxzZTtcblxuICAgIH07XG4gICAgJHNjb3BlLiRvbignJGRlc3Ryb3knLCBldmVudEJ1cy5zdWJzY3JpYmUoYXV0aGVudGljYXRpb25FdmVudHMudXNlckxvZ2dlZE91dCwgc2V0TG9nZ2VkT3V0RGF0YSkpO1xuICAgICRzY29wZS4kb24oJyRkZXN0cm95JywgZXZlbnRCdXMuc3Vic2NyaWJlKGF1dGhlbnRpY2F0aW9uRXZlbnRzLnNlc3Npb25UaW1lZE91dCwgc2V0TG9nZ2VkT3V0RGF0YSkpO1xuXG4gICAgJHNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgJHNjb3BlLmFjdGl2ZV90YWIgPSAkc3RhdGUuY3VycmVudC5hY3RpdmVUYWI7XG4gICAgfSk7XG4gICAgXG4gICAgLypcbiAgICAgKiBJZiB3ZSBhcmUgb24gYSBjdXN0b21lciBkYXNoYm9hcmQgc2NyZWVuIHNpbXBseSBicm9hZGNhc3QgYSB0YWJTZWxlY3RlZCBldmVudFxuICAgICAqIGVsc2UgbG9hZCB0aGUgZGVzaXJlZCBjdXN0b21lciBkYXNoYm9hcmQgd2l0aCBhIHJlZ3VsYXIgc3RhdGUuZ29cbiAgICAgKiBAcGFyYW0gc3RyaW5nIHBpbGxhck5hbWVJZFxuICAgICAqIEByZXR1cm5zIG5vbmVcbiAgICAgKi9cbiAgICAkc2NvcGUuaHJlZkN1c3RvbWVyRGFzaGJvYXJkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoJHN0YXRlLmN1cnJlbnQubmFtZS5pbmRleE9mKCdyb290LmN1c3RvbWVyX2Rhc2hib2FyZCcpID4gLTEpIHtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgLy8gQnJvYWRjYXN0IHRvIHRoZSBjdXN0b21lciBkYXNoYm9hcmQgY29udHJvbGxlciBhIFwidGFiU2VsZWN0ZWRcIiBldmVudFxuICAgICAgICAgICAgZXZlbnRCdXMuYnJvYWRjYXN0KCdjdXN0b21lcl9kYXNoYm9hcmQudGFiU2VsZWN0ZWQnKTtcbiAgICAgICAgICAgIFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBSZWd1bGFyIHN0YXRlIGNoYW5nZVxuICAgICAgICAgICAgJHN0YXRlLmdvKCdyb290LmN1c3RvbWVyX2Rhc2hib2FyZCcpO1xuICAgICAgICAgICAgXG4gICAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgICRzY29wZS5zaG91bGRTaG93TWVudSA9IGZ1bmN0aW9uKG1lbnVOYW1lKSB7XG4gICAgICAgIGlmIChtZW51TmFtZSA9PSAnYWRtaW4nKSB7XG4gICAgICAgICAgICByZXR1cm4gIG1lbnVzVG9TaG93LmluZGV4T2YobWVudU5hbWUpICE9IC0xO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIG1lbnVzVG9TaG93LmluZGV4T2YobWVudU5hbWUpICE9IC0xO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBcbiAgICAvLyBJbml0aWFsaXplIGNvbnRyb2xsZXJcbiAgICAkc2NvcGUuaW5pdCgpO1xuICAgIFxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuYW5ndWxhci5tb2R1bGUoJ215QXBwJykuY29udHJvbGxlcignQWNjZXNzQ3RybCcsIFsnJHNjb3BlJywgJyRzdGF0ZScsICdhdXRoZW50aWNhdGlvbicsIHJlcXVpcmUoJy4vYWNjZXNzQ3RybCcpXSk7XG5hbmd1bGFyLm1vZHVsZSgnbXlBcHAnKS5jb250cm9sbGVyKCdIZWFkZXJDdHJsJywgWyckc2NvcGUnLCAnJHN0YXRlJywgJ2V2ZW50QnVzJywgJ2F1dGhlbnRpY2F0aW9uJywgJ2F1dGhlbnRpY2F0aW9uRXZlbnRzJywgJ2F1dGhvcml6YXRpb24nLCAnYXV0aG9yaXphdGlvbkVudW1zJywgJ3VzZXJNYW5hZ2VyJywgcmVxdWlyZSgnLi9oZWFkZXJDdHJsJyldKTtcbmFuZ3VsYXIubW9kdWxlKCdteUFwcCcpLmNvbnRyb2xsZXIoJ1VzZXJDdHJsJywgWyckc2NvcGUnLCAnJGh0dHAnLCAnJHN0YXRlJywgJyRzdGF0ZVBhcmFtcycsICdhamF4SW5mbycsICckbG9jYWxTdG9yYWdlJywgJyRxJywgJ2V2ZW50QnVzJywgcmVxdWlyZSgnLi91c2VyQ3RybCcpXSk7IiwiXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgkc2NvcGUsICRodHRwLCAkc3RhdGUsICRzdGF0ZVBhcmFtcywgYWpheEluZm8sICRsb2NhbFN0b3JhZ2UsICRxLCBldmVudEJ1cykge1xuICAgIFxuICAgICRzY29wZS5pbml0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAkc2NvcGUudXNlcnMgPSB7fTtcbiAgICAgICAgJHNjb3BlLnVzZXIgPSB7fTtcbiAgICB9O1xuICAgIFxuICAgIHZhciBpbml0TmdTdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc3dpdGNoICgkc3RhdGUuY3VycmVudC5uYW1lKSB7XG4gICAgICAgICAgICBjYXNlICdyb290LnVzZXIuaW5kZXgnOlxuICAgICAgICAgICAgICAgICRzY29wZS5pbml0VXNlckluZGV4KCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdyb290LnVzZXIuc2hvdyc6XG4gICAgICAgICAgICAgICAgJHNjb3BlLmluaXRVc2VyU2hvdygkc3RhdGVQYXJhbXMudXNlcklkKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3Jvb3QudXNlci5lZGl0JzpcbiAgICAgICAgICAgICAgICAkc2NvcGUuaW5pdFVzZXJTaG93KCRzdGF0ZVBhcmFtcy51c2VySWQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgICRzY29wZS4kb24oJyRkZXN0cm95JywgZXZlbnRCdXMuc3Vic2NyaWJlKCdtb2RlbEVudGl0eTpwZXJzcGVjdGl2ZTpzd2l0Y2gnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGluaXROZ1N0YXRlKCk7XG4gICAgfSkpO1xuXG4gICAgJHNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3VjY2VzcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaW5pdE5nU3RhdGUoKTtcbiAgICB9KTtcblxuICAgICRzY29wZS5pbml0VXNlckluZGV4ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBzZXR1cFVzZXJzSW5kZXhGcm9tQmFja0VuZCgpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHNjb3BlLnVzZXJzID0gJGxvY2FsU3RvcmFnZS51c2VycztcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgICRzY29wZS5pbml0VXNlclNob3cgPSBmdW5jdGlvbiAodXNlcklkKSB7XG4gICAgICAgIC8vIFJldHJpZXZlIHVzZXIgZnJvbSBiYWNrZW5kXG4gICAgICAgICRzY29wZS5lcnJvcnMgPSBuZXcgQXJyYXkoKTtcbiAgICAgICAgJHNjb3BlLnNldHVwVXNlcih1c2VySWQpO1xuXG4gICAgfTtcblxuICAgICRzY29wZS5zZXR1cFVzZXIgPSBmdW5jdGlvbiAodXNlcklkKSB7XG4gICAgICAgIHZhciBkZWZlciA9ICRxLmRlZmVyKCk7XG4gICAgICAgIHZhciBiYWNrRW5kUHJvbWlzZSA9ICRodHRwLmdldChhamF4SW5mby5VU0VSX0dFVC51cmwucmVwbGFjZSgnOnVzZXJJZCcsIHVzZXJJZCkpO1xuICAgICAgICBiYWNrRW5kUHJvbWlzZS5zdWNjZXNzKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICAkc2NvcGUudXNlciA9IGRhdGFcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBiYWNrRW5kUHJvbWlzZTtcbiAgICB9O1xuICAgIFxuICAgICRzY29wZS5kZWxldGVVc2VyID0gZnVuY3Rpb24gKHVzZXJJZCkge1xuICAgICAgICAkaHR0cC5kZWxldGUoYWpheEluZm8uVVNFUl9ERUxFVEUudXJsLnJlcGxhY2UoJzp1c2VySWQnLCB1c2VySWQpKS5zdWNjZXNzKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgICAgICBkZWxldGUgJGxvY2FsU3RvcmFnZS51c2Vyc1t1c2VySWRdO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgJHNjb3BlLmNyZWF0ZVVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBzdWNjZXNzQ2FsbGJhY2sgPSBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICRzdGF0ZS5nbygncm9vdC51c2VyLmVkaXQnLCB7IHVzZXJJZDogcmVzcG9uc2UuZGF0YS5pZH0pO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgZXJyb3JDYWxsYmFjayA9IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgJHNjb3BlLmVycm9ycyA9IHJlc3BvbnNlLmRhdGEuZXJyb3JzO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgcGFyYW1ldGVycyA9IHtcbiAgICAgICAgICAgICd1c2VyJzogJHNjb3BlLnVzZXJcbiAgICAgICAgfTtcbiAgICAgICAgJGh0dHAucG9zdChhamF4SW5mby5VU0VSX0NSRUFURS51cmwsIHBhcmFtZXRlcnMpLnRoZW4oc3VjY2Vzc0NhbGxiYWNrLCBlcnJvckNhbGxiYWNrKTtcbiAgICB9O1xuXG4gICAgJHNjb3BlLnVwZGF0ZVVzZXJGaWVsZCA9IGZ1bmN0aW9uIChmaWVsZE5hbWUpIHtcbiAgICAgICAgdmFyIGVudGl0eVR5cGVOYW1lID0gJ3VzZXInO1xuICAgICAgICB2YXIgZm9ybU5hbWUgPSAndXNlckZvcm0nO1xuICAgICAgICBcbiAgICAgICAgLy9pZiBpdHMgbm90IHZhbGlkIG9yIGhhcyBub3QgYmVlbiBjaGFuZ2VkXG4gICAgICAgIGlmKCEkc2NvcGVbZm9ybU5hbWVdW2ZpZWxkTmFtZV0uJHZhbGlkIHx8ICRzY29wZVtmb3JtTmFtZV1bZmllbGROYW1lXS4kcHJpc3RpbmUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgdmFyIGVudGl0eSA9IHt9O1xuICAgICAgICBcbiAgICAgICAgZW50aXR5W2ZpZWxkTmFtZV0gPSAkc2NvcGVbZm9ybU5hbWVdW2ZpZWxkTmFtZV0uJG1vZGVsVmFsdWU7XG4gICAgICAgIHZhciBwYXJhbWV0ZXJzID0ge307XG4gICAgICAgIHBhcmFtZXRlcnNbZW50aXR5VHlwZU5hbWVdID0gZW50aXR5O1xuICAgICAgICB2YXIgc3VjY2Vzc0NhbGxiYWNrID0gZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAkc2NvcGVbZm9ybU5hbWVdW2ZpZWxkTmFtZV0uJHByaXN0aW5lID0gdHJ1ZTtcbiAgICAgICAgICAgICRzY29wZVtmb3JtTmFtZV1bZmllbGROYW1lXS4kZGlydHkgPSB0cnVlO1xuICAgICAgICB9O1xuICAgICAgICB2YXIgZXJyb3JDYWxsYmFjayA9IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgJHNjb3BlLmVycm9ycyA9IHJlc3BvbnNlLmVycm9ycztcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuICRodHRwLnB1dChhamF4SW5mby5VU0VSX1VQREFURS51cmwucmVwbGFjZSgnOnVzZXJJZCcsICRzY29wZS51c2VyLmlkKSwgcGFyYW1ldGVycylcbiAgICAgICAgICAgICAgICAuc3VjY2VzcyhzdWNjZXNzQ2FsbGJhY2spLmVycm9yKGVycm9yQ2FsbGJhY2spO1xuICAgIH07XG5cbiAgICB2YXIgc2V0dXBVc2Vyc0luZGV4RnJvbUJhY2tFbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFJldHJpZXZlIHVzZXJzIGxpc3QgZnJvbSBiYWNrZW5kXG4gICAgICAgIHZhciBiYWNrRW5kUHJvbWlzZSA9ICRodHRwLmdldChhamF4SW5mby5VU0VSX0lOREVYLnVybCk7XG4gICAgICAgIGJhY2tFbmRQcm9taXNlLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAkbG9jYWxTdG9yYWdlLnVzZXJzID0gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIGJhY2tFbmRQcm9taXNlO1xuICAgIH07XG5cbiAgICAvLyBJbml0aWFsaXplIGNvbnRyb2xsZXJcbiAgICAkc2NvcGUuaW5pdCgpO1xuXG59O1xuIiwiXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgkbG9jYXRpb25Qcm92aWRlciwgJHN0YXRlUHJvdmlkZXIsICR1cmxSb3V0ZXJQcm92aWRlciwgJHVybE1hdGNoZXJGYWN0b3J5UHJvdmlkZXIpIHtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdyb290LmFjY2VzcycsIHtcbiAgICAgICAgdXJsOiAnL2FjY2VzcycsXG4gICAgICAgIGFic3RyYWN0OiB0cnVlXG4gICAgfSk7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgncm9vdC5hY2Nlc3MubG9naW4nLCB7XG4gICAgICAgIHVybDogJy9sb2dpbicsXG4gICAgICAgIHZpZXdzOiB7XG4gICAgICAgICAgICAnY29udGFpbmVyQCc6IHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyOiAnQWNjZXNzQ3RybCcsXG4gICAgICAgICAgICAgICAgdGVtcGxhdGVVcmw6ICd3ZWIvaHRtbC9hY2Nlc3MvbG9naW4uaHRtbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3Jvb3QuYWNjZXNzLm5vdF9hdXRob3JpemVkJywge1xuICAgICAgICB1cmw6ICcvZm9yYmlkZGVuJyxcbiAgICAgICAgdmlld3M6IHtcbiAgICAgICAgICAgICdjb250YWluZXJAJzoge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXI6ICdBY2Nlc3NDdHJsJyxcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZVVybDogJ3dlYi9odG1sL2FjY2Vzcy9ub3RfYXV0aG9yaXplZC5odG1sJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgncm9vdC5hY2Nlc3MubG9nb3V0Jywge1xuICAgICAgICB1cmw6ICcvbG9nb3V0JyxcbiAgICAgICAgdmlld3M6IHtcbiAgICAgICAgICAgICdjb250YWluZXJAJzoge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXI6ICdBY2Nlc3NDdHJsJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG4gICAgXG59O1xuIiwiLyoqXG4gKiBcbiAqIFVJLVJvdXRlciBzdGF0ZXMgY29uZmlndXJhdGlvbi5cbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoJGxvY2F0aW9uUHJvdmlkZXIsICRzdGF0ZVByb3ZpZGVyLCAkdXJsUm91dGVyUHJvdmlkZXIsICR1cmxNYXRjaGVyRmFjdG9yeVByb3ZpZGVyKSB7XG5cbiAgICAkbG9jYXRpb25Qcm92aWRlci5odG1sNU1vZGUoe1xuICAgICAgICBlbmFibGVkOiB0cnVlXG4gICAgfSk7XG5cbiAgICAkdXJsTWF0Y2hlckZhY3RvcnlQcm92aWRlci5zdHJpY3RNb2RlKGZhbHNlKTtcbiAgICAkdXJsUm91dGVyUHJvdmlkZXIub3RoZXJ3aXNlKGZ1bmN0aW9uICgkaW5qZWN0b3IpIHtcbiAgICAgICAgdmFyICRzdGF0ZSA9ICRpbmplY3Rvci5nZXQoXCIkc3RhdGVcIik7XG4gICAgICAgICRzdGF0ZS5nbyhcInJvb3QuaG9tZXBhZ2VcIik7XG4gICAgfSk7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgncm9vdCcsIHtcbiAgICAgICAgdXJsOiAnJyxcbiAgICAgICAgYWJzdHJhY3Q6IHRydWUsXG4gICAgICAgIHZpZXdzOiB7XG4gICAgICAgICAgICAnaGVhZGVyJzoge1xuICAgICAgICAgICAgICAgIHRlbXBsYXRlVXJsOiAnd2ViL2h0bWwvZGVmYXVsdC9ib290c3RyYXBfaGVhZGVyLmh0bWwnLFxuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXI6ICdIZWFkZXJDdHJsJ1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICdmb290ZXInOiB7XG4gICAgICAgICAgICAgICAgdGVtcGxhdGVVcmw6ICd3ZWIvaHRtbC9kZWZhdWx0L2Zvb3Rlci5odG1sJ1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgncm9vdC5ob21lcGFnZScsIHtcbiAgICAgICAgdXJsOiAnLycsXG4gICAgICAgIGFjdGl2ZVRhYjogJ2hvbWUnLFxuICAgICAgICB2aWV3czoge1xuICAgICAgICAgICAgJ2NvbnRhaW5lckAnOiB7XG4gICAgICAgICAgICAgICAgdGVtcGxhdGVVcmw6ICd3ZWIvaHRtbC9kZWZhdWx0L2hvbWUuaHRtbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcbmFuZ3VsYXIubW9kdWxlKCdteUFwcCcpLmNvbmZpZyhyZXF1aXJlKCcuL2RlZmF1bHQnKSk7XG5hbmd1bGFyLm1vZHVsZSgnbXlBcHAnKS5jb25maWcocmVxdWlyZSgnLi9hY2Nlc3MnKSk7XG5hbmd1bGFyLm1vZHVsZSgnbXlBcHAnKS5jb25maWcocmVxdWlyZSgnLi91c2VyJykpOyIsIlxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIsIGF1dGhvcml6YXRpb25FbnVtcykge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3Jvb3QudXNlcicsIHtcbiAgICAgICAgdXJsOiAnL3VzZXJzJyxcbiAgICAgICAgYWJzdHJhY3Q6IHRydWVcbiAgICB9KTtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdyb290LnVzZXIuaW5kZXgnLCB7XG4gICAgICAgIHVybDogJycsXG4gICAgICAgIGFjdGl2ZVRhYjogJ3VzZXInLFxuICAgICAgICB2aWV3czoge1xuICAgICAgICAgICAgJ2NvbnRhaW5lckAnOiB7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlcjogJ1VzZXJDdHJsJyxcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZVVybDogJ3dlYi9odG1sL3VzZXIvaW5kZXguaHRtbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgYWNjZXNzOiB7XG4gICAgICAgICAgICBsb2dpblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgcGVybWlzc2lvbnM6IHtcbiAgICAgICAgICAgICAgICAndmlldyc6IFsnUk9MRV9NQU5BR0VSJ10sXG4gICAgICAgICAgICAgICAgJ2FkbWluJzogWydST0xFX01BTkFHRVInXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBlcm1pc3Npb25DaGVja1R5cGU6IGF1dGhvcml6YXRpb25FbnVtcy5wZXJtaXNzaW9uQ2hlY2tUeXBlLmF0TGVhc3RPbmVSZXF1aXJlZFxuICAgICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3Jvb3QudXNlci5uZXcnLCB7XG4gICAgICAgIHVybDogJy9uZXcnLFxuICAgICAgICBhY3RpdmVUYWI6ICd1c2VyJyxcbiAgICAgICAgdmlld3M6IHtcbiAgICAgICAgICAgICdjb250YWluZXJAJzoge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXI6ICdVc2VyQ3RybCcsXG4gICAgICAgICAgICAgICAgdGVtcGxhdGVVcmw6ICd3ZWIvaHRtbC91c2VyL2Zvcm0uaHRtbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgYWNjZXNzOiB7XG4gICAgICAgICAgICBsb2dpblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgcGVybWlzc2lvbnM6IHtcbiAgICAgICAgICAgICAgICAndmlldyc6IFsnUk9MRV9NQU5BR0VSJ10sXG4gICAgICAgICAgICAgICAgJ2FkbWluJzogWydST0xFX01BTkFHRVInXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBlcm1pc3Npb25DaGVja1R5cGU6IGF1dGhvcml6YXRpb25FbnVtcy5wZXJtaXNzaW9uQ2hlY2tUeXBlLmF0TGVhc3RPbmVSZXF1aXJlZFxuICAgICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ3Jvb3QudXNlci5lZGl0Jywge1xuICAgICAgICB1cmw6ICcvZWRpdC86dXNlcklkJyxcbiAgICAgICAgYWN0aXZlVGFiOiAndXNlcicsXG4gICAgICAgIHZpZXdzOiB7XG4gICAgICAgICAgICAnY29udGFpbmVyQCc6IHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyOiAnVXNlckN0cmwnLFxuICAgICAgICAgICAgICAgIHRlbXBsYXRlVXJsOiAnd2ViL2h0bWwvdXNlci9mb3JtLmh0bWwnXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGFjY2Vzczoge1xuICAgICAgICAgICAgbG9naW5SZXF1aXJlZDogdHJ1ZSxcbiAgICAgICAgICAgIHBlcm1pc3Npb25zOiB7XG4gICAgICAgICAgICAgICAgJ3ZpZXcnOiBbJ1JPTEVfTUFOQUdFUiddLFxuICAgICAgICAgICAgICAgICdhZG1pbic6IFsnUk9MRV9NQU5BR0VSJ11cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBwZXJtaXNzaW9uQ2hlY2tUeXBlOiBhdXRob3JpemF0aW9uRW51bXMucGVybWlzc2lvbkNoZWNrVHlwZS5hdExlYXN0T25lUmVxdWlyZWRcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIFxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdyb290LnVzZXIuc2hvdycsIHtcbiAgICAgICAgdXJsOiAnLzp1c2VySWQnLFxuICAgICAgICBhY3RpdmVUYWI6ICd1c2VyJyxcbiAgICAgICAgdmlld3M6IHtcbiAgICAgICAgICAgICdjb250YWluZXJAJzoge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xsZXI6ICdVc2VyQ3RybCcsXG4gICAgICAgICAgICAgICAgdGVtcGxhdGVVcmw6ICd3ZWIvaHRtbC91c2VyL3Nob3cuaHRtbCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgYWNjZXNzOiB7XG4gICAgICAgICAgICBsb2dpblJlcXVpcmVkOiB0cnVlLFxuICAgICAgICAgICAgcGVybWlzc2lvbnM6IHtcbiAgICAgICAgICAgICAgICAndmlldyc6IFsnUk9MRV9NQU5BR0VSJ10sXG4gICAgICAgICAgICAgICAgJ2FkbWluJzogWydST0xFX01BTkFHRVInXVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBlcm1pc3Npb25DaGVja1R5cGU6IGF1dGhvcml6YXRpb25FbnVtcy5wZXJtaXNzaW9uQ2hlY2tUeXBlLmF0TGVhc3RPbmVSZXF1aXJlZFxuICAgICAgICB9XG4gICAgfSk7XG4gICAgXG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoJHEsIGV2ZW50QnVzLCAkaHR0cCwgYWpheEluZm8sIGF1dGhlbnRpY2F0aW9uRXZlbnRzKSB7XG5cbiAgICB2YXIgbG9naW4gPSBmdW5jdGlvbiAobG9naW5Nb2RlbCkge1xuICAgICAgICB2YXIgZGVmZXIgPSAkcS5kZWZlcigpO1xuICAgICAgICB2YXIgdXJsID0gYWpheEluZm8uTE9HSU5fQ0hFQ0sudXJsO1xuICAgICAgICB2YXIgcGFyYW1ldGVycyA9IGxvZ2luTW9kZWw7XG4gICAgICAgICRodHRwLnBvc3QodXJsLCBwYXJhbWV0ZXJzKS5zdWNjZXNzKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgZXZlbnRCdXMuYnJvYWRjYXN0KGF1dGhlbnRpY2F0aW9uRXZlbnRzLmxvZ2luQ2hlY2tTdWNjZXNzLCB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2VEYXRhOiByZXNwb25zZS5kYXRhLFxuICAgICAgICAgICAgICAgIHJlc3BvbnNlVG9rZW46IHJlc3BvbnNlLnRva2VuXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICB9KS5lcnJvcihmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgZGVmZXIucmVqZWN0KGRhdGEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2U7XG4gICAgfTtcbiAgICBcbiAgICB2YXIgcmVxdWVzdExvZ2luQ1NSRlRva2VuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgZGVmZXIgPSAkcS5kZWZlcigpO1xuICAgICAgICB2YXIgdXJsID0gYWpheEluZm8uTE9HSU5fUkVRVUVTVC51cmw7XG4gICAgICAgICRodHRwLmdldCh1cmwpLnN1Y2Nlc3MoZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICBkZWZlci5yZXNvbHZlKHJlc3BvbnNlKTtcbiAgICAgICAgfSkuZXJyb3IoZnVuY3Rpb24gKGRhdGEpIHtcbiAgICAgICAgICAgIGRlZmVyLnJlamVjdChkYXRhKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkZWZlci5wcm9taXNlO1xuICAgIH07XG5cbiAgICB2YXIgcmVzZXRQYXNzd29yZCA9IGZ1bmN0aW9uIChmb3NVc2VyUmVzZXR0aW5nRm9ybSwgdG9rZW4pIHtcbiAgICAgICAgdmFyIGRlZmVyID0gJHEuZGVmZXIoKTtcbiAgICAgICAgdmFyIHVybCA9IGFqYXhJbmZvLlVTRVJfUkVTRVRfUEFTU1dPUkRfQU5EX0FVVEhFTlRJQ0FURV9VU0VSLnVybC5yZXBsYWNlKCc6dG9rZW4nLCB0b2tlbik7XG4gICAgICAgIHZhciBwYXJhbWV0ZXJzID0ge1xuICAgICAgICAgICAgZm9zX3VzZXJfcmVzZXR0aW5nX2Zvcm06IGZvc1VzZXJSZXNldHRpbmdGb3JtXG4gICAgICAgIH07XG4gICAgICAgICRodHRwLnBvc3QodXJsLCBwYXJhbWV0ZXJzKS5zdWNjZXNzKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgZXZlbnRCdXMuYnJvYWRjYXN0KGF1dGhlbnRpY2F0aW9uRXZlbnRzLmxvZ2luQ2hlY2tTdWNjZXNzLCB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2VEYXRhOiByZXNwb25zZS5kYXRhLFxuICAgICAgICAgICAgICAgIHJlc3BvbnNlVG9rZW46IHJlc3BvbnNlLnRva2VuXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGRlZmVyLnJlc29sdmUocmVzcG9uc2UpO1xuICAgICAgICB9KS5lcnJvcihmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgICAgICAgZGVmZXIucmVqZWN0KGRhdGEpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIGRlZmVyLnByb21pc2U7XG4gICAgfTtcblxuICAgIHZhciBsb2dvdXQgPSBmdW5jdGlvbiAocmVkaXJlY3RUb0xvZ2luKSB7XG4gICAgICAgIFxuICAgICAgICAvLyBUaGUgdXNlck1vZGVsIGlzIGRlbGV0ZWQgb24gbG9jYWxTdG9yYWdlLmpzIGNvbmZpZ1xuICAgICAgICBldmVudEJ1cy5icm9hZGNhc3QoYXV0aGVudGljYXRpb25FdmVudHMudXNlckxvZ2dlZE91dCwge1xuICAgICAgICBcdHJlZGlyZWN0VG9Mb2dpbjpyZWRpcmVjdFRvTG9naW5cbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBsb2dpbjogbG9naW4sXG4gICAgICAgIHJlcXVlc3RMb2dpbkNTUkZUb2tlbjogcmVxdWVzdExvZ2luQ1NSRlRva2VuLFxuICAgICAgICByZXNldFBhc3N3b3JkOiByZXNldFBhc3N3b3JkLFxuICAgICAgICBsb2dvdXQ6IGxvZ291dFxuICAgIH07XG5cbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh1c2VyQWNjZXNzLCBhdXRob3JpemF0aW9uRW51bXMpIHtcblxuICAgIHZhciBnZXRBdXRob3JpemF0aW9uTGV2ZWwgPSBmdW5jdGlvbiAobG9naW5SZXF1aXJlZCwgcmVxdWlyZWRQZXJtaXNzaW9ucywgcGVybWlzc2lvbkNoZWNrVHlwZSkge1xuXG4gICAgICAgIHZhciByZXN1bHQ7XG4gICAgICAgIHZhciByZXF1aXJlZFBlcm1pc3Npb25zVG9WaWV3ID0gW107XG4gICAgICAgIHZhciByZXF1aXJlZFBlcm1pc3Npb25zVG9BZG1pbiA9IFtdO1xuICAgICAgICBcbiAgICAgICAgLy8gUGVybWlzc2lvbnMgY2FuIGJlIGFuIGFycmF5IG9mIHN0cmluZ3Mgb3IgYW4gb2JqZWN0IHdpdGggMiBhcnJheXM6IG9uZSBmb3IgdmlldyBwZXJtaXNzaW9ucyBhbmQgb25lIGZvciBhZG1pbiBwZXJtaXNzaW9uc1xuICAgICAgIFxuICAgICAgICAvLyBJZiBpdCdzIGEgc2ltcGxlIGFycmF5IG9mIHN0cmluZ3MgaXQgbWVhbnMgdGhlc2UgYXJlIHJlcXVpcmVkUGVybWlzc2lvbnNUb1ZpZXdcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmVxdWlyZWRQZXJtaXNzaW9ucykpIHtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmVxdWlyZWRQZXJtaXNzaW9uc1RvVmlldyA9IHJlcXVpcmVkUGVybWlzc2lvbnM7XG4gICAgICAgICAgICBcbiAgICAgICAgfSBlbHNlIGlmIChyZXF1aXJlZFBlcm1pc3Npb25zICE9PSBudWxsICYmIHR5cGVvZiByZXF1aXJlZFBlcm1pc3Npb25zID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICAvLyBJZiBpdCBpcyBhbiBvYmplY3QgdGhlbiBzZWFyY2ggZm9yIHZpZXcgYW5kIGFkbWluIHBlcm1pc3Npb25zXG4gICAgICAgICAgICBpZiAocmVxdWlyZWRQZXJtaXNzaW9uc1sndmlldyddICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICByZXF1aXJlZFBlcm1pc3Npb25zVG9WaWV3ID0gcmVxdWlyZWRQZXJtaXNzaW9uc1sndmlldyddO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHJlcXVpcmVkUGVybWlzc2lvbnNbJ2FkbWluJ10gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIHJlcXVpcmVkUGVybWlzc2lvbnNUb0FkbWluID0gcmVxdWlyZWRQZXJtaXNzaW9uc1snYWRtaW4nXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxvZ2luUmVxdWlyZWQgPT09IHRydWUpIHtcblxuICAgICAgICAgICAgaWYgKHVzZXJBY2Nlc3MuaXNVc2VyTG9nZ2VkSW4oKSkge1xuXG4gICAgICAgICAgICAgICAgaWYgKHJlcXVpcmVkUGVybWlzc2lvbnNUb1ZpZXcubGVuZ3RoID09PSAwICYmIHJlcXVpcmVkUGVybWlzc2lvbnNUb0FkbWluLmxlbmd0aCA9PT0gMCkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIExvZ2luIGlzIHJlcXVpcmVkIGJ1dCBubyBzcGVjaWZpYyBwZXJtaXNzaW9ucyBhcmUgc3BlY2lmaWVkXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF1dGhvcml6YXRpb25FbnVtcy5hdXRob3Jpc2VkLmF1dGhvcmlzZWRUb0FkbWluO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAvLyBMb2dpbiBBTkQgc3BlY2lmaWMgcGVybWlzc2lvbnMgYXJlIHJlcXVpcmVkXG5cbiAgICAgICAgICAgICAgICAgICAgdmFyIGdyYW50ZWRQZXJtaXNzaW9ucyA9IHVzZXJBY2Nlc3MuZ2V0VXNlck1vZGVsKCkucGVybWlzc2lvbnM7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgdGhlIHVzZXIgaXMgYSBtYW5hZ2VyIChvciBtb3JlKSwgdGhlbiBhdXRob3JpemUgcmlnaHQgYXdheVxuICAgICAgICAgICAgICAgICAgICBpZiAoZ3JhbnRlZFBlcm1pc3Npb25zLmluZGV4T2YoJ1JPTEVfTUFOQUdFUicpID4gLTEpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXV0aG9yaXphdGlvbkVudW1zLmF1dGhvcmlzZWQuYXV0aG9yaXNlZFRvQWRtaW47XG5cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgcGVybWlzc2lvbkNoZWNrVHlwZSA9IHBlcm1pc3Npb25DaGVja1R5cGUgfHwgYXV0aG9yaXphdGlvbkVudW1zLnBlcm1pc3Npb25DaGVja1R5cGUuYXRMZWFzdE9uZVJlcXVpcmVkO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIGhhc1Blcm1pc3Npb25Ub1ZpZXc7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaGFzUGVybWlzc2lvblRvQWRtaW47XG4gICAgICAgICAgICAgICAgICAgICAgICB2YXIgaTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBlcm1pc3Npb25DaGVja1R5cGUgPT09IGF1dGhvcml6YXRpb25FbnVtcy5wZXJtaXNzaW9uQ2hlY2tUeXBlLmFsbFJlcXVpcmVkKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBBbGwgcGVybWlzc2lvbnMgYXJlIHJlcXVpcmVkLiBIYWx0IGlmIGFueSBwZXJtaXNzaW9uIGlzIG5vdCBmb3VuZFxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHVzZXIgcm9sZXMgYW5kIGZvciBwZXJzcGVjdGl2ZSBwaWxsYXIgcGVybWlzc2lvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGaXJzdCBzZWUgaWYgaXQgY2FuIGJlIGF1dGhvcml6ZWQgdG8gYWRtaW5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNQZXJtaXNzaW9uVG9BZG1pbiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHJlcXVpcmVkUGVybWlzc2lvbnNUb0FkbWluLmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChncmFudGVkUGVybWlzc2lvbnMuaW5kZXhPZihyZXF1aXJlZFBlcm1pc3Npb25zVG9BZG1pbltpXSkgPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhc1Blcm1pc3Npb25Ub0FkbWluID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBpdCBkb2VzIG5vdCBoYXZlIHBlcm1pc3Npb24gdG8gYWRtaW4gdGhlbiBjaGVjayBpZiBpdCBoYXMgcGVybWlzc2lvbiB0byB2aWV3XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGhhc1Blcm1pc3Npb25Ub0FkbWluID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNQZXJtaXNzaW9uVG9WaWV3ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHJlcXVpcmVkUGVybWlzc2lvbnNUb1ZpZXcubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChncmFudGVkUGVybWlzc2lvbnMuaW5kZXhPZihyZXF1aXJlZFBlcm1pc3Npb25zVG9WaWV3W2ldKSA9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhc1Blcm1pc3Npb25Ub1ZpZXcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwZXJtaXNzaW9uQ2hlY2tUeXBlID09PSBhdXRob3JpemF0aW9uRW51bXMucGVybWlzc2lvbkNoZWNrVHlwZS5hdExlYXN0T25lUmVxdWlyZWQpIHtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEF0IGxlYXN0IG9uZSBwZXJtaXNzaW9uIGlzIHJlcXVpcmVkLiBIYWx0IGlmIGFueSBwZXJtaXNzaW9uIGlzIGZvdW5kXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIHVzZXIgcm9sZXMgYW5kIGZvciBwZXJzcGVjdGl2ZSBwaWxsYXIgcGVybWlzc2lvbnNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGaXJzdCBzZWUgaWYgaXQgY2FuIGJlIGF1dGhvcml6ZWQgdG8gYWRtaW5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNQZXJtaXNzaW9uVG9BZG1pbiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCByZXF1aXJlZFBlcm1pc3Npb25zVG9BZG1pbi5sZW5ndGg7IGkgKz0gMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JhbnRlZFBlcm1pc3Npb25zLmluZGV4T2YocmVxdWlyZWRQZXJtaXNzaW9uc1RvQWRtaW5baV0pID4gLTEgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNQZXJtaXNzaW9uVG9BZG1pbiA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIGl0IGRvZXMgbm90IGhhdmUgcGVybWlzc2lvbiB0byBhZG1pbiB0aGVuIGNoZWNrIGlmIGl0IGhhcyBwZXJtaXNzaW9uIHRvIHZpZXdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaGFzUGVybWlzc2lvblRvQWRtaW4gPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhc1Blcm1pc3Npb25Ub1ZpZXcgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHJlcXVpcmVkUGVybWlzc2lvbnNUb1ZpZXcubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZ3JhbnRlZFBlcm1pc3Npb25zLmluZGV4T2YocmVxdWlyZWRQZXJtaXNzaW9uc1RvVmlld1tpXSkgPiAtMVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoYXNQZXJtaXNzaW9uVG9WaWV3ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gU2V0IGF1dGhvcml6ZWRUb0FkbWluLCBhdXRob3JpemVkVG9WaWV3IG9yIG5vdEF1dGhvcml6ZWQgYmFzZWQgb24gcGVybWlzc2lvbnMgZm91bmRcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNQZXJtaXNzaW9uVG9BZG1pbiA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF1dGhvcml6YXRpb25FbnVtcy5hdXRob3Jpc2VkLmF1dGhvcmlzZWRUb0FkbWluO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChoYXNQZXJtaXNzaW9uVG9WaWV3ID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXV0aG9yaXphdGlvbkVudW1zLmF1dGhvcmlzZWQuYXV0aG9yaXNlZFRvVmlldztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXV0aG9yaXphdGlvbkVudW1zLmF1dGhvcmlzZWQubm90QXV0aG9yaXNlZDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAvLyBMb2dpbiBpcyByZXF1aXJlZCBidXQgdGhlIHVzZXIgaXMgbm90IGxvZ2dlZCBpblxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF1dGhvcml6YXRpb25FbnVtcy5hdXRob3Jpc2VkLmxvZ2luUmVxdWlyZWQ7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAvLyBObyBsb2dpbiBpcyByZXF1aXJlZFxuICAgICAgICAgICAgcmVzdWx0ID0gYXV0aG9yaXphdGlvbkVudW1zLmF1dGhvcmlzZWQuYXV0aG9yaXNlZFRvVmlldztcblxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZ2V0QXV0aG9yaXphdGlvbkxldmVsOiBnZXRBdXRob3JpemF0aW9uTGV2ZWxcbiAgICB9O1xuXG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCRsb2NhbFN0b3JhZ2UpIHtcblxuICAgIHZhciBzZXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICAgICAgICBpZiAoJGxvY2FsU3RvcmFnZS5jdXN0b21DYWNoZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICRsb2NhbFN0b3JhZ2UuY3VzdG9tQ2FjaGUgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICAkbG9jYWxTdG9yYWdlLmN1c3RvbUNhY2hlW2tleV0gPSB2YWx1ZTtcbiAgICB9O1xuICAgIFxuICAgIHZhciB1bnNldCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgaWYgKCRsb2NhbFN0b3JhZ2UuY3VzdG9tQ2FjaGUgIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAkbG9jYWxTdG9yYWdlLmN1c3RvbUNhY2hlW2tleV0gPSB1bmRlZmluZWQ7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIFxuICAgIHZhciBnZXQgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIGlmICgkbG9jYWxTdG9yYWdlLmN1c3RvbUNhY2hlICE9IHVuZGVmaW5lZCAmJiAkbG9jYWxTdG9yYWdlLmN1c3RvbUNhY2hlW2tleV0gIT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gJGxvY2FsU3RvcmFnZS5jdXN0b21DYWNoZVtrZXldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgc2V0OiBzZXQsXG4gICAgICAgIHVuc2V0OiB1bnNldCxcbiAgICAgICAgZ2V0OiBnZXRcbiAgICB9O1xuXG59OyIsIlxuLyoqXG4gKiBAbmdkb2Mgc2VydmljZVxuICogQG5hbWUgZXZlbnRCdXNcbiAqIEByZXF1aXJlcyAkcm9vdFNjb3BlXG4gKlxuICogQGRlc2NyaXB0aW9uXG4gKiBQcm92aWRlcyBhIGV2ZW50aW5nIG1lY2hhbmlzbSB3aGVuIGEgdXNlciBjYW4gYnJvYWRjYXN0IGFuZCBzdWJzY3JpYmUgdG8gYXBwbGljYXRpb24gd2lkZSBldmVudHMuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oJHJvb3RTY29wZSkge1xuICAgIFxuICAgIC8qKlxuICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAqIFN1YnNjcmliZXMgYSBjYWxsYmFjayB0byB0aGUgZ2l2ZW4gYXBwbGljYXRpb24gd2lkZSBldmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBUaGUgbmFtZSBvZiB0aGUgZXZlbnQgdG8gc3Vic2NyaWJlIHRvLlxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIEEgY2FsbGJhY2sgd2hpY2ggaXMgZmlyZSB3aGVuIHRoZSBldmVudCBpcyByYWlzZWQuXG4gICAgICogQHJldHVybiB7RnVuY3Rpb259IEEgZnVuY3Rpb24gdGh0IGNhbiBiZSBjYWxsZWQgdG8gdW5zdWJzY3JpdmUgdG8gdGhlIGV2ZW50LlxuICAgICAqL1xuICAgIHZhciBzdWJzY3JpYmUgPSBmdW5jdGlvbihldmVudE5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICAgIHJldHVybiAkcm9vdFNjb3BlLiRvbihldmVudE5hbWUsIGNhbGxiYWNrKTtcbiAgICB9LFxuICAgIFxuICAgIC8qKlxuICAgICAqIEBkZXNjcmlwdGlvblxuICAgICAqIEJyb2FkY2FzdHMgdGhlIGdpdmVuIGV2ZW50IGFuZCBkYXRhLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50TmFtZSBUaGUgbmFtZSBvZiB0aGUgZXZlbnQgdG8gYnJvYWRjYXN0LlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBkYXRhIEEgZGF0YSBvYmplY3QgdGhhdCB3aWxsIGJlIHBhc3NlZCBhbG9uZyB3aXRoIHRoZSBldmVudC5cbiAgICAgKi9cbiAgICBicm9hZGNhc3QgPSBmdW5jdGlvbihldmVudE5hbWUsIGRhdGEpIHtcbiAgICAgICAgJHJvb3RTY29wZS4kZW1pdChldmVudE5hbWUsIGRhdGEpO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBzdWJzY3JpYmU6IHN1YnNjcmliZSxcbiAgICAgICAgYnJvYWRjYXN0OiBicm9hZGNhc3RcbiAgICB9O1xuICAgIFxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuYW5ndWxhci5tb2R1bGUoJ215QXBwJykuZmFjdG9yeSgnZXZlbnRCdXMnLCBbJyRyb290U2NvcGUnLCByZXF1aXJlKCcuL2V2ZW50QnVzJyldKTtcbmFuZ3VsYXIubW9kdWxlKCdteUFwcCcpLmZhY3RvcnkoJ2F1dGhlbnRpY2F0aW9uJywgWyckcScsICdldmVudEJ1cycsICckaHR0cCcsICdhamF4SW5mbycsICdhdXRoZW50aWNhdGlvbkV2ZW50cycsIHJlcXVpcmUoJy4vYXV0aGVudGljYXRpb24nKV0pO1xuYW5ndWxhci5tb2R1bGUoJ215QXBwJykuZmFjdG9yeSgnYXV0aG9yaXphdGlvbicsIFsndXNlckFjY2VzcycsICdhdXRob3JpemF0aW9uRW51bXMnLCByZXF1aXJlKCcuL2F1dGhvcml6YXRpb24nKV0pO1xuYW5ndWxhci5tb2R1bGUoJ215QXBwJykuZmFjdG9yeSgndXNlck1hbmFnZXInLCBbJ3VzZXJBY2Nlc3MnLCAnZXZlbnRCdXMnLCAnYXV0aGVudGljYXRpb25FdmVudHMnLCAnYXV0aG9yaXphdGlvbicsICdhdXRob3JpemF0aW9uRW51bXMnLCAgJ2NhY2hlJyxyZXF1aXJlKCcuL3VzZXJNYW5hZ2VyJyldKTtcbmFuZ3VsYXIubW9kdWxlKCdteUFwcCcpLmZhY3RvcnkoJ2NhY2hlJywgWyckbG9jYWxTdG9yYWdlJywgJ2V2ZW50QnVzJywgcmVxdWlyZSgnLi9jYWNoZScpXSk7XG5hbmd1bGFyLm1vZHVsZSgnbXlBcHAnKS5mYWN0b3J5KCd1c2VyQWNjZXNzJywgWyckbG9jYWxTdG9yYWdlJywgcmVxdWlyZSgnLi91c2VyQWNjZXNzJyldKTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCRsb2NhbFN0b3JhZ2UpIHtcbiAgICBcbiAgICB2YXIgZ2V0VXNlck1vZGVsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJGxvY2FsU3RvcmFnZS51c2VyTW9kZWw7XG4gICAgfTtcbiAgICBcbiAgICB2YXIgc2V0VXNlck1vZGVsID0gZnVuY3Rpb24gKHVzZXJNb2RlbCkge1xuICAgICAgICAkbG9jYWxTdG9yYWdlLnVzZXJNb2RlbCA9IHVzZXJNb2RlbDtcbiAgICB9O1xuXG4gICAgdmFyIGlzVXNlckxvZ2dlZEluID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgdXNlck1vZGVsID0gZ2V0VXNlck1vZGVsKCk7XG4gICAgICAgIHJldHVybiB1c2VyTW9kZWwgIT09IHVuZGVmaW5lZCAmJiB1c2VyTW9kZWwudG9rZW4gIT09IHVuZGVmaW5lZDtcbiAgICB9O1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICAgIGdldFVzZXJNb2RlbDogZ2V0VXNlck1vZGVsLFxuICAgICAgICBzZXRVc2VyTW9kZWw6IHNldFVzZXJNb2RlbCxcbiAgICAgICAgaXNVc2VyTG9nZ2VkSW46IGlzVXNlckxvZ2dlZEluXG4gICAgfTtcblxufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHVzZXJBY2Nlc3MsIGV2ZW50QnVzLCBhdXRoZW50aWNhdGlvbkV2ZW50cywgYXV0aG9yaXphdGlvbiwgYXV0aG9yaXphdGlvbkVudW1zLCBjYWNoZSkge1xuICAgIFxuICAgIHZhciBjcmVhdGVVc2VyTW9kZWwgPSBmdW5jdGlvbiAodXNlckRhdGEsIHRva2VuKSB7XG4gICAgICAgIGNyZWF0ZVVwZGF0ZVVzZXJNb2RlbCh1c2VyRGF0YSwgdG9rZW4pO1xuICAgIH07XG4gICAgXG4gICAgdmFyIHVwZGF0ZVVzZXJNb2RlbCA9IGZ1bmN0aW9uICh1c2VyRGF0YSkge1xuICAgICAgICBjcmVhdGVVcGRhdGVVc2VyTW9kZWwodXNlckRhdGEpO1xuICAgIH07XG4gICAgXG4gICAgdmFyIGNyZWF0ZVVwZGF0ZVVzZXJNb2RlbCA9IGZ1bmN0aW9uICh1c2VyRGF0YSwgdG9rZW4pIHtcbiAgICAgICAgXG4gICAgICAgIHZhciB1c2VyTW9kZWwgPSB1c2VyQWNjZXNzLmdldFVzZXJNb2RlbCgpO1xuICAgICAgICBcbiAgICAgICAgaWYgKHVzZXJNb2RlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB1c2VyTW9kZWwgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gU2V0dXAgdG9rZW5cbiAgICAgICAgaWYgKHRva2VuICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHVzZXJNb2RlbC50b2tlbiA9IHRva2VuO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBTZXR1cCBpZFxuICAgICAgICBpZiAodXNlckRhdGEuaWQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdXNlck1vZGVsLmlkID0gdXNlckRhdGEuaWQ7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFNldHVwIHVzZXJuYW1lXG4gICAgICAgIGlmICh1c2VyRGF0YS51c2VybmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB1c2VyTW9kZWwudXNlcm5hbWUgPSB1c2VyRGF0YS51c2VybmFtZTtcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gU2V0dXAgbmFtZVxuICAgICAgICBpZiAodXNlckRhdGEubmFtZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB1c2VyTW9kZWwubmFtZSA9IHVzZXJEYXRhLm5hbWU7XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIFNldHVwIHBlcm1pc3Npb25zXG4gICAgICAgIGlmICh1c2VyRGF0YS5yb2xlcyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICB1c2VyTW9kZWwucGVybWlzc2lvbnMgPSB1c2VyRGF0YS5yb2xlcztcbiAgICAgICAgfVxuICAgICAgICBcbiAgICAgICAgLy8gRmluYWxseSB1cGRhdGUgdGhlIGxvY2FsIHN0b3JhZ2Ugd2l0aCB0aGUgdXBkYXRlZCB1c2VyIG1vZGVsXG4gICAgICAgIHVzZXJBY2Nlc3Muc2V0VXNlck1vZGVsKHVzZXJNb2RlbCk7XG4gICAgICAgIFxuICAgIH07XG5cbiAgICB2YXIgZ2V0VXNlck1vZGVsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdXNlckFjY2Vzcy5nZXRVc2VyTW9kZWwoKTtcbiAgICB9O1xuXG4gICAgdmFyIGlzVXNlckxvZ2dlZEluID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdXNlckFjY2Vzcy5pc1VzZXJMb2dnZWRJbigpO1xuICAgIH07XG4gICAgXG4gICAgZXZlbnRCdXMuc3Vic2NyaWJlKGF1dGhlbnRpY2F0aW9uRXZlbnRzLmxvZ2luQ2hlY2tTdWNjZXNzLCBmdW5jdGlvbiAoZXZlbnQsIGV2ZW50RGF0YSkge1xuICAgICAgICBcbiAgICAgICAgLy8gU2V0dXAgdXNlciBtb2RlbCBhZnRlciBzdWNjZXNzZnVsbCBsb2dpbiBjaGVja1xuICAgICAgICBjcmVhdGVVc2VyTW9kZWwoZXZlbnREYXRhLnJlc3BvbnNlRGF0YSwgZXZlbnREYXRhLnJlc3BvbnNlVG9rZW4pO1xuICAgICAgICBcbiAgICAgICAgLy8gQnJvYWRjYXN0IHVzZXIgaGFzIGxvZ2dlZCBpblxuICAgICAgICBldmVudEJ1cy5icm9hZGNhc3QoYXV0aGVudGljYXRpb25FdmVudHMudXNlckxvZ2dlZEluLCBnZXRVc2VyTW9kZWwoKSk7XG4gICAgICAgIFxuICAgIH0pO1xuICAgIFxuICAgIHZhciBnZXREZWZhdWx0U2NyZWVuID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBcbiAgICAgICAgaWYgKGlzVXNlckxvZ2dlZEluKCkpIHtcbiAgICAgICAgICAgIC8vIEdldCBhdXRob3JpemF0aW9uIGNhY2hlXG4gICAgICAgICAgICB2YXIgYXV0aENhY2hlID0gZ2V0QXV0aG9yaXphdGlvbnNDYWNoZSgpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coYXV0aENhY2hlKTtcbiAgICAgICAgICAgIC8vIElmIHVzZXIgaGFzIG1hbmFnZXIgcm9sZSBncmFudGVkLCB0aGVuIGdvIHRvIG1hbmFnZXIgZGFzaGJvYXJkXG4gICAgICAgICAgICBpZiAoYXV0aENhY2hlLmhhc1JvbGVNYW5hZ2VyR3JhbnRlZCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAncm9vdC5kYXNoYm9hcmQnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gJ3Jvb3QuaG9tZXBhZ2UnXG4gICAgICAgICAgICBcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEVsc2UgZm9yd2FyZCB0byBhIG5vIGFjY2VzcyBwYWdlXG4gICAgICAgIHJldHVybiAncm9vdC5hY2Nlc3Mubm9fYWNjZXNzJztcbiAgICAgICAgXG4gICAgfTtcblxuICAgIHZhciBzZXRBdXRob3JpemF0aW9uQ2FjaGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFNldCB0aGUgY2FjaGVkIHZhbHVlc1xuICAgICAgICBjYWNoZS5zZXQoJ2F1dGhvcml6YXRpb25zQ2FjaGUnLCB7XG4gICAgICAgICAgICAnaGFzUm9sZU1hbmFnZXJHcmFudGVkJzogYXV0aG9yaXphdGlvbi5nZXRBdXRob3JpemF0aW9uTGV2ZWwodHJ1ZSwgeydhZG1pbic6IFsnUk9MRV9NQU5BR0VSJ119KSA9PSBhdXRob3JpemF0aW9uRW51bXMuYXV0aG9yaXNlZC5hdXRob3Jpc2VkVG9BZG1pblxuICAgICAgICB9KTtcbiAgICAgICAgXG4gICAgfTtcblxuICAgIFxuICAgIHZhciBnZXRBdXRob3JpemF0aW9uc0NhY2hlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYXV0aG9yaXphdGlvbnNDYWNoZSA9IGNhY2hlLmdldCgnYXV0aG9yaXphdGlvbnNDYWNoZScpO1xuICAgICAgICBpZiAoYXV0aG9yaXphdGlvbnNDYWNoZSA9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHNldEF1dGhvcml6YXRpb25DYWNoZSgpO1xuICAgICAgICAgICAgYXV0aG9yaXphdGlvbnNDYWNoZSA9IGNhY2hlLmdldCgnYXV0aG9yaXphdGlvbnNDYWNoZScpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhdXRob3JpemF0aW9uc0NhY2hlO1xuICAgIH07XG4gICAgXG4gICAgcmV0dXJuIHtcbiAgICAgICAgY3JlYXRlVXNlck1vZGVsOiBjcmVhdGVVc2VyTW9kZWwsXG4gICAgICAgIHVwZGF0ZVVzZXJNb2RlbDogdXBkYXRlVXNlck1vZGVsLFxuICAgICAgICBnZXRVc2VyTW9kZWw6IGdldFVzZXJNb2RlbCxcbiAgICAgICAgaXNVc2VyTG9nZ2VkSW46IGlzVXNlckxvZ2dlZEluLFxuICAgICAgICBnZXREZWZhdWx0U2NyZWVuOiBnZXREZWZhdWx0U2NyZWVuLFxuICAgICAgICBnZXRBdXRob3JpemF0aW9uc0NhY2hlOiBnZXRBdXRob3JpemF0aW9uc0NhY2hlXG4gICAgfTtcblxufTtcbiIsIlxuLy8gQVBJIFVSTHNcbnZhciByZXF1ZXN0X2Zvcm1hdCA9ICcuanNvbic7XG52YXIgYXBpX3ZlcnNpb24gPSAnJztcbnZhciBhcGlfYmFzZV91cmwgPSAnJztcbmlmICh3aW5kb3cuYXBpX2Jhc2VfdXJsICE9IHVuZGVmaW5lZCkge1xuICAgIGFwaV9iYXNlX3VybCA9IHdpbmRvdy5hcGlfYmFzZV91cmw7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgICAgIFxuICAgIFwiTE9HSU5fUkVRVUVTVFwiOiB7XG4gICAgICAgIFwidXJsXCI6IGFwaV9iYXNlX3VybCArIGFwaV92ZXJzaW9uICsgXCIvXCIgKyBcImxvZ2luX3JlcXVlc3RcIlxuICAgIH0sXG4gICAgXCJMT0dJTl9DSEVDS1wiOiB7XG4gICAgICAgIFwidXJsXCI6IGFwaV9iYXNlX3VybCArIGFwaV92ZXJzaW9uICsgXCIvXCIgKyBcImxvZ2luX2NoZWNrXCJcbiAgICB9LFxuICAgIFwiVVNFUl9JTkRFWFwiOiB7XG4gICAgICAgIFwidXJsXCI6IGFwaV9iYXNlX3VybCArIGFwaV92ZXJzaW9uICsgXCIvXCIgKyBcInVzZXJzXCIgKyByZXF1ZXN0X2Zvcm1hdFxuICAgIH0sXG4gICAgXCJVU0VSX0dFVFwiOiB7XG4gICAgICAgIFwidXJsXCI6IGFwaV9iYXNlX3VybCArIGFwaV92ZXJzaW9uICsgXCIvXCIgKyBcInVzZXJzXCIgKyBcIi9cIiArIFwiOnVzZXJJZFwiICsgcmVxdWVzdF9mb3JtYXRcbiAgICB9LFxuICAgIFwiVVNFUl9VUERBVEVcIjoge1xuICAgICAgICBcInVybFwiOiBhcGlfYmFzZV91cmwgKyBhcGlfdmVyc2lvbiArIFwiL1wiICsgXCJ1c2Vyc1wiICsgXCIvXCIgKyBcIjp1c2VySWRcIiArIHJlcXVlc3RfZm9ybWF0XG4gICAgfSxcbiAgICBcIlVTRVJfQ1JFQVRFXCI6IHtcbiAgICAgICAgXCJ1cmxcIjogYXBpX2Jhc2VfdXJsICsgYXBpX3ZlcnNpb24gKyBcIi9cIiArIFwidXNlcnNcIiArIHJlcXVlc3RfZm9ybWF0XG4gICAgfSxcbiAgICBcIlVTRVJfREVMRVRFXCI6IHtcbiAgICAgICAgXCJ1cmxcIjogYXBpX2Jhc2VfdXJsICsgYXBpX3ZlcnNpb24gKyBcIi9cIiArIFwidXNlcnNcIiArIFwiL1wiICsgXCI6dXNlcklkXCIgKyByZXF1ZXN0X2Zvcm1hdFxuICAgIH0sXG4gICAgXCJVU0VSX0dFVF9BTExfUk9MRVNcIjoge1xuICAgICAgICBcInVybFwiOiBhcGlfYmFzZV91cmwgKyBhcGlfdmVyc2lvbiArIFwiL1wiICsgXCJ1c2Vyc1wiICsgJy9yb2xlcycgKyByZXF1ZXN0X2Zvcm1hdFxuICAgIH1cbiAgICAgICAgXG59O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgbG9naW5DaGVja1N1Y2Nlc3M6ICdhdXRoOmxvZ2luQ2hlY2s6c3VjY2VzcycsXG4gICAgdXNlckxvZ2dlZEluOiAnYXV0aDp1c2VyOmxvZ2dlZEluJyxcbiAgICB1c2VyTG9nZ2VkT3V0OiAnYXV0aDp1c2VyOmxvZ2dlZE91dCcsXG4gICAgc2Vzc2lvblRpbWVkT3V0OiAnYXV0aDp1c2VyOnNlc3Npb25UaW1lZE91dCdcbn07IiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgYXV0aG9yaXNlZDoge1xuICAgICAgICBsb2dpblJlcXVpcmVkOiAnbG9naW5SZXF1aXJlZCcsXG4gICAgICAgIG5vdEF1dGhvcmlzZWQ6ICdub3RBdXRob3Jpc2VkJyxcbiAgICAgICAgYXV0aG9yaXNlZFRvVmlldzogJ2F1dGhvcmlzZWRUb1ZpZXcnLFxuICAgICAgICBhdXRob3Jpc2VkVG9BZG1pbjogJ2F1dGhvcmlzZWRUb0FkbWluJ1xuICAgIH0sXG4gICAgcGVybWlzc2lvbkNoZWNrVHlwZToge1xuICAgICAgICBhdExlYXN0T25lUmVxdWlyZWQ6ICdhdExlYXN0T25lUmVxdWlyZWQnLFxuICAgICAgICBhbGxSZXF1aXJlZDogJ2FsbFJlcXVpcmVkJ1xuICAgIH1cbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG5hbmd1bGFyLm1vZHVsZSgnbXlBcHAnKS5jb25zdGFudCgnYXV0aG9yaXphdGlvbkVudW1zJywgcmVxdWlyZSgnLi9hdXRob3JpemF0aW9uRW51bXMnKSk7XG5hbmd1bGFyLm1vZHVsZSgnbXlBcHAnKS52YWx1ZSgnYWpheEluZm8nLCByZXF1aXJlKCcuL2FwaUVuZHBvaW50cycpKTtcbmFuZ3VsYXIubW9kdWxlKCdteUFwcCcpLnZhbHVlKCdhdXRoZW50aWNhdGlvbkV2ZW50cycsIHJlcXVpcmUoJy4vYXV0aGVudGljYXRpb25FdmVudHMnKSk7XG4iXX0=
