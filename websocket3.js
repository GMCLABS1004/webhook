var W3CWebSocket = require('websocket').w3cwebsocket;
var async = require('async');
var request = require('request');
var crypto = require('crypto');
var setting = require('./models/setting');
var margin = require('./models/margin');
var position2 = require('./models/position2');
var orderDB = require('./models/order');
var order_unfilled = require('./models/order_unfilled');
var benefitDB = require('./models/benefit.js');
var webSetting = require('./webSetting.json');
var mongoose = require('mongoose');
var set = require('./websocket.json');

if(set.testnet === true){
    console.log("테스트넷 실행");
    var client = new W3CWebSocket('wss://testnet.bitmex.com/realtimemd');
}else{
    console.log("본서버 실행");
    var client = new W3CWebSocket('wss://www.bitmex.com/realtimemd');
}

var crypto = require('crypto');
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
        console.log(error);
        return;
    }
    mongoose.set('useFindAndModify', false);
});

client.onerror = function(){
    console.log('Connection Error');
};
 
client.onopen = function(){
    console.log('WebSocket Client Connected');

    setting.find({site_type : 'oversee', execFlag : true}, function(error, json){
        if(error){
            console.log(error);
            return;
        }
        //console.log(json);
        for(var i=0; i<json.length; i++){
            var username = json[i].site;
            var apiKey = json[i].apiKey
            var secreteKey = json[i].secreteKey;
            var expires = new Date().getTime() //+ (60 * 1000); // 1 min in the future //4102358400
            var signature = crypto.createHmac('sha256', secreteKey).update('GET/realtime'+expires).digest('hex');
            
            //멀티플렉싱2
            client.send(JSON.stringify([1, username, username]));
            client.send(JSON.stringify([0, username, username, {"op": "authKeyExpires", "args": [apiKey, expires, signature]}]));
            //client.send(JSON.stringify([0, username, username, {"subscribe": "margin"}]));//margin, 
            client.send(JSON.stringify([0, username, username, {"op" : "subscribe", "args" : ["position", "margin","order"]}]));//margin, 

        }
    });
};
 
client.onclose = function(){
    console.log("[" + getCurrentTimeString() +"]" +  ' echo-protocol Client Closed');
    //setTimeout(startWebsocket(), 10000);
    setTimeout(function() {
        process.exit(1);//connect();
    }, 500);
};
 
client.onmessage = function(e){
    var json = JSON.parse(e.data);
    //유효한 데이터가 없으면 종료
    if(json[3].data === undefined){
        return;
    }

    // console.log(json);
    // console.log(json[1]);
    // console.log(json[3].table);
    // console.log(json[3].data);
    var username = json[1];
    var table = json[3].table;
    var data = json[3].data;
    if(table === "margin"){
        //console.log(data);
        for(var i=0; i<data.length; i++){
            if(data[i].currency === 'XBt'){
               //data[i] 업데이트
               //console.log(data);
               var obj = bitmex_margin_parse(username, data[i]);
               //마진정보 실시간 업데이트
                margin.findOneAndUpdate(
                    {site : username},
                    {$set : obj},
                    {upsert : true},
                    function(error, body){
                        if(error){
                            console.log(error);
                            return;
                        }
                        //console.log(body);
                        //console.log("margin 갱신");
                    }
                )
            }
        }
    }else if(table === "position"){
        //console.log(data);
        for(var i=0; i<data.length; i++){
            if(data[i].symbol === 'XBTUSD'){
                //data[i] 업데이트
                var obj = bitmex_position_parse(username, data[i]);
                
                //포지션정보 실시간 업데이트
                position2.findOneAndUpdate(
                    {site : username},
                    {$set : obj},
                    {upsert : true},
                    function(error, body){
                        if(error){
                            console.log(error);
                            return;
                        }
                        
                        //console.log("position 갱신");
                    }
                )
            }
        }
    }else if(table === "order"){
        for(var i=0; i<data.length; i++){
            if(data[i]["ordStatus"] === 'Filled' && data[i]["leavesQty"] === 0){ //data[i]["text"] === 'dilute' && 
                //물타기 한 주문이 체결되면 체결내역으로 데이터 이동
                // console.log(json);
                // console.log(json[3].data);

                console.log("[" + getCurrentTimeString() +"]" + "username : "+json[1]);
                console.log("[" + getCurrentTimeString() +"]" + "action : "+ json[3]["action"] );
                console.log("[" + getCurrentTimeString() +"]" + "orderID : "+ data[i]["orderID"]);   
                console.log("[" + getCurrentTimeString() +"]" + "ordStatus : "+data[i]["ordStatus"]); 
                console.log("[" + getCurrentTimeString() +"]" + "leavesQty : "+data[i]["leavesQty"]);     
                console.log("[" + getCurrentTimeString() +"]" + "text : "+data[i]["text"]);
                console.log("--------------");
                console.log("");
                setTimeout(move_unfilled_to_filled(username, data[i].orderID),3000);
            }
        }
    }
}

