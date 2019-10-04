var async = require('async');
var crypto = require("crypto");
var request = require("request");
var mongoose = require('mongoose');
const winston = require('winston');
var numeral = require('numeral');
require('winston-daily-rotate-file');
require('date-utils');
var div_exit_bitmex = require('./lib/div_exit_bitmex');
var div_entry_bitmex = require('./lib/div_entry_bitmex');
var div_exit_bithumb = require('./lib/div_exit_bithumb');
var div_entry_bithumb = require('./lib/div_entry_bithumb');
var div_exit_coinone = require('./lib/div_exit_coinone');
var div_entry_coinone = require('./lib/div_entry_coinone');
var div_exit_upbit = require('./lib/div_exit_upbit');
var div_entry_upbit = require('./lib/div_entry_upbit');
var BithumAPI = require('./API/bithumbAPI');
var coinoneAPI = require('./API/coinoneAPI.js');
var upbitAPI = require('./API/upbitAPI.js');
var signal = require("./models/signal");
var settings = require("./models/setting");
var orderDB = require('./models/order');
var webSetting = require('./webSetting.json');
var logger;
var logfileName1 = './log/marginTrade' +'.log'; //로그파일 경로1
var logfileName2 = './log/marginTrade' +'.debug.log'; //로그파일 경로2
create_logger(logfileName1, logfileName2, function(loggerHandle){ logger = loggerHandle}); //logger 생성

var logger_bitmex1;
var logfileName0_1 = './log/bitmex1' +'.log'; //로그파일 경로1
var logfileName0_2 = './log/bitmex1' +'.debug.log'; //로그파일 경로2
create_logger(logfileName0_1, logfileName0_2, function(loggerHandle){ logger_bitmex1 = loggerHandle; logger_bitmex1.info("비트멕스1");}); //logger 생성

var logger_bitmex2;
var logfileName1_1 = './log/bitmex2' +'.log'; //로그파일 경로1
var logfileName1_2 = './log/bitmex2' +'.debug.log'; //로그파일 경로2
create_logger(logfileName1_1, logfileName1_2, function(loggerHandle){ logger_bitmex2 = loggerHandle; logger_bitmex2.info("비트멕스2");}); //logger 생성

var logger_bitmex3;
var logfileName2_1 = './log/bitmex3' +'.log'; //로그파일 경로1
var logfileName2_2 = './log/bitmex3' +'.debug.log'; //로그파일 경로2
create_logger(logfileName2_1, logfileName2_2, function(loggerHandle){ logger_bitmex3 = loggerHandle; logger_bitmex3.info("비트멕스3");}); //logger 생성


var logger_bithumb;
var logfileName3_1 = './log/bithumb' +'.log'; //로그파일 경로1
var logfileName3_2 = './log/bithumb' +'.debug.log'; //로그파일 경로2
create_logger(logfileName3_1, logfileName3_2, function(loggerHandle){ logger_bithumb = loggerHandle; logger_bithumb.info("빗썸");}); //logger 생성


var logger_coinone;
var logfileName4_1 = './log/coinone' +'.log'; //로그파일 경로1
var logfileName4_2 = './log/coinone' +'.debug.log'; //로그파일 경로2
create_logger(logfileName4_1, logfileName4_2, function(loggerHandle){ logger_coinone = loggerHandle; logger_coinone.info("코인원");}); //logger 생성


var logger_upbit;
var logfileName5_1 = './log/upbit' +'.log'; //로그파일 경로1
var logfileName5_2 = './log/upbit' +'.debug.log'; //로그파일 경로2
create_logger(logfileName5_1, logfileName5_2, function(loggerHandle){ logger_upbit = loggerHandle; logger_upbit.info("업비트");}); //logger 생성

function fixed4(num){
  var str = new String(num);
  var arr = str.split(".");
  var str2 = arr[1].slice(0,4);
  return Number(arr[0] + '.' + str2);
}

