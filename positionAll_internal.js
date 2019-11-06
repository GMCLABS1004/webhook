var async = require('async');
var crypto = require('crypto');
var request = require('request');
var BithumAPI = require('./API/bithumbAPI');
var coinoneAPI = require('./API/coinoneAPI.js');
var upbitAPI = require('./API/upbitAPI.js');
var korbitAPI = require('./API/korbitAPI.js');
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

setInterval(positionAll_internal(), 3000);



function positionAll_internal(){
    return function(){
        var list = [];
        var last_price = 0;
        
        //실제로 동작중인 국내거래소 셋팅값을 가져와라
        setting.find({execFlag : true, site_type : "korean"},function(error, set_list){
          if(error){
            console.log(error);
            return;
          }
          console.log(set_list);
          var list=[];
          if(set_list.length ===0){
            response.send({last_price :0, list : list});
            return;
          }
          console.log(set_list.length);
          //빗썸 셋팅값이 1개 이상이면 갯수만큼 포지션 정보 생성
          for(i=0; i<set_list.length; i++){
            console.log("positionAll_internal");
            setTimeout(getPosition_korea(set_list[i], function(error, data){
              if(error){
                console.log(error);
                return;
              }
              list.push(data);
              console.log(data);
              if(list.length === set_list.length){
                //스크립트 이름 넣기
                readScriptInfo(list, function(error, new_list){
                    if(error){
                        console.log(error);
                        return;
                    }
                  //abcd 순 정렬
                    new_list.sort(ascending);
                    //response.send({last_price : list[0].ticker, list : list});
                    var data = {site_type : "korean", last_price : list[0].ticker, list : list};
                   // console.log(data);
                    position.findOneAndUpdate(
                        {site_type : "korean"},
                        {$set : data},
                        {upsert : true},
                        function(error, body){
                            if(error){
                                console.log(error);
                                return;
                            }
                            console.log(body);
                        }
                    )
                });
              }
            }), 0);
          }
        });
    }
}


function fixed4(num){
    if(Number(num) < 0.0001){
      return 0;
    }
    
    var str = new String(num);
    var arr = str.split(".");
    var str2 = arr[1].slice(0,4);
    return Number(arr[0] + '.' + str2);
  }

