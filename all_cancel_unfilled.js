var request = require('request');
var crypto = require('crypto');
var async = require('async');
var mongoose = require('mongoose');
var webSetting = require('./webSetting.json');
var order_unfilled = require('./models/order_unfilled');
var setting = require('./models/setting');
mongoose.connect(webSetting.dbPath, function(error){
    // mongoose.set('useFindAndModify', false);

    // order_unfilled.findOneAndRemove({orderID : "13ff53ac-27ff-e8b4-3eac-5d14740d3210"}, function(error, json){
    //     if(error){
    //         console.log(error);
    //         return;
    //     }
    //     if(json === null){ //조회결과 없으면
    //         return;
    //     }

    //     console.log(json);
    // });
});

// setTimeout(all_cancel_unfilled_order('bitmex2'), 2000);






function all_cancel_unfilled_order(site){
    return function(){
        order_unfilled.find({site : site}, function(error, json){
            if(error){
                console.log(error);
                return;
            }
            for(var i=0; i<json.length; i++){
                setTimeout(cancel_unfilled_order(site, json[i].orderID), i*500);
            }
        });
    }
  }
  
  
  function cancel_unfilled_order(site, orderID){
    return function(){
        async.waterfall([
            function get_api_key(cb){
              setting.findOne({site : site}, function(error, json){
                if(error){
                  console.log(error);
                  return;
                }
                url = json.url;
                apiKey = json.apiKey;
                secreteKey = json.secreteKey;
                cb(null);
              });
            },
            function order_cancel(cb){ //주문취소
              var requestHeader = setRequestHeader(url, apiKey, secreteKey, 'DELETE','order',
              {orderID : orderID});
              request(requestHeader, function(error, response, body){
                  if(error){
                      console.log(error);
                      return;
                  }
                  console.log(body);
                  isCancel=true;
                  cb(null);
              });
            },
            function remove_unfilled_order(cb){ //주문삭제
              if(isCancel === true){
                order_unfilled.findOneAndRemove({orderID : orderID}, function(error, json){          
                    if(error){
                        console.log(error);
                        return;
                    }
                    cb(null);
                });
              }
            }
          ], function(error, results){
            if(error){
              console.log(error);
              return;
            }
            console.log("취소성공");
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
  
    