mongoose.connect(webSetting.dbPath, function(error){
  if(error){
    console.log(error);
    return;
  }

  // var sig = [
  //   {
  //     scriptNo : 2,
  //     side : "Buy",
  //     log : "Buy entry!"
  //   },
  //   {
  //     scriptNo : 1,
  //     side : "Sell",
  //     log : "Sell entry!"
  //   },

  // ]

  // signal.insertMany(sig,function(error, res){
  //   if(error){
  //     console.log(error);
  //     return;
  //   }
  //   //console.log(res);
  // });
  
  //프로그램 시작할때 저장되있는 신호 전부 삭제
  signal.remove({}, function(error, data){
    if(error){
      console.log(error);
      return;
    }
  });

  settings.find({}, function(err, res){ //거래소에 대응하는 환경설정을 찾는다.
    if(err){
        console.log(err);
        return;
    }
    //console.log(res);
    if(res.length === 0){ //없으면 환경설정 생성
      var obj = [
        {
          site : "bitmex1", // ex) "ANKR_KRW"
          url : "https://testnet.bitmex.com", //ex)  "ANKR"
          symbol : "XBTUSD",
          apiKey : "-2YJMJOGLRMvUgaBD1_KzbLt",
          secreteKey : "aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd"
        },
        {
          site : "bitmex2", // ex) "ANKR_KRW"
          url : "https://testnet.bitmex.com", //ex)  "ANKR"
          symbol : "XBTUSD",
          apiKey : "1",
          secreteKey : "1"
        },
        {
          site : "bitmex3", // ex) "ANKR_KRW"
          url : "https://testnet.bitmex.com", //ex)  "ANKR"
          symbol : "XBTUSD",
          apiKey : "2",
          secreteKey : "2"
        },
        {
          site : "bithumb", // ex) "ANKR_KRW"
          url : "https://api.bithumb.com", //ex)  "ANKR"
          symbol : "BTC",
          apiKey : "7446cc38540523fe9a0a04b033414ab5", //"223985a94a23a587e7aee533b82f7a4e"
          secreteKey : "50684360909e128d413356721be9b614"//"4f76cce9768fbdc7f90c6b1fb7021846"
        },
        {
          site : "coinone", // ex) "ANKR_KRW"
          url : "https://api.coinone.co.kr", //ex)  "ANKR"
          symbol : "BTC",
          apiKey : "0d246678-06c0-4b44-9eb6-bd8ef507fc5a", //"21635cc6-cbb4-4d7f-9abb-c6e78cf7ecf0"
          secreteKey : "dfb81257-4f3d-4beb-bafe-81dc122aae75" //"ec06eb68-a65a-442b-8257-c850a9242a09"
        },
        {
          site : "upbit", // ex) "ANKR_KRW"
          url : "https://api.upbit.com", //ex)  "ANKR"
          symbol : "KRW-BTC",
          apiKey : "DqvxjopaOh3v1ynwxDVDkBDWu8vxAiXhwVcqpxk4", //"tI144KZJZNyTnx54szCDTJcby5JferjpqtHPWlEB"
          secreteKey : "HEx8ak9dJRZxgX9xRNDPRaHr3L79d7dn6ZMsHtL7" //"mvLUNJHvOfIbCCzNrlJlnxwKnV2DqPljAq6hI8iv"
        }
      ]
      settings.insertMany(obj,function(err, res){ //DB에 환경설정 insert
          if(err){
              console.log(err);
              return;
          }
          //console.log(res);
      });
    }else{
        settings.updateMany({}, {$set : {isEntering : false, isExiting : false}},function(err, res){ //DB에 환경설정 insert
            if(err){
                console.log(err);
                return;
            }
            //console.log(res);
        });
    }
  });
});

setInterval(marginTrade(), 3000);

function marginTrade(){
  return function(){
    signal.find({}).sort({timestamp : "asc"}).exec(function(error, res){
      if(error){
        console.log(error);
        return;
      }

     //console.log(res);
      if(res.length > 0){
        console.log("");
        console.log("");
        console.log("-----신호목록-----");
        setTimeout(trade_bitmex(new Object(res[0]), 'bitmex1'), 0);
        setTimeout(trade_bitmex(new Object(res[0]), 'bitmex2'), 0);
        setTimeout(trade_bitmex(new Object(res[0]), 'bitmex3'), 0);
        setTimeout(trade_bithumb(new Object(res[0])), 0);
        setTimeout(trade_coinone(new Object(res[0])), 0);
        setTimeout(trade_upbit(new Object(res[0])), 0); 

        //신호 삭제
        signal.findByIdAndRemove(res[0]._id, function(error, res){
          if(error){
            console.log(error);
            return;
          }
        });
      }
    });
  }
}

