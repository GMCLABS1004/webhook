var express = require('express');
var router = express.Router();
var async = require('async');
var bitmexURL = "https://testnet.bitmex.com"
var crypto = require("crypto");
var request = require("request");

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
  var symbol = "XBTUSD";
  var apiKeyId = "KM2K3Y_DJsHKG3R_3dKW8GqF"
  var apiSecret = "FGld8-AgZKK10ph7uu_n39PQ8CJm0gxkzPJdmjfUeKoQay6_"
  async.waterfall([
    function init(cb){
        var data ={
            ticker : 0, //현재가
            walletBalance : 0, //지갑잔고
            marginBalance : 0, //마진 밸런스
            availableMargin : 0, // 사용가능잔고
            leverage : 1,
            margin : 0.1,
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
            data.ticker = json[0].price;
            cb(null, data);
        });
    },
    function getUserMargin(data, cb){ //잔액조회
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
    }

  ],function(error, data){
      if(error){
          console.log("waterfall error : " + error);
          res.send(error);
          return;
      }

      console.log(data);
      var orderQty = Math.floor(((((data.availableMargin * data.margin) * data.leverage) * data.ticker) ));
      if(orderQty < 0){
          console.log("amount minus : " + amount);
          res.send({});
          return;
      }

      console.log("orderQty : "+ orderQty);
      var side = req.body.side;
      var requestHeader = setRequestHeader(apiKeyId, apiSecret, 'POST','order',
                  {symbol : symbol, side : side, orderQty : orderQty, ordType : "Market", text : "auto"});
      
      request(requestHeader, function(error, response, body){
          if(error){
              console.log(error)    
              res.send(error);
              return;
          }
          else{
              console.log(body);
              //var resBody = JSON.parse(body);
              res.send({});
          }
      });
  });
});











/**
 * 
 * @param {*} apiKey 유저의 apiKey
 * @param {*} apiSecret 유저의 apiSecret
 * @param {*} verb Post or Get
 * @param {*} endpoint 
 * @param {*} data 
 * 
 */
function setRequestHeader(apiKey, apiSecret, verb, endpoint, data){
  path = '/api/v1/'+ endpoint;
  expires = new Date().getTime() + (60 * 1000); // 1 min in the future
  var requestOptions;
  //if(verb === 'POST'){  //GET은 안됨
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
  //}
  return requestOptions;
}

module.exports = router;
