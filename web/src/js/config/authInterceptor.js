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