function trade_bithumb(_signal){
  return function(){
    var date = new Date( (new Date().getTime() + (1000 * 60 * 60 * 9)));
    console.log("[" + date.toISOString() + "] : " + JSON.stringify(_signal));
    var bithumAPI;
    async.waterfall([
      function init(cb){
        var data = {
          avail_pay : 0,
          avail_coin : 0,
          symbol : "",
          isSide : '',
          ticker : 0,
          ask : [],
          bid : [],
        }
        cb(null, data);
      },
      function readSetting(data, cb){
        settings.find({site : "bithumb"},function(error, res){
          if(error){
            console.log(error);
            return;
          }
          
          if(res[0].execFlag === false){
            console.log("빗썸 off");
            return;
          }


          if(res[0].scriptNo !== _signal.scriptNo){
            console.log("빗썸 스크립트넘버 불일치 -> 로직종료 : "+ _signal.scriptNo);
            return; 
          }
          
          //탈출중이거나 진입중이면 신호무시
          if(res[0].isExiting === true || res[0].isEntering === true){
            console.log("분할주문중 -> 로직종료"+ res[0].isExiting + " " + res[0].isEntering);
            return; 
          }

          // console.log(res);
          // console.log(res[0].apiKey);
          // console.log(res[0].secreteKey);
          bithumAPI = new BithumAPI(res[0].apiKey,res[0].secreteKey);
          data.symbol = res[0].symbol;
          data.leverage = res[0].leverage;
          data.margin = res[0].margin * 0.01;
          data.minOrdCost = res[0].minOrdCost;
          data.ordInterval = res[0].ordInterval * 1000;
          data.minOrdRate = res[0].minOrdRate * 0.01;
          data.maxOrdRate = res[0].maxOrdRate * 0.01;
          cb(null, data);
        });
      },
      function orderbook_bithumb(data, cb){ //빗썸 매수/매도 조회
        bithumAPI.orderbook(data.symbol,function(error,response, body){
          if(error){
              console.log("빗썸 매수/매도 값 조회 error1 : " + error);
              return;
          }
          
          try{
              var json = JSON.parse(body);
          }catch(error){
              console.log("빗썸 매수/매도 값 조회 error1 : " + error);
              return;
          }
  
          if(json.status !== "0000"){
              console.log("빗썸 매수/매도 값 조회 error2 : " + body);
              return;
          }
          
          
          data.ask = {price : Number(json.data.asks[0].price), amount : Number(json.data.asks[0].quantity) };
          data.bid = {price : Number(json.data.bids[0].price), amount : Number(json.data.bids[0].quantity) };
          cb(null, data);
        });
      },
      function ticker_bithumb(data,cb){
        bithumAPI.ticker("BTC", function(error, response, body){
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
          var json = JSON.parse(body);
          console.log("ticker");
          console.log(json);
          data.ticker = json.data.closing_price;
          cb(null,data);
        });
      },
      function balance_bithumb(data,cb){
        var rgParams = {
          currency : data.symbol
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
          //console.log(body);
          
          var coin_name = data.symbol.toLowerCase();
          data.avail_coin = Number(json.data["available_btc"]);
          data.avail_pay = Math.floor(Number(json.data["available_"+"krw"]));

          if(data.avail_coin > 0.0001){
            data.isSide = "Buy"
          }else{
            data.isSide = "NONE"
          }
          console.log("avail_coin : "+ data.avail_coin);
          console.log("ticker : "+ data.ticker);
          console.log("_signal : " + _signal.side);
          console.log("isSide : " + data.isSide);
          cb(null,data);
        });
      },
      function order1(data, cb){ //주문1
        if(data.isSide === _signal.side){ //진입한 포지션 === 요청포지션
          console.log("첫주문은 서로 다른 포지션이야 합니다."); //로직종료
          //res.send({}); 
          return;
        }
        var start_time = new Date();
        start_time = start_time.getTime() + (1000 * 60 * 60 * 9);
        if(_signal.side === 'Buy' && data.isSide === 'NONE'){ //현재포지션 -> NONE and 신호 -> 매수 
          
          //목표금액  => 이용가능금액 * 마진 * 레버리지
          var goalValue = Math.floor(data.avail_pay * data.margin * data.leverage);
          if(goalValue > data.avail_pay){
            goalValue = Math.floor(data.avail_pay);
          }

          //빗썸 진입
          var obj = {
              site : 'bithumb',
              idx : 1,
              apiKey : data.apiKey,
              secreteKey : data.secreteKey,
              ordInterval : data.ordInterval,
              firstMargin : 0,
              availableMargin : 0, //잔액
              totalRemainAmt : 0, //주문후 남은 주문수량
              totalRemainVal : 0, //주문후 남은 가치
              goalValue : goalValue, //주문 목표 금액

              totalOrdValue : 0, //주문넣은 가치 합산
              totalOrdAmount : 0,
              side : 'bid', //주문 타입
              minOrdValue : data.minOrdCost, //최소주문금액
              siteMinValue : 2000, //거래소 주문 최소 가치
              minValueRate : data.minOrdRate, //최소주문비율
              maxValueRate : data.maxOrdRate, //최대주문비율
              orderID : "", //주문id
              msg : "div1",
              start_time : start_time,
              start_price : 0,
              end_price : 0
          }
          logger_bithumb.info("빗썸로그");
          setTimeout(div_entry_bithumb(bithumAPI, obj, logger_bithumb), 0);
          cb(null, data);
        }
        else if(_signal.side === 'Exit' && data.isSide === 'Buy'){ //현재포지션 -> 매수 and 신호 -> 탈출
          //탈출
          //빗썸탈출
          console.log("빗썸탈출");
          var data = {
            site : 'bithumb',
            idx : 1,
            apiKey : data.apiKey,
            secreteKey : data.secreteKey,
            ordInterval : data.ordInterval,
            minOrdVal : data.minOrdCost, //원
            minOrdAmt : 0,
            siteMinVal : 2000, //원
            siteMinAmt : 0, //btc 수량
            goalAmt : data.avail_coin, //목표 수량
            totalOrdValue : 0, 
            totalOrdAmt : 0, //누적 주문 수량 
            openingQty : 0, //진입한 포지션 수량 
            side : "",
            minAmtRate : data.minOrdRate, //최소수량비율 
            maxAmtRate : data.maxOrdRate, //최대수량비율
            orderID : "",
            isOrdered : false, //주문시도 여부
            isSuccess : false, //주문성공 여부
            isContinue : false, //주문분할 계속할지 여부
            start_time : start_time,
            start_price : 0,
            end_price : 0,
          }
          logger_bithumb.info("빗썸로그");
          setTimeout(div_exit_bithumb(bithumAPI, data, logger_bithumb), 0);
          cb(null, data);
        }
      }
    ],function(error, data){
        if(error){
            console.log("waterfall error : " + error);
            //res.send(error);
            return;
        }
        //res.send({});
    });
  }
}

