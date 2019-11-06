var async = require('async');
var crypto = require('crypto');
var request = require('request');
var order = require("./models/order");
var setting = require("./models/setting");
var script = require("./models/script");
var position = require("./models/position");
var webSetting = require("./webSetting");
var mongoose = require('mongoose');
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
});

setInterval(positionAll(), 10000);

function positionAll(){
    return function(){
        var list = [];
        var last_price = 0;
      // console.log(res);
        async.waterfall([
        function readSetting(cb){
          var set_list =[];
          setting.find({execFlag : true},function(error,res){
            if(error){
              console.log(error);
              return;
            }
            // console.log("readSetting");
            // console.log(res);
          
            for(i=0; i<res.length; i++){
              if(res[i].site.indexOf('bitmex') !== -1){
                set_list.push(res[i]);    
              }
            }
            cb(null, set_list);
          });
        },
        function ticker(set_list, cb){
          
          if(set_list.length > 0){
            
            var requestOptions = setRequestHeader(set_list[0].url, set_list[0].apiKey, set_list[0].secreteKey,'GET','trade','symbol=XBTUSD&count=1&reverse=true');
            request(requestOptions, function(err,responsedata,body){
              if(err){
                console.log(err);
              }
            //   console.log("ticker");
               //console.log(body);

               console.log(responsedata.headers);//.dict.x-ratelimit-remaining
              var obj = JSON.parse(body);
              console.log(body);
              last_price = obj[0].price;
              cb(null, set_list); 
            })
          }else{
            cb(null, set_list);
          }
        },
        function getPosition(set_list, cb){
          for(i=0; i<set_list.length; i++){
            setTimeout(getPosition_bitmex(set_list[i], function(error, data){
              if(error){
                console.log(error);
                return;
              }
            //   console.log("getPosition");
            //   console.log(data);
              // console.log("data : ");
              // console.log(data);
    
              list.push(data);
              if(set_list.length === list.length){
    
                cb(null);
              }
            }), 0);
          }
        },
        function readScriptInfo(cb){
          if(list.length === 0){
            return cb(null);
          }
    
          script.find({}, function(error, res){
            if(error){
              console.log(error);
              return;
            }
    
            for(i=0; i<list.length; i++){
              list[i].scriptName = "";
              list[i].version = "";
            }
    
            for(i=0; i<list.length; i++){
              for(j=0; j<res.length; j<j++){
                if(list[i].scriptNo === res[j].scriptNo){
                  list[i].scriptName = res[j].scriptName
                  list[i].version = res[j].version;
                }
              }
            }
            cb(null);
          })
        }
    ], function(error, results){
            if(error){
                console.log(error);
            }
            // console.log("waterfall 결과");
            // console.log(list);
            
            //console.log('last_price : '+ last_price);
            list.sort(function(a,b){ //수량을 오름차순 정렬(1,2,3..)
                return a.site.split('bitmex')[1] - b.site.split('bitmex')[1];
            });
            //console.log({site_type : "oversee", last_price : last_price, list : list});
            var data = {site_type : "oversee", last_price : last_price, list : list};
            position.findOneAndUpdate(
                {site_type : "oversee"},
                {$set : data},
                {upsert : true},
                function(error, body){
                    if(error){
                        console.log(error);
                        return;
                    }
                    //console.log(body);
                }
            )
        });
    }
}


