
'use strict';
var ticker = require('./models/ticker');
var signal = require('./models/signal'); 
var settings = require("./models/setting");
var mongoose = require('mongoose');
var webSetting = require('./webSetting.json');
var crypto = require('crypto');
var request = require('request');
mongoose.connect(webSetting.dbPath);
const BitMEXClient = require('bitmex-realtime-api');
// See 'options' reference below

const client = new BitMEXClient(
    {
        testnet: true
    }
);
// handle errors here. If no 'error' callback is attached. errors will crash the client.

client.on('error', console.error);
client.on('open', () => console.log("[" + getCurrentTimeString() +"] " + 'Connection opened.'));
client.on('close', () => console.log("[" + getCurrentTimeString() +"] " + 'Connection closed.'));
client.on('initialize', () => console.log("[" + getCurrentTimeString() +"] " + 'Client initialized, data is flowing.'));
var last_price = 0;

client.addStream('XBTUSD', 'trade', function(data, symbol, tableName) {
  //console.log(`Got update for ${tableName}:${symbol}. Current state:\n${JSON.stringify(data).slice(0, 100)}...`);
  //console.log("update price1 : "+data[0].price);
  
  if(tableName === 'trade'){
    //console.log(data);
    //console.log(data[0].price);
    //console.log(data[data.length-1].price);
    if(last_price !== data[data.length-1].price){ //
        last_price = data[data.length-1].price;
       // setTimeout(update_ticker(data[0].price), 0);
       // setTimeout(update_low_high_price(data[0].price), 0);
    }
  }
  //console.log(data);
  // Do something with the table data...
});

function update_ticker(last_price){
    return function(){
        ticker.findOneAndUpdate(
            {site : "bitmex", site_type : "oversee"},
            {
                $set : 
                {
                    last_price : last_price,
                    timestamp : new Date().getTime() + (1000 * 60 * 60 * 9)
                }
            },
            {upsert : true},
            function(error, doc, res){
                if(error){
                    console.log("[" + getCurrentTimeString() +"] " + error);
                    return;
                }
                console.log("[" + getCurrentTimeString() +"] " + "update price : "+last_price);
                //console.log(doc);
            }
        );
    }
}

function update_low_high_price(last_price){
    return function(){
        settings.find({execFlag: true, site_type : "oversee", isTrailingStop : true}, function(error, json){
            if(error){
                console.log("[" + getCurrentTimeString() +"] " + error);
                return;
            }

            var check_list = [] //
            for(var i=0; i<json.length; i++){
                var obj = new Object(json[i]);
                var lowPrice = obj.lowPrice;
                var highPrice = obj.highPrice;
                //고점 업데이트
                if(obj.highPrice < last_price){
                    console.log("[" + getCurrentTimeString() +"] " + "고점 업데이트");
                    console.log(obj.highPrice + "->" + last_price);
                    highPrice = last_price;
                    settings.findByIdAndUpdate(
                        obj._id,
                        {$set : {highPrice : last_price}},
                        function(error, res){
                            if(error){
                                console.log(error);
                                return;
                            }
                        }
                    )
                }

                //저점 업데이트
                if(last_price < obj.lowPrice){
                    console.log("[" + getCurrentTimeString() +"] " + "저점 업데이트");
                    console.log(obj.lowPrice + "->" + last_price);
                    lowPrice = last_price;
                    settings.findByIdAndUpdate(
                        obj._id,
                        {$set : {lowPrice : last_price}},
                        function(error, res){
                            if(error){
                                console.log(error);
                                return;
                            }
                        }
                    )
                }
                
                setTimeout(trailingStop(last_price, lowPrice, highPrice, obj), 0);

                // var exec_trail = true;
                // for(var j=0; j<check_list.length; j++){
                //     if(check_list[j] === obj.scriptNo){
                //         exec_trail=false;
                //     }
                // }

                // if(exec_trail === true){
                //     //트레일링 스탑 실행
                //     setTimeout(trailingStop(last_price, lowPrice, highPrice, obj), 0);
                //     check_list.push(obj.scriptNo);
                // }
            }
        });
    }
}


