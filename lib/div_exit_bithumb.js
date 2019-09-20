var numeral = require('numeral');
var mongoose = require('mongoose');
var randomFloat = require('random-float');
var crypto = require("crypto");
var request = require("request");
var async = require('async');
const winston = require('winston');
require('winston-daily-rotate-file');
require('date-utils');

var settings = require("../models/setting");
var webSetting = require('../webSetting.json');
var orderDB = require('../models/order');

var logger;
var logfileName1 = '../log/bithumb' +'.log'; //로그파일 경로1
var logfileName2 = '../log/bithumb' +'.debug.log'; //로그파일 경로2
create_logger(logfileName1, logfileName2, function(loggerHandle){ logger = loggerHandle}); //logger 생성
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
});

module.exports = function divide_exit_bithumb(bithumAPI, obj){
    switchOnOff({apiKey : obj.apiKey,secreteKey : obj.secreteKey},true);
    return function(){
      async.waterfall([
        function init(cb){
            var data = {
                idx : obj.idx,
                ordInterval : obj.ordInterval,
                minOrdVal : obj.minOrdVal,
                minOrdAmt : 0,
                siteMinVal : obj.siteMinVal,
                siteMinAmt : 0,
                goalAmt : obj.goalAmt,
                totalOrdAmt : obj.totalOrdAmt,
                openingQty : 0, //진입한 포지션 수량 
                side : "none",
                minAmtRate : obj.minAmtRate,
                maxAmtRate : obj.maxAmtRate, //최대주문비율
                orderID : obj.orderID,
                isOrdered : false, //주문시도 여부
                isSuccess : false, //주문성공 여부
                isContinue : false, //주문분할 계속할지 여부
            }
            logger.info(" 주문 시작" );
            //logger.info(JSON.stringify(data) );
            cb(null, data);
        },
        function order_info(data, cb){
            if(data.idx > 1){
                var rgParams = {
                    currency : "BTC",
                    order_id : data.orderID,
                    type : 'bid',
                };
                
                bithumAPI.bithumPostAPICall('/info/orders', rgParams, function(error, response, body){
                    if(error){
                        console.log("빗썸 미체결조회 error1 : " + error);
                        return;
                    }
                    
                    try{
                        var json = JSON.parse(body);
                    }catch(error){
                        logger.error("빗썸 미체결조회 error1 : " + error);
                        return;
                    }
                    
                    if(json.status === "0000"){
                        console.log("걸린거 주문");
                        console.log(json);
                        data.totalOrdAmt -= Number(json.data[0].units_remaining);
                    }
                    
                    cb(null, data);
                });
            }else{
                cb(null, data);
            }
        },
        function orderCancel(data, cb){
            if(data.idx > 1){
                var rgParams = {
                    currency : "BTC",
                    order_id : data.orderID,
                    type : data.side,
                };
                
                bithumAPI.bithumPostAPICall('/trade/cancel', rgParams, function(error, response, body){
                    if(error){
                        console.log("빗썸 주문취소 error1 : " + error);
                        return;
                    }
    
                    try{
                        var json = JSON.parse(body);
                    }catch(error){
                        logger.error("빗썸 주문취소 error1 : " + error);
                        return;
                    }

                    
                    cb(null, data);
                });
            }else{
                cb(null, data);
            }
        },

        function depth(data, cb){
            bithumAPI.orderbook('BTC',function(error,response, body){
                if(error){
                    console.log("빗썸 매수/매도 값 조회 error1 : " + error);
                    return;
                }

                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("빗썸 매수/매도 값 조회 error1 : " + error);
                    return;
                }

                if(json.status !== "0000"){
                    logger.error("빗썸 매수/매도 값 조회 error2 : " + body);
                    return;
                }
                data.sellDepth = {}
                data.buyDepth = {
                    price : Number(json.data.asks[1].price),//가격-> $ dollar
                    amount : Number(json.data.asks[1].quantity),//수량-> $ dollar
                    value :  Number(json.data.asks[1].price) * Number(json.data.asks[1].quantity) //가치 -> xbt
                }
                cb(null, data);
            });
        },

        function position(data, cb){
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
                    logger.error("빗썸 balance 값 조회 error1 : " + error);
                    return;
                }

                if(json.status !== "0000"){
                    logger.error("빗썸 balance 값 조회 error2 : " + body);
                    return;
                }
                
                data.openingQty = Number(json.data["available_btc"]);
                var coin_val = data.openingQty * data.buyDepth.price;
                console.log("openingQty : " + data.openingQty);
                console.log("price : " + data.buyDepth.price);
                console.log("coin_val : " + coin_val);
                console.log("siteMinVal : " + data.siteMinVal);
                if(coin_val > data.siteMinVal){
                    data.side = "ask"; //현재포지션 매수 -> 매도주문
                }else{
                    data.openingQty = 0;
                    data.side = "none"; //현재포지션 none -> 주문X
                }

                if(data.idx === 1){
                    data.goalAmt = data.openingQty;
                }
                cb(null, data);
            });
        },
        function calc(data, cb){
            var rate = fixed2(randomFloat(data.minAmtRate, data.maxAmtRate));
            if(data.side === 'none'){
                logger.info("NONE포지션 : 주문X");
                data.isOrdered = false; //주문X
                data.isContinue = false; //다음주문X
                return cb(null, data);
            }else if(data.side === 'ask'){
                logger.info("Buy포지션 : 매도주문");
                data.ordAmount = fixed4(data.buyDepth.amount * rate); //주문수량
                data.ordPrice = data.buyDepth.price; //주문 가격
                data.ordValue = data.ordAmount * data.ordPrice; //주문 가치 =
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }else{
                logger.info("XXX");
                data.isOrdered = false; //주문X
                data.isContinue = false; //다음주문X
                return cb(null, data);
            }
            
            data.siteMinAmt = fixed4(data.siteMinVal / data.buyDepth.price);
            data.minOrdAmt = fixed4(data.minOrdVal / data.buyDepth.price);
            console.log("siteMinAmt : "+data.siteMinAmt);
            console.log("minOrdAmt : "+data.minOrdAmt);
            if(data.siteMinAmt === 0){
                
                data.siteMinAmt = 0.0001
            }
            if(data.minOrdAmt === 0){
                
                data.minOrdAmt = 0.0001
            }
            console.log("siteMinAmt : "+data.siteMinAmt);
            console.log("minOrdAmt : "+data.minOrdAmt);
            //포지션수량 < 주문수량
            if(data.openingQty < data.ordAmount){
                logger.info("보유수량 < 주문수량 : 보유수량만큼 주문");
                data.ordAmount = fixed4(data.openingQty); //보유수량만큼 주문
                data.isOrdered = true; //주문O
                data.isContinue = false; //다음주문X
            }

            //사이트최소수량 > 주문수량 
            if(data.siteMinAmt > data.ordAmount){
                logger.info("사이트최소수량 > 주문수량 ");
                data.ordAmount = data.siteMinAmt; //사이트최소주문수량으로 주문
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }
            
            if(data.minOrdAmt > data.ordAmount){
                logger.info("주문최소수량 > 주문수량 ");
                data.ordAmount = data.minOrdAmt; //최소주문수량으로 주문
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }

            if(data.goalAmt < data.totalOrdAmt + data.ordAmount){
                var diffAmt = data.goalAmt - data.totalOrdAmt
                logger.info("목표수량 < 누적수량 + 주문수량");
                data.ordAmount = diffAmt; //최소주문수량으로 주문
                data.isOrdered = false; //주문O
                data.isContinue = false; //다음주문O
            }
            
            cb(null, data); //주문X
        },
        function order(data, cb){
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
            console.log(rgParams);
            bithumAPI.bithumPostAPICall('/trade/place', rgParams, function(error, response, body){
                if(error){
                    logger.info("빗썸 주문에러 error1 : " + error);
                    return;
                }

                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.info("빗썸 주문에러 error2 : " + error);
                    return;
                }
        
                if(json.status !== "0000"){
                    logger.info("빗썸 주문에러 조회 error3 : " + body);
                    return;
                }
                logger.info(data.idx+". site : bithumb " + "/ side : " + data.side + "/ price : " + price_comma(data.ordPrice) + "/ amount : "+ amount_comma(data.ordAmount) );
                data.orderID = json.order_id;
                data.totalOrdAmt += data.ordAmount;
                data.isSuccess = true;
                //logger.info(JSON.stringify(body));
                cb(null, data); //주문X
            });
            
            // data.totalOrdAmt += data.ordAmount;
            // data.isSuccess = true;
            // cb(null, data); //주문X
        }
      ],function(error, data){
        if(error){
            console.log(error);
            logger.info("분할주문종료");
            switchOnOff(data, false);
            return;
        }
        logger.info("idx : " +data.idx);
        // logger.info("goalAmt : " +data.goalAmt);
        // logger.info("totalOrdAmt : " +data.totalOrdAmt);
        logger.info("goalAmt : " +data.goalAmt);
        logger.info("totalOrdAmt : " +data.totalOrdAmt);
        logger.info("ordAmount : " +data.ordAmount);
        logger.info("isOrdered : " +data.isOrdered);
        logger.info("isSuccess : " +data.isSuccess);
        logger.info("isContinue : " +data.isContinue);
        logger.info();
        if(data.isContinue === true){ //분할주문 가능
            data.idx += 1;
            setTimeout(divide_exit_bithumb(bithumAPI, data), data.ordInterval);//분할주문
            return;
        }else{
            logger.info("분할주문종료");
            switchOnOff(data, false);
            setTimeout(order_info2(bithumAPI, data), 2000);
            
        }
      });
    }
  }


function order_info2(bithumAPI, data){
    console.log("order_info2");
    console.log(data);
    return function(){
        if(data.idx > 1){
            var rgParams = {
                currency : "BTC",
                order_id : data.orderID,
                type : 'bid',
            };
            
            bithumAPI.bithumPostAPICall('/info/orders', rgParams, function(error, response, body){
                if(error){
                    console.log("빗썸 미체결조회 error1 : " + error);
                    return;
                }
                
                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("빗썸 미체결조회 error1 : " + error);
                    return;
                }
                console.log("미체결내역");
                console.log(json);
                if(json.status === "0000"){
                    data.totalOrdAmt -= Number(json.data[0].units_remaining);
                    console.log("미체결O : 루프 다시 시작");
                    setTimeout(divide_exit_bithumb(bithumAPI, data), data.ordInterval);//분할주문
                }
            
                return;
            });
        }else{
            console.log("미체결X 로직종료");
        }
    }
}


function switchOnOff(data, isOnOff){
    settings.updateOne({
        site : "bithumb"
    },{
        $set : {
            isExiting : isOnOff 
        }
    },function(error, res){
        if(error){
            logger.info(error);
            return;
        }
        console.log(res);
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
