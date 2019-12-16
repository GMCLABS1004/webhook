var request = require('request');
var crypto = require('crypto');
var async = require('async');
var mongoose = require('mongoose');
var bid_1h = require('./models/bid_1h');
var webSetting = require('./webSetting');
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
        console.log(error);
        return;
    }
    
});

var url = 'https://www.bitmex.com'
var symbol = "XBTUSD";
var binSize = "1h"; //분봉데이터 유형 ex) 1m, 5m, 1h, 1d
var d = "2019-03-11"; 
d = new Date(d);
//var username = req.user.username; 
var apiKeyId = "IYT7EVPuT-d39e2oYbixiFxJ"; //bitmex API key
var apiSecret = "XT6vsX8GJr9Fpk1alXe9nv9DuVdY99hSNp96e2tIuhMkp-YN"; //bitmex API Secret
console.log('restore by day' + d);

setTimeout(RestoreBidData(url, apiKeyId, apiSecret, symbol, binSize, 2019, 12, 12),0);


// //1달 데이터 수집
// setTimeout(RestoreBidMonthData(url, apiKeyId, apiSecret, symbol, binSize, 2016, 11),0);

// setTimeout(RestoreBidMonthData(url, apiKeyId, apiSecret, symbol, binSize, 2016, 12),1000 * 20);

// //setTimeout(RestoreBidMonthData(url, apiKeyId, apiSecret, symbol, binSize, d.getFullYear(), d.getMonth()+1),1000 * 20);

// //1년 데이터 수집
// setTimeout(RestoreBidYearData(url, apiKeyId, apiSecret, symbol, binSize, 2017), 1000 * 60);

// //1년 데이터 수집
// setTimeout(RestoreBidYearData(url, apiKeyId, apiSecret, symbol, binSize, 2018), 1000 * 60 * 6);

// //1년 데이터 수집
// setTimeout(RestoreBidYearData(url, apiKeyId, apiSecret, symbol, binSize, 2019), 1000 * 60 * 12);


function RestoreBidYearData(url, apiKeyId, apiSecret, symbol, binSize, year){
    return function(){
        for(var i=1; i<=12; i++){
            setTimeout(RestoreBidMonthData(url, apiKeyId, apiSecret, symbol, binSize, year, i),i *20000);
        }
    }
}