function trade_coinone(_signal){
  return function(){
    var date = new Date( (new Date().getTime() + (1000 * 60 * 60 * 9)));
    console.log("[" + date.toISOString() + "] : " + JSON.stringify(_signal));
    var coinone;
    async.waterfall([
      function init(cb){
        var data = {
          symbol : "",
          side : '',
          ask : [],
          bid : [],
          avail_coin : 0,
          avail_pay : 0,
        }
        var side = _signal.side;
        (side === 'Buy')? data.side = 'bid' : data.side = 'ask';
        cb(null, data);
      },
      function readSetting(data, cb){
        settings.find({site : "coinone"},function(error, res){
          if(error){
            console.log(error);
            return;
          }
          
          if(res[0].execFlag === false){
            console.log("코인원 off");
            return;
          }

          if(res[0].scriptNo !== _signal.scriptNo){ //설정한 신호 !== 받은 신호
            console.log("코인원 스크립트넘버 불일치 -> 로직종료 : "+ _signal.scriptNo);
            return; //로직종료
          }

          //탈출중이거나 진입중이면 신호무시
          if(res[0].isExiting === true || res[0].isEntering === true){
            console.log("분할주문중 -> 로직종료"+ res[0].isExiting + " " + res[0].isEntering);
            return; 
          }

          coinone = new coinoneAPI(res[0].apiKey, res[0].secreteKey);
          data.symbol = res[0].symbol;   
          data.leverage = res[0].leverage;
          data.margin = res[0].margin * 0.01;
          data.minOrdCost = res[0].minOrdCost;
          data.ordInterval = res[0].ordInterval * 1000;
          data.minOrdRate = res[0].minOrdRate * 0.01;
          data.maxOrdRate = res[0].maxOrdRate * 0.01;
          cb(null, data);
        });
      },
      function orderbook_coinone(data, cb){ //코인원 매수/매도 조회
        //코인원 
        coinone.orderbook(data.symbol, function(error, response, body){
          if(error){
              logger.error("코인원 매수/매도 값 조회 error1 : " + error);
              return;
          }
          
          try{
              var json = JSON.parse(body);
          }catch(error){
              logger.error("코인원 매수/매도 값 조회 error1 : " + error);
              return;
          }
          
          if(json.errorCode !== "0"){
              logger.error("코인원 매수/매도 값 조회 error2 : " + body);
              return;
          }else{
              //console.log("2.코인원 매수/매도 조회 성공");
              data.ask = {price : Number(json.ask[0].price), amount : Number(json.ask[0].qty) };
              data.bid = {price : Number(json.bid[0].price), amount : Number(json.bid[0].qty) };
              cb(null, data);
          }
        });
      },
      function coinone_ticker(data,cb){
        coinone.ticker("BTC", function(error, response, body){
          if(error){
            logger.error("코인원 매수/매도 값 조회 error1 : " + error);
            return;
          }
          
          try{
              var json = JSON.parse(body);
          }catch(error){
              logger.error("코인원 매수/매도 값 조회 error1 : " + error);
              return;
          }
          
          if(json.errorCode !== "0"){
              logger.error("코인원 매수/매도 값 조회 error2 : " + body);
              return;
          }
          var json = JSON.parse(body);
          //console.log("ticker");
          //console.log(json);
          data.ticker = Number(json.last);
          cb(null,data);
        });
      },
      function balance_coinone(data, cb){ //코인원 잔액조회
        coinone.balance(function(error, httpResponse, body){
            if(error){
                console.log("코인원 balance 값 조회 error1 : " + error);
                return;
            }
            try{
                var json = JSON.parse(body);
            }catch(error){
                console.log("코인원 balance 값 조회 error1 : " + error);
                return;
            }
            if(json.errorCode !== "0"){
                console.log("코인원 balance 값 조회 error2 : " + body);
                return;
            }else{
                var json = JSON.parse(body);
                var obj = {};
                var coin_name = data.symbol.toLowerCase();
                data.avail_coin = Number(json[coin_name].avail);
                data.avail_pay = Math.floor(Number(json["krw"].avail));

                if(data.avail_coin > 0.0001){ //* data.ticker 
                  data.isSide = "Buy"
                }else{
                  data.isSide = "NONE"
                }
                console.log("avail_coin : "+ data.avail_coin);
                console.log("ticker : "+ data.ticker);
                console.log("_signal : " + _signal.side);
                console.log("isSide : " + data.isSide);
                cb(null, data);
            }
        });
      },
      function order1(data, cb){ //주문1
        if(data.isSide === _signal.side){ //진입한 포지션 === 요청포지션
          console.log("첫주문은 서로 다른 포지션이야 합니다."); //로직종료
          //res.send({}); 
          return;
        }
        var start_time = new Date();
        start_time = start_time.getTime() + (1000 * 60 * 60 * 9);
        if(_signal.side === 'Buy' && data.isSide === 'NONE'){ //현재포지션 -> NONE and 신호 -> 매수 
          //목표금액  => 이용가능금액 * 마진 * 레버리지
          var goalValue = Math.floor(data.avail_pay * data.margin * data.leverage);
          if(goalValue > data.avail_pay){
            goalValue = Math.floor(data.avail_pay);
          }

          //코인원 진입
          var obj = {
              site : 'coinone',
              idx : 1,
              apiKey : data.apiKey,
              secreteKey : data.secreteKey,
              ordInterval : data.ordInterval,
              firstMargin : 0,
              availableMargin : 0, //잔액
              totalRemainAmt : 0, //주문후 남은 주문수량
              totalRemainVal : 0, //주문후 남은 가치
              goalValue : goalValue, //주문 목표 금액
              totalOrdValue : 0, //주문넣은 가치 합산
              totalOrdAmount : 0,
              side : '', //주문 타입
              minOrdValue : data.minOrdCost, //최소주문금액
              siteMinValue : 2000, //거래소 주문 최소 가치
              minValueRate : data.minOrdRate, //최소주문비율
              maxValueRate : data.maxOrdRate, //최대주문비율
              orderID : "", //주문id
              msg : "div1",
              start_time : start_time,
              start_price : 0,
              end_price : 0
          }
          setTimeout(div_entry_coinone(coinone, obj, logger_coinone), 0);
          cb(null, data);
        }
        else if(_signal.side === 'Exit' && data.isSide === 'Buy'){ //현재포지션 -> 매수 and 신호 -> 탈출
          //탈출
          //빗썸탈출
          console.log("코인원탈출");
          var data = {
            site : 'coinone',
            idx : 1,
            apiKey : data.apiKey,
            secreteKey : data.secreteKey,
            ordInterval : data.ordInterval,
            minOrdVal : data.minOrdCost, //원
            minOrdAmt : 0,
            siteMinVal : 2000, //원
            siteMinAmt : 0, //btc 수량
            goalAmt : data.avail_coin, //목표 수량
            totalOrdValue : 0, 
            totalOrdAmt : 0, //누적 주문 수량 
            openingQty : 0, //진입한 포지션 수량 
            side : "",
            minAmtRate : data.minOrdRate, //최소수량비율 
            maxAmtRate : data.maxOrdRate, //최대수량비율
            orderID : "",
            isOrdered : false, //주문시도 여부
            isSuccess : false, //주문성공 여부
            isContinue : false, //주문분할 계속할지 여부,
            start_time : start_time,
            start_price : 0,
            end_price : 0,
          }
          setTimeout(div_exit_coinone(coinone, data, logger_coinone), 0);
          cb(null, data);
        }
        
        //cb(null, data);
      }
    ],function(error, data){
        if(error){
            console.log("waterfall error : " + error);
            //res.send(error);
            return;
        }
        //res.send({});
    });
  }
}

