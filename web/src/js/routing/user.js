
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
