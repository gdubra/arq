module.exports = function ($scope, $state, authentication) {

    $scope.loginModel = {};
    $scope.isBusy = false;

    $scope.init = function () {

    };
    
    $scope.$on('$stateChangeSuccess', function () {
        switch ($state.current.name) {
            case 'root.access.login':
                $scope.initAccessLogin();
                break;
            case 'root.access.logout':
                $scope.logout();
                break;
        }
    });
    
    $scope.initAccessLogin = function() {
        if ($scope.loginModel._csrf_token == undefined) {
            authentication.requestLoginCSRFToken().then(function(response) {
                $scope.loginModel._csrf_token = response.csrf_token;
            }, function(data) {
                $scope.globalError = 'Oops! Our log in system is having some technical difficulties right now.';
            })['finally'](function() {
                $scope.isBusy = false;
            });
        }
    };
    
    $scope.login = function () {
        
        $scope.globalError = null;
        $scope.isBusy = true;
        
        authentication.login($scope.loginModel).then(function (response) {
            $state.go('root.homepage', {}, {reload: true});
        }, function (data) {
            $scope.globalError = 'Oops! It appears that either your username or password is incorrect.';
        })['finally'](function () {
            $scope.isBusy = false;
        });
    };

    $scope.logout = function(){
        authentication.logout();
    };  

    $scope.init();

};