function move_unfilled_to_filled(site, orderID){
    return function(){
        console.log("[" + getCurrentTimeString() +"]" + "move_unfilled_to_filled 실행!!!");
        var myPos = {
            walletBalance : 0,
            avgEntryPrice : 0,
            highPrice : 0,
            lowPrice : 0,
            side : "",
            amount : 0
        }
        var unfilled ={};
        var totalAsset =0;
        var type = "";
        var benefit =0;
        var benefitRate =0;
        var isBnefitHis = false;
        var start_time = "";
        var end_time = "";
        var filled = {
            walletBalance : 0,
            side : "",
            amount : 0,
        }
        
        var updateObj = {}

        async.waterfall([
            function remove_unfilled_order(cb){
                //미체결 내역 조회
                order_unfilled.findOneAndRemove({orderID : orderID}, function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }

                    if(json === null){ //조회결과 없으면
                        console.log("[" + getCurrentTimeString() +"]" + "미체결 조회결과 없음");
                        return;
                    }

                    console.log("[" + getCurrentTimeString() +"]" + "미체결 주문 검색-> 삭제!!");
                    console.log(json);
                    unfilled = new Object(json);
                    cb(null);
                });
            },
            function get_margin(cb){ //총자산 조회
                margin.findOne({site : site}, function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }
                    //console.log(json);
                    
                    myPos.walletBalance =json.walletBalance; //총자산
                    cb(null);
                });
            },
            function get_postion(cb){ //진입평균가, 진입수량, 실제 포지션 조회
                position2.findOne({site : site}, function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }
                    
                    myPos.avgEntryPrice = fixed1(json.avgEntryPrice); //진입평균가
                    myPos.amount = json.size; //사이즈 
                    
                    //실제 포지션
                    if(json.size > 0){
                        myPos.side = "long";
                    }else if(json.size < 0){
                        myPos.side = "short";
                    }else{
                        myPos.side = "exit";
                    }
                    cb(null);
                });
            },
            function get_filled_history(cb){ //체결내역 조회
                orderDB.findOne({site : site}).sort({start_time : "desc"}).limit(1).exec(function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }
                    filled.walletBalance = json.totalAsset;
                    filled.side = json.type; //long, short, exit
                    filled.amount = json.amount;
                    cb(null);
                });
            },
            function isCondition(cb){
                if(filled.side === 'long' && Math.abs(myPos.amount) > filled.amount && Math.abs(myPos.amount) > unfilled.orderQty){
                    console.log("[" + getCurrentTimeString() +"]" + "물타기 Buy");
                    type = "long"
                    totalAsset = filled.walletBalance;
                    updateObj["entryPrice"] = myPos.avgEntryPrice;
                    return cb(null);
                }

                if(filled.side === 'short' && Math.abs(myPos.amount) > filled.amount && Math.abs(myPos.amount) > unfilled.orderQty){
                    console.log("[" + getCurrentTimeString() +"]" + "물타기 Sell");
                    type = "short"
                    totalAsset = filled.walletBalance;
                    updateObj["entryPrice"] = myPos.avgEntryPrice;
                    return cb(null);
                }

                if(filled.side === 'exit' && myPos.amount > 0){
                    console.log("[" + getCurrentTimeString() +"]" + "진입 Buy");
                    type="long";
                    totalAsset = filled.walletBalance;
                    updateObj["side"] = 'long';
                    updateObj["entryPrice"] = unfilled.price;
                    updateObj["highPrice"] = unfilled.price;
                    updateObj["lowPrice"] = unfilled.price;
                    return cb(null);
                }

                if(filled.side === 'exit' && myPos.amount < 0){
                    console.log("[" + getCurrentTimeString() +"]" + "진입 Sell");
                    type = "short"
                    totalAsset = filled.walletBalance;
                    updateObj["side"] = 'short';
                    updateObj["entryPrice"] = unfilled.price;
                    updateObj["highPrice"] = unfilled.price;
                    updateObj["lowPrice"] = unfilled.price;
                    return cb(null);
                }

                if(filled.side === 'long' && filled.side === myPos.side && 0 < Math.abs(myPos.amount) && Math.abs(myPos.amount) < filled.amount){
                    console.log("[" + getCurrentTimeString() +"]" + "Buy 절반탈출");
                    type = "exit"
                    isBnefitHis = true;
                    totalAsset = myPos.walletBalance;
                    benefit = myPos.walletBalance - filled.walletBalance;
                    benefitRate = (benefit / myPos.walletBalance) * 100;
                    updateObj = null;
                    return cb(null);
                }

                if(filled.side === 'short' && filled.side === myPos.side && 0 < Math.abs(myPos.amount) && Math.abs(myPos.amount) < filled.amount){
                    console.log("[" + getCurrentTimeString() +"]" + "Sell 절반탈출");
                    type = "exit"
                    isBnefitHis = true;
                    totalAsset = myPos.walletBalance;
                    benefit = myPos.walletBalance - filled.walletBalance;
                    benefitRate = (benefit / myPos.walletBalance) * 100;
                    updateObj = null;
                    return cb(null);
                }

                if(myPos.amount === 0){
                    console.log("[" + getCurrentTimeString() +"]" + "완전탈출");
                    type = "exit"
                    isBnefitHis = true;
                    totalAsset = myPos.walletBalance;
                    benefit = myPos.walletBalance - filled.walletBalance;
                    benefitRate = (benefit / myPos.walletBalance) * 100; 

                    updateObj["side"] = 'exit';
                    updateObj["entryPrice"] = unfilled.price;
                    updateObj["highPrice"] = unfilled.price;
                    updateObj["lowPrice"] = unfilled.price;
                    return cb(null);
                }
            },
            function insert_filled_order(cb){
                var totalOrdValue = unfilled.orderQty / unfilled.price
                var obj={
                    site : site,
                    symbol : 'XBTUSD',
                    totalAsset : totalAsset,//walletBalance, //총자산
                    type : type, //exit, long, short
                    side : unfilled.side, //Buy or Sell
                    side_num : 0,
                    start_price : fixed1(unfilled.price), //가격
                    end_price :  fixed1(unfilled.price), //가격
                    price :  fixed1(unfilled.price), //가격
                    amount : unfilled.orderQty, //수량
                    value : fixed4(totalOrdValue), //가치
                    feeRate : 0.075 * 0.01,
                    fee : fixed8(totalOrdValue * (0.075 * 0.01) ),
                    benefit : fixed8(benefit),
                    benefitRate : fixed4(benefitRate),
                    div_cnt : 1,
                    start_time : new Date().getTime() + (1000 * 60 * 60 * 9),
                    end_time : new Date().getTime() + (1000 * 60 * 60 * 9),
                    type_log : "limit order",
                    isSend : false //telegram 전송여부
                }
                start_time = obj.start_time;
                end_time = obj.end_time;
                orderDB.insertMany(obj, function(error, res){
                    if(error){
                        console.log(error);
                        return;
                    }
                    console.log("[" + getCurrentTimeString() +"]" + "이동한 체결내역");
                    console.log(res);
                    cb(null);
                });
            },
            function insert_benefit_history(cb){
                if(isBnefitHis === true){
                    setTimeout(restore_benefit_history(site, start_time, end_time, benefit, "limit order"), 0);
                }
                cb(null);
            },
            function change_status(cb){
                if(updateObj === null){
                    console.log("[" + getCurrentTimeString() +"]" +"상태값변경변경X");
                    return cb(null);
                }

                setting.updateOne({site : site}, {$set : updateObj}, function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }
                    console.log("[" + getCurrentTimeString() +"]" +"상태값변경!");
                    cb(null);
                });
            },
   
        ], function(error, results){
            if(error){
                console.log(error);
                return;
            }
            console.log("[" + getCurrentTimeString() +"]" +"move_unfilled_to_filled 실행!!!");
        });
    }
}


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

