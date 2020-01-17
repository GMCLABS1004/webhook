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
// var logfileName1 = '../log/upbit' +'.log'; //로그파일 경로1
// var logfileName2 = '../log/upbit' +'.debug.log'; //로그파일 경로2
// create_logger(logfileName1, logfileName2, function(loggerHandle){ logger = loggerHandle}); //logger 생성
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
});

var logger;
module.exports = divide_exit_upbit;
function divide_exit_upbit(upbit, obj, logObj){
    logger = logObj
    //console.log("탈출!!!"+upbit);
    switchOnOff({apiKey : obj.apiKey,secreteKey : obj.secreteKey},true);
    return function(){
      async.waterfall([
        function init(cb){
            var data = {
                site : obj.site, //업비트 계정
                idx : obj.idx, //분할주문 횟수
                ordInterval : obj.ordInterval, //주문간격 n초
                minOrdVal : obj.minOrdVal, //최소주문가치 
                minOrdAmt : 0, //최소주문수량
                siteMinVal : obj.siteMinVal, //사이트최소가치 
                siteMinAmt : 0, //사이트최소수량
                goalAmt : obj.goalAmt, //목표수량
                totalOrdAmt : obj.totalOrdAmt, //총주문수량
                totalOrdValue : obj.totalOrdValue, //총주문가치 
                openingQty : 0, //진입한 포지션 수량
                side : "none", //현재포지션
                side_num : obj.side_num, //스크립트번호
                minAmtRate : obj.minAmtRate, //최소주문비율
                maxAmtRate : obj.maxAmtRate, //최대주문비율
                orderID : obj.orderID, //주문ID
                isOrdered : false, //주문시도 여부
                isSuccess : false, //주문성공 여부
                isContinue : false, //주문분할 계속할지 여부
                isError : false, //에러
                start_time : obj.start_time, //시작시간
                start_price : obj.start_price, //시작가격
                end_price : obj.end_price, //종료가격
                total_krw : obj.total_krw, 
                total_btc : obj.total_btc 
            }
            logger.info(" 주문 시작" );
            //logger.info(JSON.stringify(data) );
            cb(null, data);
        },
        function depth(data, cb){  //매수, 매도 목록 조회
            //매수, 매도 목록 조회
            upbit.orderbook("KRW-BTC", function(error, response, body){
                if(error){
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
                    logger.error("업비트 매수/매도 조회 error1 : " + body);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }
                
                //console.log("3.업비트 매수/매도 조회 성공");
                var obj=parse('upbit', json);
                //매수목록 조회
                data.buyDepth = {
                    price : Number(obj.bids[0].price), //가격
                    amount : Number(obj.bids[0].amount), //수량
                    value :  Number(obj.bids[0].price) * Number(obj.bids[0].amount) //가치
                }
                data.sellDepth ={};
                cb(null, data);
            });
        },
        function position(data, cb){ //포지션 조회
            if(data.isError === true){
                return cb(null, data);
            }
            
            var pay_balance = 0;
            var coin_balance =0;
            var total_krw = 0;
            var total_btc =0;
            upbit.accounts(function(error, response, body){
                
                if(error){
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
                        pay_balance = Number(element.balance); //이용가능 금액
                        total_krw = Number(element.balance) + Number(element.locked); //총원화 = 이용가능금액 + 묶여있는금액
                    }
                    else if(element.currency === "BTC"){
                        coin_balance = Number(element.balance); //이용가능금액
                        total_btc = Number(element.balance) + Number(element.locked); //총BTC = 이용가능BTC + 묶여있는BTC
                    }
                });
                
                data.availableMargin =  fixed4(coin_balance); 
                if(data.idx === 1){ //첫번째 분할주문이면 
                    data.firstMargin = data.availableMargin;
                    data.total_krw = Math.floor(total_krw); //총원화저장
                    data.total_btc = fixed4(total_btc); //총BTC저장
                }

                data.openingQty = fixed4(coin_balance); //현재 이용가능한 코인수량
                var coin_val = data.openingQty * data.buyDepth.price; 
                console.log("openingQty : " + data.openingQty);
                console.log("price : " + data.buyDepth.price);
                console.log("coin_val : " + coin_val);
                console.log("siteMinVal : " + data.siteMinVal);
                if(data.openingQty >= 0.0003){ //현재이용가능 BTC수량 >= 0.0003 
                    data.side = "ask"; //현재포지션 매수 -> 매도주문
                }else{ ////현재이용가능 BTC수량 < 0.0003 
                    data.openingQty = 0;
                    data.side = "none"; //현재포지션 none -> 주문X
                }
                
                if(data.idx === 1){
                    data.goalAmt = data.openingQty; //목표수량 저장
                }
                cb(null, data);
            });
        },
        function calc(data, cb){ //주문가격, 주문수량, 주문 가치 결정
            if(data.isError === true){
                return cb(null, data);
            }

            var rate = (randomFloat(data.minAmtRate, data.maxAmtRate));
            
            if(data.side === 'none'){ //현재포지션 === NONE 
                logger.info("NONE포지션 : 주문X");
                data.isOrdered = false; //주문X
                data.isContinue = false; //다음주문X
                setTimeout(insert_history(upbit, data), 2000); //주문내역 저장
                switchOnOff(data, false); //탈출중 플래그 OFF
                return;
            }else if(data.side === 'ask'){ //현재포지션 === ask
                logger.info("Buy포지션 : 매도주문");
                data.ordAmount = fixed4(data.buyDepth.amount * rate); //주문수량
                data.ordPrice = data.buyDepth.price; //주문가격 = 매수1가격
                data.ordValue = data.ordAmount * data.ordPrice; //주문가치 = 주문수량 * 주문가격
                data.isOrdered = true; //주문O
                data.isContinue = true; //다음주문O
            }else{
                logger.info("XXX");
                data.isOrdered = false; //주문X
                data.isContinue = false; //다음주문X
                switchOnOff(data, false); //탈출중 플래그 OFF
                return;
            }
            
            data.siteMinAmt = fixed4(data.siteMinVal / data.buyDepth.price); //사이트최소수량 = (사이트최소가치 / 매수1가격)
            data.minOrdAmt = fixed4(data.minOrdVal / data.buyDepth.price); //최소주문수량 = 최소주문가치 / 매수1가격
            console.log("siteMinAmt : "+data.siteMinAmt);
            console.log("minOrdAmt : "+data.minOrdAmt);
            if(data.siteMinAmt === 0){ //사이트최소수량 = 0
                data.siteMinAmt = 0.0001 //사이트최소수량 = 0.0001
            }
            if(data.minOrdAmt === 0){  //최소주문수량 = 0
                data.minOrdAmt = 0.0001 //최소주문수량 = 0.0001
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
                logger.info("포지션수량 < 사이트최소수량");
                data.ordAmount = fixed4(data.openingQty); //보유수량만큼 주문
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
            //주문
            upbit.order("KRW-BTC", data.side, data.ordPrice, data.ordAmount, function(error, response, body){
                if(error){
                    logger.info("업비트 주문에러 error1 : "+error);
                    data.isError = true;
                    data.isContinue = true;
                    return cb(null, data);
                }

                console.log(body);
                logger.info(data.idx+". site : upbit " + "/ side : " + data.side + "/ price : " + price_comma(data.ordPrice) + "/ amount : "+ amount_comma(data.ordAmount) );
                
                //주문성공, 첫주문O
                if(data.idx === 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'ask') ){
                    data.start_price = data.ordPrice; //시작가격 = 주문가격
                    data.end_price = data.ordPrice; //종료가격 = 주문가격
                } ////주문성공, 첫주문X
                else if(data.idx > 1 && data.ordPrice > 0 && data.ordAmount > 0 && (data.side === 'ask')){
                    data.end_price = data.ordPrice; //종료가격 = 주문가격
                }
                
                data.orderID = body.uuid; //주문ID저장
                data.totalOrdAmt += data.ordAmount; //주문가치 누적 
                data.totalOrdValue += (data.ordPrice * data.ordAmount); //주문가치 누적 
                data.isSuccess = true; //주문성공
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
            logger.info("취소시작");
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
                        logger.error("업비트 주문취소 error2 : " + error);
                        data.isError = true;
                        data.isContinue = true;
                        return cb(null, data);
                    }
                    //미체결상태이면 
                    if(Number(json.volume) > Number(json.remaining_volume)){
                        logger.info("미체결O : "+ Number(json.remaining_volume));
                        data.totalOrdAmt -= Number(json.remaining_volume); //총주문수량 = 총주문수량 - 미체결수량
                        data.totalOrdValue -= (data.ordPrice * Number(json.remaining_volume)); //총주문가치 = 총주문가치 - (주문가격 * 미체결수량)
                        data.isContinue=true;
                    }else{ //완전체결이면 
                        logger.info("완전체결 : " + data.ordAmount);
                    }
                    logger.info("취소종료");
                    cb(null, data);
                });
            }, 1000);
        },
      ],function(error, data){
        if(error){
            console.log(error);
            logger.info("분할주문종료");
            setTimtout(insert_history(upbit, data), 2000); //주문내역 저장
            switchOnOff(data, false); //탈출충 플래그 OFF
            return;
        }
        logger.info("idx : " +data.idx);
        // logger.info("goalAmt : " +data.goalAmt);
        // logger.info("totalOrdAmt : " +data.totalOrdAmt);
        logger.info("openingQty : " + data.openingQty);
        logger.info("goalAmt : " +data.goalAmt);
        logger.info("totalOrdAmt : " +data.totalOrdAmt);
        logger.info("ordAmount : " +data.ordAmount);
        logger.info("isOrdered : " +data.isOrdered);
        logger.info("isSuccess : " +data.isSuccess);
        logger.info("isContinue : " +data.isContinue);
        logger.info();
  
        if(data.isContinue === true){ //분할주문 계속O
            data.idx += 1; //분할횟수 증가
            setTimeout(divide_exit_upbit(upbit, data, logger), data.ordInterval);//분할주문
        }else{ //분할주문 계속X
            //마지막주문
            setTimeout(last_order(upbit, data), 5000);
        }
      });
    }
  }


 
