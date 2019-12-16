
'use strict';
var ticker = require('./models/ticker');
var bid_1h = require('./models/bid_1h');
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
  if(tableName === 'trade'){
    if(last_price !== data[data.length-1].price){
        console.log(block_signal);
        last_price = data[data.length-1].price;
        setTimeout(update_ticker(last_price), 0);
        setTimeout(update_low_high_price(last_price), 0);
    }
  }
});

client.addStream('XBTUSD', 'tradeBin1h', function(data, symbol, tableName){
    if(tableName === 'tradeBin1h'){
        var length = data.length-1;
        var json = data[length];
        var close_price = json.close;
        
        var min = new Date().getMinutes();
        if(min > 0){
            console.log("[" + getCurrentTimeString() +"] " + "ts 실행X");
            return;
        }
        
        //1시간봉 종가를 기준으로 트레일링 스탑 실행
        settings.find({execFlag: true, site_type : "oversee"}, function(error, json){ //, isTrailingStop : true
            if(error){
                console.log("[" + getCurrentTimeString() +"] " + error);
                return;
            }
            console.log("[" + getCurrentTimeString() +"] " + "ts 실행O");
            for(var i=0; i<json.length; i++){
                //현재가를 기준으로 트레일링 스탑
                if(json[i].isTrailingStop === true){
                    setTimeout(trailingStop(close_price, json[i].lowPrice, json[i].highPrice, json[i]), 0);
                }
            }
        });
    }   
});

function update_bin1h(obj){
    return function(){
        bid_1h.find({}).sort({timestamp : 'desc'}).limit(339).exec(function(error, json){
            if(error){
                console.log(error);
                return;
            }
         
            var list = new Object(json);
            
            list.unshift(new Object(obj));
            var standard = "low"
       
            if(checkUsefulData(list)){
                //console.log("1시간차이 -> sma, ema 계산")
                obj["sma1"] = getSMA8(list, 0, standard);
                obj["sma2"] = getSMA26(list, 0, standard);
                obj["sma3"] = getSMA54(list, 0, standard);
                obj["sma4"] = getSMA90(list, 0, standard);
                obj["sma5"] = getSMA340(list, 0, standard);
                obj["ema"] = getEMA340(list, 0, standard, list[1].ema);

                bid_1h.findOneAndUpdate(
                    {timestamp : obj.timestamp},
                    {$set : obj},
                    {upsert : true},
                    function(error, body){
                        if(error){
                            console.log(error);
                            return;
                        }
                        console.log("bid update : " + new Date(obj.timestamp).toISOString());
                    }
                )
            }
            
        });
    }
}

//배열길이가 340개 인지 , 분봉 간격이 1시간차이가 맞는지 확인
function checkUsefulData(list){
    if(list.length !== 340){
        return false;
    }

    var t1 = list[0].timestamp;
    var t2 = 0;
    for(var i=1; i<list.length; i++){
        t2 = new Date(list[i].timestamp).getTime();
        if((t1 - t2) !== (1000 * 60 * 60)){ //최근분봉 - DB최신분봉 === 1시간차
              return false;
        }
        t1 = t2;
    }
    return true;
}

function getSMA8(list, idx, standard){
    if((idx+7) > (list.length-1)){
        return 0;
    }
    var beforeTime = 0;
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

function getEMA340(list, idx, standard, beforeEMA){
    ema = ((list[idx][standard] - beforeEMA) * (2/(340+1))) + beforeEMA;
    return Number(Number(ema).toFixed(11));
}


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
                //현재가를 기준으로 트레일링 스탑
                // if(json[i].isTrailingStop === true){
                //     setTimeout(trailingStop(last_price, lowPrice, highPrice, obj), 0);
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
            var rentryFee = entryPrice * (obj.rentryFeeRate * 0.01);
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
            console.log("[" + getCurrentTimeString() +"] " + "rentryFee : "+ rentryFee);

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
                // console.log("[" + getCurrentTimeString() +"] " + "entryPrice - rentryFee : "+ (entryPrice - rentryFee));
                console.log("[" + getCurrentTimeString() +"] " + "entryPrice - alpha < last_price < entryPrice - rentryFee");
                console.log("[" + getCurrentTimeString() +"] " + (entryPrice - alpha) + " / " + last_price + " / " + (entryPrice - rentryFee));

                if(entryPrice - alpha < last_price &&  last_price < entryPrice - rentryFee){ //진입가 + 
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
                // console.log("[" + getCurrentTimeString() +"] " + "entryPrice + rentryFee : "+ (entryPrice + rentryFee));
                console.log("[" + getCurrentTimeString() +"] " + "entryPrice + rentryFee < last_price < entryPrice + alpha");
                console.log("[" + getCurrentTimeString() +"] " + (entryPrice + rentryFee) + " / " + last_price + " / " + (entryPrice + alpha));
                
                if(entryPrice + rentryFee < last_price && last_price < entryPrice + alpha){ //진입가 + ahlpa 
                    console.log({site : site, scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "rentry"});
                    if(is_insert_signal({site : site, scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "rentry", timestamp : new Date().getTime()})){
                        signal.insertMany({site : site, scriptNo : scriptNo , side : "Sell", side_num : side_num, type_log : "rentry"});
                    }
                }
            }
            console.log("");
        //});
    }
}


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