function trailingStop(last_price, lowPrice, highPrice, obj){
    return function(){
        //position(obj, function(isPosition){
            console.log(obj.site+" 트레일링 스탑 실행");
            //console.log("isPosition :" + isPosition);
            var site = obj.site;
            var entryPrice = obj.entryPrice; //진입가격
            var trailingHighRate = obj.trailingHighRate * 0.01; 
            var trailingLowRate = obj.trailingLowRate * 0.01; 
            var trailFee = entryPrice * (obj.trailFeeRate * 0.01);
            var scriptNo = obj.scriptNo;
            var side_num = obj.side_num;
            var alpha = 0;
            console.log("[" + getCurrentTimeString() +"] " + "------------------------");
            console.log("[" + getCurrentTimeString() +"] " + "last_price : "+ last_price);
            console.log("[" + getCurrentTimeString() +"] " + "highPrice : "+ highPrice);
            console.log("[" + getCurrentTimeString() +"] " + "entryPrice : "+ entryPrice);
            console.log("[" + getCurrentTimeString() +"] " + "lowPrice : "+ lowPrice);
            console.log("[" + getCurrentTimeString() +"] " + "highPrice - entryPrice : "+ (highPrice - entryPrice) + " * "+ trailingHighRate + " = " + ((highPrice - entryPrice) * trailingHighRate));
            console.log("[" + getCurrentTimeString() +"] " + "lowPrice - entryPrice : "+ (lowPrice - entryPrice) + " * "+ trailingLowRate + " = " + ((lowPrice - entryPrice) * trailingLowRate));
            console.log("[" + getCurrentTimeString() +"] " + "trailFee : "+ trailFee);


            // console.log("[" + getCurrentTimeString() +"] " + "trailingHighRate : "+ trailingHighRate);
            // console.log("[" + getCurrentTimeString() +"] " + "trailFee :"+ trailFee);
            // console.log("val : "+ (highPrice - entryPrice) * trailingHighRate)
            // console.log("entryPrice + val : "+ (entryPrice+val) )
            console.log(obj.side);
            
            //포지션 조회
            if(obj.side === 'long'){//isPosition === 'long'
                alpha = (highPrice - entryPrice) * trailingHighRate; //(고점가 - 진입가) * 비율
                console.log("-----------------long exit--------------");
                // console.log("[" + getCurrentTimeString() +"] " + "alpha : "+ alpha);
                // console.log("[" + getCurrentTimeString() +"] " + "entryPrice + alpha : "+ (entryPrice + alpha));
                // console.log("[" + getCurrentTimeString() +"] " + "last_price : "+ (last_price));
                // console.log("[" + getCurrentTimeString() +"] " + "entryPrice + trailFee : "+ (entryPrice + trailFee));
                console.log("[" + getCurrentTimeString() +"] " + "entryPrice + trailFee < last_price < entryPrice + alpha");
                console.log("[" + getCurrentTimeString() +"] " + (entryPrice + trailFee) + " / " + last_price + " / " + (entryPrice + alpha));
                if(entryPrice + trailFee < last_price && last_price < entryPrice + alpha){ //진입가 + ahlpa 
                    console.log({site : site, scriptNo : scriptNo , side : "Buy Exit", side_num : side_num, type_log : "trailingStop"});
                    signal.insertMany({site : site, scriptNo : scriptNo , side : "Buy Exit", side_num : side_num, type_log : "trailingStop"});
                }
            }else if(obj.side === 'short'){ //isPosition === 'short'
                console.log("-----------------short exit--------------");
                alpha = (entryPrice - lowPrice) * trailingLowRate; //(진입가- 저점가) * 비율
                console.log("[" + getCurrentTimeString() +"] " + "alpha : "+alpha);
                // console.log("[" + getCurrentTimeString() +"] " + "entryPrice - alpha : "+ (entryPrice - alpha));
                // console.log("[" + getCurrentTimeString() +"] " + "last_price : "+ (last_price));
                // console.log("[" + getCurrentTimeString() +"] " + "entryPrice - trailFee : "+ (entryPrice - trailFee));
                console.log("[" + getCurrentTimeString() +"] " + "entryPrice - alpha < last_price < entryPrice - trailFee");
                console.log("[" + getCurrentTimeString() +"] " + (entryPrice - alpha) + " / " + last_price + " / " + (entryPrice - trailFee));
                
                if(entryPrice - alpha < last_price &&  last_price < entryPrice - trailFee){ //진입가 + 
                    console.log({site : site, scriptNo : scriptNo , side : "Sell Exit", side_num : side_num, type_log : "trailingStop"});
                    signal.insertMany({site : site, scriptNo : scriptNo , side : "Sell Exit", side_num : side_num, type_log : "trailingStop"});
                }
            }
            
            //현재포지션 exit, 셋팅 : long -> 롱재진입
            if(obj.side === 'long'){ //isPosition === 'exit' && 
                alpha = (entryPrice - lowPrice) * trailingLowRate; //(진입가- 저점가) * 비율
                console.log("-----------------long entry--------------");
               // console.log("[" + getCurrentTimeString() +"] " + "alpha : "+alpha);
                // console.log("[" + getCurrentTimeString() +"] " + "entryPrice - alpha : "+ (entryPrice - alpha));
                // console.log("[" + getCurrentTimeString() +"] " + "last_price : "+ (last_price));
                // console.log("[" + getCurrentTimeString() +"] " + "entryPrice - trailFee : "+ (entryPrice - trailFee));
                console.log("[" + getCurrentTimeString() +"] " + "entryPrice - alpha < last_price < entryPrice - trailFee");
                console.log("[" + getCurrentTimeString() +"] " + (entryPrice - alpha) + " / " + last_price + " / " + (entryPrice - trailFee));

                if(entryPrice - alpha < last_price &&  last_price < entryPrice - trailFee){ //진입가 + 
                    console.log({site : site, scriptNo : scriptNo , side : "Buy", side_num : side_num, type_log : "long rentry"});
                    signal.insertMany({site : site, scriptNo : scriptNo , side : "Buy", side_num : side_num, type_log : "long rentry"});
                }
            }else if(obj.side === 'short' ){ //isPosition === 'exit' && 
                alpha = (highPrice - entryPrice) * trailingHighRate; //(고점가 - 진입가) * 비율
                console.log("-----------------short entry--------------");
                //console.log("[" + getCurrentTimeString() +"] " + "alpha : "+alpha);
                // console.log("[" + getCurrentTimeString() +"] " + "entryPrice + alpha : "+ (entryPrice + alpha));
                // console.log("[" + getCurrentTimeString() +"] " + "last_price : "+ (last_price));
                // console.log("[" + getCurrentTimeString() +"] " + "entryPrice + trailFee : "+ (entryPrice + trailFee));
                console.log("[" + getCurrentTimeString() +"] " + "entryPrice + trailFee < last_price < entryPrice + alpha");
                console.log("[" + getCurrentTimeString() +"] " + (entryPrice + trailFee) + " / " + last_price + " / " + (entryPrice + alpha));
                
                if(entryPrice + trailFee < last_price && last_price < entryPrice + alpha){ //진입가 + ahlpa 
                    console.log({site : site, scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "short rentry"});
                    signal.insertMany({site : site, scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "short rentry"});
                }
            }
            console.log("");
        //});
    }
}