//거래내역 저장
function insert_history(upbit, data){
    return function(){
        var end_time = new Date();
        end_time = end_time.getTime() + (1000 * 60 * 60 * 9);
        var total_krw = 0;
        var total_btc =0;
        var benefit =0;
        var benefitRate = 0;
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
            function getOrderHistory(cb){
                console.log("getOrderHistory");
                orderDB.find({site : data.site}).sort({end_time : "desc"}).exec(function(error, res){
                    if(error){
                        console.log(error);
                        return;
                    }
                    if(res.length > 0){
                        benefit= total_krw - res[0].totalAsset; //수익 = 탈출자산 - 진입자산
                        benefitRate = (benefit / res[0].totalAsset) * 100; //수익율 = (수익 / 진입자산) /100
                    }else{
                        benefit =0;
                        benefitRate =0;
                    }
                    cb(null);
                });
            },
            function insertDB(cb){
                console.log("insertDB");
                var value = (total_krw - data.total_krw); //주문가치 = 주문후 원화 - 주문전원화
                var amount = (data.total_btc - total_btc); //주문수량 = 주문전 코인- 주문후 코인
                var price = value / amount;
                //var price = value / data.totalOrdAmt;
                console.log("진입전 krw : "+ data.total_krw);
                console.log("진입후 : " + total_krw);
                console.log("진입전 : "+ data.total_btc);
                console.log("진입후 : " + total_btc);
                var obj={
                    site : data.site, //계정명 upbit
                    symbol : 'XBTUSD',
                    totalAsset : 0, //총자산
                    type : "exit", //탈출
                    side : 'ask',//data.side, //Buy or Sell 
                    side_num : data.side_num,
                    totalAsset : Math.floor(total_krw),
                    start_price :  Math.floor(data.start_price), //가격
                    end_price :  Math.floor(data.end_price), //가격
                    price :  Math.floor(price),//가격
                    amount : fixed4(amount), //수량
                    value :  Math.floor(value),//가치
                    benefit : Math.floor(benefit), //수익
                    benefitRate : fixed4(benefitRate), //수익율
                    start_time : data.start_time, //시작시간
                    end_time : end_time, //종료시간
                    div_cnt : data.idx, //분할횟수 
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
                //프로그램 포지션 업데이트 
                settings.updateOne({site : data.site}, {$set :{side : "exit", side_num : data.side_num}}, function(error, res){
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
                logger.info(error);
                return;
            }
        })
    }
}


function last_order(upbit, obj){
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
                    side_num : obj.side_num,
                    minAmtRate : obj.minAmtRate,
                    maxAmtRate : obj.maxAmtRate, //최대주문비율
                    orderID : obj.orderID,
                    isOrdered : false, //주문시도 여부
                    isSuccess : false, //주문성공 여부
                    isContinue : false, //주문분할 계속할지 여부
                    isError : false,
                    start_time : obj.start_time,
                    start_price : obj.start_price,
                    end_price : obj.end_price,
                    total_krw : obj.total_krw,
                    total_btc : obj.total_btc
                }
                logger.info("last_order 시작!" );
                //logger.info(JSON.stringify(data) );
                cb(null, data);
            },
            function orderCancel(data, cb){ //마지막주문 주문취소 
                setTimeout(function(){
                    upbit.cancel(data.orderID, function(error, response, body){
                        if(error){
                            logger.error("업비트 주문취소 error1 : " + error);
                            return cb(null, data);
                        }
                        
                        try{
                            var json = JSON.parse(body);
                        }catch(error){
                            logger.error("업비트 주문취소 error2 : " + error);
                            return cb(null, data);
                        }
                        
                        cb(null, data);
                    });
                }, 0);
            },
            function position(data, cb){ //분할주문 계속 진행할지 말지 판단

                upbit.accounts(function(error, response, body){
                    if(error){
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
                    var avail_btc = 0;
                    json.forEach(element => {
                        if(element.currency === "BTC"){
                            avail_btc = Number(element.balance); //이용가능한 코인갯수 조회
                        }
                    });

                    if(avail_btc >= 0.0003){ //코인갯수 > 0.0003
                        data.isContinue = true; //분할주문 계속 진행
                    }else{
                        data.isContinue = false; //분할주문 종료, 로직종료
                    }
                    
                    cb(null, data);
                });
            }
          ],function(error, data){
            if(error){
                console.log(error);
                logger.info("분할주문종료");
                setTimeout(insert_history(upbit, data), 2000); //주문내역 저장
                switchOnOff(data, false); //탈출중 플래그 OFF
                return;
            }
            
            if(data.isContinue === true){ //분할주문 계속 O
                data.idx += 1; //분할횟수 1 증가 
                setTimeout(divide_exit_upbit(upbit, data, logger), data.ordInterval);//분할주문
            }else{ //분할주문 계속 X
                logger.info("last_order 종료!!");
                setTimeout(insert_history(upbit, data), 2000); //주문내역 저장
                switchOnOff(data, false); //탈충중 플래그 OFF
            }
          });
    }
}




function order_info2(upbit, data){
    console.log("order_info2");
    console.log(data);
    return function(){
        
        var rgParams = {
            currency : "BTC",
            order_id : data.orderID,
            type : 'bid',
        };
        
        upbit.bithumPostAPICall('/info/orders', rgParams, function(error, response, body){
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
                data.totalOrdAmt -= Number(json.data[0].units_remaining); //총주문수량 = 총주문수량 - 미체결수량
                console.log("미체결O : 루프 다시 시작");
                setTimeout(divide_exit_upbit(upbit, data, logger), data.ordInterval);//분할주문
            }
        });
    }
}

//탈출중 플래그 ON/OFF 
function switchOnOff(data, isOnOff){
    settings.updateOne({
        site : "upbit"
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
