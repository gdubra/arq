
module.exports = function ($scope, $http, $state, $stateParams, ajaxInfo, $localStorage, $q, eventBus) {
    
    $scope.init = function () {
        $scope.users = {};
        $scope.user = {};
    };
    
    var initNgState = function () {
        switch ($state.current.name) {
            case 'root.user.index':
                $scope.initUserIndex();
                break;
            case 'root.user.show':
                $scope.initUserShow($stateParams.userId);
                break;
            case 'root.user.edit':
                $scope.initUserShow($stateParams.userId);
                break;
        }
    };

    $scope.$on('$destroy', eventBus.subscribe('modelEntity:perspective:switch', function () {
        initNgState();
    }));

    $scope.$on('$stateChangeSuccess', function () {
        initNgState();
    });

    $scope.initUserIndex = function () {
        setupUsersIndexFromBackEnd().then(function () {
            $scope.users = $localStorage.users;
        });
    };

    $scope.initUserShow = function (userId) {
        // Retrieve user from backend
        $scope.errors = new Array();
        $scope.setupUser(userId);

    };

    $scope.setupUser = function (userId) {
        var defer = $q.defer();
        var backEndPromise = $http.get(ajaxInfo.USER_GET.url.replace(':userId', userId));
        backEndPromise.success(function (data) {
            $scope.user = data
        });
        return backEndPromise;
    };
    
    $scope.deleteUser = function (userId) {
        $http.delete(ajaxInfo.USER_DELETE.url.replace(':userId', userId)).success(function (data) {
            delete $localStorage.users[userId];
        });
    };

    $scope.createUser = function () {
        var successCallback = function (response) {
            $state.go('root.user.edit', { userId: response.data.id});
        };
        var errorCallback = function (response) {
            $scope.errors = response.data.errors;
        };
        var parameters = {
            'user': $scope.user
        };
        $http.post(ajaxInfo.USER_CREATE.url, parameters).then(successCallback, errorCallback);
    };

    $scope.updateUserField = function (fieldName) {
        var entityTypeName = 'user';
        var formName = 'userForm';
        
        //if its not valid or has not been changed
        if(!$scope[formName][fieldName].$valid || $scope[formName][fieldName].$pristine) {
            return;
        }
        
        var entity = {};
        
        entity[fieldName] = $scope[formName][fieldName].$modelValue;
        var parameters = {};
        parameters[entityTypeName] = entity;
        var successCallback = function (response) {
            $scope[formName][fieldName].$pristine = true;
            $scope[formName][fieldName].$dirty = true;
        };
        var errorCallback = function (response) {
            $scope.errors = response.errors;
        };
        return $http.put(ajaxInfo.USER_UPDATE.url.replace(':userId', $scope.user.id), parameters)
                .success(successCallback).error(errorCallback);
    };

    var setupUsersIndexFromBackEnd = function () {
        // Retrieve users list from backend
        var backEndPromise = $http.get(ajaxInfo.USER_INDEX.url);
        backEndPromise.then(function (response) {
            $localStorage.users = response.data;
        });

        return backEndPromise;
    };

    // Initialize controller
    $scope.init();

};
