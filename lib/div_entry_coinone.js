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
module.exports= function check_is_exit(coinone, obj, logObj){
    logger = logObj;
    switchOnOff({apiKey : obj.apiKey,secreteKey : obj.secreteKey}, true);
   
    return function(){
        settings.find({site :'coinone'},function(error, res){
            if(error){
                console.log(error);
                return;
            }
            
            //탈출중이면 분할진입 대기!
            if(res[0].isExiting === true){
                logger.info("코인원 탈출중 -> 대기 "+ res[0].isExiting + " " + res[0].isEntering);
                setTimeout(check_is_exit(coinone, obj), 10000);
                return;
            }else if(res[0].isExiting === false){ //분할진입 시작
                logger.info("코인원 진입 시작");
                setTimeout(divide_entry_coinone(coinone, obj),obj.ordInterval);
                return;
            }
        });
    }
}

function divide_entry_coinone(coinone, obj){
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
                side : 'buy', //주문 타입
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
                    data.availableMargin =  Math.floor(Number(json["krw"].avail));
                    if(data.idx === 1){
                        data.firstMargin =  Math.floor(Number(json["krw"].balance));
                    }
                    
                    cb(null, data);
                }
            });
        },
        function depth(data, cb){
            if(data.isError === true){
                return cb(null, data);
            }

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
                    data.buyDepth = {}
                    data.sellDepth = {
                        price : Number(json.ask[0].price),//가격-> $ dollar
                        amount : Number(json.ask[0].qty),//수량-> $ dollar
                        value :  Number(json.ask[0].price) * Number(json.ask[0].qty) //가치 -> xbt
                    }
                    cb(null, data);
                }
            });
        },
        function calc(data, cb){
            if(data.isError === true){
                return cb(null, data);
            }

            var rate = (randomFloat(data.minValueRate, data.maxValueRate));
            var ordValue=0;
            var remainValue=0;
            
            if(data.side === 'buy'){
                logger.info("buy");
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
                if(diffVal > data.siteMinValue && diffVal < data.availableMargin ){ //|| diffVal > data.minOrdValue
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

            // //이용가능잔고 < 주문가치
            // if(data.availableMargin * 0.99 < data.ordValue){
            //     logger.info("이용가능잔고 < 주문가치");
            //     //주문X
            //     data.ordPrice = 0; // 주문 가격
            //     data.ordAmount = 0;
            //     data.ordValue = 0; //주문최소가치로 주문
            //     data.isOrdered = false; //주문X
            //     data.isContinue = false; //다음주문X
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
                // price : data.ordPrice,
                // type : data.side,
                // units : data.ordAmount


            coinone.limitBuy("BTC", data.ordPrice, data.ordAmount, function(error, response, body){
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
                
                if(data.idx === 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'buy') ){
                    data.start_price = data.ordPrice;
                    data.end_price = data.ordPrice;
                }else if(data.idx > 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'buy')){
                    data.end_price = data.ordPrice;
                }

                data.orderID = json.orderId;
                data.canceledPrice = data.ordPrice; //다음 주문시 활용
                data.totalOrdAmount += data.ordAmount; //주문수량 누적
                data.totalOrdValue += (data.ordPrice * data.ordAmount)//data.ordValue; //주문가치 누적
                console.log("주문가치 누적1 : "+ data.totalOrdValue)
                data.isSuccess = true; //주문O
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
            coinone.cancelOrder("BTC", data.ordPrice, data.ordAmount, data.orderID, 'bid', function(error, response, body){
                if(error){
                    logger.error("코인원 주문취소 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                try{
                    var json = JSON.parse(body);
                }catch(error){
                    logger.error("코인원 주문취소 error2 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                cb(null, data);
            });
        },
        function order_info(data,cb){
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
                    logger.error("코인원 주문조회 error1 : " + error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                console.log(json);
                console.log("data.ordAmount : "+data.ordAmount);
                if(json.errorCode === "0"){
                    if(data.ordAmount > Number(json.info.qty)){
                        console.log("미체결 : " + data.ordAmount + " > " + Number(json.info.qty));
                        data.totalOrdAmount -= Number(json.info.qty); //주문수량 누적
                        data.totalOrdValue -= (data.canceledPrice * (data.ordAmount - Number(json.info.qty)) );
                        //data.totalOrdValue -= (data.canceledPrice * (Number(json.info.qty)) );

                        data.ordAmount = Number(json.info.qty);
                        data.isContinue = true;
                    }
                    else{
                        console.log("완전체결 : " + data.ordAmount + " === " + Number(json.info.qty));
                    }
                }else if(json.errorCode === "104"){
                    console.log("완전취소 : " + data.ordAmount);
                    data.totalOrdAmount -= data.ordAmount; //주문수량 누적
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
            logger.info("분할주문종료")
            insert_history(data);
            switchOnOff({apiKey : data.apiKey,secreteKey : data.secreteKey},false);
            return;
        }

        logger.info("msg : " +data.msg);
        logger.info("idx : " +data.idx);
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
            setTimeout(divide_entry_coinone(coinone,data), data.ordInterval);//분할주문
            return;
        }else if(data.isContinue === false){
            //종료
            logger.info("로직종료");
            switchOnOff({apiKey : data.apiKey, secreteKey : data.secreteKey},false);
            insert_history(data);

            return;
        }
      });
    }
}
function getType(side){
    if(side ==='buy' || side ==='Buy' || side ==='bid'){
        return 'long'
    }else if(side ==='sell' || side ==='Sell' || side ==='ask'){
        return 'short'
    }
  }
function insert_history(data){
    var end_time = new Date();
    end_time = end_time.getTime() + (1000 * 60 * 60 * 9);
    var walletBalance =0;
    async.waterfall([
        function insertDB(cb){
            console.log("totalOrdValue : "+data.totalOrdValue);
            console.log("totalOrdAmount : "+data.totalOrdAmount);
            var obj={
                site : data.site,
                symbol : 'XBTUSD',
                totalAsset : Math.floor(data.firstMargin), //진입전 총자산
                type : getType(data.side), //진입
                side : data.side, //Buy or Sell 
                start_price :  Math.floor(data.start_price), //가격
                end_price :  Math.floor(data.end_price), //가격
                price : Math.floor(data.totalOrdValue / data.totalOrdAmount), //가격
                amount : fixed4(data.totalOrdAmount), //수량
                value : Math.floor(data.totalOrdValue), //가치 firstMargin
                feeRate : 0.08 * 0.01,
                fee : Math.floor(data.totalOrdValue * (0.08 * 0.01) ),
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
            logger.info(error);
            return;
        }
    });
}
  

function switchOnOff(data, isOnOff){
    //탈출중 플래그 ON
    settings.updateOne({
        site : "coinone"
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