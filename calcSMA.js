var mongoose = require('mongoose');
var webSetting = require('./webSetting');
var bid_1h = require('./models/bid_1h');


mongoose.connect(webSetting.dbPath, function(error){
    if(error){
        console.log(error);
        return;
    }
    // //SMA 계산
    // bid_1h.find({}).sort({timestamp : 'desc'}).exec(function(error, list){
    //     if(error){
    //         console.log(error);
    //         return;
    //     }
    //     var standard = "low"
    //     for(var idx=0; idx<list.length; idx++){
    //         var SMA = {
    //             sma1 : getSMA8(list, idx, standard),
    //             sma2 : getSMA26(list, idx, standard),
    //             sma3 : getSMA54(list, idx, standard),
    //             sma4 : getSMA90(list, idx, standard),
    //             sma5 : getSMA340(list, idx, standard),
    //         }
    //         bid_1h.findByIdAndUpdate(list[idx]._id, {$set : SMA}, function(error, res){
    //             if(error){
    //                 console.log(error);
    //                 return;
    //             }
    //             console.log(res);
    //         });
    //     }
    // });

    bid_1h.find({}).sort({timestamp : 'asc'}).exec(function(error, list){
        if(error){
            console.log(error);
            return;
        }
        var standard = "low"
        for(var idx=0; idx<list.length; idx++){
            var EMA = {
                ema : getEMA340(list, idx, standard)
            }
            bid_1h.findByIdAndUpdate(list[idx]._id, {$set : EMA}, function(error, res){
                if(error){
                    console.log(error);
                    return;
                }
                console.log(res);
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

function getSMA8(list, idx, standard){
    if( (idx+7) > (list.length-1) ){
        return 0;
    }
    var sma =0;
    for(var i=idx; i<=idx+7; i++){
        sma += list[i][standard];
    }
    return fixed1(sma / 8);
}


function getSMA26(list, idx, standard){
    if( idx+15 > list.length-1 ){
        return 0;
    }
    var sma =0;
    for(var i=idx; i<=idx+15; i++){
        sma += list[i][standard];
    }
    return fixed1(sma / 16);
}

function getSMA54(list, idx, standard){
    if( idx+53 > list.length-1 ){
        return 0;
    }
    var sma =0;
    for(var i=idx; i<=idx+53; i++){
        sma += list[i][standard];
    }
    return fixed1(sma / 54);
}

function getSMA90(list, idx, standard){
    if( idx+89 > list.length-1 ){
        return 0;
    }

    var sma =0;
    for(var i=idx; i<=idx+89; i++){
        sma += list[i][standard];
    }
    return fixed1(sma / 90);
}


function getSMA340(list, idx, standard){
    if(idx+339 > list.length-1){
        return 0;
    }

    var sma =0;
    for(var i=idx; i<=idx+339; i++){
        sma += list[i][standard];
    }
    return fixed1(sma / 340);
}

function getEMA340(list, idx, standard){
    if(idx < 339){
        return 0;
    }

    if(idx === 339){
        return list[idx]["sma5"];
    }   
    
    ema = (list[idx][standard] - list[idx-1]["ema"]) * (2/(340+1) + list[idx-1]["ema"]);
    return fixed1(ema);
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


//     ema = (list[idx][standard] - list[idx-1]["ema"]) * (2/(340+1) + list[idx-1]["ema"]);
//     return fixed1(ema);
// }

