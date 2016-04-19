module.exports = function (userAccess, authorizationEnums) {

    var getAuthorizationLevel = function (loginRequired, requiredPermissions, permissionCheckType) {

        var result;
        var requiredPermissionsToView = [];
        var requiredPermissionsToAdmin = [];
        
        // Permissions can be an array of strings or an object with 2 arrays: one for view permissions and one for admin permissions
       
        // If it's a simple array of strings it means these are requiredPermissionsToView
        if (Array.isArray(requiredPermissions)) {
            
            requiredPermissionsToView = requiredPermissions;
            
        } else if (requiredPermissions !== null && typeof requiredPermissions === 'object') {
            
            // If it is an object then search for view and admin permissions
            if (requiredPermissions['view'] !== undefined) {
                requiredPermissionsToView = requiredPermissions['view'];
            }
            if (requiredPermissions['admin'] !== undefined) {
                requiredPermissionsToAdmin = requiredPermissions['admin'];
            }
            
        }

        if (loginRequired === true) {

            if (userAccess.isUserLoggedIn()) {

                if (requiredPermissionsToView.length === 0 && requiredPermissionsToAdmin.length === 0) {

                    // Login is required but no specific permissions are specified
                    result = authorizationEnums.authorised.authorisedToAdmin;

                } else {

                    // Login AND specific permissions are required

                    var grantedPermissions = userAccess.getUserModel().permissions;

                    // If the user is a manager (or more), then authorize right away
                    if (grantedPermissions.indexOf('ROLE_MANAGER') > -1) {

                        result = authorizationEnums.authorised.authorisedToAdmin;

                    } else {

                        permissionCheckType = permissionCheckType || authorizationEnums.permissionCheckType.atLeastOneRequired;
                        var hasPermissionToView;
                        var hasPermissionToAdmin;
                        var i;

                        if (permissionCheckType === authorizationEnums.permissionCheckType.allRequired) {

                            // All permissions are required. Halt if any permission is not found

                            // Check for user roles and for perspective pillar permissions
                            
                            // First see if it can be authorized to admin
                            hasPermissionToAdmin = true;
                            for (i = 0; i < requiredPermissionsToAdmin.length; i += 1) {
                                if (grantedPermissions.indexOf(requiredPermissionsToAdmin[i]) == -1) {
                                    hasPermissionToAdmin = false;
                                    break;
                                }
                            }
                            
                            // If it does not have permission to admin then check if it has permission to view
                            if (hasPermissionToAdmin === false) {
                                hasPermissionToView = true;
                                for (i = 0; i < requiredPermissionsToView.length; i += 1) {
                                    if (grantedPermissions.indexOf(requiredPermissionsToView[i]) == -1) {
                                        hasPermissionToView = false;
                                        break;
                                    }
                                }
                            }

                        } else if (permissionCheckType === authorizationEnums.permissionCheckType.atLeastOneRequired) {

                            // At least one permission is required. Halt if any permission is found
                            
                            // Check for user roles and for perspective pillar permissions
                            
                            // First see if it can be authorized to admin
                            hasPermissionToAdmin = false;
                            for (i = 0; i < requiredPermissionsToAdmin.length; i += 1) {
                                if (
                                        grantedPermissions.indexOf(requiredPermissionsToAdmin[i]) > -1 
                                        ) {
                                    hasPermissionToAdmin = true;
                                    break;
                                }
                            }

                            // If it does not have permission to admin then check if it has permission to view
                            if (hasPermissionToAdmin === false) {
                                hasPermissionToView = false;
                                for (i = 0; i < requiredPermissionsToView.length; i += 1) {
                                    if (
                                            grantedPermissions.indexOf(requiredPermissionsToView[i]) > -1
                                            ) {
                                        hasPermissionToView = true;
                                        break;
                                    }
                                }
                            }
                        }

                        // Set authorizedToAdmin, authorizedToView or notAuthorized based on permissions found
                        if (hasPermissionToAdmin === true) {
                            result = authorizationEnums.authorised.authorisedToAdmin;
                        } else if (hasPermissionToView === true) {
                            result = authorizationEnums.authorised.authorisedToView;
                        } else {
                            result = authorizationEnums.authorised.notAuthorised;
                        }

                    }

                }

            } else {

                // Login is required but the user is not logged in
                result = authorizationEnums.authorised.loginRequired;

            }

        } else {

            // No login is required
            result = authorizationEnums.authorised.authorisedToView;

        }

        return result;
    };

    return {
        getAuthorizationLevel: getAuthorizationLevel
    };

};