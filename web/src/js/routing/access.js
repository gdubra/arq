
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