//startDay부터 endDay까지(ex : 2018-10-01 ~ 2018-10-07) 분봉데이터 수집하여 DB에 저장 
//범위지정은 4일까지만 허용(많은 데이터 요청시 bitmex에서 접속제한 걸기때문)
function RestoreBidMonthData(url, apiKeyId, apiSecret, symbol, binSize, year, month){
    return function(){
        console.log(year+"-"+month+"실행");
        if(month < 10)
            month = "0" + month;
        
        var endDay = getMonthEndDay(year, month);
        console.log("endDay : "+ endDay);
        //1일부터
        var st1 = new Date(year + "-" + month + "-" + "01" + "T00:00:00.00Z");
        st1.setHours(st1.getHours()-9);
        st1.setMinutes(1);
        st1 = st1.toUTCString();
        console.log(st1);
  
         //20일까지
        var et1 = new Date(year + "-" + month + "-" + "20" + "T15:00:00.00Z").toUTCString();
        console.log(et1);
        
        //20일부터
        var st2 = new Date(year + "-" + month + "-" + "20" + "T15:01:00.00Z").toUTCString();
        console.log(st2);
  
        //endDay까지
        var et2 = new Date(year + "-" + month + "-" + endDay + "T15:00:00.00Z").toUTCString();
        console.log(et2);
        
        var count =720;
        if(binSize === '1h'){
            count = 720;
        }
        
        var param1 = 'binSize=' + binSize + '&partial=false&symbol=' + symbol + '&count='+count+'&reverse=false&startTime=' + st1 +'&endTime=' + et1;
        var param2 = 'binSize=' + binSize + '&partial=false&symbol=' + symbol + '&count='+count+'&reverse=false&startTime=' + st2 +'&endTime=' + et2;
        console.log(param1);
        console.log(param2);
        try{
            (async function main() {
                //var result1 = await makeRequest(bitmexURL, apiKeyId, apiSecret, 'GET','trade/bucketed', param1);
                var requestOptions = setRequestHeader(url, apiKeyId, apiSecret,'GET', 'trade/bucketed', param1);
                
                request(requestOptions.url, function(err,response, body){
                    var result = JSON.parse(body);
                    var data1 = new Array();
                    for(var i=0; i<result.length; i++){
                        var temp = {};
                        temp["symbol"] = result[i].symbol;
                        temp["timestamp"] = new Date(result[i].timestamp).getTime() + (1000 * 60 * 60 * 8);
                        //temp["time1m"] = d;
                        temp["open"] = result[i].open;
                        temp["high"] = result[i].high;
                        temp["low"] = result[i].low;
                        temp["close"] = result[i].close;
                        temp["trades"] = result[i].trades;
                        temp["volume"] = result[i].volume;
                        temp["vwap"] = result[i].vwap;
                        temp["lastSize"] = result[i].lastSize;
                        temp["turnover"] = result[i].turnover;
                        temp["homeNotional"] = result[i].homeNotional;
                        temp["foreignNotional"] = result[i].foreignNotional;
                        data1.push(temp);
                    }
                    //console.log("data1");
                    //console.log(data1);
                    //분봉데이터 DB에 저장, 데이터 중복 허용 X
                    for(var i in data1){
                        bid_1h.updateOne({
                                symbol : data1[i].symbol, 
                                timestamp : data1[i].timestamp
                            }, {
                                symbol : data1[i].symbol,
                                timestamp : data1[i].timestamp,
                                open : data1[i].open,
                                high : data1[i].high,
                                low : data1[i].low,
                                close : data1[i].close,
                                trades : data1[i].trades,
                                volume : data1[i].volume,
                                vwap : data1[i].vwap,
                                lastSize : data1[i].lastSize,
                                turnover : data1[i].turnover,
                                homeNotional : data1[i].homeNotional,
                                foreignNotional : data1[i].foreignNotional
                            }, { upsert: true }, 
                            function(err, body){
                                if(err) console.log(err);
                            }
                        );
                    }
                })
            })();
    
            (async function main() {
                var requestOptions = setRequestHeader(url, apiKeyId, apiSecret,'GET', 'trade/bucketed', param2);
    
                request(requestOptions.url, function(err,response, body){
                    var result = JSON.parse(body);
                    var data2 = new Array();
                    for(var i=0; i<result.length; i++){
                        var temp = {};
                        temp["symbol"] = result[i].symbol;
                        temp["timestamp"] = new Date(result[i].timestamp).getTime() + (1000 * 60 * 60 * 8);
                        //temp["time1m"] = d;
                        temp["open"] = result[i].open;
                        temp["high"] = result[i].high;
                        temp["low"] = result[i].low;
                        temp["close"] = result[i].close;
                        temp["trades"] = result[i].trades;
                        temp["volume"] = result[i].volume;
                        temp["vwap"] = result[i].vwap;
                        temp["lastSize"] = result[i].lastSize;
                        temp["turnover"] = result[i].turnover;
                        temp["homeNotional"] = result[i].homeNotional;
                        temp["foreignNotional"] = result[i].foreignNotional;
                        data2.push(temp);
                    }
    
                    //console.log("data2");
                    //console.log(data2);
                    //분봉데이터 DB에 저장, 데이터 중복 허용 X
                    for(var i in data2){
                        bid_1h.updateOne({
                                symbol : data2[i].symbol,
                                timestamp : data2[i].timestamp
                            }, {
                                symbol : data2[i].symbol,
                                 
                                timestamp : data2[i].timestamp,
                                open : data2[i].open,
                                high : data2[i].high,
                                low : data2[i].low,
                                close : data2[i].close,
                                trades : data2[i].trades,
                                volume : data2[i].volume,
                                vwap : data2[i].vwap,
                                lastSize : data2[i].lastSize,
                                turnover : data2[i].turnover,
                                homeNotional : data2[i].homeNotional,
                                foreignNotional : data2[i].foreignNotional
                            }, { upsert: true }, 
                            function(err, body){
                                if(err) console.log(err);
                            }
                        );
                    }
                })
                /*
                var result2 = await makeRequest(bitmexURL, apiKeyId, apiSecret, 'GET','trade/bucketed', param2);
                
                */
            })();
        }catch(error){ //분봉데이터가 없으면
            console.log("error : "+ error); 
            console.log("param1 :"+ param1); //못받은 데이터 출력
            console.log("param2 :"+ param2); //못받은 데이터 출력
        }
    }
  }


  function getMonthEndDay(year, month){
    var d = new Date();//오늘날짜 계산
    var thisMonth = (parseInt(year) === d.getFullYear() && parseInt(month) === (d.getMonth()+1)); //이번달인지 아닌지 판단
    var endDay = 0;
    console.log("thisMonth : "+ thisMonth);
    if(thisMonth === true){ //이번달이면
        console.log("이번달");
        endDay  = d.getDate(); //현재일자 GET
    }else{ //이번달이 아니면 
        console.log("이번달X");
        endDay = new Date(year, month, 0).getDate(); //month의 마지막 날짜 ex) 31 or 30 or 28 
    }
    return endDay;
  }
  

  function RestoreBidData(url, apiKeyId, apiSecret, symbol, binSize, year, month, startday){
    return function(){
        var startDay = (startday < 10)? "0" + startday : startday;
        if(month < 10)
            month = "0" + month;
        var dateString = year + "-" + month + "-" + startDay + "T00:00:00.00Z";
        
        var st1 = new Date(dateString);
        st1.setHours(st1.getHours()-9);
        st1.setMinutes(1);
        var et1 = new Date(st1);
        et1.setMinutes(720);
        
        var st2 = new Date(st1);
        st2.setHours(st2.getHours() + 12);
        st2.setMinutes(1);
  
        var et2 = new Date(st1);
        et2.setMinutes(720);
        
        var count =720;
        if(binSize === '1m'){
            count = 720;
        }else if(binSize === '1h'){
            count = 12;
        }
    
        var param1 = 'binSize=' + binSize + '&partial=false&symbol=' + symbol + '&count='+count+'&reverse=false&startTime=' + st1.toUTCString() +'&endTime=' + et1.toUTCString();
        var param2 = 'binSize=' + binSize + '&partial=false&symbol=' + symbol + '&count='+count+'&reverse=false&startTime=' + st2.toUTCString() +'&endTime=' + et2.toUTCString();
        console.log(param1);
        console.log(param2);
        try{
            (async function main() {
                //var result1 = await makeRequest(bitmexURL, apiKeyId, apiSecret, 'GET','trade/bucketed', param1);
                var requestOptions = setRequestHeader(url, apiKeyId, apiSecret,'GET', 'trade/bucketed', param1);
                
                request(requestOptions.url, function(err,response, body){
                    var result = JSON.parse(body);
                    var data1 = new Array();
                    for(var i=0; i<result.length; i++){
                        var temp = {};
                        temp["symbol"] = result[i].symbol;
                        temp["timestamp"] = new Date(result[i].timestamp).getTime() + (1000 * 60 * 60 * 8);
                        //temp["time1m"] = d;
                        temp["open"] = result[i].open;
                        temp["high"] = result[i].high;
                        temp["low"] = result[i].low;
                        temp["close"] = result[i].close;
                        temp["trades"] = result[i].trades;
                        temp["volume"] = result[i].volume;
                        temp["vwap"] = result[i].vwap;
                        temp["lastSize"] = result[i].lastSize;
                        temp["turnover"] = result[i].turnover;
                        temp["homeNotional"] = result[i].homeNotional;
                        temp["foreignNotional"] = result[i].foreignNotional;
                        data1.push(temp);
                    }
                    console.log("data1");
                    console.log(data1);
                    //분봉데이터 DB에 저장, 데이터 중복 허용 X
                    for(var i in data1){
                        bid_1h.updateOne({
                                symbol : data1[i].symbol, 
                                timestamp : data1[i].timestamp
                            }, {
                                symbol : data1[i].symbol,
                                timestamp : data1[i].timestamp,
                                open : data1[i].open,
                                high : data1[i].high,
                                low : data1[i].low,
                                close : data1[i].close,
                                trades : data1[i].trades,
                                volume : data1[i].volume,
                                vwap : data1[i].vwap,
                                lastSize : data1[i].lastSize,
                                turnover : data1[i].turnover,
                                homeNotional : data1[i].homeNotional,
                                foreignNotional : data1[i].foreignNotional
                            }, { upsert: true }, 
                            function(err, body){
                                if(err) console.log(err);
                            }
                        );
                    }
                })
            })();
    
            (async function main() {
                var requestOptions = setRequestHeader(url, apiKeyId, apiSecret,'GET', 'trade/bucketed', param2);
    
                request(requestOptions.url, function(err,response, body){
                    var result = JSON.parse(body);
                    var data2 = new Array();
                    for(var i=0; i<result.length; i++){
                        var temp = {};
                        temp["symbol"] = result[i].symbol;
                        temp["timestamp"] = new Date(result[i].timestamp).getTime() + (1000 * 60 * 60 * 8);
                        //temp["time1m"] = d;
                        temp["open"] = result[i].open;
                        temp["high"] = result[i].high;
                        temp["low"] = result[i].low;
                        temp["close"] = result[i].close;
                        temp["trades"] = result[i].trades;
                        temp["volume"] = result[i].volume;
                        temp["vwap"] = result[i].vwap;
                        temp["lastSize"] = result[i].lastSize;
                        temp["turnover"] = result[i].turnover;
                        temp["homeNotional"] = result[i].homeNotional;
                        temp["foreignNotional"] = result[i].foreignNotional;
                        data2.push(temp);
                    }
    
                    console.log("data2");
                    console.log(data2);
                    //분봉데이터 DB에 저장, 데이터 중복 허용 X
                    for(var i in data2){
                        bid_1h.updateOne({
                                symbol : data2[i].symbol,
                                timestamp : data2[i].timestamp
                            }, {
                                symbol : data2[i].symbol,
                                 
                                timestamp : data2[i].timestamp,
                                open : data2[i].open,
                                high : data2[i].high,
                                low : data2[i].low,
                                close : data2[i].close,
                                trades : data2[i].trades,
                                volume : data2[i].volume,
                                vwap : data2[i].vwap,
                                lastSize : data2[i].lastSize,
                                turnover : data2[i].turnover,
                                homeNotional : data2[i].homeNotional,
                                foreignNotional : data2[i].foreignNotional
                            }, { upsert: true }, 
                            function(err, body){
                                if(err) console.log(err);
                            }
                        );
                    }
                })
                /*
                var result2 = await makeRequest(bitmexURL, apiKeyId, apiSecret, 'GET','trade/bucketed', param2);
                
                */
            })();
        }catch(error){ //분봉데이터가 없으면
            console.log("error : "+ error); 
            console.log("param1 :"+ param1); //못받은 데이터 출력
            console.log("param2 :"+ param2); //못받은 데이터 출력
        }
    }
  }


