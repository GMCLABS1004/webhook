var async = require('async');
var crypto = require('crypto');
var request = require('request');
var order = require("./models/order");
var setting = require("./models/setting");
var script = require("./models/script");
var position = require("./models/position");
var position2 = require("./models/position2");
var margin = require("./models/margin");
var ticker = require("./models/ticker");
var webSetting = require("./webSetting");
var mongoose = require('mongoose');
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
});
setTimeout(positionAll(), 0);
setInterval(positionAll(), 10000);

function positionAll(){
    return function(){
        var list = [];
        var last_price = 0;
      // console.log(res);
        async.waterfall([
        function readSetting(cb){
          var set_list =[];
          setting.find({execFlag : true},function(error,res){
            if(error){
              console.log(error);
              return;
            }
            // console.log("readSetting");
            // console.log(res);
          
            for(i=0; i<res.length; i++){
              if(res[i].site.indexOf('bitmex') !== -1){
                set_list.push(res[i]);    
              }
            }
            cb(null, set_list);
          });
        },
        function get_last_price(set_list, cb){
          
          if(set_list.length > 0){
            ticker.findOne({site : "bitmex"}, function(error, json){
                if(error){
                    console.log(error);
                    return;
                }
                last_price = json.last_price;
                cb(null, set_list); 
            });
          }else{
            cb(null, set_list);
          }
        },
        function getPosition(set_list, cb){
          for(i=0; i<set_list.length; i++){
            setTimeout(getPosition_bitmex(set_list[i], function(error, data){
              if(error){
                console.log(error);
                return;
              }
            //   console.log("getPosition");
            //   console.log(data);
              // console.log("data : ");
              // console.log(data);
    
              list.push(data);
              if(set_list.length === list.length){
    
                cb(null);
              }
            }), 0);
          }
        },
        function readScriptInfo(cb){
          if(list.length === 0){
            return cb(null);
          }
    
          script.find({}, function(error, res){
            if(error){
              console.log(error);
              return;
            }
    
            for(i=0; i<list.length; i++){
              list[i].scriptName = "";
              list[i].version = "";
            }
    
            for(i=0; i<list.length; i++){
              for(j=0; j<res.length; j<j++){
                if(list[i].scriptNo === res[j].scriptNo){
                  list[i].scriptName = res[j].scriptName
                  list[i].version = res[j].version;
                }
              }
            }
            cb(null);
          })
        }
    ], function(error, results){
            if(error){
                console.log(error);
            }
             console.log("waterfall 결과");
             console.log(list);
            
            //console.log('last_price : '+ last_price);
            list.sort(function(a,b){ //수량을 오름차순 정렬(1,2,3..)
                return a.site.split('bitmex')[1] - b.site.split('bitmex')[1];
            });
            //console.log({site_type : "oversee", last_price : last_price, list : list});
            var data = {site_type : "oversee", last_price : last_price, list : list};
            console.log(data);
            // position.findOneAndUpdate(
            //     {site_type : "oversee"},
            //     {$set : data},
            //     {upsert : true},
            //     function(error, body){
            //         if(error){
            //             console.log(error);
            //             return;
            //         }
            //         //console.log(body);
            //     }
            // )
        });
    }
}


function getPosition_bitmex(set, cb){
    return function(){
        position2.findOne({site : set.site}, function(error, obj){
            if(error){
                console.log(err);
                return;
            }
            // console.log("getPosition_bitmex");
            // console.log(body);
            //var obj = JSON.parse(body)
            var data = {};
            data["site"] = obj.site;
            data["avgEntryPrice"] = obj.avgEntryPrice;
            data["isOpen"] = obj.isOpen;
            data["realisedPnl"] = obj.realisedPnl;
            data["unrealisedPnl"] = obj.unrealisedPnl;
            data["size"] = obj.size;
            data["value"] = obj.value;
            

            data["leverage"] = set.leverage;
            data["margin"] = set.margin;
            data["scriptNo"] = set.scriptNo;
            data["side_num"] = set.side_num;
            data["pgSide"] = set.side;
            
            //setTimeout(correct_wrong_pgside(data.size,  data["pgSide"], new Object(set) ),0);
            
            margin.findOne({site : set.site},function(error, json){
                if(error){
                    console.log(err);
                    return;
                }
                data["walletBalance"] = json.walletBalance;

                //최초자산 조회
                order.find({site : set.site}).sort({start_time : "asc"}).limit(1).exec(function(error, body){
                    if(error){
                        console.log(error);
                        
                        return;
                    }
                    // console.log(body);
                    if(body.length > 0){
                        //console.log("")
                        data["walletBalance_before"] = body[0].totalAsset;
                    }else{
                        data["walletBalance_before"] = data.walletBalance;
                    }
                    cb(null, data);
                });
            });
            
        });
    }
}