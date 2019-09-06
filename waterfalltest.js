var async = require('async');


async.waterfall([
    function(cb){
        var data = 1;
        console.log(data);
        cb(null, data);
    },
    function(data, cb){
        console.log(data);
        return cb(null, data);
    },
    function(data, cb){
        data =2;
        console.log(data);
        cb(null, data);
    }
],function(error, results){
    if(error){
        console.log(error);
        return;
    }
    console.log(results);
})