// function trailingStop(last_price, lowPrice, highPrice, obj){
//     return function(){
//         //position(obj, function(isPosition){
            
//             //console.log("isPosition :" + isPosition);
//             var entryPrice = obj.entryPrice; //진입가격
//             var trailingHighRate = obj.trailingHighRate * 0.01; 
//             var trailingLowRate = obj.trailingLowRate * 0.01; 
//             var trailFee = entryPrice * (obj.trailFeeRate * 0.01);
//             var scriptNo = obj.scriptNo;
//             var side_num = obj.side_num;
//             var alpha = 0;
            
//             console.log("highPrice : "+ highPrice);
//             console.log("entryPrice : "+ entryPrice);
//             console.log("highPrice - entryPrice : "+ (highPrice - entryPrice));
//             console.log("trailingHighRate : "+ trailingHighRate);
//             console.log("trailFee :"+ trailFee);
//             // console.log("val : "+ (highPrice - entryPrice) * trailingHighRate)
//             // console.log("entryPrice + val : "+ (entryPrice+val) )
//             console.log(obj.side);
            
//             //포지션 조회
//             if(obj.side === 'long'){//isPosition === 'long'
//                 alpha = (highPrice - entryPrice) * trailingHighRate; //(고점가 - 진입가) * 비율
//                 console.log("alpha : "+alpha);
//                 console.log("entryPrice + alpha : "+ (entryPrice + alpha));
//                 console.log("last_price : "+ (last_price));
//                 console.log("entryPrice + trailFee : "+ (entryPrice + trailFee));
//                 if(entryPrice + trailFee < last_price && last_price < entryPrice + alpha){ //진입가 + ahlpa 
//                     console.log({scriptNo : scriptNo , side : "Buy Exit", side_num : side_num, type_log : "trailingStop"});
//                     signal.insertMany({scriptNo : scriptNo , side : "Buy Exit", side_num : side_num, type_log : "trailingStop"});
//                 }
//             }else if(obj.side === 'short'){ //isPosition === 'short'
//                 alpha = (entryPrice - lowPrice) * trailingLowRate; //(진입가- 저점가) * 비율
//                 if(entryPrice - alpha < last_price &&  last_price < entryPrice - trailFee){ //진입가 + 
//                     console.log({scriptNo : scriptNo , side : "Sell Exit", side_num : side_num, type_log : "trailingStop"});
//                     signal.insertMany({scriptNo : scriptNo , side : "Sell Exit", side_num : side_num, type_log : "trailingStop"});
//                 }
//             }
            
