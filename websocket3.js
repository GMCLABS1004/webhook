var W3CWebSocket = require('websocket').w3cwebsocket;
var setting = require('./models/setting');
var margin = require('./models/margin');
var position2 = require('./models/position2');
var webSetting = require('./webSetting.json');
var mongoose = require('mongoose');
var set = require('./websocket.json');

if(set.testnet === true){
    var client = new W3CWebSocket('wss://testnet.bitmex.com/realtimemd');
}else{
    var client = new W3CWebSocket('wss://www.bitmex.com/realtimemd');
}

var crypto = require('crypto');
mongoose.connect(webSetting.dbPath);
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
            client.send(JSON.stringify([0, username, username, {"op" : "subscribe", "args" : ["position", "margin"]}]));//margin, 

        }
    });
};
 
client.onclose = function(){
    console.log('echo-protocol Client Closed');
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
                
                position2.findOneAndUpdate(
                    {site : username},
                    {$set : obj},
                    {upsert : true},
                    function(error, body){
                        if(error){
                            console.log(error);
                            return;
                        }
                        //console.log(body);
                        console.log("position 갱신");
                    }
                )
            }
        }
    }
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
                realisedPnl : 0
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