function trade_upbit(_signal){
  return function(){
    var date = new Date( (new Date().getTime() + (1000 * 60 * 60 * 9)));
    console.log("[" + date.toISOString() + "] : " + JSON.stringify(_signal));
    var upbit;
    async.waterfall([
      function init(cb){
        var data = {
          symbol : "",
          side : '',
          ordType : 'Limit',
          ask : [],
          bid : [],
          leverage : 1,
          margin : 1,
          avail_pay : 0,
          avail_coin : 0
        }
        var side = _signal.side;
        (side === 'Buy')? data.side = 'bid' : data.side = 'ask';
        cb(null, data);
      },
      function readSetting(data, cb){
        settings.find({site : "upbit"},function(error, res){
          if(error){
            console.log(error);
            return;
          }
         
          if(res[0].execFlag === false){
            console.log("업비트 off");
            return;
          }

          if(res[0].scriptNo !== _signal.scriptNo){
            console.log("업비트 스크립트넘버 불일치 -> 로직종료 : "+ _signal.scriptNo);
            return;
          }

          //탈출중이거나 진입중이면 신호무시
          if(res[0].isExiting === true || res[0].isEntering === true){
            console.log("업비트 분할주문중 -> 로직종료"+ res[0].isExiting + " " + res[0].isEntering);
            return; 
          }
          
          upbit = new upbitAPI(res[0].apiKey, res[0].secreteKey);
          data.symbol = res[0].symbol;
          data.leverage = res[0].leverage;
          data.margin = res[0].margin * 0.01;
          data.minOrdCost = res[0].minOrdCost;
          data.ordInterval = res[0].ordInterval * 1000;
          data.minOrdRate = res[0].minOrdRate * 0.01;
          data.maxOrdRate = res[0].maxOrdRate * 0.01;
          cb(null, data);
        });
      },
      function ticker_upbit(data,cb){
        upbit.ticker("KRW-BTC", function(error, response, body){
          if(error){
            console.log("업비트 현재가 조회 error1 : " + error);
            return;
          }
          
          try{
              var json = JSON.parse(body);
          }catch(error){
              console.log("업비트 현재가 조회 error2 : " + error);
              return;
          }

          if(typeof(json["error"]) === 'object'){
              console.log("업비트 현재가 조회 error1 : " + body);
              return;
          }

          var json = JSON.parse(body);
          // console.log("ticker");
          // console.log(json);
          data.ticker = json[0].trade_price;
          cb(null,data);
        });
      },
      function orderbook_upbit(data, cb){ //업비트 매수/매도 조회

        //3.업비트
        upbit.orderbook(data.symbol, function(error, response, body){
            if(error){
                console.log("업비트 매수/매도 조회 error1 : " + error);
                return;
            }
  
            try{
                var json = JSON.parse(body);
            }catch(error){
                console.log("업비트 매수/매도 조회 error2 : " + error);
                return;
            }
  
            if(typeof(json["error"]) === 'object'){
                console.log("업비트 잔액조회 조회 error1 : " + body);
                return;
            }
            
            var obj = parse('upbit', json);
            data.ask = {price : obj.asks[0].price, amount : obj.asks[0].amount};
            data.bid = {price : obj.bids[0].price, amount : obj.bids[0].amount};
            cb(null, data);
        });
      },
      function balance_upbit(data, cb){ //업비트 잔액 조회
       
        upbit.accounts(function(error, response, body){
            if (error){
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
                if(element.currency === 'KRW'){ //KRW
                  data.avail_pay = Math.floor(Number(element.balance));
                }
                else if(element.currency === 'BTC'){
                  data.avail_coin = Number(element.balance);
                }
            });
            
            if(data.avail_coin > 0.0003){ //업비트만 0.0003
              data.isSide = "Buy"
            }else{
              data.isSide = "NONE"
            }
            console.log("avail_coin : "+ data.avail_coin);
            console.log("ticker : "+ data.ticker);
            console.log("_signal : " + _signal.side);
            console.log("isSide : " + data.isSide);
            cb(null,data);
            
        });
      },
      function order1(data, cb){ //주문1
        if(data.isSide === _signal.side){ //진입한 포지션 === 요청포지션
          console.log("첫주문은 서로 다른 포지션이야 합니다."); //로직종료
          //res.send({}); 
          return;
        }
        var start_time = new Date();
        start_time = start_time.getTime() + (1000 * 60 * 60 * 9);
        if(_signal.side === 'Buy' && data.isSide === 'NONE'){ //현재포지션 -> NONE and 신호 -> 매수 
          
          //목표금액  => 이용가능금액 * 마진 * 레버리지
          var goalValue = Math.floor((data.avail_pay * data.margin * data.leverage) * 0.99);
          if(goalValue > data.avail_pay){
            goalValue = Math.floor(data.avail_pay * 0.99);
          }

          //업비트 진입
          var obj = {
              site : "upbit",
              idx : 1,
              apiKey : data.apiKey,
              secreteKey : data.secreteKey,
              ordInterval : data.ordInterval,
              firstMargin : 0,
              availableMargin : 0, //잔액
              totalRemainAmt : 0, //주문후 남은 주문수량
              totalRemainVal : 0, //주문후 남은 가치
              goalValue : goalValue, //주문 목표 금액

              totalOrdValue : 0, //주문넣은 가치 합산
              totalOrdAmount : 0,
              side : 'bid', //주문 타입
              minOrdValue : data.minOrdCost, //최소주문금액
              siteMinValue : 1001, //거래소 주문 최소 가치
              minValueRate : data.minOrdRate, //최소주문비율
              maxValueRate : data.maxOrdRate, //최대주문비율
              orderID : "", //주문id
              msg : "div1",
              start_time : start_time,
              start_price : 0,
              end_price : 0
          }
          setTimeout(div_entry_upbit(upbit, obj, logger_upbit), 0);
          cb(null, data);
        }
        else if(_signal.side === 'Exit' && data.isSide === 'Buy'){ //현재포지션 -> 매수 and 신호 -> 탈출
          //탈출
          //빗썸탈출
          console.log("업비트탈출");
          var data = {
            site : "upbit",
            idx : 1,
            apiKey : data.apiKey,
            secreteKey : data.secreteKey,
            ordInterval : data.ordInterval,
            minOrdVal : data.minOrdCost, //원
            minOrdAmt : 0,
            siteMinVal : 1001, //원
            siteMinAmt : 0, //btc 수량
            goalAmt : data.avail_coin, //목표 수량
            totalOrdValue : 0, 
            totalOrdAmt : 0, //누적 주문 수량 
            openingQty : 0, //진입한 포지션 수량 
            side : "",
            minAmtRate : data.minOrdRate, //최소수량비율 
            maxAmtRate : data.maxOrdRate, //최대수량비율
            orderID : "",
            isOrdered : false, //주문시도 여부
            isSuccess : false, //주문성공 여부
            isContinue : false, //주문분할 계속할지 여부
            start_time : start_time,
            start_price : 0,
            end_price : 0
          }
          setTimeout(div_exit_upbit(upbit, data, logger_upbit), 0);
          cb(null, data);
        }
      }
    ],function(error, data){
        if(error){
            console.log("waterfall error : " + error);
            //res.send(error);
            return;
        }
        //res.send({});
    });
  }
}

