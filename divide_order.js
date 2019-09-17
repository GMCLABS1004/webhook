var crypto = require("crypto");
var request = require("request");
var url = 'https://testnet.bitmex.com';
var apiKey = '-2YJMJOGLRMvUgaBD1_KzbLt'
var secreteKey = 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd';
var symbol = 'XBTUSD';
var requestHeader = setRequestHeader(url, apiKey, secreteKey, 'GET', 'orderbook/L2', 'symbol='+symbol+'&depth=1');

function divide_bitmex(goalValue, minOrdValue, side){
    return function(cb){
      async.waterfall([
        function init(){
            var data = {
                goalValue : goalValue, //주문 목표 금액
                minOrdValue : minOrdValue, //최소주문금액
                side : side, //주문 타입
                sellDepth : {}, //매도목록
                buyDepth : {} //매수목록
            }
            cb(data);
        },
        function depth(){
          var requestHeader = setRequestHeader(url, apiKey, secreteKey, 'GET', 'orderbook/L2', 'symbol='+symbol+'&depth=1');
          request(requestHeader, function(error, response, body){
            if(error){
              console.log(error);
              return;
            }
            var json = JSON.parse(body);
          });
        },
        function order(){
          // var requestHeader = setRequestHeader(data.url, data.apiKey, data.secreteKey, 'POST','order',
          // {symbol : symbol, side : side, orderQty : orderQty, ordType : "Market", text : "auto"});
          // request(requestHeader, function(error, response, body){
          //   if(error){
          //     console.log(error)    
          //     //res.send(error);
          //     return;
          //   }
          //   console.log("주문1 : " + body);
          //   var json = JSON.parse(body);
          //   logger.info("site : bitmex " + "/ side : " + json.side + "/ price : " + price_comma(json.price) + "/ amount : "+ amount_comma(json.orderQty) );
          //   var history = {
          //     site : "bitmex",
          //     side : json.side,
          //     price : json.price,
          //     amount : json.orderQty,
          //     timestamp : (new Date().getTime() + (1000 * 60 * 60 * 9))
          //   }
          //   orderDB.insertMany(history,function(error,res){
          //     if(error){
          //     console.log(error);
          //     return;
          //     }
          //   });
          // });
        }
      ],function(error, results){
  
      });
    }
  }