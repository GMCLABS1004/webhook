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
module.exports= function check_is_exit(bithumAPI, obj, logObj){
    logger = logObj;
    logger.info(logObj);
    switchOnOff({apiKey : obj.apiKey,secreteKey : obj.secreteKey}, true);  //진입중 플래그 ON
   
    return function(){
        settings.find({site :'bithumb'},function(error, res){
            if(error){
                console.log(error);
                return;
            }
            
            //탈출중이면 진입 대기!
            if(res[0].isExiting === true){ //탈출중이면 대기
                logger.info("빗썸 탈출중 -> 대기 "+ res[0].isExiting + " " + res[0].isEntering);
                setTimeout(check_is_exit(bithumAPI, obj), 10000); //10초뒤 탈출 했는지 다시 check
                return;
            }else if(res[0].isExiting === false){  //탈출완료했으면 
                logger.info("빗썸 진입 시작")
                setTimeout(divide_entry_bithumb(bithumAPI, obj),obj.ordInterval);  //진입 시작
                return;
            }
        });
    }
}

function divide_entry_bithumb(bithumAPI, obj){
    switchOnOff({apiKey : obj.apiKey, secreteKey : obj.secreteKey}, true);
    return function(){
      async.waterfall([
        function init(cb){
            var data = {
                site : obj.site, //계정명 ex) bithumb
                msg : obj.msg,
                idx : obj.idx, //분할횟수
                url : obj.url,
                apiKey : obj.apiKey,
                secreteKey : obj.secreteKey,
                symbol : obj.symbol,
                ordInterval : obj.ordInterval, //분할주문 시간가격
                firstMargin : obj.firstMargin,
                availableMargin : 0, //잔액
                canceledPrice : 0, //취소할 주문 가격
                totalRemainAmt : obj.totalRemainAmt, //주문후 남은 주문수량
                totalRemainVal : obj.totalRemainVal, //주문후 남은 가치
                goalValue : obj.goalValue, //주문 목표 금액
                firstAvailMargin : obj.firstAvailMargin, //첫 이용가능한 자산
                totalOrdValue : obj.totalOrdValue, //주문넣은 가치 합산
                totalOrdAmount : obj.totalOrdAmount, //주문넣은 가치 합산
                minOrdValue : obj.minOrdValue, //최소주문금액
                siteMinValue : 2000, //거래소 주문 최소 가치
                minOrdAmt : 0, //최소주문달러
                siteMinAmt : 0, //거래소 주문 최소 달러 
                side : 'bid', //주문 타입
                side_num : obj.side_num, //주문 타입
                minValueRate : obj.minValueRate, //최소주문비율
                maxValueRate : obj.maxValueRate, //최대주문비율
                sellDepth : {}, //매도목록
                buyDepth : {}, //매수목록
                orderID : obj.orderID, //주문id
                
                total_krw : obj.total_krw,
                total_btc : obj.total_btc, //
                start_time : obj.start_time, //시작시간
                start_price : obj.start_price,  //시작가격
                end_price : obj.end_price, //종료가격
                ordPrice : 0, //주문넣은 가격
                ordAmount : 0, //주문넣은 수량
                ordValue : 0, //주문넣은 가치
                isOrdered : false, //주문시도 여부
                isSuccess : false, //주문성공 여부
                isContinue : false, //주문분할 계속할지 여부
                isError : false
            }
            logger.info(data.msg +" 주문 시작" );
            //logger.info(JSON.stringify(data) );
            cb(null, data);
        },
        function getUserMargin(data, cb){ //잔액조회
            var rgParams = {
                currency : "BTC"
            };
            
            bithumAPI.bithumPostAPICall('/info/balance', rgParams, function(error, response, body){
                if(error){
                    console.log("빗썸 balance 값 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("빗썸 balance 값 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                if(json.status !== "0000"){
                    logger.error("빗썸 balance 값 조회 error2 : " + body);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                if(data.idx === 1){
                    //data.firstMargin = data.availableMargin;
                    data.firstMargin = Number(json.data["total_krw"]); //이용가능금액
                    data.firstAvailMargin = Math.floor(Number(json.data["available_krw"])); //이용가능금액
                    data.total_krw = Math.floor(Number(json.data["total_krw"])); //총액(원화)
                    data.total_btc = fixed4(Number(json.data["total_btc"]));  //총 코인 갯수
                }
                data.availableMargin =  Math.floor(Number(json.data["available_krw"])); //이용가능금액
                data.totalOrdValue = Math.floor(data.firstAvailMargin - data.availableMargin); //주문넣은 총가치 = 첫이용가능금액 - 현재이용가능금액
                cb(null, data);
            });
        },
        function depth(data, cb){ //매수, 매도 목록 조회
            if(data.isError === true){
                return cb(null, data);
            }
            //매수, 매도 목록 조회
            bithumAPI.orderbook('BTC',function(error,response, body){
                if(error){
                    console.log("빗썸 매수/매도 값 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("빗썸 매수/매도 값 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                if(json.status !== "0000"){
                    logger.error("빗썸 매수/매도 값 조회 error2 : " + body);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                data.buyDepth = {}
                data.sellDepth = {  //매도목록 저장
                    price : Number(json.data.asks[0].price), //가격
                    amount : Number(json.data.asks[0].quantity), //수량
                    value :  Number(json.data.asks[0].price) * Number(json.data.asks[0].quantity) //가치
                }
                cb(null, data);
            });
        },
        function calc(data, cb){ //주문가격, 주문수량, 주문가치 결정
            if(data.isError === true){
                return cb(null, data);
            }

            var rate = (randomFloat(data.minValueRate, data.maxValueRate));
            var ordValue=0;
            var remainValue=0;
            
            if(data.side === 'bid'){ //매수주문이면 
                logger.info("bid");
                ordValue = data.sellDepth.value * rate; //주문가치 = 매도1가치의 n%
                data.ordAmount = fixed4(ordValue / data.sellDepth.price); //주문수량 = 주문가치 / 매도1가격
                data.ordPrice = data.sellDepth.price; //주문 가격 = 매도1가격
                data.ordValue = data.ordAmount * data.ordPrice; //주문 가치 = 주문수량 * 주문가격
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }else{ //로직종료
                logger.info("XXX");
                data.isOrdered = false; //주문X
                data.isContinue = false; //다음주문X
                return cb(null, data);
            }
            

            //최소주문수량
            data.minOrdAmt = fixed4(data.minOrdValue / data.ordPrice); //최소주문수량 = 최소주문가치 / 주문가격
            data.siteMinAmt = fixed4(data.siteMinValue / data.ordPrice); //사이트최소수량 = 사이트최소가치 / 주문가격
            if(data.siteMinAmt === 0){ //사이트최소수량 0이면
                data.siteMinAmt = 0.0001 //사이트최소수량 = 0.0001
            }
            if(data.minOrdAmt === 0){ //최소주문수량 0이면
                data.minOrdAmt = 0.0001 //최소주문수량 = 0
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
                data.ordAmount = data.minOrdAmt; //주문수량 = 최소주문수량
                data.ordValue = data.ordPrice * data.minOrdAmt; //주문가치 = 주문가격 * 최소주문수량
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }


            //목표가치 < 주문가치
            if(data.goalValue < data.ordValue){
                //목표가치로 주문
                logger.info("목표가치로 주문");
                data.ordAmount = fixed4(data.goalValue / data.ordPrice); //주문수량 = 목표가치 / 주문가격
                data.ordValue = data.goalValue;  //주문가치 = 목표가치 
                data.isOrdered = true; //주문O
                data.isContinue = false; //다음주문O
            }

            //찌거기 = 목표가치 - (총주문가치 + 주문가치)
            var zziggeogi = data.goalValue - (data.totalOrdValue + data.ordValue);

            //찌꺼기 < 거래소최소수량
            if(zziggeogi < data.siteMinValue && zziggeogi > 0){
                console.log("zziggeogi : "+ zziggeogi);
                //찌꺼기 포함해서 주문
                data.ordValue += zziggeogi; //주문가치 = 주문가치 + 찌꺼기
                data.ordAmount = fixed4(data.ordValue / data.ordPrice); //주문수량 = 주문가치 / 주문가격
                data.ordValue = data.ordAmount * data.ordPrice; //주문가치 = 주문수량 * 주문가격
                data.isOrdered = true; //주문O
                data.isContinue = false; //다음주문O
            }

            
            //남은가치 = (목표가치 - 총주문가치)
            var remainValue = data.goalValue - data.totalOrdValue;
            
            //남은가치 < 사이트최소가치 && 남은가치 < 최소주문가치
            if(remainValue < data.siteMinValue && remainValue < data.minOrdValue){
                logger.info("남은가치 < 사이트최소가치");
                
                //주문X
                data.ordPrice = 0; //주문가격 = 0
                data.ordAmount = 0; //주문수량 = 0
                data.ordValue = 0; //주문가치 =0
                data.isOrdered = false; //주문X
                data.isContinue = false; //다음주문X
            }

            //남은가치 > 사이트최소가치 && 남은가치 < 최소주문가치 
            if(remainValue > data.siteMinValue && remainValue < data.minOrdValue){
                logger.info("남은가치 > 사이트최소가치");

                //남은가치 만큼 주문
                data.ordAmount = fixed4(remainValue / data.ordPrice); //주문수량=남은가치 / 주문가격
                data.ordValue =  data.ordAmount * data.ordPrice; //주문가치 = 주문수량 * 주문가격
                data.isOrdered = true; //주문O
                data.isContinue = false; //다음주문X
            }

            //주문목표가치 < 총주문누적 
            if(data.goalValue < (data.totalOrdValue + data.ordValue)){
                logger.info("주문목표가치 < 총주문누적 : " + data.goalValue + " " + data.totalOrdValue + " " + data.ordValue);
                //가치차이 = 목표가치 - 총주문가치
                var diffVal = data.goalValue - data.totalOrdValue;
                //가치차이 > 사이트최소가치 && 남은가치 > 최소주문가치
                if(diffVal > data.siteMinValue && diffVal <= data.availableMargin){
                    logger.info("가치차이만큼 주문1 : " + diffVal );
                    //가치차이 만큼 주문
                    data.ordAmount = fixed4(diffVal / data.ordPrice); //주문수량 = 가치차이 / 주문가격
                    data.ordValue =  data.ordAmount * data.ordPrice; // 주문가치 = 주문수량 * 주문가격
                    data.isOrdered = true; //주문O
                    data.isContinue = false; //다음주문X
                }
                else{
                    //주문X
                    logger.info("가치차이 주문X  : " + diffVal + " " +  data.siteMinValue);
                    data.ordPrice = 0; //주문가격=0
                    data.ordAmount = 0; //주문수량=0
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

            var rgParams = {
                order_currency : 'BTC',
                payment_currency : 'KRW',
                price : data.ordPrice,
                type : data.side,
                units : data.ordAmount
            };
            
             //주문
            bithumAPI.bithumPostAPICall('/trade/place', rgParams, function(error, response, body){
                if(error){
                    logger.info("빗썸 주문에러 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.info("빗썸 주문에러 error2 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                if(json.status !== "0000"){
                    logger.info("빗썸 주문에러 조회 error3 : " + body);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                logger.info(data.idx+". site : bithumb " + "/ side : " + data.side + "/ price : " + price_comma(data.ordPrice) + "/ amount : "+ amount_comma(data.ordAmount) );
                //주문성공, 첫주문O
                if(data.idx === 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'bid') ){
                    data.start_price = data.ordPrice; //시작가격 = 주문가격
                    data.end_price = data.ordPrice; //종료가격 = 주문가격
                } //주문성공, , 첫주문X
                else if(data.idx > 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'bid')){
                    data.end_price = data.ordPrice; //종료가격 = 주문가격
                }
                
                data.orderID = json.order_id; //주문ID저장, 주문취소를 위해
                data.canceledPrice = data.ordPrice; //다음 주문시 활용
                data.totalOrdAmount += data.ordAmount; //주문수량 누적
                data.totalOrdValue += (data.ordPrice * data.ordAmount)//data.ordValue; //주문가치 누적
                data.isSuccess = true; //주문O
                cb(null, data); //주문X
            });
           
        },
        function order_info(data,cb){
            if(data.isError === true){
                return cb(null, data);
            }
            if(data.isOrdered === false){
                return cb(null, data); //주문X
            }
            var rgParams = {
                currency : "BTC",
                order_id : data.orderID,
                type : 'bid',
            };
            
            bithumAPI.bithumPostAPICall('/info/orders', rgParams, function(error, response, body){
                if(error){
                    console.log("빗썸 미체결조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("빗썸 미체결조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                if(json.status === "0000"){
                    //미체결되었으면 
                    if(Number(json.data[0].units_remaining) > 0){
                        data.totalOrdAmount -= Number(json.data[0].units_remaining); //총주문수량 = 총주문수량 - 미체결수량 
                        data.totalOrdValue -= (data.canceledPrice * Number(json.data[0].units_remaining)); //총주문가치 = 총주문가치 - (취소주문가격 * 미체결수량)
                        data.isContinue=true; //분할주문 계속
                    }
                }
                
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
            var rgParams = {
                currency : "BTC",
                order_id : data.orderID,
                type : data.side,
            };
            //취소
            bithumAPI.bithumPostAPICall('/trade/cancel', rgParams, function(error, response, body){
                if(error){
                    console.log("빗썸 주문취소 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("빗썸 주문취소 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                cb(null, data);
            });
        },
      ],function(error, data){
        if(error){
            console.log(error);
            logger.info("빗썸 진입 종료")
            insert_history(bithumAPI, data);
            switchOnOff({apiKey : data.apiKey,secreteKey : data.secreteKey},false);
            return;
        }

        logger.info("msg : " +data.msg);
        logger.info("idx : " +data.idx);
        logger.info("goalValue : " +data.goalValue);
        logger.info("totalOrdValue : " +data.totalOrdValue);
        logger.info("ordValue : " +data.ordValue);
        logger.info("totalOrdAmount : " +data.totalOrdAmount);
        logger.info("ordAmount : " +data.ordAmount);
        logger.info("totalRemainVal : " +data.totalRemainVal);
        logger.info("siteMinValue : " +data.siteMinValue);
        logger.info("minOrdValue : " +data.minOrdValue);
        logger.info("isOrdered : " +data.isOrdered);
        logger.info("isSuccess : " +data.isSuccess);
        logger.info("isContinue : " +data.isContinue);
        logger.info("");
        if(data.isContinue === true){ //분할주문 가능
            data.idx += 1; //분할주문횟수 1증가
            setTimeout(divide_entry_bithumb(bithumAPI,data), data.ordInterval);//분할주문
            return;
        }else if(data.isContinue === false){ //분할주문 X
           
            setTimeout(last_order(bithumAPI, data), 5000); //마지막 주문 
            return;
        }
      });
    }
  }


  function last_order(bithumAPI, obj){
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
                    firstAvailMargin : obj.firstAvailMargin, //첫 이용가능한 자산
                    totalOrdValue : obj.totalOrdValue, //주문넣은 가치 합산
                    totalOrdAmount : obj.totalOrdAmount, //주문넣은 가치 합산
                    minOrdValue : obj.minOrdValue, //최소주문금액
                    siteMinValue : 2000, //거래소 주문 최소 가치
                    minOrdAmt : 0, //최소주문달러
                    siteMinAmt : 0, //거래소 주문 최소 달러 
                    side : 'bid', //주문 타입
                    side_num : obj.side_num, //주문 타입
                    minValueRate : obj.minValueRate, //최소주문비율
                    maxValueRate : obj.maxValueRate, //최대주문비율
                    sellDepth : {}, //매도목록
                    buyDepth : {}, //매수목록
                    orderID : obj.orderID, //주문id
                    
                    total_krw : obj.total_krw,
                    total_btc : obj.total_btc,
                    start_time : obj.start_time,
                    start_price : obj.start_price,
                    end_price : obj.end_price,
                    ordPrice : 0, //주문넣은 가격
                    ordAmount : 0, //주문넣은 수량
                    ordValue : 0, //주문넣은 가치
                    isOrdered : false, //주문시도 여부
                    isSuccess : false, //주문성공 여부
                    isContinue : false, //주문분할 계속할지 여부
                    isError : false
                }
                logger.info("last_order! 시작");
                //logger.info(JSON.stringify(data) );
                cb(null, data);
            },
            function orderCancel(data, cb){
                //마지막 주문 취소
                var rgParams = {
                    currency : "BTC",
                    order_id : data.orderID,
                    type : data.side,
                };
                
                bithumAPI.bithumPostAPICall('/trade/cancel', rgParams, function(error, response, body){
                    if(error){
                        console.log("빗썸 주문취소 error1 : " + error);
                        return cb(null, data);
                    }
    
                    try{
                        var json = JSON.parse(body);
                    }catch(error){
                        logger.error("빗썸 주문취소 error1 : " + error);
                        return cb(null, data);
                    }
                    cb(null, data);
                });
            },
            function getUserMargin(data, cb){ //잔액조회후 분할주문 계속 진행할지 판단
                var rgParams = {
                    currency : "BTC"
                };
                
                bithumAPI.bithumPostAPICall('/info/balance', rgParams, function(error, response, body){
                    if(error){
                        console.log("빗썸 balance 값 조회 error1 : " + error);
                        return cb(null, data);
                    }
    
                    try{
                        var json = JSON.parse(body);
                    }catch(error){
                        logger.error("빗썸 balance 값 조회 error1 : " + error);
                        return cb(null, data);
                    }
    
                    if(json.status !== "0000"){
                        logger.error("빗썸 balance 값 조회 error2 : " + body);
                        return cb(null, data);
                    }
                    
                    var avail_krw =  Math.floor(Number(json.data["available_krw"]));
                    data.totalOrdValue = Math.floor(data.firstAvailMargin - avail_krw);
                    var remainValue = Math.floor(data.goalValue - data.totalOrdValue);
                    //분할주문 계속 해야 되면 
                    if(data.goalValue > data.totalOrdValue && remainValue >= data.siteMinValue && avail_krw >= data.siteMinValue){
                        logger.info("avail_krw : " + avail_krw);
                        logger.info("siteMinValue : " + data.siteMinValue);
                        data.isContinue = true; //분할주문 계속 진행 
                    }else{ //분할주문 할필요없으면 
                        logger.info("avail_krw : " + avail_krw);
                        logger.info("siteMinValue : " + data.siteMinValue);
                        data.isContinue = false; //분할주문 종료, 로직종료
                    }


                    cb(null, data);
                });
            },
        ],
        function(error, data){
            if(error){
                console.log(error);
                logger.info("빗썸 진입 종료")
                insert_history(bithumAPI, data); //주문내역 저장 
                switchOnOff({apiKey : data.apiKey,secreteKey : data.secreteKey},false); //진입중 플래그 OFF
                return;
            }
            if(data.isContinue === true){ //분할주문 가능
                data.idx += 1; //분할주문 횟수 1증가
                setTimeout(divide_entry_bithumb(bithumAPI,data), data.ordInterval);//분할주문
                return;
            }else if(data.isContinue === false){ //분할주문 X
                //종료
                logger.info("last_order! 종료");
                switchOnOff({apiKey : data.apiKey, secreteKey : data.secreteKey},false); //진입중 플래그 OFF
                insert_history(bithumAPI, data); //주문 내역 저장
                return;
            }
        })
      }
  }

  function insert_history(bithumAPI, data){
    var end_time = new Date();
    end_time = end_time.getTime() + (1000 * 60 * 60 * 9);
    var total_krw = 0;
    var total_btc =0;
    async.waterfall([
        function getUserMargin(cb){ //잔액조회
            var rgParams = {
                currency : "BTC"
            };
            
            bithumAPI.bithumPostAPICall('/info/balance', rgParams, function(error, response, body){
                if(error){
                    console.log("빗썸 balance 값 조회 error1 : " + error);
                    return;
                }

                try{
                    var json = JSON.parse(body);
                }catch(error){
                    console.log("빗썸 balance 값 조회 error1 : " + error);
                    return;
                }

                if(json.status !== "0000"){
                    console.log("빗썸 balance 값 조회 error2 : " + body);
                   
                    return;
                }
                
                total_krw =  Math.floor(Number(json.data["total_krw"]));
                total_btc =  fixed4(Number(json.data["total_btc"]));
                
                cb(null);
            });
        },
        function insertDB(cb){ //DB에 거래내역 저장
            var value = (data.total_krw - total_krw); //주문가치 =  주문전원화 - 주문후 원화
            var amount = (total_btc - data.total_btc); //주문수량 = 주문후 코인 - 주문전 코인
            var price = value / amount; //주문가격 = 주문가치 / 주문전 코인
            //var price = value / data.totalOrdAmount;
            console.log("진입전 krw : "+ data.total_krw);
            console.log("진입후 : " + total_krw);
            console.log("진입전 : "+ data.total_btc);
            console.log("진입후 : " + total_btc);
            var obj = {
                site : data.site, 
                symbol : 'XBTUSD',
                totalAsset : Math.floor(data.firstMargin), //진입전 총자산
                type : getType(data.side), //진입
                side : data.side, //Buy or Sell 
                side_num : data.side_num, //주문 타입
                start_price :  Math.floor(data.start_price), //가격
                end_price :  Math.floor(data.end_price), //가격
                price : Math.floor(price), //가격
                amount : fixed4(amount), //수량
                value : Math.floor(value),//가치
                feeRate : 0.08 * 0.01, //수수료비율
                fee : Math.floor(data.totalOrdValue * (0.08 * 0.01) ),  //수익
                benefit : 0, //수익
                benefitRate : 0,  //수익율
                div_cnt : data.idx, //분할횟수
                start_time : data.start_time, //시작시간
                end_time : end_time,  //종료시간
                isSend : false //telegram 전송여부
            }
            //거래내역 저장
            orderDB.insertMany(obj, function(error, res){
                if(error){
                    logger.info(error);
                    return;
                }
                logger.info(res);
                cb(null);
            });
        },
        function updatePosition(cb){
            //프로그램 포지션 변경
            settings.updateOne({site : data.site}, {$set :{side : getType(data.side), side_num : data.side_num}}, function(error, res){
                if(error){
                    console.log(error);
                    return;
                }
                console.log("updatePosition 실행!!!!!");
                console.log("updatePosition 실행!!!!!");
                
                console.log(res);
                cb(null);
            });
        }
    ], function(error, results){
        if(error){
            logger.info(error);
            return;
        }
    });
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
        site : "bithumb"
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