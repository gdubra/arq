module.exports = function ($localStorage) {

    var set = function (key, value) {
        if ($localStorage.customCache == undefined) {
            $localStorage.customCache = {};
        }
        $localStorage.customCache[key] = value;
    };
    
    var unset = function (key) {
        if ($localStorage.customCache != undefined) {
            $localStorage.customCache[key] = undefined;
        }
    };
    
    var get = function (key) {
        if ($localStorage.customCache != undefined && $localStorage.customCache[key] != undefined) {
            return $localStorage.customCache[key];
        } else {
            return undefined;
        }
    };
    
    return {
        set: set,
        unset: unset,
        get: get
    };

};