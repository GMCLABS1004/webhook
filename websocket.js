
'use strict';
var ticker = require('./models/ticker');
var signal = require('./models/signal'); 
var settings = require("./models/setting");
var mongoose = require('mongoose');
var webSetting = require('./webSetting.json');
var setting = require('./websocket.json');
var crypto = require('crypto');
var request = require('request');
mongoose.connect(webSetting.dbPath);
const BitMEXClient = require('bitmex-realtime-api');
// See 'options' reference below

const client = new BitMEXClient(
    {
        testnet: setting.testnet
    }
);
// handle errors here. If no 'error' callback is attached. errors will crash the client.

client.on('error', console.error);
client.on('open', () => console.log("[" + getCurrentTimeString() +"] " + 'Connection opened.'));
client.on('close', () => console.log("[" + getCurrentTimeString() +"] " + 'Connection closed.'));
client.on('initialize', () => console.log("[" + getCurrentTimeString() +"] " + 'Client initialized, data is flowing.'));
var last_price = 0;

client.addStream('XBTUSD', 'trade', function(data, symbol, tableName){
  //console.log(`Got update for ${tableName}:${symbol}. Current state:\n${JSON.stringify(data).slice(0, 100)}...`);
  //console.log("update price1 : "+data[0].price);
  
  if(tableName === 'trade'){
    //console.log(data);
    //console.log(data[0].price);
    //console.log(data[data.length-1].price);
    
    if(last_price !== data[data.length-1].price){ //
        console.log(block_signal);
        last_price = data[data.length-1].price;
       setTimeout(update_ticker(last_price), 0);
       setTimeout(update_low_high_price(last_price), 0);
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
        settings.find({execFlag: true, site_type : "oversee"}, function(error, json){ //, isTrailingStop : true
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
                            console.log(res.site + " 저점 업데이트 : " + last_price);
                        }
                    )
                }
                
                if(json[i].isTrailingStop === true){
                    setTimeout(trailingStop(last_price, lowPrice, highPrice, obj), 0);
                }
               

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
                    if(is_insert_signal({site : site, scriptNo : scriptNo , side : "Buy Exit", side_num : side_num, type_log : "trailingStop", timestamp : new Date().getTime()})){
                        signal.insertMany({site : site, scriptNo : scriptNo , side : "Buy Exit", side_num : side_num, type_log : "trailingStop"});
                    }
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
                    if(is_insert_signal({site : site, scriptNo : scriptNo , side : "Sell Exit", side_num : side_num, type_log : "trailingStop", timestamp : new Date().getTime()})){
                        signal.insertMany({site : site, scriptNo : scriptNo , side : "Sell Exit", side_num : side_num, type_log : "trailingStop"});
                    }
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
                    console.log({site : site, scriptNo : scriptNo , side : "Buy", side_num : side_num, type_log : "rentry"});
                    if(is_insert_signal({site : site, scriptNo : scriptNo , side : "Buy", side_num : side_num, type_log : "rentry", timestamp : new Date().getTime()})){
                        signal.insertMany({site : site, scriptNo : scriptNo , side : "Buy", side_num : side_num, type_log : "rentry"});
                    }
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
                    console.log({site : site, scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "reentry"});
                    if(is_insert_signal({site : site, scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "reentry", timestamp : new Date().getTime()})){
                        signal.insertMany({site : site, scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "reentry"});
                    }
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

var block_signal = [];
function is_insert_signal(signal){
    //console.log(block_signal);
    var removeIdx = -1;
    var before = -1;
    var current = -1;
    for(var i=0; i<block_signal.length; i++){
        //동일 신호 검색
        if(block_signal[i].type_log === signal.type_log && block_signal[i].scriptNo === signal.scriptNo && block_signal[i].side === signal.side && block_signal[i].side_num === signal.side_num && block_signal[i].site === signal.site){
            before = block_signal[i].timestamp;
            current = signal.timestamp;
            
            if((current - before) >= (1000 * 60)){ //1분이상된 신호 

                removeIdx = i; //인덱스 기억 
                
            }else{
                 console.log("신호무시");
                // console.log(block_signal);
                return false; //1분이하 신호 -> 신호무시
            }
        }
    }

    if(removeIdx === -1){ //신호가 처음인 경우
        block_signal.push(signal); //신호 입력
         console.log("첫신호입력");
        // console.log(block_signal);
        return true;
    }

    if(removeIdx >= 0){ //찾았는데 1분이상 경과된 신호
        block_signal.splice(removeIdx, 1); //이전신호 지우고
        block_signal.push(signal); //새신호로 입력
         console.log("신호갱신");
        // console.log(block_signal);
        return true;
    }

    return false; 
}