// //한달치 분봉데이터를 수집하여 DB에 저장
// function RestoreMonthBidData(url, apiKeyId, apiSecret, symbol, binSize, year, month){
//     return function(){
//         var d = new Date();//오늘날짜 계산
//         var thisMonth = (parseInt(year) === d.getFullYear() && parseInt(month) === (d.getMonth()+1)); //이번달인지 아닌지 판단
//         console.log("thisMonth : "+ thisMonth);
//         if(thisMonth === true){ //이번달이면
//             console.log("이번달");
//             var endDay  = d.getDate(); //현재일자 GET
//             for(var i = 1; i <= endDay ; i++)
//                 setTimeout(RestoreBidData(url, apiKeyId, apiSecret, symbol, binSize, year, month, i), i*1000);
    
        
//         }else{ //이번달이 아니면 
//             console.log("이번달X");
//             var endDay = new Date(iYear, iMonth, 0).getDate(); //month의 마지막 날짜 ex) 31 or 30 or 28 
//             for(var i = 1; i <= endDay ; i++)
//                 setTimeout(RestoreBidData(url, apiKeyId, apiSecret, symbol, binSize, year, month, i), i*500);
//         }
//     }
// }



function setRequestHeader(url, apiKey, apiSecret, verb, endpoint, data){
    path = '/api/v1/'+ endpoint;
    expires = new Date().getTime() + (60 * 1000); // 1 min in the future
    var requestOptions;
    if(verb === 'POST' || verb === 'PUT' || verb === 'DELETE'){
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