function getPosition_bitmex(set, cb){
    return function(){
      var requestOptions = setRequestHeader(set.url, set.apiKey, set.secreteKey,'GET','position','');
      request(requestOptions, function(err,responsedata,body){
        if(err){
          console.log(err);
        }
        // console.log("getPosition_bitmex");
        // console.log(body);
        var obj = JSON.parse(body);
        var data = bitmex_position_notSearch(set);
        
        if(obj.length === 0){
          // data["leverage"] = set.leverage;
          // data["margin"] = set.margin;
          // data["scriptNo"] = set.scriptNo;
          return cb(null, data);
        }
        for(var i=0; i<obj.length; i++){
          if(obj[i].symbol === 'XBTUSD'){
            data = bitmex_position_parse(set.site, obj[i]);
            data["leverage"] = set.leverage;
            data["margin"] = set.margin;
            data["scriptNo"] = set.scriptNo;
            data["side_num"] = set.side_num;
          }
        }
  
        var requestOptions = setRequestHeader(set.url, set.apiKey, set.secreteKey, 'GET','user/margin','currency=XBt');
        request(requestOptions, function(error, response, body){
            if(error){
                console.log(error);
                
                return;
            }
            var json = JSON.parse(body);
            data.walletBalance = json.walletBalance / 100000000;
            
            //최초자산 조회
            order.find({site : set.site}).sort({start_time : "asc"}).limit(1).exec(function(error, body){
              if(error){
                console.log(error);
               
                return;
              }
             // console.log(body);
              if(body.length > 0){
                //console.log("")
                data["walletBalance_before"] = body[0].totalAsset;
              }else{
                data["walletBalance_before"] = data.walletBalance;
              }
              cb(null, data);
            });
            
        });
      })
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


  function bitmex_position_notSearch(set){
    return { 
      site: set.site,
      symbol: 'XBTUSD',
      walletBalance : 0,
      size: 0,
      value: 0,
      avgEntryPrice: 0,
      markPrice: 0,
      liquidationPrice: 0,
      margin: set.margin,
      leverage: set.leverage,
      scriptNo : set.scriptNo,
      unrealisedPnl: 0,
      unrealisedRoePcnt: 0,
      realisedPnl: 0,
      isOpen: false
    }
  }
  
  function bitmex_position_parse(site, obj){
    var posObj = {};
    posObj["site"] = site;
    if(typeof(obj.symbol) !== "undefined" && obj.symbol !== null)
        posObj["symbol"] = obj.symbol;
  
    if(typeof(obj.currentQty) !== "undefined" && obj.currentQty !== null) 
        posObj["size"] = obj.currentQty;
  
    if(typeof(obj.homeNotional) !== "undefined" && obj.homeNotional !== null) 
        posObj["value"] = obj.homeNotional;
  
    if(typeof(obj.avgEntryPrice) !== "undefined" && obj.avgEntryPrice !== null){
      posObj["avgEntryPrice"] = obj.avgEntryPrice;
    }else{
      posObj["avgEntryPrice"] = 0;
    }
        
  
    if(typeof(obj.markPrice) !== "undefined" && obj.markPrice !== null) 
        posObj["markPrice"] = obj.markPrice;
  
    if(typeof(obj.liquidationPrice) !== "undefined" && obj.liquidationPrice !== null) 
        posObj["liquidationPrice"] = obj.liquidationPrice;
  
    if(typeof(obj.maintMargin) !== "undefined" && obj.maintMargin !== null) 
        posObj["margin"] = obj.maintMargin;
  
    if(typeof(obj.leverage) !== "undefined" && obj.leverage !== null)
        posObj["leverage"] = obj.leverage;
  
    if(typeof(obj.unrealisedPnl) !== "undefined" && obj.unrealisedPnl !== null) 
        posObj["unrealisedPnl"] =  obj.unrealisedPnl * 0.00000001;
  
    if(typeof(obj.unrealisedRoePcnt) !== "undefined" && obj.unrealisedRoePcnt !== null) 
        posObj["unrealisedRoePcnt"] = obj.unrealisedRoePcnt;
  
    if(typeof(obj.realisedPnl) !== "undefined" && obj.realisedPnl !== null) 
        posObj["realisedPnl"] = obj.realisedPnl * 0.0000000001;
    
    if(typeof(obj.isOpen) !== "undefined" && obj.isOpen !== null) 
        posObj["isOpen"] = new Boolean(obj.isOpen);
    
    return posObj;
    
  }
  