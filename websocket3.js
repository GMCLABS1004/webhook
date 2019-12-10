var W3CWebSocket = require('websocket').w3cwebsocket;
var async = require('async');
var request = require('request');
var crypto = require('crypto');
var setting = require('./models/setting');
var margin = require('./models/margin');
var position2 = require('./models/position2');
var orderDB = require('./models/order');
var order_unfilled = require('./models/order_unfilled');
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
    }, 10000);
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
                        console.log("margin 갱신");
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
                    
                        console.log("position 갱신");
                    }
                )
            }
        }
    }else if(table === "order"){
        for(var i=0; i<data.length; i++){
            if(data[i]["ordStatus"] === 'Filled'){ //data[i]["text"] === 'dilute' && 
                //물타기 한 주문이 체결되면 체결내역으로 데이터 이동
                console.log("action : "+ json[3]["action"] );
                console.log("orderID : "+ data[i]["orderID"]);   
                console.log("ordStatus : "+data[i]["ordStatus"]);   
                console.log("text : "+data[i]["text"]);
                console.log("--------------");
                console.log("");
                setTimeout(move_unfilled_to_filled(username, data[i].orderID));
            }
        }
    }
}

function move_unfilled_to_filled(site, orderID){
    return function(){
        var data = {};
        var walletBalance = 0;
        async.waterfall([
            function remove_unfilled_order(cb){
                order_unfilled.findOneAndRemove({orderID : orderID}, function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }
                    if(json === null){ //조회결과 없으면
                        return;
                    }
                    //console.log(json);
                    data = new Object(json);
                    cb(null);
                });
            },
            function get_wallet_balance(cb){
                margin.findOne({site : site}, function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }

                    //console.log(json);
                    walletBalance =json.walletBalance;
                    cb(null);
                });
            },
            function insert_filled_order(cb){
                var totalOrdValue = data.orderQty / data.price
                var obj={
                    site : site,
                    symbol : 'XBTUSD',
                    totalAsset : walletBalance,//walletBalance, //총자산
                    type : getType(data.side), //진입
                    side : data.side, //Buy or Sell
                    side_num : 0,
                    start_price : fixed1(data.price), //가격
                    end_price :  fixed1(data.price), //가격
                    price :  fixed1(data.price), //가격
                    amount : data.orderQty, //수량
                    value : fixed4(totalOrdValue), //가치
                    feeRate : 0.075 * 0.01,
                    fee : fixed8(totalOrdValue * (0.075 * 0.01) ),
                    benefit : 0,
                    benefitRate : 0,
                    div_cnt : 1,
                    start_time : new Date().getTime() + (1000 * 60 * 60 * 9),
                    end_time : new Date().getTime() + (1000 * 60 * 60 * 9),
                    type_log : "dilute",
                    isSend : false //telegram 전송여부
                }
                orderDB.insertMany(obj, function(error, res){
                    if(error){
                        console.log(error);
                        return;
                    }
                    //console.log(res);
                    cb(null);
                });
            },

        ], function(error, results){
            if(error){
                console.log(error);
                return;
            }
        })
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
    if(typeof(obj.walletBalance) !== "undefined" && obj.walletBalance !== null)
        posObj["walletBalance"] = obj.walletBalance / 100000000;
  
    if(typeof(obj.marginBalance) !== "undefined" && obj.marginBalance !== null) 
        posObj["marginBalance"] = obj.marginBalance / 100000000;
  
    if(typeof(obj.availableMargin) !== "undefined" && obj.availableMargin !== null) 
        posObj["availableMargin"] = obj.availableMargin / 100000000;
    return posObj;
  }


function bitmex_position_parse(site, obj){
    var posObj = {
        site : site
    };
    
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