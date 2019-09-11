var async = require('async');
var crypto = require("crypto");
var request = require("request");
var mongoose = require('mongoose');
var BithumAPI = require('./API/bithumbAPI');
var coinoneAPI = require('./API/coinoneAPI.js');
var upbitAPI = require('./API/upbitAPI.js');
var signal = require("./models/signal");
var settings = require("./models/setting");
var webSetting = require('./webSetting.json');
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

  settings.find({}, function(err, res){ //거래소에 대응하는 환경설정을 찾는다.
    if(err){
        console.log(err);
        return;
    }

    if(res.length === 0){ //없으면 환경설정 생성
      var obj = [
        {
          site : "bitmex", // ex) "ANKR_KRW"
          url : "https://testnet.bitmex.com", //ex)  "ANKR"
          symbol : "XBTUSD",
          apiKey : "-2YJMJOGLRMvUgaBD1_KzbLt",
          secreteKey : "aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd"
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
    }
  });
});

setInterval(marginTrade(), 3000);

function marginTrade(){
  return function(){
    signal.find({},function(error, res){
      if(error){
        console.log(error);
        return;
      }
      if(res.length > 0){
        console.log("");
        console.log("");
        console.log("-----신호목록-----");
        //console.log(res);
        for(i=0; i<res.length; i++){
          setTimeout(trade_bitmex(new Object(res[i]) ), 0);
          setTimeout(trade_bithumb(new Object(res[i])), 0);
          setTimeout(trade_coinone(new Object(res[i])), 0);
          setTimeout(trade_upbit(new Object(res[i])), 0);
          
          //신호 삭제
          signal.findByIdAndRemove(res[i]._id, function(error, res){
            if(error){
              console.log(error);
              return;
            }
          });
        }
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
          side : '',
          ask : [],
          bid : []
        }

        var side = _signal.side;
        (side === 'Buy')? data.side = 'bid' : data.side = 'ask';
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
          data.avail_coin = Number(json.data["available_"+coin_name]);
          data.avail_pay = Math.floor(Number(json.data["available_"+"krw"]));
          cb(null,data);
        });
      },
      function order1(data, cb){ //주문1
        //console.log(data);

       
        var revSide = '';
        (data.side === 'bid')? revSide = 'ask' : revSide = 'bid';
        console.log("side : " + data.side );
        console.log("revSide : " + revSide );
        console.log("avail_pay : "+ data.avail_pay);
        console.log("margin : "+ data.margin);
        console.log("leverage : "+ data.leverage);
        console.log("price : " + data[revSide].price);
        if(data.side === 'bid'){
          //var amount = Number(((((data.avail_pay * data.margin) * data.leverage) /  data[revSide].price) - 0.00014999).toFixed(4));
          var amount = fixed4((((data.avail_pay * data.margin) * data.leverage) /  data[revSide].price));
          
        }else if(data.side === 'ask'){
          //var amount = Number((data.avail_coin - 0.00014999).toFixed(4));
          var amount = fixed4(data.avail_coin);
        }

        var rgParams = {
          order_currency : 'BTC',
          payment_currency : 'KRW',
          price : data[revSide].price,
          type : data.side,
          units : amount
        };
        console.log("avail krw : " + data.avail_pay);
        console.log("avail coin : " + data.avail_coin);
        console.log(rgParams);
        //수량 : 마진, 레버리지
        //둘다 : 최소수량 check
        //매도 : 코인수량 check
        //매수 : 사용가능금액 check 
        
        var flag = isOrder(rgParams.type, rgParams.price, rgParams.units, 2000, data.avail_pay, data.avail_coin, rgParams.order_currency, "bithumb" );
        if(flag === true){
          bithumAPI.bithumPostAPICall('/trade/place', rgParams, function(error, response, body){
              if(error){
                  console.log("빗썸 주문에러 error1 : " + error);
                  return;
              }

              try{
                  var json = JSON.parse(body);
              }catch(error){
                  console.log("빗썸 주문에러 error2 : " + error);
                  return;
              }

              if(json.status !== "0000"){
                  console.log("빗썸 주문에러 조회 error3 : " + body);
                  return;
              }
              console.log(JSON.stringify(body));
              cb(null,data);
          });
          console.log("----빗썸 주문실행----");
          console.log("avail krw : " + data.avail_pay);
          console.log("avail coin : " + data.avail_coin);
          console.log(rgParams);
        }

        //cb(null,data);
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
      function orderbook_coinone(data, cb){ //업비트 매수/매도 조회
        //3.업비트
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
                cb(null, data);
            }
        });
      },  
      
      function order1(data, cb){ //주문1
        //var amount = Number((1200 / data[data.side].price).toFixed(4));
        var revSide = '';
        (data.side === 'bid')? revSide = 'ask' : revSide = 'bid';
        //var amount = Number(((((data.avail_coin * data.margin) * data.leverage) * data[revSide].price) - 0.00014999).toFixed(4));
        if(data.side === 'bid'){
          //var amount = Number(((((data.avail_pay * data.margin) * data.leverage) /  data[revSide].price) - 0.00014999).toFixed(4));
          var amount = fixed4((((data.avail_pay * data.margin) * data.leverage) /  data[revSide].price));

        }else if(data.side === 'ask'){
          //var amount = Number((data.avail_coin - 0.00014999).toFixed(4));
          var amount = fixed4(data.avail_coin);
        }
        
        var flag = isOrder(data.side, data[revSide].price, amount, 2000, data.avail_pay, data.avail_coin, data.symbol, "coinone");
        if(flag === true){
          console.log("----코인원 주문실행----");
          console.log("avail krw : " + data.avail_pay);
          console.log("avail coin : " + data.avail_coin);
          console.log("price : "+data[revSide].price);
          console.log("amount : "+amount);
          console.log("side : "+data.side);
          if(data.side === 'bid'){
            coinone.limitBuy(data.symbol, data[revSide].price, amount, function(error, response, body){
              if(error){
                  console.log("코인원 주문에러 : "+error);
                  return;
              }
              try{
                  var json = JSON.parse(body);
              }catch(error){
                console("코인원 주문에러 error1 : " + error);
                return;
              }
              if(json.errorCode !== "0"){
                console("코인원 주문에러 error2 : " + body);
                return;
              }
              console.log(body);
              cb(null, data);
            });
          }else if(data.side === 'ask'){
            coinone.limitSell(data.symbol, data[revSide].price, amount, function(error, response, body){
              if(error){
                  console.log("코인원 주문에러 : "+error);
                  return;
              }
              try{
                  var json = JSON.parse(body);
              }catch(error){
                console("코인원 주문에러 error1 : " + error);
                return;
              }
              if(json.errorCode !== "0"){
                console("코인원 주문에러 error2 : " + body);
                return;
              }
              console.log(body);
              cb(null, data);
            });
            
          }
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
            cb(null, data);
        });
      },

      function order1(data, cb){ //주문1
        //var amount = Number((1200 / data[data.side].price).toFixed(4));
        //console.log(data);
        //console.log("amount : "+amount);
        var revSide = '';
        (data.side === 'bid')? revSide = 'ask' : revSide = 'bid';
        if(data.side === 'bid'){
          //var amount = Number(((((data.avail_pay * data.margin) * data.leverage) /  data[revSide].price) - 0.00014999).toFixed(4));
          var amount = fixed4((((data.avail_pay * data.margin) * data.leverage) /  data[revSide].price));

        }else if(data.side === 'ask'){
          //var amount = Number((data.avail_coin - 0.00014999).toFixed(4));
          var amount = fixed4(data.avail_coin);
        }
     
        var flag = isOrder(data.side, data[revSide].price, amount, 2000, data.avail_pay, data.avail_coin, data.symbol, "upbit");
        if(flag === true){
          upbit.order(data.symbol, data.side, data[revSide].price, amount, function(error, response, body){
            if(error){
              console.log(error);
              return;
            }
            console.log(body);
            cb(null,data);
          });
          console.log("-----업비트 주문실행-------");
          console.log("avail krw : " + data.avail_pay);
          console.log("avail coin : " + data.avail_coin);
          console.log("price : "+data[revSide].price);
          console.log("amount : "+amount);
          console.log("side : "+data.side);
        }
        //cb(null,data);
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

function trade_bitmex(_signal){
  return function(){
    var date = new Date( (new Date().getTime() + (1000 * 60 * 60 * 9)));
    console.log("[" + date.toISOString() + "] : " + JSON.stringify(_signal));
    async.waterfall([
      function init(cb){
          var data ={
              url : "",
              apiKey : "",
              secreteKey : "",
              symbol : "",
              ticker : 0, //현재가
              walletBalance : 0, //지갑잔고
              marginBalance : 0, //마진 밸런스
              availableMargin : 0, // 사용가능잔고
              leverage : 1, //setting값 
              margin : 0.1, //setting값
              openingQty : 0, // 들어가 있는 수량
              isSide : 'none', //들어가 있는 side// Sell or Buy
          }
          cb(null, data);
      },
      function readSetting(data, cb){
        settings.find({site : "bitmex"},function(error, res){
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

          data.url = res[0].url;
          data.symbol = res[0].symbol;
          data.apiKey = res[0].apiKey;
          data.secreteKey = res[0].secreteKey;
          data.leverage = res[0].leverage;
          data.margin = res[0].margin * 0.01;
          data.minOrdCost = res[0].minOrdCost;
          data.ordInterval = res[0].ordInterval * 1000;
          data.minOrdRate = res[0].minOrdRate * 0.01;
          data.maxOrdRate = res[0].maxOrdRate * 0.01;
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
        }
        else if(_signal.side === 'Exit'){ //포지션종료
          console.log("포지션 종료"); //로직종료
          var requestClearHeader = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'POST','order/closePosition', {symbol : data.symbol});
          request(requestClearHeader, function(error, response, body) {
            if(error){
              console.log(error)    
              //res.send(error);
              return;
            }
            //res.send({}); 
            return;
          });
        }
        else if(data.isSide === 'Buy' || data.isSide === 'Sell'){ //진입한 포지션O && Buy or Sell
          var symbol = data.symbol;
          var side = _signal.side;
          var orderQty =  Math.abs(data.openingQty); //기존 수량 그대로 주문
          var requestHeader = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'POST','order',
            {symbol : symbol, side : side, orderQty : orderQty, ordType : "Market", text : "auto"});
  
          request(requestHeader, function(error, response, body){
              if(error){
              console.log(error)    
              //res.send(error);
              return;
            }
            console.log("주문1 : " + body);
            cb(null, data);
          });
        }
      },
      function getUserMargin(data, cb){ //잔액조회
        if(_signal.side === 'Exit'){
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
        if(_signal.side === 'Exit'){
          return cb(null, data);
        }
        var symbol = data.symbol;
        var orderQty = Math.floor(((((data.availableMargin * data.margin) * data.leverage) * data.ticker) ));
        var side = _signal.side;
        var requestHeader = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'POST','order',
                    {symbol : symbol, side : side, orderQty : orderQty, ordType : "Market", text : "auto"});
        
        request(requestHeader, function(error, response, body){
            if(error){
                console.log(error)    
                //res.send(error);
                return;
            }
            console.log("주문2 : " + body);
            //var resBody = JSON.parse(body);
            cb(null, data);
        });
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