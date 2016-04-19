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
