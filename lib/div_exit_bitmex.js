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
var position2 = require('../models/position2');
var benefitDB = require('../models/benefit');
// var logger;
// var logfileName1 = '../log/marginTrade' +'.log'; //로그파일 경로1
// var logfileName2 = '../log/marginTrade' +'.debug.log'; //로그파일 경로2
//create_logger(logfileName1, logfileName2, function(loggerHandle){ logger = loggerHandle}); //logger 생성
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
//     goalAmt : 0,
//     totalOrdAmt : 0,
//     openingQty : 0, //진입한 포지션 수량 
//     side : "",
//     minAmtRate : 0.07, //최소주문비율
//     maxAmtRate : 0.09, //최대주문비율
//     isOrdered : false, //주문시도 여부
//     isSuccess : false, //주문성공 여부
//     isContinue : false, //주문분할 계속할지 여부
// }

// setTimeout(divide_exit_bitmex(data), 0);
var logger;
module.exports = function divide_exit_bitmex(obj, logObj){
    logger = logObj;
    switchOnOff(obj,true);
    return function(){
        var data = {
            site : obj.site,
            idx : obj.idx,
            url : obj.url,
            apiKey : obj.apiKey,
            secreteKey : obj.secreteKey,
            symbol : obj.symbol,
            ordInterval : obj.ordInterval,
            minOrdAmt : obj.minOrdAmt,
            goalAmt : obj.goalAmt,
            totalOrdAmt : obj.totalOrdAmt,
            totalOrdValue : obj.totalOrdValue,
            openingQty : 0, //진입한 포지션 수량 
            side : "",
            side_num : obj.side_num,
            start_price : obj.start_price,
            end_price : obj.end_price,
            minAmtRate : obj.minAmtRate,
            maxAmtRate : obj.maxAmtRate, //최대주문비율
            orderID : obj.orderID,
            start_time : obj.start_time,
            type_log : obj.type_log,
            start_asset_sum : obj.start_asset_sum,  //첫 자산들 총합
            end_asset_sum : obj.end_asset_sum, //탈출전 자산 합
            isOrdered : false, //주문시도 여부
            isSuccess : false, //주문성공 여부
            isContinue : false, //주문분할 계속할지 여부
            isError : false
        }
        async.parallel([
            function end_asset_sum(cb){ //탈출전 자산 합
                if(data.idx !== 1){
                    return cb(null);
                }

                //최초 한번만 실행
                get_total_asset("desc",function(error, asset){
                    if(error){
                        console.log(error);
                        return;
                    }
                    data.end_asset_sum = asset;
                    cb(null);
                });
            },
            function start_asset_sum(cb){ //첫 자산들 총합
                if(data.idx !== 1){
                    return cb(null);
                }

                //최초 한번만 실행
                get_total_asset("asc",function(error, asset){
                    if(error){
                        console.log(error);
                        return;
                    }
                    data.start_asset_sum = asset;
                    cb(null);
                });
            },
            function position(cb){
                var requestOptions = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'GET','position','');//'currency=XBt'
                request(requestOptions, function(err,response,body){
                    if(err){
                        console.log(err);
                        data.isError = true;
                        data.isContinue = true;
                        return cb(null, data);
                    }
                    //console.log(body);
                    var json = JSON.parse(body);
                    
                    for(i=0; i<json.length; i++){
                        if(json[i].currentQty > 0 && json[i].symbol==='XBTUSD'){
                            //console.log("매수");
                            data.openingQty = json[i].currentQty; //dollar
                            data.side = "Sell";
                        }else if(json[i].currentQty < 0 && json[i].symbol==='XBTUSD'){
                            //console.log("매도");
                            data.openingQty = Math.abs(json[i].currentQty); //dollar
                            data.side = "Buy";
                        }else{
                            data.openingQty = 0;
                            data.side = "NONE";
                        }
    
                        if(data.idx === 1){
                            data.goalAmt = data.openingQty;
                        }
                    }
                    console.log("data.openingQty : "+ data.openingQty);
                    console.log("data.side : "+ data.side);
                    cb(null);
                });
            },
            function depth(cb){
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
                            price : json[0].price,//가격-> $ dollar
                            amount : json[0].size,//수량-> $ dollar
                            value :  json[0].size / json[0].price //가치 -> xbt
                        }
                        data.buyDepth = {
                            price : json[1].price,//가격-> $ dollar
                            amount : json[1].size, //수량-> $ dollar
                            value : json[1].size / json[1].price  //가치 -> xbt
                        }
                    }
                    
                    cb(null);
                });
            },
        ], function(error, results){
            if(error){
                console.log(error);
                return;
            }
            
            async.waterfall([
                function init(cb){
                    cb(null, data);
                },
                function calc(data, cb){
                    if(data.isError === true){
                        return cb(null, data);
                    }
        
                    var rate = (randomFloat(data.minAmtRate, data.maxAmtRate));
                    var ordAmount=0;
                    var remainValue=0;
                    if(data.side === 'NONE'){
                        logger.info("NONE");
                        data.isOrdered = false; //주문X
                        data.isContinue = false; //다음주문X
                        return cb(null, data);
                    }
                    else if(data.side === 'Buy'){
                        logger.info("Buy");
                        
                        data.ordAmount = Math.floor(data.sellDepth.amount * rate); //주문수량
                        data.ordPrice = data.sellDepth.price; //주문 가격
                        data.ordValue = data.ordAmount / data.ordPrice; //주문 가치 =
                       
                        data.isOrdered = true; //주문O
                        data.isContinue = true; //다음주문O
                        
                    }else if(data.side === 'Sell'){
                        logger.info("Sell");
                        data.ordAmount = Math.floor(data.buyDepth.amount * rate); //주문수량
                        data.ordPrice = data.buyDepth.price; //주문 가격
                        data.ordValue = data.ordAmount / data.ordPrice; //주문 가치 =
                        data.isOrdered = true; //주문O
                        data.isContinue = true; //다음주문O
                    }
                    
                    // 주문수량 < 최소주문수량
                    if(data.ordAmount < data.minOrdAmt ){
                        data.ordAmount = data.minOrdAmt; //최소주문수량으로 주문
                        data.isOrdered = true; //주문O
                        data.isContinue = true; //다음주문O
                    }
                    
                      //포지션수량 < 주문수량
                    if(data.openingQty < data.ordAmount){
                        logger.info("포지션수량 < 주문수량");
                        data.ordAmount = data.openingQty;
                        data.isOrdered = true; //주문O
                        data.isContinue = false; //다음주문X
                    }

                    //포지션수량 < 주문수량
                    if(data.openingQty < data.siteMinAmt){
                        logger.info("포지션수량 < 사이트최소수량");
                        data.ordAmount = 0; //보유수량만큼 주문
                        data.isOrdered = false; //주문O
                        data.isContinue = false; //다음주문X
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
                        
                        logger.info(data.idx+". site : "+ data.site + "/ side : " + json.side + "/ price : " + price_comma(json.price) + "/ amount : "+ amount_comma(json.orderQty) );
                        if(json.side === undefined || isNaN(json.orderQty)){
                            logger.info("주문실패");
                            logger.info(body);
                        }
                        if(data.idx === 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'Buy' || data.side=='Sell') ){
                            data.start_price = data.ordPrice;
                            data.end_price = data.ordPrice;
                        }else if(data.idx > 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'Buy' || data.side=='Sell')){
                            data.end_price = data.ordPrice;
                        }
                        data.orderID = json.orderID; //취소위해 주문ID저장
                        data.totalOrdAmt += data.ordAmount;
                        data.totalOrdValue += (data.ordAmount / data.ordPrice);
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
                            //res.send(error);
                            data.isError = true;
                            data.isContinue = true;
                            return cb(null, data);
                        }
                        var json = JSON.parse(body);
                        //logger.info("취소성공");
                        //logger.info(body);
                        if(typeof(json.error) === 'object' ){
                            return cb(null, data);
                        }

                        var remainAmt = json[0].orderQty - json[0].cumQty;
                        
                        if(remainAmt > 0){
                            data.totalOrdAmt -= remainAmt;
                            data.totalOrdValue -= (remainAmt/data.ordPrice);
                            data.isContinue = true;
                        }
                        
                        cb(null, data);
                    });
                }
              ],function(error, data){
                if(error){
                    console.log(error);
                    logger.info("분할주문종료");
                    //switchOnOff(data, false);
                    insert_history(data);
                    return;
                }
                // logger.info("idx : " +data.idx);
                // // logger.info("goalAmt : " +data.goalAmt);
                // // logger.info("totalOrdAmt : " +data.totalOrdAmt);
                // logger.info("goalAmt : " +data.goalAmt);
                // logger.info("totalOrdAmt : " +data.totalOrdAmt);
                // logger.info("ordAmount : " +data.ordAmount);
                // logger.info("isOrdered : " +data.isOrdered);
                // logger.info("isSuccess : " +data.isSuccess);
                // logger.info("isContinue : " +data.isContinue);
                logger.info();
                if(data.isContinue === true){ //분할주문 가능
                    data.idx += 1;
                    setTimeout(divide_exit_bitmex(data, logger), data.ordInterval);//분할주문
                    return;
                }else{
                    logger.info("분할주문종료");
                    //switchOnOff(data, false);
                    insert_history(data);
                    return;
                }
              });
        });
    }
  }

