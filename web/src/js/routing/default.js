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
