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