function readScriptInfo(list, cb){
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
      cb(null, list);
    })
  }
  
  // 대소문자 무시 ( toLowerCase ) 
  function ascending ( a , b ) {  
    var a = a.site.toString().toLowerCase(); 
    var b = b.site.toString().toLowerCase(); 
    return ( a < b ) ? -1 : ( a == b ) ? 0 : 1; 
  } 
  
  function getPosition_korea(set, cb){
    return function(){
      var predicate={}
      if(set.site === 'bithumb') predicate = getPosition_bithumb;
      else if(set.site === 'coinone') predicate = getPosition_coinone;
      else if(set.site === 'upbit') predicate = getPosition_upbit;
      else if(set.site === 'korbit') predicate = getPosition_korbit;
  
      console.log("getPosition_korea");
      //빗썸 셋팅값이 1개 이상이면 갯수만큼 포지션 정보 생성
      setTimeout(predicate(set, function(error, data){
        if(error){
          console.log(error);
          return;
        }
        
        //최초자산 조회
        order.find({site : set.site}).sort({start_time : "asc"}).limit(1).exec(function(error, body){
          if(error){
            console.log(error);
            //res.send(error);
            return;
          }
          console.log(body);
          if(body.length > 0){
            console.log("")
            data["totalAsset_before"] = body[0].totalAsset;
          }else{
            data["totalAsset_before"] = data.totalAsset;
          }
          cb(null, data);
        });
       
      }), 0);
    }
  }
  
  function getPosition_bithumb(set, cb){
    return function(){
      var bithumAPI={};
      var total_krw =0;
      var total_btc =0;
      async.waterfall([
        function init(cb){
          console.log("getPosition_coinone");
          //사이트, 스크립트, 마진, 레버리지
          bithumAPI = new BithumAPI(set.apiKey, set.secreteKey);
          var data = {
            site : set.site,//사이트
            scriptNo : set.scriptNo, //스크립트
            isSide : "",
            side_num : set.side_num,
            totalAsset : 0,
            size: 0,
            value : 0,
            price : 0,
            margin : set.margin,//마진
            leverage : set.leverage, //레버리지
            benefit : 0,
            benefitRate: 0,
            ticker :0
          }
          cb(null, data);
        
        },
        function balance(data, cb){
          //포지션(long), 보유수량, 가치, 현재자산(총krw)
          var rgParams = {
            currency : "BTC"
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
            
            data.totalAsset =  Math.floor(Number(json.data["total_krw"]));
            data.size =  fixed4((Number(json.data["total_btc"])));
            var avail_btc = fixed4((Number(json.data["available_btc"])));
  
            if(avail_btc > 0.0001){ //* data.ticker 
              data.isSide = "long"
            }else{
              data.isSide = "none"
            }
            cb(null, data);
          });
        },
        function ticker(data, cb){
          if(data.isSide === 'none'){
            return cb(null, data);
          }
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
            data.ticker = json.data.closing_price;
            data.value = Math.floor(data.size * data.ticker);
            cb(null, data);
          });
        },
        function trade_history(data, cb){
          if(data.isSide === 'none'){
            return cb(null,data);
          }
          
          //진입전자산, 진입가격
          order.find({site : data.site, type : "long"}).sort({end_time : "desc"}).exec(function(error, res){
            if(error){
                console.log(error);
                return;
            }
            if(res.length > 0){
                data.price = res[0].price;
                data.benefit = (data.value + data.totalAsset) - res[0].totalAsset; //탈출자산 - 진입자산
                data.benefitRate = (data.benefit / res[0].totalAsset) * 100;
            }else{
                data.benefit =0;
                data.benefitRate =0;
            }
            cb(null, data);
          });
        }
      ], function(error, data){
        if(error){
          console.log(error);
          return;
        }
        return cb(null, data);
      });
    }
  }
  
  function getPosition_coinone(set, cb){
    return function(){
      var coinone={};
      var total_krw =0;
      var total_btc =0;
      async.waterfall([
        function init(cb){
          console.log("getPosition_coinone");
          //사이트, 스크립트, 마진, 레버리지
          coinone = new coinoneAPI(set.apiKey, set.secreteKey);
          var data = {
            site : set.site,//사이트
            scriptNo : set.scriptNo, //스크립트
            isSide : "",
            side_num : set.side_num,
            totalAsset : 0,
            size: 0,
            value : 0,
            price : 0,
            margin : set.margin,//마진
            leverage : set.leverage, //레버리지
            benefit : 0,
            benefitRate: 0,
            ticker :0
          }
          cb(null, data);
        
        },
        function balance(data, cb){
          //포지션(long), 보유수량, 가치, 현재자산(총krw)
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
              
            }else{
              data.totalAsset =  Math.floor(Number(json["krw"].balance));
              data.size =  fixed4(Number(json["btc"].balance));
              var avail_btc = Number(json["btc"].avail);
  
              if(avail_btc > 0.0001){ //* data.ticker 
                data.isSide = "long"
              }else{
                data.isSide = "none"
              }
              cb(null, data);
            }
          });
        },
        function ticker(data, cb){
          if(data.isSide === 'none'){
            return cb(null, data);
          }
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
           
            data.ticker = Number(json.last);
            data.value = Math.floor(data.size * data.ticker);
            cb(null, data);
          
          });
  
        },
        function trade_history(data, cb){
          if(data.isSide === 'none'){
            return cb(null,data);
          }
          
          //진입전자산, 진입가격
          order.find({site : data.site, type : "long"}).sort({end_time : "desc"}).exec(function(error, res){
            if(error){
                console.log(error);
                return;
            }
            if(res.length > 0){
                data.price = res[0].price;
                data.benefit = (data.value + data.totalAsset) - res[0].totalAsset; //탈출자산 - 진입자산
                data.benefitRate = (data.benefit / res[0].totalAsset) * 100;
            }else{
                data.benefit =0;
                data.benefitRate =0;
            }
            cb(null, data);
          });
        }
      ], function(error, data){
        if(error){
          console.log(error);
          return;
        }
        return cb(null, data);
      });
    }
  }
  
  function getPosition_upbit(set, cb){
    return function(){
      var upbit={};
      var total_krw =0;
      var total_btc =0;
      async.waterfall([
        function init(cb){
          console.log("getPosition_upbit");
          //사이트, 스크립트, 마진, 레버리지
          upbit = new upbitAPI(set.apiKey, set.secreteKey);
          var data = {
            site : set.site,//사이트
            scriptNo : set.scriptNo, //스크립트
            isSide : "",
            side_num : set.side_num,
            totalAsset : 0,
            size: 0,
            value : 0,
            price : 0,
            margin : set.margin,//마진
            leverage : set.leverage, //레버리지
            benefit : 0,
            benefitRate: 0,
            ticker :0
          }
          cb(null, data);
        
        },
        function balance(data, cb){
          //포지션(long), 보유수량, 가치, 현재자산(총krw)
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
            var avail_btc=0;
            json.forEach(element => {
                if(element.currency === "KRW"){ //KRW
                  data.totalAsset = Math.floor(Number(element.balance) + Number(element.locked));
                }else if(element.currency === "BTC"){
                  data.size = fixed4(Number(element.balance) + Number(element.locked));
                  avail_btc = fixed4(Number(element.balance));
                }
            });
            if(avail_btc > 0.0003){ //* data.ticker 
              data.isSide = "long"
            }else{
              data.isSide = "none"
            }
            cb(null, data);
          });
        },
        function ticker(data, cb){
          if(data.isSide === 'none'){
            return cb(null, data);
          }
  
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
            data.value = Math.floor(data.size * data.ticker);
            cb(null, data);
           
          });
        },
        function trade_history(data, cb){
          if(data.isSide === 'none'){
            return cb(null,data);
          }
          
          //진입전자산, 진입가격
          order.find({site : data.site, type : "long"}).sort({end_time : "desc"}).exec(function(error, res){
            if(error){
                console.log(error);
                return;
            }
            if(res.length > 0){
                data.price = res[0].price;
                data.benefit = (data.value + data.totalAsset) - res[0].totalAsset; //탈출자산 - 진입자산
                data.benefitRate = (data.benefit / res[0].totalAsset) * 100;
            }else{
                data.benefit =0;
                data.benefitRate =0;
            }
            cb(null, data);
          });
        }
      ], function(error, data){
        if(error){
          console.log(error);
          return;
        }
        return cb(null, data);
      });
    }
  }
  
  function getPosition_korbit(set, cb){
    return function(){
      var korbit={};
      var total_krw =0;
      var total_btc =0;
      async.waterfall([
        function init(cb){
          console.log("getPosition_korbit");
          //사이트, 스크립트, 마진, 레버리지
          korbit = new korbitAPI(set.apiKey, set.secreteKey);
          korbit.access_token(function(error, response, body){
            if(error){
                console.log(error);
                return;
            }
  
            try{
                var json = JSON.parse(body);
            }catch(error){
                console.log(error);
                return;
            }
            korbit.token = json.access_token;
            var data = {
              site : set.site,//사이트
              scriptNo : set.scriptNo, //스크립트
              isSide : "",
              side_num : set.side_num,
              totalAsset : 0,
              size: 0,
              value : 0,
              price : 0,
              margin : set.margin,//마진
              leverage : set.leverage, //레버리지
              benefit : 0,
              benefitRate: 0,
              ticker :0
            }
            cb(null, data);
          });
        },
        function balance(data, cb){
          //포지션(long), 보유수량, 가치, 현재자산(총krw)
          korbit.balances(function(error, response, body){
            if(error){
                console.log("코빗 balance 값 조회 error1 : " + error);
                return;;
            }
           
            try{
                var json = JSON.parse(body);
            }catch(error){
                console.log("코빗 balance 값 조회 error2 : " + error);
                return;
            }
            data.totalAsset =  Math.floor(Number(json["krw"].available) + Number(json["krw"].trade_in_use));
            data.size =  fixed4(Number(json["btc"].available) + Number(json["btc"].trade_in_use));
            var avail_btc = fixed4(Number(json["btc"].available));
            if(avail_btc > 0.0001){ //* data.ticker 
              data.isSide = "long"
            }else{
              data.isSide = "none"
            }
            cb(null, data);
          });
        },
        function ticker(data, cb){
          if(data.isSide === 'none'){
            return cb(null, data);
          }
  
          //현재가
          korbit.ticker("btc_krw", function(error, response, body){
            if(error){
              console.log("코빗 ticker 값 조회 error1 : " +error);
              return;
            }
            try{
              var json = JSON.parse(body);
            }catch(error){
                console.log("코빗 ticker 값 조회 error2 : " + error);
                return;
            }
            data.ticker = Number(json.last);
            data.value = Math.floor(data.size * data.ticker);
            cb(null, data);
          });
        },
        function trade_history(data, cb){
          if(data.isSide === 'none'){
            return cb(null,data);
          }
          
          //진입전자산, 진입가격
          order.find({site : data.site, type : "long"}).sort({end_time : "desc"}).exec(function(error, res){
            if(error){
                console.log(error);
                return;
            }
            if(res.length > 0){
                data.price = res[0].price;
                data.benefit = (data.value + data.totalAsset) - res[0].totalAsset; //탈출자산 - 진입자산
                data.benefitRate = (data.benefit / res[0].totalAsset) * 100;
            }else{
                data.benefit =0;
                data.benefitRate =0;
            }
            cb(null, data);
          });
        }
      ], function(error, data){
        if(error){
          console.log(error);
          return;
        }
        return cb(null, data);
      });
    }
  }