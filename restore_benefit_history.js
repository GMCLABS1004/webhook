var webSetting = require('./webSetting');
var mongoose = require('mongoose');
var orderDB = require('./models/order');
var benefitDB = require('./models/benefit.js');
var async = require('async');
mongoose.connect(webSetting.dbPath, function(error){
    orderDB.find({site : {$regex : "bitmex"}, type : "exit"}).sort({start_time : "asc"}).exec(function(error, json){
        if(error){
            console.log(error);
            return;
        }
        // var length = json.length-1;
        // console.log(length);
        // var site = json[length].site;
        // var start_time = json[length].start_time;
        // var end_time = json[length].end_time;
        // var benefit = json[length].benefit;
        // var type_log = json[length].type_log;
        // setTimeout(restore_benefit_history(site, start_time, end_time, benefit, type_log), 0);
        console.log("count : "+ json.length);
        for(i in json){
            var site = json[i].site;
            var start_time = json[i].start_time;
            var end_time = json[i].end_time;
            var benefit = json[i].benefit;
            var type_log = json[i].type_log;
            setTimeout(restore_benefit_history(site, start_time, end_time, benefit, type_log), i *100);
        }
    });
});


function restore_benefit_history(site, start_time, end_time, benefit, type_log){
    return function(){
        // console.log(start_time);
        // console.log(end_time);
        var start_asset_sum = 0;
        var end_asset_sum = 0;
        async.waterfall([
            //첫 자산들 총합
            function get_start_asset_sum(cb){

                //최초 한번만 실행
                get_total_asset(start_time, "asc",function(error, asset){
                    if(error){
                        console.log(error);
                        return;
                    }
                    // console.log("start_asset : "+asset);
                    start_asset_sum = asset;
                    cb(null);
                });
            }, 
            function get_end_asset_sum(cb){ //탈출전 자산 합

                //최초 한번만 실행
                get_total_asset(start_time, "desc",function(error, asset){
                    if(error){
                        console.log(error);
                        return;
                    }
                    // console.log("end_asset : "+asset);

                    end_asset_sum = asset;
                    cb(null);
                });
            },
            function restore(){
                var obj = {
                    site : site,
                    start_asset_sum : fixed8(start_asset_sum),
                    end_asset_sum : fixed8(end_asset_sum),
                    before_asset_sum : fixed8(end_asset_sum),  //최근 자산들 총합(탈출전)
                    after_asset_sum : fixed8(end_asset_sum + benefit),//최근 자산들 총합(탈출후)
                    benefit : fixed8(benefit),
                    benefitRate : (benefit / end_asset_sum) * 100,
                    type_log : type_log,
                    timestamp : end_time,
                    start_time : start_time,
                    end_time : end_time,
                }
                
                benefitDB.insertMany(obj, function(error, json){
                    if(error){
                        return;
                    }
                    console.log(json);
                })
            }
            
        ], function(error, results){

        })
    }
}

function get_total_asset(timestamp, isSort, callback){
    var list = [];
    var total_asset=0;
    for(var i=1; i<=10; i++){
      orderDB.findOne({"site" : "bitmex"+i, "start_time" : {"$lt" : timestamp}}).sort({"start_time" : isSort}).limit(1).exec(function(error, json){
        if(error){
          console.log(error);
          return;
        }
        
        list.push(json);
        if(json !== null){
          total_asset += json.totalAsset;
        }
        
        if(list.length === 10){
            // console.log("totalAsset : "+ total_asset);
            // console.log(list);
            
            callback(null, total_asset);
        }
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