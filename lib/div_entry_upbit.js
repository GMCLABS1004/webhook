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

mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
});

var logger;
module.exports= function check_is_exit(upbit, obj, logObj){
    logger = logObj;
    switchOnOff({apiKey : obj.apiKey,secreteKey : obj.secreteKey}, true);
    
    return function(){
        settings.find({site :'upbit'},function(error, res){
            if(error){
                console.log(error);
                return;
            }
            
            //탈출중이면 분할진입 대기!
            if(res[0].isExiting === true){
                logger.info("업비트 탈출중 -> 대기 "+ res[0].isExiting + " " + res[0].isEntering);
                setTimeout(check_is_exit(upbit, obj), 10000);
                return;
            }else if(res[0].isExiting === false){ //분할진입 시작
                logger.info("업비트 진입 시작");
                setTimeout(divide_entry_upbit(upbit, obj),obj.ordInterval);
                return;
            }
        });
    }
}

function divide_entry_upbit(upbit, obj){
    switchOnOff({apiKey : obj.apiKey, secreteKey : obj.secreteKey}, true);
    return function(){
      async.waterfall([
        function init(cb){
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
                availableMargin : 0, //잔액
                canceledPrice : 0, //취소할 주문 가격
                totalRemainAmt : obj.totalRemainAmt, //주문후 남은 주문수량
                totalRemainVal : obj.totalRemainVal, //주문후 남은 가치
                goalValue : obj.goalValue, //주문 목표 금액
                totalOrdValue : obj.totalOrdValue, //주문넣은 가치 합산
                totalOrdAmount : obj.totalOrdAmount, //주문넣은 가치 합산
                minOrdValue : obj.minOrdValue, //최소주문금액
                siteMinValue : 2000, //거래소 주문 최소 가치
                minOrdAmt : 0, //최소주문달러
                siteMinAmt : 0, //거래소 주문 최소 달러 
                side : 'bid', //주문 타입
                minValueRate : obj.minValueRate, //최소주문비율
                maxValueRate : obj.maxValueRate, //최대주문비율
                sellDepth : {}, //매도목록
                buyDepth : {}, //매수목록
                orderID : obj.orderID, //주문id
               
                total_krw : obj.total_krw,
                total_btc : obj.total_btc,
                start_price : obj.start_price,
                end_price : obj.end_price,
                ordPrice : 0, //주문넣은 가격
                ordAmount : 0, //주문넣은 수량
                ordValue : 0, //주문넣은 가치
                isOrdered : false, //주문시도 여부
                isSuccess : false, //주문성공 여부
                isContinue : false, //주문분할 계속할지 여부
                isError : false,
                start_time :obj.start_time
            }
            logger.info(data.msg +" 주문 시작" );
            //logger.info(JSON.stringify(data) );
            cb(null, data);
        },
        function getUserMargin(data, cb){ //잔액조회
            var firstMargin =0;
            var pay_balance = 0;
            var coin_balance =0;
            var total_krw =0;
            var total_btc =0;
            upbit.accounts(function(error, response, body){
                if (error){
                    logger.error("업비트 잔액조회 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("업비트 잔액조회 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                if(typeof(json["error"]) === 'object'){
                    logger.error("업비트 잔액조회 조회 error1 : " + body);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                json.forEach(element => {
                    if(element.currency === "KRW"){ //KRW
                        pay_balance = Number(element.balance);
                        firstMargin = Number(element.balance) + Number(element.locked)
                        total_krw = Number(element.balance) + Number(element.locked)
                    }
                    else if(element.currency === "BTC"){
                        coin_balance = Number(element.balance);
                        total_btc = fixed4(Number(element.balance) + Number(element.locked))
                    }
                });
                
                data.availableMargin =  Math.floor(pay_balance);
                if(data.idx === 1){
                    data.firstMargin = firstMargin;
                    data.total_krw = Math.floor(total_krw);
                    data.total_btc = total_btc;
                }
                cb(null, data);
            });
        },
        function depth(data, cb){
            if(data.isError === true){
                return cb(null, data);
            }

            upbit.orderbook("KRW-BTC", function(error, response, body){
                if (error){
                    logger.error("업비트 매수/매도 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("업비트 매수/매도 조회 error2 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                if(typeof(json["error"]) === 'object'){
                    logger.error("업비트 잔액조회 조회 error1 : " + body);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                //console.log("3.업비트 매수/매도 조회 성공");
                var obj=parse('upbit', json);
                
                data.buyDepth = {}
                data.sellDepth = {
                    price : Number(obj.asks[0].price),
                    amount : Number(obj.asks[0].amount),
                    value :  Number(obj.asks[0].price) * Number(obj.asks[0].amount) 
                }
                
                cb(null, data);
            });
        },
        function calc(data, cb){
            if(data.isError === true){
                return cb(null, data);
            }

            var rate = (randomFloat(data.minValueRate, data.maxValueRate));
            var ordValue=0;
            var remainValue=0;
            
            if(data.side === 'bid'){
                logger.info("bid");
                ordValue = data.sellDepth.value * rate; //매도1 가치의 n%
                data.ordAmount = fixed4(ordValue / data.sellDepth.price); //주문수량
                data.ordPrice = data.sellDepth.price; //주문 가격
                data.ordValue = data.ordAmount * data.ordPrice; //주문 가치 
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }else{
                logger.info("XXX");
                data.isOrdered = false; //주문X
                data.isContinue = false; //다음주문X
                return cb(null, data);
            }

            
            // if(data.idx === 1){
            //     data.goalValue = fixed4(data.goalValue / data.ordPrice);
            // }

            //최소주문수량
            data.minOrdAmt = fixed4(data.minOrdValue / data.ordPrice); //최소주문가치(xbt) = 수량(달러) / 가격(달러)
            data.siteMinAmt = fixed4(data.siteMinValue / data.ordPrice); //최소주문가치(xbt) = 수량(달러) / 가격(달러)
            if(data.siteMinAmt === 0){
                data.siteMinAmt = 0.0001
            }
            if(data.minOrdAmt === 0){
                data.minOrdAmt = 0.0001
            }
            console.log("ordPrice : "+ data.ordPrice);
            console.log("minOrdVal : "+ data.minOrdValue);
            console.log("siteMinVal : "+ data.siteMinValue);
            console.log("minOrdAmt : "+ data.minOrdAmt);
            console.log("siteMinAmt : "+ data.siteMinAmt);

            //주문가치 < 주문최소가치
            if(data.ordValue < data.minOrdValue){
                logger.info("주문가치 < 주문최소가치 : "+ data.ordValue + ", "+ data.minOrdValue);
                //주문최소가치로 주문 
                data.ordAmount = data.minOrdAmt;
                data.ordValue = data.ordPrice * data.minOrdAmt;
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }


            //목표가치 < 주문가치
            if(data.goalValue < data.ordValue){
                //목표가치로 주문
                logger.info("목표가치로 주문");
                data.ordAmount = fixed4(data.goalValue / data.ordPrice); //주문수량
                data.ordValue = data.goalValue; 
                data.isOrdered = true; //주문O
                data.isContinue = false; //다음주문O
            }

            var zziggeogi = data.goalValue - (data.totalOrdValue + data.ordValue);
            //찌꺼기 < 거래소최소수량
            if(zziggeogi < data.siteMinValue && zziggeogi > 0){
                console.log("zziggeogi : "+ zziggeogi);
                //찌꺼기 포함해서 주문
                data.ordValue += zziggeogi;
                data.ordAmount = fixed4( data.ordValue / data.ordPrice); //주문수량
                data.ordValue = data.ordAmount * data.ordPrice;
                data.isOrdered = true; //주문O
                data.isContinue = false; //다음주문O
            }

            var remainValue = data.goalValue - data.totalOrdValue; //남은가치 = 목표가치 - 총주문가치
            
            //남은가치 < 사이트최소가치 && 남은가치 < 최소주문가치
            if(remainValue < data.siteMinValue && remainValue < data.minOrdValue){
                logger.info("남은가치 < 사이트최소가치");
                //주문X
                data.ordPrice = 0; // 주문 가격
                data.ordAmount = 0;
                data.ordValue = 0; //주문최소가치로 주문
                data.isOrdered = false; //주문X
                data.isContinue = false; //다음주문X
            }

            //남은가치 > 사이트최소가치 && 남은가치 < 최소주문가치 
            if(remainValue > data.siteMinValue && remainValue < data.minOrdValue){
                logger.info("남은가치 > 사이트최소가치");
                //남은가치 만큼 주문
                data.ordAmount = fixed4(remainValue / data.ordPrice); //주문수량 다시 계산
                data.ordValue =  data.ordAmount * data.ordPrice; // data.minOrdValue //주문최소가치로 주문
                data.isOrdered = true; //주문O
                data.isContinue = false; //다음주문X
            }

            //주문목표가치 < 총주문누적 
            if(data.goalValue < (data.totalOrdValue + data.ordValue)){
                logger.info("주문목표가치 < 총주문누적 : " + data.goalValue + " " + data.totalOrdValue + " " + data.ordValue);
                var diffVal = data.goalValue - data.totalOrdValue;
                //가치차이 > 사이트최소가치 && 남은가치 > 최소주문가치
                if(diffVal > data.siteMinValue && diffVal < data.availableMargin){ //|| diffVal > data.minOrdValue
                    logger.info("가치차이만큼 주문1 : " + diffVal );
                    //가치차이 만큼 주문
                    data.ordAmount = fixed4(diffVal / data.ordPrice); //주문수량 다시 계산
                    data.ordValue =  data.ordAmount * data.ordPrice; // data.minOrdValue //주문최소가치로 주문
                    data.isOrdered = true; //주문O
                    data.isContinue = false; //다음주문X
                }
                else{ //if(diffVal < data.siteMinValue && remainValue < data.minOrdValue && diffVal < data.goalValue)
                    //주문X
                    logger.info("가치차이 주문X  : " + diffVal + " " +  data.siteMinValue);
                    data.ordPrice = 0; // 주문 가격
                    data.ordAmount = 0;
                    data.ordValue = 0; //주문최소가치로 주문
                    data.isOrdered = false; //주문X
                    data.isContinue = false; //다음주문X
                }
            }
            // goalValue - data.totalOrdValue
            //이용가능잔고 < 주문가치
            // if(data.availableMargin * 0.99 < data.ordValue && data.siteMinValue < data.availableMargin){
            //     logger.info("이용가능잔고 < 주문가치");
            //     //주문X
            //     data.ordAmount = fixed4( (data.availableMargin * 0.99) / data.ordPrice);
            //     data.ordValue = data.ordAmount * data.ordPrice; //주문최소가치로 주문
            //     data.isOrdered = true; //주문X
            //     data.isContinue = true; //다음주문X
            // }
            cb(null, data); //주문X
        },
        function order(data, cb){
            if(data.isError === true){
                return cb(null, data);
            }

            if(data.isOrdered === false){
                return cb(null, data); //주문X
            }

            upbit.order("KRW-BTC", data.side, data.ordPrice, data.ordAmount, function(error, response, body){
                if(error){
                    logger.info("업비트 주문에러 error1 : "+error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                console.log("주문내용 : " + typeof(body));
                console.log(body);
                logger.info(data.idx+". site : upbit " + "/ side : " + data.side + "/ price : " + price_comma(data.ordPrice) + "/ amount : "+ amount_comma(data.ordAmount) );
                if(data.idx === 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'bid') ){
                    data.start_price = data.ordPrice;
                    data.end_price = data.ordPrice;
                }else if(data.idx > 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'bid')){
                    data.end_price = data.ordPrice;
                }
                
                data.orderID = body.uuid;
                data.canceledPrice = data.ordPrice; //다음 주문시 활용
                data.totalOrdAmount += data.ordAmount; //주문수량 누적
                data.totalOrdValue += (data.ordPrice * data.ordAmount)//data.ordValue; //주문가치 누적 
                data.isSuccess = true; //주문O
                cb(null, data); //주문X
            });
        },
        // function order_info(data,cb){
        //     if(data.isError === true){
        //         return cb(null, data);
        //     }
        //     if(data.isOrdered === false){
        //         return cb(null, data); //주문X
        //     }
        //     upbit.order_info(data.orderID, function(error, response, body){
        //         if(error){
        //             logger.error("업비트 order_info 조회 error1 : " + error);
        //             data.isError = true;
        //             data.isContinue = true;
        //             return cb(null, data);
        //         }

        //         console.log(body);
        //         console.log(typeof(body));
        //         console.log("remaining_volume : "+ Number(body.remaining_volume));
        //         try{
        //             var json = JSON.parse(body);
        //         }catch(error){
        //             logger.error("업비트 잔액조회 조회 error1 : " + error);
        //             data.isError = true;
        //             data.isContinue = true;
        //             return cb(null, data);
        //         }
                
        //         if(typeof(json["error"]) === 'object'){
        //             logger.error("업비트 잔액조회 조회 error1 : " + body);
        //             data.isError = true;
        //             data.isContinue = true;
        //             return cb(null, data);
        //         }

        //         data.totalOrdValue -= (data.canceledPrice * Number(json.remaining_volume));
        //         data.isContinue=true;
                
        //         cb(null, data);
        //     });
        // },
        function orderCancel(data, cb){
            if(data.isError === true){
                return cb(null, data);
            }
            if(data.isOrdered === false){
                return cb(null, data); //주문X
            }
            setTimeout(function(){
                upbit.cancel(data.orderID, function(error, response, body){
                    if(data.isError === true){
                        return cb(null, data);
                    }
                    
                    if(error){
                        logger.error("업비트 주문취소 error1 : " + error);
                        data.isError = true;
                        data.isContinue = true;
                        return cb(null, data);
                    }
    
                    try{
                        var json = JSON.parse(body);
                    }catch(error){
                        logger.error("업비트 잔액조회 조회 error1 : " + error);
                        data.isError = true;
                        data.isContinue = true;
                        return cb(null, data);
                    }
                    
                    console.log(body);
                    console.log(typeof(body));
                    
                    if(Number(json.volume) > Number(json.remaining_volume)){
                        console.log("미체결O : "+ Number(json.remaining_volume));
                        data.totalOrdAmount -= Number(json.remaining_volume); //주문수량 누적
                        data.totalOrdValue -= data.canceledPrice * Number(json.remaining_volume);
                        data.isContinue=true;
                    }else{
                        console.log("완전체결 : " + data.ordAmount);
                    }
                    cb(null, data);
                });
            }, 1000);
        },
      ],function(error, data){
        if(error){
            console.log(error);
            logger.info("분할주문종료")
            insert_history(upbit, data);
            switchOnOff({apiKey : data.apiKey,secreteKey : data.secreteKey},false);
            return;
        }

        logger.info("msg : " +data.msg);
        logger.info("idx : " +data.idx);
        logger.info("availableMargin : " +data.availableMargin);
        logger.info("goalValue : " +data.goalValue);
        logger.info("totalOrdValue : " +data.totalOrdValue);
        logger.info("ordValue : " +data.ordValue);
        logger.info("totalRemainVal : " +data.totalRemainVal);
        logger.info("siteMinValue : " +data.siteMinValue);
        logger.info("minOrdValue : " +data.minOrdValue);
        logger.info("isOrdered : " +data.isOrdered);
        logger.info("isSuccess : " +data.isSuccess);
        logger.info("isContinue : " +data.isContinue);
        logger.info("");
        if(data.isContinue === true){ //분할주문 가능
            data.idx += 1;
            setTimeout(divide_entry_upbit(upbit,data), data.ordInterval);//분할주문
            return;
        }else if(data.isContinue === false){
            //종료
            // logger.info("로직종료");
            // insert_history(upbit, data);
            // switchOnOff({apiKey : data.apiKey, secreteKey : data.secreteKey},false);
            setTimeout(last_order(upbit, data), 5000);
            return;
        }
      });
    }
  }


  function last_order(upbit, obj){
    return function(){
      async.waterfall([
        function init(cb){
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
                availableMargin : 0, //잔액
                canceledPrice : 0, //취소할 주문 가격
                totalRemainAmt : obj.totalRemainAmt, //주문후 남은 주문수량
                totalRemainVal : obj.totalRemainVal, //주문후 남은 가치
                goalValue : obj.goalValue, //주문 목표 금액
                totalOrdValue : obj.totalOrdValue, //주문넣은 가치 합산
                totalOrdAmount : obj.totalOrdAmount, //주문넣은 가치 합산
                minOrdValue : obj.minOrdValue, //최소주문금액
                siteMinValue : 2000, //거래소 주문 최소 가치
                minOrdAmt : 0, //최소주문달러
                siteMinAmt : 0, //거래소 주문 최소 달러 
                side : 'bid', //주문 타입
                minValueRate : obj.minValueRate, //최소주문비율
                maxValueRate : obj.maxValueRate, //최대주문비율
                sellDepth : {}, //매도목록
                buyDepth : {}, //매수목록
                orderID : obj.orderID, //주문id
               
                total_krw : obj.total_krw,
                total_btc : obj.total_btc,
                start_price : obj.start_price,
                end_price : obj.end_price,
                ordPrice : 0, //주문넣은 가격
                ordAmount : 0, //주문넣은 수량
                ordValue : 0, //주문넣은 가치
                isOrdered : false, //주문시도 여부
                isSuccess : false, //주문성공 여부
                isContinue : false, //주문분할 계속할지 여부
                isError : false,
                start_time :obj.start_time
            }
            logger.info("last_order 시작" );
            //logger.info(JSON.stringify(data) );
            cb(null, data);
        },
        function orderCancel(data, cb){
          
            setTimeout(function(){
                upbit.cancel(data.orderID, function(error, response, body){
                    if(data.isError === true){
                        return cb(null, data);
                    }
                    
                    if(error){
                        logger.error("업비트 주문취소 error1 : " + error);
                        data.isError = true;
                        data.isContinue = true;
                        return cb(null, data);
                    }
    
                    try{
                        var json = JSON.parse(body);
                    }catch(error){
                        logger.error("업비트 잔액조회 조회 error1 : " + error);
                        data.isError = true;
                        data.isContinue = true;
                        return cb(null, data);
                    }
                    
                   
                    cb(null, data);
                });
            }, 0);
        },
        function getUserMargin(data, cb){ //잔액조회
            upbit.accounts(function(error, response, body){
                if (error){
                    logger.error("업비트 잔액조회 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("업비트 잔액조회 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                if(typeof(json["error"]) === 'object'){
                    logger.error("업비트 잔액조회 조회 error1 : " + body);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                var avail_krw = 0;
                json.forEach(element => {
                    if(element.currency === "KRW"){ //KRW
                        avail_krw = Math.floor(Number(element.balance));
                    }
                });
                
                if(avail_krw >= data.siteMinValue){
                    logger.info("avail_krw : " + avail_krw);
                    logger.info("siteMinValue : " + data.siteMinValue);
                    data.totalOrdValue -= avail_krw;
                    data.isContinue = true;
                }else{
                    logger.info("avail_krw : " + avail_krw);
                    logger.info("siteMinValue : " + data.siteMinValue);
                    data.isContinue = false;
                }
                cb(null, data);
            });
        }
      ],
      function(error, data){
          if(error){
              console.log(error);
              logger.info("빗썸 진입 종료")
              insert_history(upbit, data);
              switchOnOff({apiKey : data.apiKey,secreteKey : data.secreteKey},false);
              return;
          }
          if(data.isContinue === true){ //분할주문 가능
              data.idx += 1;
              setTimeout(divide_entry_upbit(upbit,data), data.ordInterval);//분할주문
              return;
          }else if(data.isContinue === false){
              //종료
              logger.info("last_order! 종료");
              switchOnOff({apiKey : data.apiKey, secreteKey : data.secreteKey},false);
              insert_history(upbit, data);
              return;
          }
      })
    }
}


  function insert_history(upbit, data){
    var end_time = new Date();
    end_time = end_time.getTime() + (1000 * 60 * 60 * 9);
    var total_krw = 0;
    var total_btc =0;
    async.waterfall([
        function getUserMargin(cb){ //잔액조회
            console.log("잔액조회");
            upbit.accounts(function(error, response, body){
                if(error){
                    console.log("업비트 잔액조회 조회 error1 : " + error);
                    return;
                }

                try{
                    var json = JSON.parse(body);
                }catch(error){
                    console.log("업비트 잔액조회 조회 error1 : " + error);
                    return;
                }
                
                if(typeof(json["error"]) === 'object'){
                    console.log("업비트 잔액조회 조회 error1 : " + body);
                    return;
                }

                json.forEach(element => {
                    if(element.currency === "KRW"){ //KRW
                        total_krw = Math.floor(Number(element.balance) + Number(element.locked));
                    }else if(element.currency === "BTC"){
                        total_btc = fixed4(Number(element.balance) + Number(element.locked));
                    }
                });
                console.log("잔액조회 : " + total_krw);
                
                cb(null);
            });
        },
        function insertDB(cb){
            var value = (data.total_krw - total_krw); //주문가치 =  주문전원화 - 주문후 원화
            var amount = (total_btc - data.total_btc); //주문수량 = 주문후 코인 - 주문전 코인
            var price = value / amount;
            //var price = value / data.totalOrdAmount;
            console.log("진입전 krw : "+ data.total_krw);
            console.log("진입후 : " + total_krw);
            console.log("진입전 : "+ data.total_btc);
            console.log("진입후 : " + total_btc);
            var obj={
                site : data.site,
                symbol : 'XBTUSD',
                totalAsset : Math.floor(data.firstMargin), //진입전 총자산
                type : getType(data.side), //진입
                side : data.side, //Buy or Sell 
                start_price :  Math.floor(data.start_price), //가격
                end_price :  Math.floor(data.end_price), //가격
                price : Math.floor(price),//Math.floor(data.totalOrdValue / data.totalOrdAmount), //가격
                amount : fixed4(amount), //fixed4(data.totalOrdAmount),
                value : Math.floor(value),//Math.floor(data.totalOrdValue), //가치 firstMargin
                feeRate : 0.05 * 0.01,
                fee : Math.floor(data.totalOrdValue * (0.05 * 0.01) ),
                benefit : 0,
                benefitRate : 0,
                div_cnt : data.idx,
                start_time : data.start_time,
                end_time : end_time,
                isSend : false //telegram 전송여부
            }
            
            orderDB.insertMany(obj, function(error, res){
                if(error){
                    logger.info(error);
                    return;
                }
                logger.info(res);
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
  

function getType(side){
    if(side ==='Buy' || side ==='buy' || side ==='bid'){
        return 'long'
    }else if(side ==='Sell' || side ==='sell'  || side ==='ask'){
        return 'short'
    }
  }
function switchOnOff(data, isOnOff){
    //탈출중 플래그 ON
    settings.updateOne({
        site : "upbit"
    },{
        $set : {
            isEntering : isOnOff 
        }
    },function(error, res){
        if(error){
            logger.info(error);
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
  

function fixed4(num){
    var str = new String(num);
    var arr = str.split(".");
	if(arr.length>1){
		    var str2 = arr[1].slice(0,4);
    	return Number(arr[0] + '.' + str2);	
	}
	return Number(arr[0])
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
    var price = Number(num)
    if(price < 100){ //가격이 100원보다 작으면 ',' 표시 안하고 그대로 출력
        return price;
    }else{ //가격이 100원보다 크면 ',' 표시 
        return numeral(price).format( '₩0,0' )
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
 * 거래소별 뎁스를 파싱후 새로운 데이터형으로 생성.
 * @param {*} site "upbit"
 * @param {*} json rest-api의 리턴값
 */
function parse(site, json){
    if(site === 'upbit'){
        var upbit = {
            bids : new Array(),
            asks: new Array()
        }
        json[0].orderbook_units.forEach(element => {
            var askObj = new Object({
                price : element.ask_price,
                amount : element.ask_size,
            });

            var bidObj = new Object({
                price : element.bid_price,
                amount : element.bid_size,
            });
            upbit.asks.push(askObj);
            upbit.bids.push(bidObj);
        });

        return upbit;
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