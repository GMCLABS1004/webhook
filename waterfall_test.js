var async = require('async');
var flag = false;
async.waterfall([
    function a(cb){
        console.log("a");
        return cb();
    },
    function b(cb){
        if(flag === false){
            return cb(); 
        }
        console.log("b");
        cb();
    }
], function(error, res){
    console.log("c");
});