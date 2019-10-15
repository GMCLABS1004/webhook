var async = require('async');


// async.waterfall([
//     function(cb){
//         var data = 1;
//         console.log(data);
//         cb(null, data);
//     },
//     function(data, cb){
//         console.log(data);
//         return cb(null, data);
//     },
//     function(data, cb){
//         data =2;
//         console.log(data);
//         cb(null, data);
//     }
// ],function(error, results){
//     if(error){
//         console.log(error);
//         return;
//     }
//     console.log(results);
// })


async.waterfall([
    function(cb){
        setTimeout(print(1), 1000);
        setTimeout(print(2), 2000);
        setTimeout(print(3), 2000);
        cb(null, "완료");
    }
   
],function(error, results){
    if(error){
        console.log(error);
        return;
    }
    console.log(results);
})

function print(idx){
    return function(){
        console.log(idx);
    }
}