function trade_bitmex(_signal, siteName){
  return function(){
    var log_obj;
    var log_obj2;
    if(siteName === 'bitmex1'){
      log_obj = new Object(logger_bitmex1);
      log_obj2 = new Object(logger_bitmex1);
    }else if(siteName === 'bitmex2'){
      log_obj = new Object(logger_bitmex2);
      log_obj2 = new Object(logger_bitmex2);
    }else if(siteName === 'bitmex3'){
      log_obj = new Object(logger_bitmex3);
      log_obj2 = new Object(logger_bitmex3);
    }
    var date = new Date( (new Date().getTime() + (1000 * 60 * 60 * 9)));
    console.log("[" + date.toISOString() + "] : " + JSON.stringify(_signal));
    async.waterfall([
      function init(cb){
          var data ={
              site : siteName,
              url : "",
              apiKey : "",
              secreteKey : "",
              symbol : "",
              ticker : 0, //현재가
              walletBalance : 0, //지갑잔고
              marginBalance : 0, //마진 밸런스
              availableMargin : 0, // 사용가능잔고
              ordInterval : 0,
              leverage : 1, //setting값 
              margin : 0.1, //setting값
              openingQty : 0, // 들어가 있는 수량
              isSide : 'none', //들어가 있는 side// Sell or Buy
          }
          cb(null, data);
      },
      function readSetting(data, cb){
        settings.find({site : data.site},function(error, res){
          if(error){
            console.log(error);
            return;
          }
          
          if(res[0].execFlag === false){
            console.log("비트멕스 off");
            return;
          }

          if(res[0].scriptNo !== _signal.scriptNo){
            console.log("비트멕스 스크립트넘버 불일치 -> 로직종료 : "+ _signal.scriptNo);
            return; 
          }

          //탈출중이거나 진입중이면 신호무시
          if(res[0].isExiting === true || res[0].isEntering === true){
            console.log("분할주문중 -> 로직종료"+ res[0].isExiting + " " + res[0].isEntering);
            return; 
          }

          data.url = res[0].url;
          data.symbol = res[0].symbol;
          data.apiKey = res[0].apiKey;
          data.secreteKey = res[0].secreteKey;
          data.leverage = res[0].leverage;
          data.margin = res[0].margin * 0.01;
          data.minOrdAmt = res[0].minOrdCost;
          data.ordInterval = res[0].ordInterval * 1000;
          data.minOrdRate = res[0].minOrdRate * 0.01;
          data.maxOrdRate = res[0].maxOrdRate * 0.01;
          console.log(data);
          cb(null, data);
        });
      },
      function ticker(data,cb){ //현재가 조회
          var requestOptions = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'GET','trade','symbol='+data.symbol+'&count=1'+'&reverse='+true);//'currency=XBt'
          request(requestOptions, function(error,response,body){
              if(error) {
                  console.log("error : " +error);
                  //res.send(error);
                  return;
              }
              var json = JSON.parse(body);
              //console.log(body);
              data.ticker = json[0].price;
              cb(null, data);
          });
      },
      function position(data, cb){
        var requestOptions = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'GET','position','');//'currency=XBt'
        request(requestOptions, function(err,response,body){
            if(err) {
                console.log(err);
                return;
            }
            //console.log(body);
            var json = JSON.parse(body);
            //console.log(json);
            for(i=0; i<json.length; i++){
                if(json[i].currentQty > 0 && json[i].symbol==='XBTUSD'){
                    //console.log("매수");
                    data.openingQty = json[i].currentQty;
                    data.isSide = "Buy";
                }else if(json[i].currentQty < 0 && json[i].symbol==='XBTUSD'){
                    //console.log("매도");
                    data.openingQty = json[i].currentQty;
                    data.isSide = "Sell";
                }
            }
            cb(null, data);
        });
      },
      function order1(data, cb){ //주문1
        
        if(data.isSide === _signal.side){ //진입한 포지션 === 요청포지션
          console.log("첫주문은 서로 다른 포지션이야 합니다."); //로직종료
          //res.send({}); 
          return;
        }
        
        if(data.isSide === 'none'){ //진입한 포지션이 없으면 첫번째 주문 생략
            cb(null, data);
        }else if( (data.isSide === 'Buy' && _signal.side === 'Buy Exit') || (data.isSide === 'Sell' && _signal.side === 'Sell Exit') ){
          console.log("포지션 종료"); //로직종료
            var start_time = new Date();
            start_time = start_time.getTime() + (1000 * 60 * 60 * 9);
            var obj = {
                site : data.site,
                idx : 1,
                url : data.url,
                apiKey : data.apiKey,
                secreteKey : data.secreteKey,
                symbol : data.symbol,
                ordInterval : data.ordInterval,
                goalAmt : 0,
                minOrdAmt : data.minOrdAmt,
                totalOrdAmt : 0,
                totalOrdValue : 0,
                openingQty : 0, //진입한 포지션 수량 
                side : "",
                minAmtRate : data.minOrdRate, //최소주문비율  
                maxAmtRate : data.minOrdRate, //최대주문비율 
                start_time : start_time,
                isOrdered : false, //주문시도 여부
                isSuccess : false, //주문성공 여부
                isContinue : false, //주문분할 계속할지 여부
            }
            setTimeout(div_exit_bitmex(obj, log_obj), 0);
            return;
        }
        // else if(_signal.side === 'Exit'){ //포지션종료
        //     console.log("포지션 종료"); //로직종료
        //     var start_time = new Date()
        //     start_time = start_time.getTime() + (1000 * 60 * 60 * 9);
        //     var obj = {
        //         site : data.site,
        //         idx : 1,
        //         url : data.url,
        //         apiKey : data.apiKey,
        //         secreteKey : data.secreteKey,
        //         symbol : data.symbol,
        //         ordInterval : data.ordInterval,
        //         goalAmt : 0,
        //         minOrdAmt : data.minOrdAmt,
        //         totalOrdAmt : 0,
        //         totalOrdValue : 0,
        //         openingQty : 0, //진입한 포지션 수량 
        //         side : "",
        //         minAmtRate : data.minOrdRate, //최소주문비율  
        //         maxAmtRate : data.minOrdRate, //최대주문비율 
        //         start_time : start_time,
        //         isOrdered : false, //주문시도 여부
        //         isSuccess : false, //주문성공 여부
        //         isContinue : false, //주문분할 계속할지 여부
        //     }
        //     setTimeout(div_exit_bitmex(obj, log_obj), 0);
        //     return;
        // }
        else if(data.isSide === 'Buy' || data.isSide === 'Sell'){ //진입한 포지션O && Buy or Sell
            var start_time = new Date()
            start_time = start_time.getTime() + (1000 * 60 * 60 * 9);  
            console.log("포지션 종료"); //로직종료
            var obj = {
                site : data.site,
                idx : 1,
                url : data.url,
                apiKey : data.apiKey,
                secreteKey : data.secreteKey,
                symbol : data.symbol,
                goalAmt : 0,
                minOrdAmt : data.minOrdAmt,
                totalOrdAmt : 0,
                totalOrdValue : 0,
                openingQty : 0, //진입한 포지션 수량 
                side : "",
                ordInterval : data.ordInterval,
                minAmtRate : data.minOrdRate, //최소주문비율  
                maxAmtRate : data.minOrdRate, //최대주문비율 
                start_price : 0,
                end_price : 0,
                start_time : start_time,
                isOrdered : false, //주문시도 여부
                isSuccess : false, //주문성공 여부
                isContinue : false, //주문분할 계속할지 여부
            }
            setTimeout(div_exit_bitmex(obj, log_obj ), 0);
            cb(null, data);
        }
      },
      function getUserMargin(data, cb){ //잔액조회
        if(_signal.side === 'Exit'  || _signal.side === 'Buy Exit' || _signal.side === 'Sell Exit'){
          return cb(null, data);
        }
        
        var requestOptions = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'GET','user/margin','currency=XBt');
        request(requestOptions, function(error, response, body){
            if(error){
                console.log(error);
                //res.send(error);
                return;
            }
            var json = JSON.parse(body);
            data.walletBalance = json.walletBalance / 100000000;
            data.marginBalance = json.marginBalance / 100000000;
            data.availableMargin = json.availableMargin / 100000000;
            //console.log("margin : " + body);
            cb(null, data);
        });
      },
      function order2(data, cb){
        if(_signal.side === 'Exit' || _signal.side === 'Buy Exit' || _signal.side === 'Sell Exit'){
          return cb(null, data);
        }
        
        if(_signal.side !== 'Sell' && _signal.side !== 'Buy'){
          return cb(null, data);
        }

        var start_time = new Date()
        start_time = start_time.getTime() + (1000 * 60 * 60 * 9);
        //진입주문
        var obj = {
            site : data.site,
            idx : 1,
            url : data.url,
            apiKey : data.apiKey,
            secreteKey : data.secreteKey,
            symbol : data.symbol,
            minOrdAmt : data.minOrdAmt,
            ordInterval : data.ordInterval,
            firstMargin : 0,
            totalRemainAmt : 0, //미체결 수량
            totalRemainVal : 0, //미체결 가치
            goalValue : Math.floor(((((data.availableMargin * data.margin) * data.leverage) * data.ticker))), //주문 목표 금액
            totalOrdValue : 0, //주문넣은 가치 합산
            totalOrdAmount : 0, //주문넣은 가치 합산
            side : _signal.side, //주문 타입
            minValueRate : data.minOrdRate, //최소주문비율
            maxValueRate : data.minOrdRate, //최대주문비율
            orderID : "", //주문id'
            msg : "div1",
            start_price : 0,
            end_price : 0,
            start_time : start_time
        }
        console.log("진입주문전");
        //console.log(obj);
        var obj2= {};
        if(obj.site === 'bitmex1'){
          //obj2 = new Object(logger_bitmex1);
          setTimeout(div_entry_bitmex(obj, logger_bitmex1), 0);
        }else if(obj.site === 'bitmex2'){
          //obj2 = new Object(logger_bitmex2);
          setTimeout(div_entry_bitmex(obj, logger_bitmex2), 0);
          
        }else if(obj.site === 'bitmex3'){
          //obj2 = new Object(logger_bitmex3);
          setTimeout(div_entry_bitmex(obj, logger_bitmex3), 0);
        }
        
        cb(null, data);
      }
    ],function(error, data){
        if(error){
            console.log("bitmex waterfall error : " + error);
            //res.send(error);
            return;
        }
        //res.send({});
    });
  }
}



