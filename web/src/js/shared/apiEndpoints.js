
// API URLs
var request_format = '.json';
var api_version = '';
var api_base_url = '';
if (window.api_base_url != undefined) {
    api_base_url = window.api_base_url;
}


module.exports = {
        
    "LOGIN_REQUEST": {
        "url": api_base_url + api_version + "/" + "login_request"
    },
    "LOGIN_CHECK": {
        "url": api_base_url + api_version + "/" + "login_check"
    },
    "USER_INDEX": {
        "url": api_base_url + api_version + "/" + "users" + request_format
    },
    "USER_GET": {
        "url": api_base_url + api_version + "/" + "users" + "/" + ":userId" + request_format
    },
    "USER_UPDATE": {
        "url": api_base_url + api_version + "/" + "users" + "/" + ":userId" + request_format
    },
    "USER_CREATE": {
        "url": api_base_url + api_version + "/" + "users" + request_format
    },
    "USER_DELETE": {
        "url": api_base_url + api_version + "/" + "users" + "/" + ":userId" + request_format
    },
    "USER_GET_ALL_ROLES": {
        "url": api_base_url + api_version + "/" + "users" + '/roles' + request_format
    }
        
};
