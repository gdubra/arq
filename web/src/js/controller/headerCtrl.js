
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
