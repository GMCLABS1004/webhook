var async = require('async');
setTimeout(bitmex({scriptNo :3}), 1000);
function bitmex(_signal){
    return function(){
        async.waterfall([
           function(cb){
                return cb(null);
           }
        ], function(error, results){
            console.log("11");
            console.log(_signal);
        });
    }
}
