var numeral = require('numeral');
var mongoose = require('mongoose');
var randomFloat = require('random-float');
var crypto = require("crypto");
var request = require("request");
var async = require('async');
const winston = require('winston');
require('winston-daily-rotate-file');
require('date-utils');
var webSetting = require('../webSetting.json');
var orderDB = require('../models/order');
var settings = require("../models/setting");
var position2 = require("../models/position2");

mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
});  

// var data = {
//     idx : 1,
//     url : 'https://testnet.bitmex.com',
//     apiKey : '-2YJMJOGLRMvUgaBD1_KzbLt',
//     secreteKey : 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd',
//     symbol : 'XBTUSD',
//     firstMargin : 0,
//     totalRemainAmt : 0, //미체결 수량
//     totalRemainVal : 0, //미체결 가치
//     goalValue : Math.floor(24210.0), //주문 목표 금액
//     totalOrdValue : 0, //주문넣은 가치 합산
//     side : "Sell", //주문 타입
//     minValueRate : 0.5, //최소주문비율
//     maxValueRate : 0.9, //최대주문비율
//     orderID : "", //주문id'
//     msg : "div1"
// }

// setTimeout(divide_entry_bitmex(data), 0);
var ccc = 1;
var logger;
module.exports= function check_is_exit(obj, logObj){
    logger = new Object(logObj);
    // console.log("진입 로거aaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    // console.log(logger);
    switchOnOff(obj, true);
    return function(){
        settings.find({site : obj.site},function(error, res){
            if(error){
                console.log(error);
                return;
            }
            
            //탈출중이면 분할진입 대기!
            if(res[0].isExiting === true){
                console.log("탈출중 -> 대기 "+ res[0].isExiting + " " + res[0].isEntering);
                setTimeout(check_is_exit(obj), 10000);
                return;
            }else if(res[0].isExiting === false){ //분할진입 시작
                setTimeout(divide_entry_bitmex(obj),obj.ordInterval);
                return;
            }
        });
    }
}

