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