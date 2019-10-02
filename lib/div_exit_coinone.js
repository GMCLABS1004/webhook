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

// var logger;
// var logfileName1 = '../log/coinone' +'.log'; //로그파일 경로1
// var logfileName2 = '../log/coinone' +'.debug.log'; //로그파일 경로2
// create_logger(logfileName1, logfileName2, function(loggerHandle){ logger = loggerHandle}); //logger 생성
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
});
var logger;
module.exports = function divide_exit_coinone(coinone, obj, logObj){
    logger = logObj
    switchOnOff({apiKey : obj.apiKey,secreteKey : obj.secreteKey},true);
    return function(){
      async.waterfall([
        function init(cb){
            var data = {
                site : obj.site,
                idx : obj.idx,
                ordInterval : obj.ordInterval,
                minOrdVal : obj.minOrdVal,
                minOrdAmt : 0,
                siteMinVal : obj.siteMinVal,
                siteMinAmt : 0,
                goalAmt : obj.goalAmt,
                totalOrdAmt : obj.totalOrdAmt,
                totalOrdValue : obj.totalOrdValue,
                openingQty : 0, //진입한 포지션 수량 
                side : "none",
                minAmtRate : obj.minAmtRate,
                maxAmtRate : obj.maxAmtRate, //최대주문비율
                orderID : obj.orderID,
                isOrdered : false, //주문시도 여부
                isSuccess : false, //주문성공 여부
                isContinue : false, //주문분할 계속할지 여부
                isError : false,
                start_time : obj.start_time
            }
            logger.info(" 주문 시작" );
            //logger.info(JSON.stringify(data) );
            cb(null, data);
        },
        function depth(data, cb){
            coinone.orderbook('BTC',function(error,response, body){
                if(error){
                    logger.error("코인원 매수/매도 값 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("코인원 매수/매도 값 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                if(json.errorCode !== "0"){
                    logger.error("코인원 매수/매도 값 조회 error2 : " + body);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }else{
                    
                    data.buyDepth = {
                        price : Number(json.bid[0].price),//가격-> $ dollar
                        amount : Number(json.bid[0].qty),//수량-> $ dollar
                        value :  Number(json.bid[0].price) * Number(json.bid[0].qty) //가치 -> xbt
                    }
                    data.sellDepth = {}
                    cb(null, data);
                }
            });
        },

        function position(data, cb){
            if(data.isError === true){
                return cb(null, data);
            }

            coinone.balance(function(error, httpResponse, body){
                if(error){
                    logger.error("코인원 balance 값 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("코인원 balance 값 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                if(json.errorCode !== "0"){
                    logger.error("코인원 balance 값 조회 error2 : " + body);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                data.openingQty = fixed4(Number(json["btc"].avail));
                var coin_val = data.openingQty * data.buyDepth.price;
                console.log("openingQty : " + data.openingQty);
                console.log("price : " + data.buyDepth.price);
                console.log("coin_val : " + coin_val);
                console.log("siteMinVal : " + data.siteMinVal);
                if(data.openingQty >= 0.0001){ //coin_val > data.siteMinVal
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
            if(data.isError === true){
                return cb(null, data);
            }
            
            var rate = randomFloat(data.minAmtRate, data.maxAmtRate);
            
            if(data.side === 'none'){
                logger.info("NONE포지션 : 주문X");
                data.isOrdered = false; //주문X
                data.isContinue = false; //다음주문X
                insert_history(coinone, data);
                switchOnOff(data, false);
                return;
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
                switchOnOff(data, false);
                return;
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

            //주문수량 < 최소주문수량
            if(data.ordAmount < data.minOrdAmt){
                logger.info("주문수량 < 최소주문수량");
                data.ordAmount = data.minOrdAmt; //최소주문수량으로 주문
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }
            

            //포지션수량 < 주문수량
            if(data.openingQty < data.ordAmount){
                logger.info("포지션수량 < 주문수량");
                data.ordAmount = fixed4(data.openingQty); //보유수량만큼 주문
                data.isOrdered = true; //주문O
                data.isContinue = false; //다음주문X
            }

            //주문수량 < 사이트최소수량  
            if(data.ordAmount < data.siteMinAmt){
                logger.info("주문수량 < 사이트최소수량");
                data.ordAmount = data.siteMinAmt; //사이트최소주문수량으로 주문
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }
            
            //포지션수량 < 주문수량
            if(data.openingQty < data.siteMinAmt){
                logger.info("포지션수량 < 주문수량");
                data.ordAmount = 0; //보유수량만큼 주문
                data.isOrdered = false; //주문O
                data.isContinue = false; //다음주문X
            }
            
            // if(data.goalAmt < data.totalOrdAmt + data.ordAmount){
            //     var diffAmt = fixed4(data.goalAmt - data.totalOrdAmt)
            //     logger.info("목표수량 < 누적수량 + 주문수량");
            //     data.ordAmount = diffAmt; //최소주문수량으로 주문
            //     if(data.ordAmount>data.siteMinAmt){
            //         data.isOrdered = true; //주문O
            //         data.isContinue = false; //다음주문O
            //     }else{
            //         data.isOrdered = false; //주문O
            //         data.isContinue = false; //다음주문O
            //     }
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

            coinone.limitSell("BTC", data.ordPrice, data.ordAmount, function(error, response, body){
                if(error){
                    logger.info("코인원 주문에러 : "+error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.info("코인원 주문에러 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                if(json.errorCode !== "0"){
                    logger.info("코인원 주문에러 error2 : " + body);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                logger.info(data.idx+". site : coinone " + "/ side : " + data.side + "/ price : " + price_comma(data.ordPrice) + "/ amount : "+ amount_comma(data.ordAmount) );
                data.orderID = json.orderId;
                data.totalOrdAmt += data.ordAmount; //주문수량 누적
                data.totalOrdValue += (data.ordPrice * data.ordAmount) //data.ordValue; //주문가치 누적
                data.isSuccess = true;
                //logger.info(JSON.stringify(body));
                cb(null, data); //주문X
            });
        },

        function orderCancel(data, cb){
            if(data.isError === true){
                return cb(null, data);
            }
            if(data.isOrdered === false){
                return cb(null, data); //주문X
            }

            coinone.cancelOrder("BTC", data.ordPrice, data.ordAmount, data.orderID, data.side, function(error, response, body){
                if(error){
                    logger.error("코인원 주문취소 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("코인원 주문취소 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                cb(null, data);
            });
        },
        function order_info(data, cb){
            if(data.isError === true){
                return cb(null, data);
            }
            if(data.isOrdered === false){
                return cb(null, data); //주문X
            }



            coinone.myOrderInfo(data.orderID, "BTC", function(error, response, body){
                if(error){
                    logger.error("코인원 주문조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("코인원 주문 조회 error2 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                console.log(json);
                console.log("data.ordAmount : "+data.ordAmount);
                //주문조회 성공
                if(json.errorCode === "0"){
                    if(data.ordAmount > Number(json.info.qty)){
                        console.log("미체결 : " + data.ordAmount + " > " + Number(json.info.qty));
                        data.totalOrdAmt -= Number(data.ordAmount -Number(json.info.qty)); //주문수량 누적
                        data.totalOrdValue -= (data.ordPrice * (data.ordAmount -Number(json.info.qty)) );
                        //data.totalOrdValue -= (data.canceledPrice * (Number(json.info.qty)) );
                        data.ordAmount = Number(json.info.qty);
                        data.isContinue = true;
                    }else{
                        console.log("완전체결 : " + data.ordAmount + " == " + Number(json.info.qty));
                    }
                }else if(json.errorCode === "104"){
                    console.log("완전취소 : " + data.ordAmount);
                    data.totalOrdAmt -= data.ordAmount; //주문수량 누적
                    data.totalOrdValue -= (data.ordPrice * (data.ordAmount) );
                    data.ordAmount = 0;
                    data.isContinue = true;
                }
                cb(null, data);
            });
        },
      ],function(error, data){
        if(error){
            console.log(error);
            
            logger.info("분할주문종료");
            insert_history(coinone, data);
            switchOnOff(data, false);
            return;
        }
        logger.info("idx : " +data.idx);
        // logger.info("goalAmt : " +data.goalAmt);
        // logger.info("totalOrdAmt : " +data.totalOrdAmt);
        logger.info("openingQty : " + data.openingQty);
        // logger.info("goalAmt : " +data.goalAmt);
        logger.info("ordAmount : " +data.ordAmount);
        logger.info("totalOrdValue : " +data.totalOrdValue);
        logger.info("totalOrdAmt : " +data.totalOrdAmt);
        logger.info("isOrdered : " +data.isOrdered);
        logger.info("isSuccess : " +data.isSuccess);
        logger.info("isContinue : " +data.isContinue);
        logger.info();
        // if(data.isContinue === true){ //분할주문 가능
        //     data.idx += 1;
        //     setTimeout(divide_exit_coinone(coinone, data), data.ordInterval);//분할주문
        //     return;
        // }
        // else if(data.openingQty ){
        //     logger.info("분할주문종료");
        //     switchOnOff(data, false);
        //     setTimeout(order_info2(coinone, data), 2000);
        // }
        if(data.isContinue === true){
            data.idx += 1;
            setTimeout(divide_exit_coinone(coinone, data, logger), data.ordInterval);//분할주문
        }else{
            logger.info("로직종료");
            insert_history(coinone, data);
            switchOnOff(data, false);
        }
      });
    }
  }




function insert_history(coinone, data){
    var end_time = new Date();
    end_time = end_time.getTime() + (1000 * 60 * 60 * 9);
    var walletBalance = 0;
    var benefit =0;
    var benefitRate = 0;
    async.waterfall([

        function getUserMargin(cb){ //잔액조회
            coinone.balance(function(error, httpResponse, body){
                if(error){
                    logger.error("코인원 balance 값 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("코인원 balance 값 조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                if(json.errorCode !== "0"){
                    logger.error("코인원 balance 값 조회 error2 : " + body);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }else{
                    walletBalance =  Math.floor(Number(json["krw"].balance));
                    
                    
                    cb(null);
                }
            });

        },
        function getOrderHistory(cb){
            orderDB.find({site : data.site}).sort({end_time : "desc"}).exec(function(error, res){
                if(error){
                    console.log(error);
                    return;
                }
                if(res.length > 0){
                    benefit= walletBalance - res[0].totalAsset; //탈출자산 - 진입자산
                    benefitRate = (benefit / res[0].totalAsset) * 100;
                }else{
                    benefit =0;
                    benefitRate =0;
                }
                cb(null);
            });
        },
        function insertDB(cb){
            console.log("totalOrdValue : "+ data.totalOrdValue);
            console.log("totalOrdAmt : "+ data.totalOrdAmt);
            var obj={
                site : data.site,
                symbol : 'XBTUSD',
                totalAsset : 0, //총자산
                type : "exit", //탈출
                side : data.side, //Buy or Sell 
                totalAsset : walletBalance,
                price :  Math.floor(data.totalOrdValue / data.totalOrdAmt), //가격
                amount : fixed4(data.totalOrdAmt), //수4
                value : Math.floor(data.totalOrdValue), //가치
                benefit : Math.floor(benefit),
                benefitRate : fixed4(benefitRate),
                start_time : data.start_time,
                end_time : end_time,
                isSend : false //telegram 전송여부
            }
        
            orderDB.insertMany(obj, function(error, res){
                if(error){
                    console.log(error);
                    return;
                }
                console.log(res);
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
function order_info2(coinone, data){
    console.log("order_info2");
    console.log(data);
    return function(){
        
        var rgParams = {
            currency : "BTC",
            order_id : data.orderID,
            type : 'bid',
        };
        
        coinone.bithumPostAPICall('/info/orders', rgParams, function(error, response, body){
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
                setTimeout(divide_exit_coinone(coinone, data, logger), data.ordInterval);//분할주문
            }
        
            
        });
        
    }
}


function switchOnOff(data, isOnOff){
    settings.updateOne({
        site : "coinone"
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
