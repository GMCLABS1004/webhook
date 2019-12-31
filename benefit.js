var webSetting = require('./webSetting.json');
var mongoose = require('mongoose');
var async = require('async');
mongoose.connect(webSetting.dbPath);
var randomInt = require('random-int');
var benefitDB = require('./models/benefit.js');

console.log(randomInt(0, 10));
console.log(randomInt(0, 10));
console.log(randomInt(0, 10));
console.log(randomInt(0, 10));
console.log(randomInt(0, 10));
setTimeout(calc_benefit_rate(), 2000);

function calc_benefit_rate(){
    return function(){
        filled_data = {};
        var end_asset_sum = 0;
        var before_asset_sum = 0;
        //var after_asset_sum = 0;
        async.waterfall([
            function init(cb){
                //체결된 주문중 가장 최근 주문 1개
                benefitDB.find({end_asset_sum : {$gt : 0}}).sort({"start_time" : "desc"}).limit(1).exec(function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }
                    console.log(json);
                    if(json.length > 0){
                        filled_data=new Object(json[0]);
                        end_asset_sum = filled_data.after_asset_sum;
                        before_asset_sum = filled_data.after_asset_sum;
                        cb(null);
                    }else{
                        return;
                    }
                   
                });
            },
            function calc(cb){
                //수익율 계산안된 모든 목록들 수익율 계산
                benefitDB.find({end_asset_sum : 0, before_asset_sum : 0, after_asset_sum : 0}).sort({"start_time" : "asc"}).exec(function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }

                    for(var i=0; i<json.length; i++){
                        var obj  = {
                            end_asset_sum : fixed8(end_asset_sum),
                            before_asset_sum : fixed8(before_asset_sum),
                            after_asset_sum : fixed8(before_asset_sum + json[i].benefit),
                            benefitRate : (json[i].benefit / end_asset_sum) * 100,
                        }
                        console.log(obj);
                        benefitDB.findByIdAndUpdate(
                            json[i]._id,
                            {$set : obj},
                            function(error, res){
                                if(error){
                                    console.log(error);
                                    return;
                                }
                            }
                        )
                        end_asset_sum = obj.after_asset_sum;
                        before_asset_sum = obj.after_asset_sum;
                    }
                    cb(null);
                });
            }
        ], function(error, res){
            if(error){
                console.log(error);
                return;
            }
            console.log(res);
        });
    }
}
function fixed8(num){
    var str = new String(num);
    var arr = str.split(".");
	if(arr.length>1){
		    var str2 = arr[1].slice(0,8);
    	return Number(arr[0] + '.' + str2);	
	}
	return Number(arr[0])
}