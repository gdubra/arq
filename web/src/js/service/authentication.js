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
