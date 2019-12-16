var mongoose = require('mongoose');
var webSetting = require('./webSetting');
var bid_1h = require('./models/bid_1h');


mongoose.connect(webSetting.dbPath, function(error){
    if(error){
        console.log(error);
        return;
    }
    //{"timestamp" : {"$gte": new Date("2018-01-01T09:00:00.000Z") }}
    //SMA 계산
    bid_1h.find({}).sort({timestamp : 'desc'}).exec(function(error, list){
        if(error){
            console.log(error);
            return;
        }
        var standard = "low"
        for(var idx=0; idx<list.length; idx++){
            var SMA = {
                sma1 : getSMA8(list, idx, standard),
                sma2 : getSMA26(list, idx, standard),
                sma3 : getSMA54(list, idx, standard),
                sma4 : getSMA90(list, idx, standard),
                sma5 : getSMA340(list, idx, standard),
            }
            bid_1h.findByIdAndUpdate(list[idx]._id, {$set : SMA}, function(error, res){
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
    return Number(Number(sma / 8).toFixed(11));
    //return fixed1(sma / 8);
}


function getSMA26(list, idx, standard){
    if(idx+25 > list.length-1){
        return 0;
    }
    var sma =0;
    for(var i=idx; i<=idx+25; i++){
        sma += list[i][standard];
    }
    return Number(Number(sma / 26).toFixed(11));
    //return fixed1(sma / 26);
}

function getSMA54(list, idx, standard){
    if( idx+53 > list.length-1 ){
        return 0;
    }
    var sma =0;
    for(var i=idx; i<=idx+53; i++){
        sma += list[i][standard];
    }
    return Number(Number(sma / 54).toFixed(11));
    //return fixed1(sma / 54);
}

function getSMA90(list, idx, standard){
    if( idx+89 > list.length-1 ){
        return 0;
    }

    var sma =0;
    for(var i=idx; i<=idx+89; i++){
        sma += list[i][standard];
    }
    return Number(Number(sma / 90).toFixed(11));
    //return fixed1(sma / 90);
}


function getSMA340(list, idx, standard){
    if(idx+339 > list.length-1){
        return 0;
    }

    var sma =0;
    for(var i=idx; i<=idx+339; i++){
        sma += list[i][standard];
    }
    return Number(Number(sma / 340).toFixed(11));
    //return fixed1(sma / 340);
}