function divide_entry_bitmex(obj){
    switchOnOff({site : obj.site}, true);
    console.log("divide_entry_bitmex ");
    console.log(obj);
    return function(){
        var data = {
            site : obj.site,
            msg : obj.msg,
            idx : obj.idx,
            url : obj.url,
            apiKey : obj.apiKey,
            secreteKey : obj.secreteKey,
            symbol : obj.symbol,
            ordInterval : obj.ordInterval,
            firstMargin : obj.firstMargin,
            firstWalletBalance :  obj.firstWalletBalance,
            availableMargin : 0, //잔액
            canceledPrice : 0, //취소할 주문 가격
            totalRemainAmt : obj.totalRemainAmt, //주문후 남은 주문수량
            totalRemainVal : obj.totalRemainVal, //주문후 남은 가치
            goalValue : obj.goalValue, //주문 목표 금액
            totalOrdValue : obj.totalOrdValue, //주문넣은 가치 합산
            totalOrdAmount : obj.totalOrdAmount, //주문넣은 가치 합산
            minOrdValue : 0, //최소주문금액
            siteMinValue : 0, //거래소 주문 최소 가치
            minOrdAmt : obj.minOrdAmt, //최소주문달러
            siteMinAmt : 1, //거래소 주문 최소 달러 
            side : obj.side, //주문 타입
            side_num : obj.side_num,
            minValueRate : obj.minValueRate, //최소주문비율
            maxValueRate : obj.maxValueRate, //최대주문비율
            sellDepth : {}, //매도목록
            buyDepth : {}, //매수목록
            orderID : obj.orderID, //주문id
            start_time : obj.start_time, 
            start_price : obj.start_price,
            end_price : obj.end_price,
            ordPrice : 0, //주문넣은 가격
            ordAmount : 0, //주문넣은 수량
            ordValue : 0, //주문넣은 가치
            type_log : obj.type_log,
            isOrdered : false, //주문시도 여부
            isSuccess : false, //주문성공 여부
            isContinue : false, //주문분할 계속할지 여부
            isError : false
        }
        async.parallel([
            function getUserMargin(cb){ //잔액조회
                var requestOptions = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'GET','user/margin','currency=XBt');
                request(requestOptions, function(error, response, body){
                    if(error){
                        console.log(error);
                        data.isError = true;
                        data.isContinue = true;
                        return cb(null, data);
                    }
                    var json = JSON.parse(body);
                    // data.walletBalance = json.walletBalance / 100000000;
                    // data.marginBalance = json.marginBalance / 100000000;
                    
                    data.availableMargin = json.availableMargin / 100000000;
                    if(data.idx === 1){
                        data.firstMargin = data.availableMargin;
                        data.firstWalletBalance = json.walletBalance / 100000000;
                    }
                    //console.log("margin : " + body);
                    console.log("data.firstWalletBalance : " + data.firstWalletBalance);
                    cb(null);
                });
            },
            function depth(cb){
                if(data.isError === true){
                    return cb(null, data);
                }
    
                var requestHeader = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'GET', 'orderbook/L2', 'symbol='+data.symbol+'&depth=1');
                request(requestHeader, function(error, response, body){
                    if(error){
                        console.log(error);
                        data.isError = true;
                        data.isContinue = true;
                        return cb(null, data);
                    }
                    var json = JSON.parse(body);
                    if(json[0]["price"] === undefined || json[1]["price"] === undefined){
                        data.isError = true;
                        data.isContinue = true;
                    }else{
                        data.sellDepth = {
                            price : json[0].price,//가격-> $
                            amount : json[0].size,//수량-> $
                            value :  json[0].size / json[0].price //가치 -> xbt
                        }
                        data.buyDepth = {
                            price : json[1].price,//가격-> $
                            amount : json[1].size, //수량-> $
                            value : json[1].size / json[1].price  //가치 -> xbt
                        }
                    }
                    cb(null);
                });
            }
        ], function(error, results){
            if(error){
                console.log(error);
                return;
            }
            //console.log("results : "+JSON.stringify(results));
            //console.log("results");
            //console.log(data);
            async.waterfall([
                function init(cb){
                    cb(null, data);
                },
                function calc(data, cb){
                    if(data.isError === true){
                        return cb(null, data);
                    }
                    
                    var rate = (randomFloat(data.minValueRate, data.maxValueRate));
                    var ordValue=0;
                    var remainValue=0;
                    
                    if(data.side === 'Buy'){
                        //console.log("Buy");
                        // console.log("value : " +data.sellDepth.value);
                        // console.log("rate : "+ rate);
                        ordValue = data.sellDepth.value * rate; //매도1 가치의 n%
                        data.ordAmount = Math.floor(ordValue * data.sellDepth.price); //주문수량
                        data.ordPrice = data.sellDepth.price; //주문 가격
                        data.ordValue = data.ordAmount / data.ordPrice; //주문 가치 =
                        
                        data.isOrdered = true; //주문O
                        data.isContinue = true; //다음주문O
                        
                    }else if(data.side === 'Sell'){
                        //console.log("Sell");
                        ordValue = data.buyDepth.value * rate; //매수1 가치의 n%
                        data.ordAmount = Math.floor(ordValue * data.buyDepth.price); //주문수량
                        data.ordPrice = data.buyDepth.price; //주문 가격
                        data.ordValue = data.ordAmount / data.ordPrice; //주문 가치 =
        
                        data.isOrdered = true; //주문O
                        data.isContinue = true; //다음주문O
                    }
        
                                    
                    if(data.idx === 1){
                        data.goalValue = fixed4(data.goalValue / data.ordPrice);
                    }
        
                    //최소주문가치
                    data.minOrdValue = fixed4(data.minOrdAmt / data.ordPrice); //최소주문가치(xbt) = 수량(달러) / 가격(달러)
                    data.siteMinValue = fixed4(data.siteMinAmt / data.ordPrice); //최소주문가치(xbt) = 수량(달러) / 가격(달러)

                    //주문가치 < 주문최소가치
                    if(data.ordAmount < data.minOrdAmt){
                        console.log("주문가치 < 최소주문가치");
                        data.ordAmount = data.minOrdAmt;
                        data.ordValue = data.minOrdAmt / data.ordPrice;
                        data.isOrdered = true; //주문O
                        data.isContinue = true; //다음주문O
                    }
        
                    //목표가치 < 주문가치
                    if(data.goalValue < data.ordValue){
                        //목표가치로 주문
                        
                        
                        //console.log("목표가치로 주문 : " + data.goalValue + " / " + data.ordValue);
                        data.ordAmount = Math.floor(data.goalValue * data.ordPrice); //주문수량
                        data.ordValue = data.goalValue; 
                        data.isOrdered = true; //주문O
                        data.isContinue = false; //다음주문O
                    }
        
                    var zziggeogi = data.goalValue - (data.totalOrdValue + data.ordValue);
                    //찌꺼기 < 거래소최소수량
                    if(zziggeogi < data.siteMinValue && zziggeogi > 0){
                        //찌꺼기 포함해서 주문
                        data.ordValue += zziggeogi;
                        data.ordAmount = Math.floor(data.ordValue * data.ordPrice); //주문수량
                        data.isOrdered = true; //주문O
                        data.isContinue = false; //다음주문O
                    }
        
                    // //주문가치 < 주문최소가치
                    // if(data.ordValue < data.minOrdValue){
                    //     console.log("주문가치 < 주문최소가치 : "+ data.ordValue + ", "+ data.minOrdValue);
                    //     //주문최소가치로 주문 
                    //     data.ordAmount = data.minOrdAmt;
                    //     data.isOrdered = true; //주문O
                    //     data.isContinue = true; //다음주문O
                    // }
        
                    var remainValue = data.goalValue - data.totalOrdValue; //남은가치 = 목표가치 - 총주문가치
                    
                    //남은가치 < 사이트최소가치 && 남은가치 < 최소주문가치
                    if(remainValue < data.siteMinValue && remainValue < data.minOrdValue){
                       console.log("남은가치 < 사이트최소가치");
                        //주문X
                        data.ordPrice = 0; // 주문 가격
                        data.ordAmount = 0;
                        data.ordValue = 0; //주문최소가치로 주문
                        data.isOrdered = false; //주문X
                        data.isContinue = false; //다음주문X
                    }
        
                    //남은가치 > 사이트최소가치 && 남은가치 < 최소주문가치 
                    if(remainValue > data.siteMinValue && remainValue < data.minOrdValue){
                        console.log("남은가치 > 사이트최소가치");
                        //남은가치 만큼 주문
                        data.ordAmount = Math.floor(remainValue * data.ordPrice); //주문수량 다시 계산
                        data.ordValue =  data.ordAmount / data.ordPrice; // data.minOrdValue //주문최소가치로 주문
                        data.isOrdered = true; //주문O
                        data.isContinue = false; //다음주문X
                    }
        
                    //주문목표가치 < 총주문누적 
                    if(data.goalValue < (data.totalOrdValue + data.ordValue)){
                        console.log("주문목표가치 < 총주문누적 : " + data.goalValue + " " + data.totalOrdValue + " " + data.ordValue);
                        //var diffVal =  (data.totalOrdValue + data.ordValue) - data.goalValue;
                        var diffVal = data.goalValue - data.totalOrdValue;
                        //가치차이 > 사이트최소가치 && 남은가치 > 최소주문가치
                        if(diffVal > data.siteMinValue || diffVal > data.minOrdValue){
                            console.log("가치차이만큼 주문1 : " + diffVal );
                            //가치차이 만큼 주문
                            data.ordAmount = Math.floor(diffVal * data.ordPrice); //주문수량 다시 계산
                            data.ordValue =  data.ordAmount / data.ordPrice; // data.minOrdValue //주문최소가치로 주문
                            data.isOrdered = true; //주문O
                            data.isContinue = false; //다음주문X
                        }
                        else{ //if(diffVal < data.siteMinValue && remainValue < data.minOrdValue && diffVal < data.goalValue)
                            //주문X
                            console.log("가치차이 주문X  : " + diffVal + " " +  data.siteMinValue);
                            data.ordPrice = 0; // 주문 가격
                            data.ordAmount = 0;
                            data.ordValue = 0; //주문최소가치로 주문
                            data.isOrdered = false; //주문X
                            data.isContinue = false; //다음주문X
                        }
                    }
                    cb(null, data); //주문X
                },
                function order(data, cb){
                    if(data.isError === true){
                        return cb(null, data);
                    }
        
                    if(data.isOrdered === false){
                        return cb(null, data); //주문X
                    }
        
                    if(data.side === undefined || data.ordPrice === 0 || data.ordAmount === NaN){
                        // console.log("주문정보 데이터이상");
                        // console.log("side : "+ data.side);
                        // console.log("ordPrice : "+ data.ordPrice);
                        // console.log("ordAmount : "+ data.ordAmount);
                        data.isOrdered=false;
                        data.isContinue = true; //다음주문O
                        return cb(null, data); //주문X
                    }
        
                    var requestHeader = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'POST','order',
                                            {symbol : data.symbol, side : data.side, price : data.ordPrice, orderQty : data.ordAmount, ordType : "Limit", text : "auto"});
                    request(requestHeader, function(error, response, body){
                        if(error){
                            console.log(error)    
                            data.isError = true;
                            data.isContinue = true;
                            return cb(null, data);
                        }
                        
                        //console.log("주문1 : " + body);
                        var json = JSON.parse(body);
                        console.log(data.idx+". site : "+ data.site + "/ side : " + json.side + "/ price : " + price_comma(json.price) + "/ amount : "+ amount_comma(json.orderQty) );
                        if(json.side === undefined || isNaN(json.orderQty)){
                            console.log("주문실패");
                            console.log(body);
                        }

                        if(data.idx === 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'Buy' || data.side=='Sell') ){
                            data.start_price = data.ordPrice;
                            data.end_price = data.ordPrice;
                        }else if(data.idx > 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'Buy' || data.side=='Sell')){
                            data.end_price = data.ordPrice;
                        }
                        
                        data.totalOrdAmount += data.ordAmount; //주문가치 누적
                        data.totalOrdValue += (data.ordAmount / data.ordPrice)//data.ordValue; //주문가치 누적
                        data.orderID = json.orderID; //주문 아이디 저장
                        data.canceledPrice = json.price; //다음 주문시 활용
                        data.isSuccess = true; //주문O
                        cb(null, data);
                    });
                },
                function orderCancel(data, cb){
                    if(data.isError === true){
                        return cb(null, data);
                    }
                    if(data.isOrdered === false){
                        return cb(null, data); //주문X
                    }
                    var requestHeader = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'DELETE','order',
                    {orderID : data.orderID});
                    request(requestHeader, function(error, response, body){
                        if(error){
                            console.log(error)    
                            data.isError = true;
                            data.isContinue = true;
                            return cb(null, data);
                        }
                        var json = JSON.parse(body);
                        //console.log("취소성공")
                        //console.log(body);
                        var remainAmt = json[0].orderQty - json[0].cumQty;
                        if(remainAmt > 0){
                            data.totalOrdAmount -= remainAmt;
                            data.totalOrdValue -= (remainAmt / data.canceledPrice);
                            data.totalRemainAmt += remainAmt; //미체결 수량 합산
                            data.totalRemainVal += (remainAmt / data.canceledPrice); //미체결 가치 합산
                            data.isContinue =true;
                        }
                        cb(null, data);
                    });
                }
              ],function(error, data){
                if(error){
                    console.log(error);
                    //console.log("분할주문종료");
                    insert_history(data);
                    //switchOnOff(data,false);
                    return;
                }
        
                // console.log("msg : " +data.msg);
                // console.log("idx : " +data.idx);
                // console.log("goalValue : " +data.goalValue);
                // console.log("totalOrdValue : " +data.totalOrdValue);
                // console.log("ordValue : " +data.ordValue);
                // console.log("totalOrdAmount : " +data.totalOrdAmount);
                // console.log("ordAmount : " +data.ordAmount);
                // console.log("siteMinValue : " +data.siteMinValue);
                // console.log("minOrdValue : " +data.minOrdValue);
                // console.log("isOrdered : " +data.isOrdered);
                // console.log("isSuccess : " +data.isSuccess);
                // console.log("isContinue : " +data.isContinue);
                console.log();
                if(data.isContinue === true){ //분할주문 가능
                    data.idx += 1;
                    setTimeout(divide_entry_bitmex(data), data.ordInterval);//분할주문
                    return;
                }else if(data.isContinue === false){
                    //종료
                    console.log("로직종료");
                    //switchOnOff(data,false);
                    insert_history(data);
                    return;
                }
              });
        });
    }
  }


  function insert_history(data){
    var end_time = new Date();
    end_time = end_time.getTime() + (1000 * 60 * 60 * 9);
    var walletBalance =0;
    var avgPrice =0;
    var isOrdered = true
    async.waterfall([
        function check_real_order(cb){
            setTimeout(function(){
                position2.findOne({site : data.site}, function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }
                    console.log(json);
                    var side = isPosition(json.size);
                    if(side === 'exit'){ //long 혹은 short 상태가 정상 -> 거래내역 기록 X
                        console.log("진입 실패");
                        isOrdered = false;
                        
                    }
                    switchOnOff(data,false);
                    cb(null);
                });
            },3000);
        },
        // function position(cb){
        //     var requestOptions = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'GET','position','');//'currency=XBt'
        //     request(requestOptions, function(error,response,body){
        //         if(error){
        //             console.log(error);
        //             return;
        //         }
        //         //console.log(body);
        //         var json = JSON.parse(body);
        //         for(i=0; i<json.length; i++){
        //             if( json[i].currentQty === 0  && json[i].symbol==='XBTUSD'){
        //                 console.log("탈출 실패");
        //                 isOrdered = false;
        //             }
        //         }
        //         cb(null);
        //     });
        // },
        function insertDB(cb){
            var obj={
                site : data.site,
                symbol : 'XBTUSD',
                totalAsset : data.firstWalletBalance,//walletBalance, //총자산
                type : (isOrdered === true)? getType(data.side) : getType(data.side)+" 실패", //진입
                side : data.side, //Buy or Sell
                side_num : data.side_num,
                start_price :  fixed1(data.start_price), //가격
                end_price :  fixed1(data.end_price), //가격
                price :  fixed1(data.totalOrdAmount / data.totalOrdValue), //가격
                amount : data.totalOrdAmount, //수량
                value : fixed4(data.totalOrdValue), //가치
                feeRate : 0.075 * 0.01,
                fee : fixed8(data.totalOrdValue * (0.075 * 0.01) ),
                benefit : 0,
                benefitRate : 0,
                div_cnt : data.idx,
                start_time : data.start_time,
                end_time : end_time,
                type_log : data.type_log,
                isSend : false //telegram 전송여부
            }
            avgPrice = obj.price;
            orderDB.insertMany(obj, function(error, res){
                if(error){
                    console.log(error);
                    return;
                }
                console.log(res);
                cb(null);
            });
        },
        function updatePosition(cb){
            if(isOrdered === false){
                return cb(null);
            }

            settings.updateOne(
                {site : data.site}, 
                {$set :
                    {
                        side : getType(data.side), 
                        side_num : data.side_num, 
                        entryPrice : avgPrice, 
                        highPrice : avgPrice, 
                        lowPrice : avgPrice
                    }
                }, 
            function(error, res){
                if(error){
                    console.log(error);
                    return;
                }
                console.log(res);
                cb(null);
            });
        }
    ], function(error, results){
        if(error){
            console.log(error);
            return;
        }
    });
}

