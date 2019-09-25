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
// var url = 'https://testnet.bitmex.com';
// var apiKey = '-2YJMJOGLRMvUgaBD1_KzbLt'
// var secreteKey = 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd';
// var symbol = 'XBTUSD';
var logger;
var logfileName1 = '../log/marginTrade' +'.log'; //로그파일 경로1
var logfileName2 = '../log/marginTrade' +'.debug.log'; //로그파일 경로2
create_logger(logfileName1, logfileName2, function(loggerHandle){ logger = loggerHandle}); //logger 생성
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


module.exports= function check_is_exit(obj){
    switchOnOff({apiKey : obj.apiKey,secreteKey : obj.secreteKey}, true);
    return function(){
        settings.find({site :'bitmex'},function(error, res){
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
    switchOnOff({apiKey : obj.apiKey,secreteKey : obj.secreteKey}, true);
    return function(){
      async.waterfall([
        function init(cb){
            var data = {
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
                minOrdValue : 0, //최소주문금액
                siteMinValue : 0, //거래소 주문 최소 가치
                minOrdAmt : obj.minOrdAmt, //최소주문달러
                siteMinAmt : 1, //거래소 주문 최소 달러 
                side : obj.side, //주문 타입
                minValueRate : obj.minValueRate, //최소주문비율
                maxValueRate : obj.maxValueRate, //최대주문비율
                sellDepth : {}, //매도목록
                buyDepth : {}, //매수목록
                orderID : obj.orderID, //주문id
               
                ordPrice : 0, //주문넣은 가격
                ordAmount : 0, //주문넣은 수량
                ordValue : 0, //주문넣은 가치
                isOrdered : false, //주문시도 여부
                isSuccess : false, //주문성공 여부
                isContinue : false, //주문분할 계속할지 여부
                isError : false
            }
            logger.info(data.msg +"진입 주문 시작" );
            logger.info(data);
            cb(null, data);
        },
        
        function getUserMargin(data, cb){ //잔액조회
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
                }
                //console.log("margin : " + body);
                cb(null, data);
            });
          },
        function depth(data, cb){
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
           
            if(data.side === 'Buy'){
                logger.info("Buy");
                // console.log("value : " +data.sellDepth.value);
                // console.log("rate : "+ rate);
                ordValue = data.sellDepth.value * rate; //매도1 가치의 n%
                data.ordAmount = Math.floor(ordValue * data.sellDepth.price); //주문수량
                data.ordPrice = data.sellDepth.price; //주문 가격
                data.ordValue = data.ordAmount / data.ordPrice; //주문 가치 =
                
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
               
            }else if(data.side === 'Sell'){
                logger.info("Sell");
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
                logger.info("주문가치 < 최소주문가치");
                data.ordAmount = data.minOrdAmt;
                data.ordValue = data.minOrdAmt / data.ordPrice;
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }

            //목표가치 < 주문가치
            if(data.goalValue < data.ordValue){
                //목표가치로 주문
                logger.info("목표가치로 주문 : " + data.goalValue + " / " + data.ordValue);
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
                data.ordAmount += Math.floor(data.ordValue * data.ordPrice); //주문수량
                data.isOrdered = true; //주문O
                data.isContinue = false; //다음주문O
            }

            // //주문가치 < 주문최소가치
            // if(data.ordValue < data.minOrdValue){
            //     logger.info("주문가치 < 주문최소가치 : "+ data.ordValue + ", "+ data.minOrdValue);
            //     //주문최소가치로 주문 
            //     data.ordAmount = data.minOrdAmt;
            //     data.isOrdered = true; //주문O
            //     data.isContinue = true; //다음주문O
            // }

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
                data.ordAmount = Math.floor(remainValue * data.ordPrice); //주문수량 다시 계산
                data.ordValue =  data.ordAmount / data.ordPrice; // data.minOrdValue //주문최소가치로 주문
                data.isOrdered = true; //주문O
                data.isContinue = false; //다음주문X
            }

            //주문목표가치 < 총주문누적 
            if(data.goalValue < (data.totalOrdValue + data.ordValue)){
                logger.info("주문목표가치 < 총주문누적 : " + data.goalValue + " " + data.totalOrdValue + " " + data.ordValue);
                //var diffVal =  (data.totalOrdValue + data.ordValue) - data.goalValue;
                var diffVal = data.goalValue - data.totalOrdValue;
                //가치차이 > 사이트최소가치 && 남은가치 > 최소주문가치
                if(diffVal > data.siteMinValue || diffVal > data.minOrdValue){
                    logger.info("가치차이만큼 주문1 : " + diffVal );
                    //가치차이 만큼 주문
                    data.ordAmount = Math.floor(diffVal * data.ordPrice); //주문수량 다시 계산
                    data.ordValue =  data.ordAmount / data.ordPrice; // data.minOrdValue //주문최소가치로 주문
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

 

            //이용가능잔고 < 주문가치
            if(data.availableMargin * 0.99 < data.ordValue){
                logger.info("이용가능잔고 < 주문가치");
                //주문X
                data.ordPrice = 0; // 주문 가격
                data.ordAmount = 0;
                data.ordValue = 0; //주문최소가치로 주문
                data.isOrdered = false; //주문X
                data.isContinue = false; //다음주문X
            }

            // if(data.goalValue < data.ordValue){
            //     var diffVal = data.goalValue - data.totalOrdValue; //목표가치 - 누적가치
            //     //가치차이 만큼 주문
            //     data.ordAmount = Math.floor(diffVal * data.ordPrice); //주문수량 다시 계산
            //     data.ordValue =  data.ordAmount / data.ordPrice; // data.minOrdValue //주문최소가치로 주문
            //     data.isOrdered = true; //주문O
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
                logger.info(data.idx+". site : bitmex " + "/ side : " + json.side + "/ price : " + price_comma(json.price) + "/ amount : "+ amount_comma(json.orderQty) );
                data.totalOrdValue += data.ordValue; //주문가치 누적
                data.orderID = json.orderID; //주문 아이디 저장
                data.canceledPrice = json.price; //다음 주문시 활용
                data.isSuccess = true; //주문O
                // var history = {
                //     site : "bitmex",
                //     side : json.side,
                //     price : json.price,
                //     amount : json.orderQty,
                //     timestamp : (new Date().getTime() + (1000 * 60 * 60 * 9))
                // }
                
                // orderDB.insertMany(history,function(error,res){
                //     if(error){
                //         console.log(error);
                //         return;
                //     }
                // });
                cb(null, data);
            });
        },
        function orderCancel(data, cb){
            if(data.isError === true){
                return cb(null, data);
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
                //logger.info("취소성공")
                logger.info(body);
                var remainAmt = json[0].orderQty - json[0].cumQty;
                if(remainAmt > 0){
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
            logger.info("분할주문종료")
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
        logger.info();
        if(data.isContinue === true){ //분할주문 가능
            data.idx += 1;
            setTimeout(divide_entry_bitmex(data), data.ordInterval);//분할주문
            return;
        }else if(data.isContinue === false){
            //종료
            logger.info("로직종료");
            switchOnOff({apiKey : data.apiKey,secreteKey : data.secreteKey},false);
            return;
        }
        
        // //미체결되어 취소된 가치 < 거래소최소가치
        // if(data.totalRemainVal < data.siteMinValue && data.totalRemainVal < data.minOrdValue){
        //     //종료
        //     logger.info("미체결 분할주문X 로직종료")
        //     switchOnOff({apiKey : data.apiKey,secreteKey : data.secreteKey},false);
        //     return;
        // }else{ //분할주문이 끝났다면 미체결 가치만큼 다시 분할주문
        //     var obj = {
        //         msg : "div2",
        //         idx : data.idx + 1,
        //         url : 'https://testnet.bitmex.com',
        //         apiKey : '-2YJMJOGLRMvUgaBD1_KzbLt',
        //         secreteKey : 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd',
        //         symbol : 'XBTUSD',
        //         firstMargin : 0,
        //         totalRemainAmt : 0, //미체결 수량
        //         totalRemainVal : 0, //미체결 가치
        //         goalValue : data.totalRemainVal, //주문 목표 금액
        //         totalOrdValue : 0, //주문넣은 가치 합산
        //         side : data.side, //주문 타입
        //         minOrdValue : 1000, //최소주문금액
        //         minValueRate : data.minValueRate, //최소주문비율
        //         maxValueRate : data.maxValueRate, //최대주문비율
        //         orderID : "" //주문id
        //     }
        //     setTimeout(divide_entry_bitmex(data), 10000);//미체결가치만큼 분할주문
        // }
      });
    }
  }


  

function switchOnOff(data, isOnOff){
    //탈출중 플래그 ON
    settings.updateOne({
        site : "bitmex"
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