function getType(side){
    if(side ==='Buy' || side ==='bid'){
        return 'long'
    }else if(side ==='Sell' || side ==='ask'){
        return 'short'
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

function fixed4(num){
    var str = new String(num);
    var arr = str.split(".");
	if(arr.length>1){
		    var str2 = arr[1].slice(0,4);
    	return Number(arr[0] + '.' + str2);	
	}
	return Number(arr[0])
}

function fixed1(num){
    var str = new String(num);
    var arr = str.split(".");
    if(arr.length>1){
        var str2 = arr[1].slice(0,1);
        return Number(arr[0] + '.' + str2);	
    }
    return Number(arr[0]);
}

function fixed2(num){
    var str = new String(num);
    var arr = str.split(".");
    if(arr.length>1){
        var str2 = arr[1].slice(0,2);
        return Number(arr[0] + '.' + str2);	
    }
    return Number(arr[0]);
}

function bitmex_margin_parse(site, obj){
    var posObj = {};
    posObj["site"] = site;
   // console.log(obj);
    if(typeof(obj.walletBalance) !== "undefined" && obj.walletBalance !== null)
        posObj["walletBalance"] = obj.walletBalance / 100000000;
  
    if(typeof(obj.marginBalance) !== "undefined" && obj.marginBalance !== null) 
        posObj["marginBalance"] = obj.marginBalance / 100000000;
  
    if(typeof(obj.availableMargin) !== "undefined" && obj.availableMargin !== null) 
        posObj["availableMargin"] = obj.availableMargin / 100000000;

    if(typeof(obj.marginLeverage) !== "undefined" && obj.marginLeverage !== null) 
        posObj["marginLeverage"] = obj.marginLeverage;
    
    if(typeof(obj.marginUsedPcnt) !== "undefined" && obj.marginUsedPcnt !== null) 
        posObj["marginUsedPcnt"] = obj.marginUsedPcnt ;
    return posObj;
  }


function bitmex_position_parse(site, obj){
    var posObj = {
        site : site
    };
   // console.log(obj);
    if(typeof(obj.isOpen) !== "undefined" && obj.isOpen !== null){
        posObj["isOpen"] = new Boolean(obj.isOpen);
        // //포지션 닫혀있으면 0으로 값초기화 하여 업데이트
        if(obj.isOpen === false){
            return {
                site : site,
                size : 0,
                value : 0,
                avgEntryPrice : 0,
                markPrice : 0,
                liquidationPrice : 0,
                margin : 0,
                leverage : 0,
                unrealisedPnl : 0,
                unrealisedRoePcnt : 0,
                realisedPnl : 0,
                isOpen : false
            }
        }
    }
        

    

    if(typeof(obj.symbol) !== "undefined" && obj.symbol !== null)
        posObj["symbol"] = obj.symbol;
    
    if(typeof(obj.currentQty) !== "undefined" && obj.currentQty !== null) 
        posObj["size"] = obj.currentQty;
    
    if(typeof(obj.homeNotional) !== "undefined" && obj.homeNotional !== null) 
        posObj["value"] = obj.homeNotional;
  
    if(typeof(obj.avgEntryPrice) !== "undefined" && obj.avgEntryPrice !== null){
      posObj["avgEntryPrice"] = obj.avgEntryPrice;
    }
    // else{
    //   posObj["avgEntryPrice"] = 0;
    // }
        
  
    if(typeof(obj.markPrice) !== "undefined" && obj.markPrice !== null) 
        posObj["markPrice"] = obj.markPrice;
  
    if(typeof(obj.liquidationPrice) !== "undefined" && obj.liquidationPrice !== null) 
        posObj["liquidationPrice"] = obj.liquidationPrice;
  
    if(typeof(obj.maintMargin) !== "undefined" && obj.maintMargin !== null) 
        posObj["margin"] = obj.maintMargin;
  
    if(typeof(obj.leverage) !== "undefined" && obj.leverage !== null)
        posObj["leverage"] = obj.leverage;
  
    if(typeof(obj.unrealisedPnl) !== "undefined" && obj.unrealisedPnl !== null) 
        posObj["unrealisedPnl"] =  obj.unrealisedPnl * 0.00000001;
    
    if(typeof(obj.unrealisedRoePcnt) !== "undefined" && obj.unrealisedRoePcnt !== null) 
        posObj["unrealisedRoePcnt"] = obj.unrealisedRoePcnt;
  
    if(typeof(obj.realisedPnl) !== "undefined" && obj.realisedPnl !== null) 
        posObj["realisedPnl"] = obj.realisedPnl * 0.0000000001;
    
    
    

    return posObj;
  }


  function getCurrentTimeString(){
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var CurrentDateTime = date+' '+time;
    return CurrentDateTime;
  }