function isPosition(size){
    if(size > 0){
        return "long"
    }else if(size < 0){
        return "short";
    }else{
        return "exit";
    }
  }

  function getType(side){
    if(side ==='Buy' || side ==='bid'){
        return 'long'
    }else if(side ==='Sell' || side ==='ask'){
        return 'short'
    }
  }

function switchOnOff(data, isOnOff){
    //탈출중 플래그 ON
    settings.updateOne({
        site : data.site,
    },{
        $set : {
            isEntering : isOnOff 
        }
    },function(error, res){
        if(error){
            console.log(error);
            return;
        }
    });
}

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

function price_comma(num){
    var price = (Number(num))
    if(price < 100){ //가격이 100원보다 작으면 ',' 표시 안하고 그대로 출력
        return price;
    }else{ //가격이 100원보다 크면 ',' 표시 
        return numeral(price).format( '₩0,0.0' )
    }
}
  
  function amount_comma(num){
    var coin = Number(num);
    if(coin >= 0.000001){
        return numeral(coin).format( '₩0,0.0000' ); // 1000.00000123 =>  1,000.00000123
    }else{
        return coin.toFixed(4); // 0.00000078 -> 0.00000078
    }
  }


/**
 * 
 * @param {String} info 레벨 로그 logfileName1 
 * @param {String} debug 레벨 로그 logfileName2 
 */
function create_logger(logfileName1, logfileName2, callback){
    var handle =  winston.createLogger({
        level: 'debug', // 최소 레벨
        // 파일저장
        transports: [
            new winston.transports.DailyRotateFile({
                level : 'info',
                filename : logfileName1, // log 폴더에 system.log 이름으로 저장
                zippedArchive: false, // 압축여부
                maxFiles: '14d',
                format: winston.format.printf(
                    info => `${new Date().toFormat('YYYY-MM-DD HH24:MI:SS')} [${info.level.toUpperCase()}] - ${info.message}`)
            }),
    
            new winston.transports.DailyRotateFile({
                filename : logfileName2, // log 폴더에 system.log 이름으로 저장
                zippedArchive: false, // 압축여부
                maxFiles: '14d',
                format: winston.format.printf(
                    info => `${new Date().toFormat('YYYY-MM-DD HH24:MI:SS')} [${info.level.toUpperCase()}] - ${info.message}`)
            }),
            // 콘솔 출력
            new winston.transports.Console({
                format: winston.format.printf(
                    info => `${new Date().toFormat('YYYY-MM-DD HH24:MI:SS')} [${info.level.toUpperCase()}] - ${info.message}`)
            })
        ]
    });
  
    callback(handle);
  }