var express = require('express');
var router = express.Router();
var async = require('async');
var bitmexURL = "https://testnet.bitmex.com"
var symbol = "XBTUSD";

var apiKeyId = "-2YJMJOGLRMvUgaBD1_KzbLt"; //bitmex API key
var apiSecret = "aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd"; //bitmex API Secret

// var apiKeyId = "KM2K3Y_DJsHKG3R_3dKW8GqF"
// var apiSecret = "FGld8-AgZKK10ph7uu_n39PQ8CJm0gxkzPJdmjfUeKoQay6_"

var crypto = require("crypto");
var request = require("request");

var BithumAPI = require('../API/bithumbAPI');
var coinoneAPI = require('../API/coinoneAPI.js');
var upbitAPI = require('../API/upbitAPI.js');

// bithumb = new BithumAPI("223985a94a23a587e7aee533b82f7a4e", "4f76cce9768fbdc7f90c6b1fb7021846");
// coinone = new coinoneAPI("21635cc6-cbb4-4d7f-9abb-c6e78cf7ecf0","ec06eb68-a65a-442b-8257-c850a9242a09");
// upbit = new upbitAPI("tI144KZJZNyTnx54szCDTJcby5JferjpqtHPWlEB","mvLUNJHvOfIbCCzNrlJlnxwKnV2DqPljAq6hI8iv");

var bithumb = new BithumAPI("7446cc38540523fe9a0a04b033414ab5", "50684360909e128d413356721be9b614");
var coinone = new coinoneAPI("0d246678-06c0-4b44-9eb6-bd8ef507fc5a","dfb81257-4f3d-4beb-bafe-81dc122aae75");
var upbit = new upbitAPI("DqvxjopaOh3v1ynwxDVDkBDWu8vxAiXhwVcqpxk4","HEx8ak9dJRZxgX9xRNDPRaHr3L79d7dn6ZMsHtL7");


/* GET home page. */
router.get('/', function(req, res, next){
  var date = new Date();
  console.log("[" + date.toISOString() + "] : " + req.body);
  res.render('index', { title: 'Express' });
});

router.post('/api/webhook',function(req,res){
  var date = new Date( (new Date().getTime() + (1000 * 60 * 60 * 9)));
  console.log("kkkk");
  console.log("body : "+req.body);
  console.log("text : "+req.body.text);
  console.log("[" + date.toISOString() + "] : " + JSON.stringify(req.body.text) );
  res.send({});
});


