var express = require('express');
var router = express.Router();

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


router.post('/api/bitmex',function(req,res){
  var date = new Date( (new Date().getTime() + (1000 * 60 * 60 * 9)));
  console.log("[" + date.toISOString() + "] : " + JSON.stringify(req.body));
  var symbol = "XBTUSD";
  var apiKeyId = "KM2K3Y_DJsHKG3R_3dKW8GqF"
  var apiSecret = "FGld8-AgZKK10ph7uu_n39PQ8CJm0gxkzPJdmjfUeKoQay6_"
  async.waterfall([
    function init(cb){
      var data ={
        ticker : 0
      }
      cb(null, data);
    },
    function ticker(data,cb){
      var requestOptions = setRequestHeader(apiKeyId, apiSecret, 'GET','trade','symbol='+symbol+'&count=1'+'&reverse='+true);//'currency=XBt'
      request(requestOptions, function(err,response,body){
          if(err){
              console.log(err);
              res.send(err);
              return;
          }
          var json = JSON.parse(body);
          console.log("ticker : "+ body);
          //console.log(json[0])
          cb(null, data);
      });
    },
  ],function(error, results){
    if(error){
      console.log(err);
      res.send(err);
      return;
    }
    //console.log(results);
    if(req.body.side === 'Buy'){
      console.log("buy");
    }else if(req.body.side === 'Sell'){
      console.log("sell");
    }
    res.send({});
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
