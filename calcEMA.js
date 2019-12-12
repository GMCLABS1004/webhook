var mongoose = require('mongoose');
var webSetting = require('./webSetting');
var bid_1h = require('./models/bid_1h');


mongoose.connect(webSetting.dbPath, function(error){
    if(error){
        console.log(error);
        return;
    }

    // timestamp : {$gte : new Date("2018-01-01T09:00:00:00:000Z")}
    // bid_1h.find({"timestamp" : {"$gte": new Date("2018-01-01T09:00:00.000Z") }}).sort({timestamp : 'asc'}).limit(10).exec(function(error, list){
    //     if(error){
    //         console.log(error);
    //         return;
    //     }
    //     console.log(list);
    // });
    //{"timestamp" : {"$gte": new Date("2018-01-01T09:00:00.000Z") }}
    bid_1h.find({"timestamp" : {"$gte": new Date("2018-01-01T09:00:00.000Z") }}).sort({timestamp : 'asc'}).exec(function(error, list){
        if(error){
            console.log(error);
            return;
        }
        var standard = "low"
        var beforeEMA =0;
        for(var idx=0; idx<list.length; idx++){
            
            var obj = {
                ema : getEMA340(list, idx, standard, beforeEMA)
            }
            beforeEMA = obj.ema;
            bid_1h.findByIdAndUpdate(list[idx]._id, {$set : obj}, function(error, res){
                if(error){
                    console.log(error);
                    return;
                }
                //console.log(res);
            });
        }
    });

});
function fixed1(num){
    var str = new String(num);
    var arr = str.split(".");
    if(arr.length>1){
        var str2 = arr[1].slice(0,1);
        return Number(arr[0] + '.' + str2);	
    }
    return Number(arr[0]);
}



function getEMA340(list, idx, standard, beforeEMA){
    var ema =0;
    if(idx < 339){
        return 0;
    }

    if(idx === 339){
        return list[idx]["sma5"];
    }

    ema = ((list[idx][standard] - beforeEMA) * (2/(340+1))) + beforeEMA;
    
    console.log("ema : "+Number(ema).toFixed(11));
    return Number(Number(ema).toFixed(11));
    //return fixed1(ema);
}



// function getEMA340(list, idx, standard){
    
//     if(idx-1 < 0){
//         return 0;
//     }

//     if(idx < 339){
//         return 0;
//     }

//     if(idx === 339){
//         return list[idx+1]["sma5"];
//     }


//     ema = ((list[idx][standard] - list[idx-1]["ema"]) * (2/(340+1))) + list[idx-1]["ema"];
//     return fixed1(ema);
// }