router.post('/api/bitmex', function(req,res){
  var date = new Date( (new Date().getTime() + (1000 * 60 * 60 * 9)));
  console.log("[" + date.toISOString() + "] : " + JSON.stringify(req.body));
  async.waterfall([
    function init(cb){
        var data ={
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
    function ticker(data,cb){ //현재가 조회
        var requestOptions = setRequestHeader(apiKeyId, apiSecret, 'GET','trade','symbol='+symbol+'&count=1'+'&reverse='+true);//'currency=XBt'
        request(requestOptions, function(error,response,body){
            if(error) {
                console.log("error : " +error);
                res.send(error);
                return;
            }
            var json = JSON.parse(body);
            console.log(body);
            data.ticker = json[0].price;
            cb(null, data);
        });
    },
    function position(data, cb){
      var requestOptions = setRequestHeader(apiKeyId, apiSecret, 'GET','position','');//'currency=XBt'
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
                  console.log("매수");
                  data.openingQty = json[i].currentQty;
                  data.isSide = "Buy";
              }else if(json[i].currentQty < 0 && json[i].symbol==='XBTUSD'){
                  console.log("매도");
                  data.openingQty = json[i].currentQty;
                  data.isSide = "Sell";
              }
          }
          cb(null, data);
      });
    },
    function order1(data, cb){ //주문1
      
      if(data.isSide === req.body.side){ //진입한 포지션 === 요청포지션
        console.log("첫주문은 서로 다른 포지션이야 합니다."); //로직종료
        res.send({}); 
        return;
      }
     
      if(data.isSide === 'none'){ //진입한 포지션이 없으면 첫번째 주문 생략
        cb(null, data);
      }
      else if(req.body.side === 'Exit'){ //포지션종료
        console.log("포지션 종료"); //로직종료
        var requestClearHeader = setRequestHeader(apiKeyId, apiSecret, 'POST','order/closePosition', {symbol : symbol});
        request(requestClearHeader, function(error, response, body) {
          if(error){
            console.log(error)    
            res.send(error);
            return;
          }
          res.send({}); 
          return;
        });
      }
      else if(data.isSide === 'Buy' || data.isSide === 'Sell'){ //진입한 포지션O && Buy or Sell
        var side = req.body.side;
        var orderQty =  Math.abs(data.openingQty); //기존 수량 그대로 주문
        var requestHeader = setRequestHeader(apiKeyId, apiSecret, 'POST','order',
          {symbol : symbol, side : side, orderQty : orderQty, ordType : "Market", text : "auto"});

        request(requestHeader, function(error, response, body){
            if(error){
            console.log(error)    
            res.send(error);
            return;
          }
          console.log("주문1 : " + body);
          cb(null, data);
        });
      }
    },
    function getUserMargin(data, cb){ //잔액조회
      if(req.body.side === 'Exit'){
        return cb(null, data);
      }
      
      var requestOptions = setRequestHeader(apiKeyId, apiSecret, 'GET','user/margin','currency=XBt');
      request(requestOptions, function(error, response, body){
          if(error){
              console.log(error);
              res.send(error);
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
      if(req.body.side === 'Exit'){
        return cb(null, data);
      }

      var orderQty = Math.floor(((((data.availableMargin * data.margin) * data.leverage) * data.ticker) ));
      var side = req.body.side;
      var requestHeader = setRequestHeader(apiKeyId, apiSecret, 'POST','order',
                  {symbol : symbol, side : side, orderQty : orderQty, ordType : "Market", text : "auto"});
      
      request(requestHeader, function(error, response, body){
          if(error){
              console.log(error)    
              res.send(error);
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
          res.send(error);
          return;
      }
      res.send({});
  });
});


router.post('/api/upbit', function(req,res){
  var date = new Date( (new Date().getTime() + (1000 * 60 * 60 * 9)));
  console.log("[" + date.toISOString() + "] : " + JSON.stringify(req.body));
  async.waterfall([
    function init(cb){
      var data = {
        side : '',
        ordType : 'Limit',
        ask : [],
        bid : []
      }
      var side = req.body.side;
      (side === 'Buy')? data.side = 'bid' : data.side = 'ask';
      
      cb(null, data);
    },
    function orderbook_upbit(data, cb){ //업비트 매수/매도 조회
      //3.업비트
      upbit.orderbook('KRW-BTC', function(error, response, body){
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
    function order1(data, cb){ //주문1
      var amount = Number((1200 / data[data.side].price).toFixed(4));
      console.log(data);
      console.log("amount : "+amount);
      var revSide = '';
      (data.side === 'bid')? revSide = 'ask' : revSide = 'bid';
      upbit.order("KRW-BTC", data.side, data[revSide].price, amount, function(error, response, body){
        if(error){
          console.log(error);
          return;
        }
        console.log(body);
        cb(null,data);
      });
    }
  ],function(error, data){
      if(error){
          console.log("waterfall error : " + error);
          res.send(error);
          return;
      }
      res.send({});
  });
});


router.post('/api/coinone', function(req,res){
  var date = new Date( (new Date().getTime() + (1000 * 60 * 60 * 9)));
  console.log("[" + date.toISOString() + "] : " + JSON.stringify(req.body));
  async.waterfall([
    function init(cb){
      var data = {
        side : '',
        ask : [],
        bid : []
      }
      var side = req.body.side;
      (side === 'Buy')? data.side = 'bid' : data.side = 'ask';
      cb(null, data);
    },
    function orderbook_coinone(data, cb){ //업비트 매수/매도 조회
      //3.업비트
      coinone.orderbook("BTC", function(error, response, body){
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
    function order1(data, cb){ //주문1
      var amount = Number((1200 / data[data.side].price).toFixed(4));
      console.log(data);
      console.log("amount : "+amount);
      var revSide = '';
      (data.side === 'bid')? revSide = 'ask' : revSide = 'bid';
      if(data.side === 'bid'){
        coinone.limitBuy("BTC", data[revSide].price, amount, function(error, response, body){
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
        coinone.limitSell("BTC", data[revSide].price, amount, function(error, response, body){
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
  ],function(error, data){
      if(error){
          console.log("waterfall error : " + error);
          res.send(error);
          return;
      }
      res.send({});
  });
});

router.post('/api/bithumb', function(req,res){
  var date = new Date( (new Date().getTime() + (1000 * 60 * 60 * 9)));
  console.log("[" + date.toISOString() + "] : " + JSON.stringify(req.body));
  async.waterfall([
    function init(cb){
      var data = {
        side : '',
        ask : [],
        bid : []
      }
      var side = req.body.side;
      (side === 'Buy')? data.side = 'bid' : data.side = 'ask';
      cb(null, data);
    },
    function orderbook_bithumb(data, cb){ //빗썸 매수/매도 조회
      bithumb.orderbook("BTC",function(error,response, body){
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
        currency : "BTC"
      };
    
      bithumb.bithumPostAPICall('/info/balance', rgParams, function(error, response, body){
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
        console.log(body);
        cb(null,data);
      });
    },
    function order1(data, cb){ //주문1
      
      console.log(data);
      console.log("amount : "+amount);
      var revSide = '';
      (data.side === 'bid')? revSide = 'ask' : revSide = 'bid';
      var amount = Number((10000 / data[revSide].price).toFixed(4));
      var rgParams = {
        order_currency : 'BTC',
        payment_currency : 'KRW',
        price : data[revSide].price,
        type : data.side,
        units : amount
      };
      console.log(rgParams);
      bithumb.bithumPostAPICall('/trade/place', rgParams, function(error, response, body){
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
          console.log("[" + msg + "] : " + JSON.stringify(body));
      });
    }
  ],function(error, data){
      if(error){
          console.log("waterfall error : " + error);
          res.send(error);
          return;
      }
      res.send({});
  });
});

function setRequestHeader(apiKey, apiSecret, verb, endpoint, data){
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
          url: bitmexURL+path,
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
          url: bitmexURL+path + query,
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

 module.exports = router;