function setRequestHeader(url, apiKey, apiSecret, verb, endpoint, data){
    path = '/api/v1/'+ endpoint;
    expires = new Date().getTime() + (60 * 1000); // 1 min in the future
    var requestOptions;
    if(verb === 'POST' || verb === 'PUT'){
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
  
function isOrder(side, price, amount, orderMinCost, balance_krw, balance_coin, currency, site){
  if(side === 'bid'){
      //거래소 최소주문 수량 
      if( price * amount < orderMinCost){
          console.log("[매수X] 최소비용 부족 : " + currency + " / " + site + " / " + price + " / " +  amount + " / " + orderMinCost);
          return false;
      }

      //잔고체크
      if(price * amount > balance_krw){
          console.log("[매수X] 잔고 부족 : " + currency + " / " + site + " / " + price + " / " +  amount + " / " + balance_krw);
          return false;
      }
      return true;
      
  }else if(side === 'ask' ){
      //거래소 최소주문 수량
      var orderMinAmount = orderMinCost / price;
      //거래소 최소주문 수량 부족
      if(amount < orderMinAmount){
          console.log("[매도X] 최소수량 부족 : " + currency + " / " + site + " / " + price + " / " +  amount + " / " + orderMinAmount);
          return false;
      }

      //코인부족
      if(amount > balance_coin){
          console.log("[매도X] 코인 부족 : " + currency + " / " + site + " / " + price + " / " +  amount + " / " + balance_coin);
          return false;
      }
      return true;
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