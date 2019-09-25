var async = require('async');
var flag = false;
async.waterfall([
    function a(cb){
        console.log("a");
        return cb();
    },
    function b(cb){
        var str ="bbbbbb";
        setTimeout(function(){
            console.log(str);
            return cb();
        }, 2000);
    }
], function(error, res){
    console.log("c");
});

function kk(str, cb){
    return function(){
        console.log(str); 
        return cb();
    }
}