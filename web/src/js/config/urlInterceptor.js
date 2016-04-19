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