//             //현재포지션 exit, 셋팅 : long -> 롱재진입
//             if(obj.side === 'long'){ //isPosition === 'exit' && 
//                 alpha = (highPrice - entryPrice) * trailingHighRate; //(고점가 - 진입가) * 비율
//                 console.log("alpha : "+alpha);
//                 console.log("entryPrice + alpha : "+ (entryPrice + alpha));
//                 console.log("last_price : "+ (last_price));
//                 console.log("entryPrice + trailFee : "+ (entryPrice + trailFee));
//                 alpha = (entryPrice - lowPrice) * trailingLowRate; //(고점가 - 진입가) * 비율
//                 if(entryPrice - alpha < last_price &&  last_price < entryPrice - trailFee){ //진입가 + 
//                     console.log({scriptNo : scriptNo , side : "Buy", side_num : side_num, type_log : "long rentry"});
//                     signal.insertMany({scriptNo : scriptNo , side : "Buy", side_num : side_num, type_log : "long rentry"});
//                 }
//             }else if(obj.side === 'short' ){ //isPosition === 'exit' && 
//                 if(entryPrice + trailFee < last_price && last_price < entryPrice + alpha){ //진입가 + ahlpa 
//                     console.log({scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "short retry"});
//                     signal.insertMany({scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "short retry"});
//                 }
//             }
//         //});
//     }
// }


function position(data, cb){
    var isSide = 'exit';
    //console.log(data);
    var requestOptions = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'GET','position','');//'currency=XBt'
    request(requestOptions, function(err,response,body){
        if(err){
            console.log(err);
            return;
        }
        //console.log(body);
        var json = JSON.parse(body);
        //console.log(json);
        for(var i=0; i<json.length; i++){
            if(json[i].currentQty > 0 && json[i].symbol==='XBTUSD'){
                console.log("[" + getCurrentTimeString() +"] " + "매수");
                isSide = "long";
                
            }else if(json[i].currentQty < 0 && json[i].symbol==='XBTUSD'){
                console.log("[" + getCurrentTimeString() +"] " + "매도");
                isSide = "short";
            }
        }
        console.log("[" + getCurrentTimeString() +"] " + "isSide : "+ isSide)
        cb(isSide);
    });
  }


  function setRequestHeader(url, apiKey, apiSecret, verb, endpoint, data){
    var path = '/api/v1/'+ endpoint;
    var expires = new Date().getTime() + (60 * 1000); // 1 min in the future
    var requestOptions;
    if(verb === 'POST' || verb === 'PUT'){
        var postBody = JSON.stringify(data);
        var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
        var headers = {
            'content-type' : 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'api-expires': expires,
            'api-key': apiKey,
            'api-signature': signature
        };
        requestOptions = {
            headers: headers,
            url: url+path,
            method: verb,
            body: postBody
        };
    }else{ //'GET'
        var query = '?'+ data;
        var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + query + expires).digest('hex');
        var headers = {
          'content-type' : 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'api-expires': expires,
          'api-key': apiKey,
          'api-signature': signature
        };
        requestOptions = {
            headers: headers,
            url: url+path + query,
            method: verb
        };
    }
    return requestOptions;
}
  

function getCurrentTimeString(){
    var today = new Date();
    var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var CurrentDateTime = date+' '+time;
    return CurrentDateTime;
}