function switchOnOff(data, isOnOff){
    //탈출중 플래그 ON
    //수정된 원화가치 저장
    // settings_v2.updateOne({currency : order_currency + "_" + payment_currency}, {$set : {changed_krw : changed_krw}},function(err, json){
    //     if(err){
    //         console.log(err);
    //         return;
    //     }
    //     console.log("changed_krw 업데이트");
    // });
    settings.updateOne({
        site : data.site
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


function get_total_asset(isSort, callback){
    var list = [];
    var total_asset=0;
    for(var i=1; i<=10; i++){
      orderDB.findOne({site : "bitmex"+i}).sort({start_time : isSort}).limit(1).exec(function(error, json){
        if(error){
          console.log(error);
          return;
        }
        
        list.push(json);
        if(json!== null){
          total_asset += json.totalAsset;
        }
        
        if(list.length === 10){
          callback(null, total_asset);
        }
      });
    }
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
  

function insert_history(data){
    var start_time = data.start_time;
    var end_time = new Date();
    end_time = end_time.getTime() + (1000 * 60 * 60 * 9);
    
    var walletBalance = 0;
    var benefit =0;
    var benefitRate = 0;
    var isOrdered = true
    var avgPrice =0;
    var benefitObj = {}
    async.waterfall([
        function check_real_order(cb){
            setTimeout(function(){
                position2.findOne({site : data.site}, function(error, json){
                    if(error){
                        console.log(error);
                        return;
                    }
                    var side = isPosition(json.size);
                    if(side !== 'exit'){ //exit 상태가 정상 -> 거래내역 기록 X
                        console.log("탈출 실패");
                        isOrdered = false;
                    }
                    //isOrdered = false;
                    switchOnOff(data,false);
                    cb(null);
                });
            },2000);
        },
        function position(cb){
            var requestOptions = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'GET','user/margin','currency=XBt');
            request(requestOptions, function(error, response, body){
                if(error){
                    console.log(error);
                    //res.send(error);
                    return;
                }
                var json = JSON.parse(body);
                walletBalance = json.walletBalance / 100000000;
                // if(json.isOpen === true){ //false가 정상

                // }
                switchOnOff(data,false);
                // data.marginBalance = json.marginBalance / 100000000;
                // data.availableMargin = json.availableMargin / 100000000;
                //console.log("margin : " + body);
                cb(null);
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

        function insert_order_history(cb){
            var obj={
                site : data.site,
                symbol : 'XBTUSD',
                totalAsset : 0, //총자산
                type : (isOrdered === true)? "exit" : "exit 실패", //탈출 
                side : data.side, //Buy or Sell 
                side_num : data.side_num, //Buy or Sell 
                totalAsset : walletBalance,
                start_price :  fixed1(data.start_price), //가격
                end_price :  fixed1(data.end_price), //가격
                price :  fixed1(data.totalOrdAmt / data.totalOrdValue), //가격
                amount : data.totalOrdAmt, //수4
                value : fixed4(data.totalOrdValue), //가치
                benefit : fixed8(benefit),
                benefitRate : fixed4(benefitRate),
                start_time : data.start_time,
                end_time : end_time,
                div_cnt : data.idx,
                type_log : data.type_log,
                isSend : false //telegram 전송여부
            }
            avgPrice = obj.price;
            console.log("type_log1 : "+ data.type_log);
            orderDB.insertMany(obj, function(error, res){
                if(error){
                    console.log(error);
                    return;
                }
                console.log(res);
                cb(null);
            });
        },
        function insert_benefit_history(cb){
            var obj = {
                site : data.site,
                start_asset_sum : fixed8(data.start_asset_sum), //시작 자산들 총합(탈출전)
                end_asset_sum : fixed8(data.end_asset_sum), //최근 자산들 총합(탈출전)
                before_asset_sum : fixed8(data.end_asset_sum),  //최근 자산들 총합(탈출전)
                after_asset_sum : fixed8(data.end_asset_sum + benefit),//최근 자산들 총합(탈출후)
                benefit : fixed8(benefit), //이번거래로 생긴 수익
                benefitRate : (benefit / data.end_asset_sum) * 100, //탈출전 총자산 대비 수익율
                type_log : data.type_log, //trailingStop, rentry, manual etc..
                timestamp : end_time,//탈출 시간
                start_time : start_time,
                end_time : end_time,
            }
            console.log("type_log2 : "+ data.type_log);
            benefitDB.insertMany(obj, function(error, res){
                if(error){
                    console.log(error);
                    return;
                }
                cb(null);
            });
        },
        function updatePosition(cb){
            if(isOrdered === false){
                return cb(null);
            }
            
            settings.findOne({site : data.site}, function(error, json){
                if(error){
                    console.log(error);
                    return;
                }

                if(data.type_log === 'trailingStop'){ //트레일링 스탑 -> 상태변화X
                    settings.findByIdAndUpdate(
                        json._id,
                        {$set : {entryPrice : avgPrice, highPrice : avgPrice, lowPrice : avgPrice}}, //
                        function(error, res){
                            if(error){
                                console.log(error);
                                return cb(null);
                            }
                            return cb(null);
                        }
                    )
                }else{ //나머지 -> 상태변화O, 진입, 고점,저점,초기화
                    settings.findByIdAndUpdate(json._id, {$set :{side : 'exit', side_num : data.side_num, entryPrice : avgPrice, highPrice : avgPrice, lowPrice : avgPrice}}, function(error, res){
                        if(error){
                            console.log(error);
                            return;
                        }
                        console.log(res);
                        return cb(null);
                    });
                }
            });
        },
        
    ], function(error, results){
        if(error){
            console.log(error);
            return;
        }
        
    })
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