var async = require('async');
var crypto = require('crypto');
var request = require('request');
var express = require('express');
var router = express.Router();
var fs = require('fs');
var BithumAPI = require('../API/bithumbAPI');
var coinoneAPI = require('../API/coinoneAPI.js');
var upbitAPI = require('../API/upbitAPI.js');
var korbitAPI = require('../API/korbitAPI.js');
var script = require("../models/script");
var signal = require("../models/signal");
var setting = require("../models/setting");
var order = require("../models/order");
var orderDB2 = require('../models/order_avg');
var position = require("../models/position");

var webSetting = require("../webSetting");
var moment = require('moment');
var forever = require('forever');
var passport = require('passport');
const Users = require('../models/users');
var LocalStrategy = require('passport-local').Strategy;
passport.serializeUser(function (user, done) {
  done(null, user)
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

passport.use(new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password',
  passReqToCallback: true //인증을 수행하는 인증 함수로 HTTP request를 그대로  전달할지 여부를 결정한다
}, function (req, username, password, done) {
  Users.findOne({id : username}, function(error, res){
    if (error) return done(error); // 서버 에러 처리
    if (!res) return done(null, false, { message: '존재하지 않는 아이디입니다' }); // 임의 에러 처리
    if(username === res.id && password === res.pw){
      return done(null, {
        'user_id': res.id,
      });
    }else{
      return done(false, null)
    }
  });
}));

var isAuthenticated = function(req, res, next) {
  // console.log("isAuthenticated call!!!");
  // console.log(req);
  // console.log(req.isAuthenticated());
  if(req.isAuthenticated())
    return next();
  res.redirect('/login');
};

router.get('/login', function(req, res) {
  res.render('login');
});



router.post('/login', passport.authenticate('local', {failureRedirect: '/login', failureFlash: true}), // 인증 실패 시 401 리턴, {} -> 인증 스트레티지
  function (req, res) {
    res.redirect('/manage');
});

router.get('/logout', isAuthenticated, function (req, res) {
  req.logout();
  if(webSetting.redis_exec){
    req.session.destroy();
  }
  
  res.redirect('/login');
});




router.get('/changePW',isAuthenticated,  function(req, res) {
  res.render('changePW');
});


/* GET home page. */
router.get('/', isAuthenticated,  function(req, res){
  res.redirect('manage');
});

// router.get('/main',  function(req, res, next){
//   res.render('main', {user_info : req.user});
// });

router.get('/script', isAuthenticated,  function(req, res, next){
  res.render('script');
});

router.get('/script2', isAuthenticated,  function(req, res, next){
  console.log("scriptNo : "+ req.query.scriptNo);
  var scriptNo = Number(req.query.scriptNo);
  res.render('script2',{scriptNo : scriptNo});
});

router.post('/api/updateScript', isAuthenticated,  function(req, res, next){
  console.log('/api/updateScript');
  var data = new Object(req.body);
  var scriptNo = Number(req.body.scriptNo);
  var data = {
    long1 : create_array(req.body.long1),
    long2 : create_array(req.body.long2),
    long3 : create_array(req.body.long3),
    long4 : create_array(req.body.long4),
    long5 : create_array(req.body.long5),
    short1 : create_array(req.body.short1),
    short2 : create_array(req.body.short2),
    short3 : create_array(req.body.short3),
    short4 : create_array(req.body.short4),
    short5 : create_array(req.body.short5)
  }
  console.log(data);
  script.updateOne({scriptNo : scriptNo}, {$set : data}, function(error, bpdy){
    if(error){
      console.log(error);
      return;
    }
    res.send({});
  });

  function create_array(data){
    if(data === ""){
      return [];
    }

    var body = "["+data+"]";
    var json = JSON.parse(body);
    return json;
  }
});

router.get('/api/findOneScript', isAuthenticated,  function(req, res, next){
  var scriptNo = Number(req.query.scriptNo);
  script.find({scriptNo :  scriptNo}, function(error, json){
    if(error){
      console.log(error);
      return;
    }
    res.send(json[0]);
  });
});


router.get('/api/findScript', isAuthenticated,  function(req, res, next){
  script.find({}, function(error, json){
    if(error){
      console.log(error);
      return;
    }
    res.send(json);
  });
});

router.post('/api/insertScript', isAuthenticated,  function(req, res, next){
  console.log('/api/insertScript');
  var data = new Object(req.body);
  console.log(data);
  var obj = {
    scriptName  : req.body.scriptName,
    scriptNo  : Number(req.body.scriptNo),
    version : Number(req.body.version)
  }

  script.insertMany(obj, function(error, body){
    if(error){
      console.log(error);
      return;
    }
    console.log(body);
    res.send({});
  });
});

router.post('/api/removeScript', isAuthenticated,  function(req, res, next){
  var deleteArr = req.body.deleteArr; //start or stop
  var length = deleteArr.length;
  console.log(deleteArr)
  for(i=0; i<deleteArr.length; i++){
    script.findByIdAndDelete(deleteArr[i],function(error, json){
      if(error){
        console.log("error ㅏㄹ생:"+error);
        res.send({});
        return;
      }
      
    });
  }
  res.send({});
});

router.get('/positionAll', isAuthenticated,  function(req, res, next){
  res.render('positionAll');
});


router.get('/api/positionAll', isAuthenticated,  function(req, res){
  position.find({site_type : "oversee"}, function(error, json){
    if(error){
      console.log(error);
      res.send(error);
      return;
    }
    //console.log(json);
    res.send(json[0]);
  });
})

// router.get('/api/positionAll', isAuthenticated,  function(req, response, next){
//   var list = [];
//   var last_price = 0;
//     // console.log(res);
//     async.waterfall([
//       function readSetting(cb){
//         var set_list =[];
//         setting.find({execFlag : true},function(error,res){
//           if(error){
//             console.log(error);
//             return;
//           }
//           console.log("readSetting");
//           console.log(res);
        
//           for(i=0; i<res.length; i++){
//             if(res[i].site.indexOf('bitmex') !== -1){
//               set_list.push(res[i]);    
//             }
//           }
//           cb(null, set_list);
//         });
//       },
//       function ticker(set_list, cb){
        
//         if(set_list.length > 0){
          
//           var requestOptions = setRequestHeader(set_list[0].url, set_list[0].apiKey, set_list[0].secreteKey,'GET','trade','symbol=XBTUSD&count=1&reverse=true');
//           request(requestOptions, function(err,responsedata,body){
//             if(err){
//               console.log(err);
//             }
//             console.log("ticker");
//             console.log(body);
          
//             var obj = JSON.parse(body);
//             last_price = obj[0].price;
//             cb(null, set_list); 
//           })
//         }else{
//           cb(null, set_list);
//         }
//       },
//       function getPosition(set_list, cb){
//         for(i=0; i<set_list.length; i++){
//           setTimeout(getPosition_bitmex(set_list[i], function(error, data){
//             if(error){
//               console.log(error);
//               return;
//             }
//             console.log("getPosition");
//             console.log(data);
//             // console.log("data : ");
//             // console.log(data);

//             list.push(data);
//             if(set_list.length === list.length){

//               cb(null);
//             }
//           }), 0);
//         }
//       },
//       function readScriptInfo(cb){
//         if(list.length === 0){
//           return cb(null);
//         }

//         script.find({}, function(error, res){
//           if(error){
//             console.log(error);
//             return;
//           }

//           for(i=0; i<list.length; i++){
//             list[i].scriptName = "";
//             list[i].version = "";
//           }

//           for(i=0; i<list.length; i++){
//             for(j=0; j<res.length; j<j++){
//               if(list[i].scriptNo === res[j].scriptNo){
//                 list[i].scriptName = res[j].scriptName
//                 list[i].version = res[j].version;
//               }
//             }
//           }
//           cb(null);
//         })
//       }
//     ], function(error, results){
//       if(error){
//         console.log(error);
//       }
//       console.log("waterfall 결과");
//       console.log(list);
      
//       console.log('last_price : '+ last_price);
//       list.sort(function(a,b){ //수량을 오름차순 정렬(1,2,3..)
//         return a.site.split('bitmex')[1] - b.site.split('bitmex')[1];
//       });
//       response.send({last_price : last_price, list : list});
//     });
// });

router.get('/positionAll_internal', isAuthenticated,  function(req, res, next){
  res.render('positionAll_internal');
});
router.get('/api/positionAll_internal', isAuthenticated,  function(req, res, next){
  position.find({site_type : "korean"}, function(error, json){
    if(error){
      console.log(error);
      res.send(error);
      return;
    }
    console.log(json);
    res.send(json[0]);
  });

})

// router.get('/api/positionAll_internal', isAuthenticated,  function(req, response, next){
//   var list = [];
//   var last_price = 0;

//   //실제로 동작중인 국내거래소 셋팅값을 가져와라
//   setting.find({execFlag : true, site_type : "korean"},function(error, set_list){
//     if(error){
//       console.log(error);
//       return;
//     }
//     console.log(set_list);
//     var list=[];
//     if(set_list.length ===0){
//       response.send({last_price :0, list : list});
//       return;
//     }
//     console.log(set_list.length);
//     //빗썸 셋팅값이 1개 이상이면 갯수만큼 포지션 정보 생성
//     for(i=0; i<set_list.length; i++){
//       console.log("positionAll_internal");
//       setTimeout(getPosition_korea(set_list[i], function(error, data){
//         if(error){
//           console.log(error);
//           return;
//         }
//         list.push(data);
//         console.log(data);
//         if(list.length === set_list.length){
//           //스크립트 이름 넣기
//           readScriptInfo(list, function(error, new_list){
//             if(error){
//               console.log(error);
//               return;
//             }
//             //abcd 순 정렬
//             new_list.sort(ascending);
//             response.send({last_price : list[0].ticker, list : list});
//           });
//         }
//       }), 0);
//     }
//   });
// });

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

function getPosition_bitmex(set, cb){
  return function(){
    var requestOptions = setRequestHeader(set.url, set.apiKey, set.secreteKey,'GET','position','');
    request(requestOptions, function(err,responsedata,body){
      if(err){
        console.log(err);
      }
      console.log("getPosition_bitmex");
      console.log(body);
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
              //res.send(error);
              return;
          }
          var json = JSON.parse(body);
          data.walletBalance = json.walletBalance / 100000000;
          
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

function fixed4(num){
  if(Number(num) < 0.0001){
    return 0;
  }
  
  var str = new String(num);
  var arr = str.split(".");
  var str2 = arr[1].slice(0,4);
  return Number(arr[0] + '.' + str2);
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

router.get('/manage', isAuthenticated,  function(req, res, next){
  var options = {
    url : webSetting.url+"/api/manage",
    method : "GET",
  }
  request(options, function(err,responsedata,body){
    if(err){
      console.log(err);
    }
    console.log("api/manage 호출");
    console.log(body);
    console.log(typeof(body));
    console.log( JSON.parse(body));
    var json = JSON.parse(body);
    res.render('manage', json);
  });
});


router.get('/api/manage',  function(req, res, next){

  var status = {
    isMargin : {execBot : "unchecked", exec_bitmex : "unchecked", exec_bithumb : "unchecked", exec_coinone : "unchecked", exec_upbit : "unchecked" }
  }
  
  var botArr = new Array(); // isBot1 isBot2 isDefBot isAutoCancleBot
  
  botArr.push({botName : "marginTrade.js"});
  
  setting.find({}, function(error, json){
    if(error){
      console.log(error);
      return;
    }
    console.log(json);
    for(i=0; i<json.length; i++){
      var flag = "unchecked";
      (json[i].execFlag === true)? flag = "checked" : flag = "unchecked"
      status["isMargin"]["exec_"+json[i].site] = flag;


      var flag2 = "unchecked";
      (json[i].isTrailingStop === true)? flag2 = "checked" : flag2 = "unchecked"
      status["isMargin"]["execTrail_"+json[i].site] = flag2;
    }
  
    forever.list(false, function(err,processes){
      if(err){
          console.log("err : "+err);
          res.render('financialTradeSet',status);
      }
      else if(processes){
        console.log(processes);
        //실행중인 봇 체크 
        for(i=0; i<botArr.length; i++){
          for(j=0; j<processes.length; j++){
            if(processes[j].file.indexOf(botArr[i].botName) !== -1){
              botArr[i].isExec = "checked"; 
            }
          }
        }
        console.log("botArr : " + JSON.stringify(botArr));
      }
      
      status["isMargin"]["execBot"] = botArr[0].isExec;
  
      //console.log("status2 호출 : " + JSON.stringify(status));
      res.send(status);
    });
  });
});

// router.get('/api/manage',  function(req, res, next){


//   var date = new Date();
//   console.log("[" + date.toISOString() + "] : " + req.body);
//   var status = [];

//   var botArr = new Array(); // isBot1 isBot2 isDefBot isAutoCancleBot

//   botArr.push({botName : "marginTrade.js"});
  
//   setting.find({}, function(error, json){
//     if(error){
//       console.log(error);
//       return;
//     }
//     // console.log(json);
//     for(i=0; i<json.length; i++){
//       var flag = "unchecked";
//       (json[i].execFlag === true)? flag = "checked" : flag = "unchecked"
//       status.push({ id : json[i].site+"_execFlag", flag : flag});
//     }

//     forever.list(false, function(err,processes){
//       if(err){
//           console.log("err : "+err);
//           //res.render('financialTradeSet',status);
//       }
//       else if(processes){
//         console.log(processes);
//         //실행중인 봇 체크 
//         for(i=0; i<botArr.length; i++){
//           for(j=0; j<processes.length; j++){
//             if(processes[j].file.indexOf(botArr[i].botName) !== -1){
//               botArr[i].isExec = "checked"; 
//             }
//           }
//         }
//         console.log("botArr : " + JSON.stringify(botArr));
//       }
      
//       status.push({id : "marginTrade", flag : botArr[0].isExec});
      
//       //console.log("status2 호출 : " + JSON.stringify(status));
//       res.send(status);
//     });
//   });
// });




// router.get('/manage',  function(req, res, next){
//   var date = new Date();
//   console.log("[" + date.toISOString() + "] : " + req.body);
//   var status = {
//     isMargin : {marginTrade : "unchecked", bithumb_execFlag : "unchecked", coinone_execFlag : "unchecked", upbit_execFlag : "unchecked" }
//   }

//   var botArr = new Array(); // isBot1 isBot2 isDefBot isAutoCancleBot

//   botArr.push({botName : "marginTrade.js"});
  
//   setting.find({}, function(error, json){
//     if(error){
//       console.log(error);
//       return;
//     }
//     console.log(json);
//     for(i=0; i<json.length; i++){
//       var flag = "unchecked";
//       (json[i].execFlag === true)? flag = "checked" : flag = "unchecked"
//       status["isMargin"][json[i].site+"_execFlag"] = flag;
//     }

//     forever.list(false, function(err,processes){
//       if(err){
//           console.log("err : "+err);
//           //res.render('financialTradeSet',status);
//       }
//       else if(processes){
//         console.log(processes);
//         //실행중인 봇 체크 
//         for(i=0; i<botArr.length; i++){
//           for(j=0; j<processes.length; j++){
//             if(processes[j].file.indexOf(botArr[i].botName) !== -1){
//               botArr[i].isExec = "checked"; 
//             }
//           }
//         }
//         console.log("botArr : " + JSON.stringify(botArr));
//       }
      
//       status["isMargin"]["marginTrade"] = botArr[0].isExec;
      
//       console.log("status2 호출 : " + JSON.stringify(status));
//       res.render('manage',status);
//     });
//   });
// });


router.post('/api/marginTrade', function(req,res){
  var sigData = {
    scriptNo : Number(req.body.scriptNo),
    side : req.body.side,
    side_num : Number(req.body.side_num),
    log : req.body.log,
    timestamp : new Date().getTime() + (1000 * 60 * 60 * 9)
  }
  signal.insertMany(sigData, function(error, data){
    if(error){
      console.log(error);
      res.send(error);
      return;
    }
    console.log(data);
    res.send({});
  });
});


router.post('/api/manual_order',isAuthenticated, function(req,res){
  var sigData ={
    site :  req.body.site,
    scriptNo : Number(req.body.scriptNo),
    side : req.body.side,
    side_num : Number(req.body.side_num),
    type_log : req.body.type_log,
    timestamp : new Date().getTime() + (1000 * 60 * 60 * 9)
  }
  
  console.log(sigData);
  signal.insertMany(sigData, function(error, data){
    if(error){
      console.log(error);
      res.send(error);
      return;
    }
    console.log(data);
    res.send({msg : '신호생성완료'});
  });
});

router.get('/setting',  isAuthenticated, function(req,res){
  var site = req.query.site;
  setting.findOne({site : site},function(error, json){
    if(error){
      res.render('setting',error);
      return;
    }
    console.log(json);
    res.render('setting',json);
  })
});



router.get('/setting',  isAuthenticated, function(req,res){
  var site = req.query.site;
  setting.findOne({site : site},function(error, json){
    if(error){
      res.render('setting',error);
      return;
    }
    console.log(json);
    res.render('setting',json);
  });
});



router.get('/api/read_setting',  isAuthenticated, function(req,res){
  var site = req.query.site;
  setting.findOne({site : site},function(error, json){
    if(error){
      res.render('setting',error);
      return;
    }
    console.log(json);
    res.send(json);
  });
});



router.post('/api/setting',  isAuthenticated,  function(req,res){
  var json = new Object(req.body);

  var obj ={
    url : json.url,
    apiKey : json.apiKey,
    secreteKey : json.secreteKey,
    scriptNo : Number(json.scriptNo),
    leverage : Number(json.leverage),
    margin : Number(json.margin),
    minOrdCost : Number(json.minOrdCost),
    ordInterval : Number(json.ordInterval),
    minOrdRate : Number(json.minOrdRate),
    maxOrdRate : Number(json.maxOrdRate),
    // isTrailingStop : ((json.isTrailingStop === "true")? true : false),
    // trailingHighRate : Number(json.trailingHighRate),
    // trailingLowRate : Number(json.trailingLowRate),
    // trailFeeRate : Number(json.trailFeeRate),
    // entryPrice : Number(json.entryPrice),
    // highPrice : Number(json.highPrice),
    // lowPrice : Number(json.lowPrice)
  }
  // console.log("/api/setting");
  // console.log(json.isTrailingStop);
  // console.log(Boolean(json.isTrailingStop));
  // console.log(obj);
  setting.updateOne({site : json.site},{$set : obj}, function(error,body){
    if(error){
      console.log(error);
      return;
    }
    res.send({"msg" : "설정업데이트 성공"});
  });
});


router.get('/setting_status',  isAuthenticated, function(req,res){
  var site = req.query.site;
  setting.findOne({site : site},function(error, json){
    if(error){
      res.render('setting',error);
      return;
    }
    
    res.render('setting_status',json);
  })
});

router.post('/api/setting_status',  isAuthenticated,  function(req,res){
  var json = new Object(req.body);
  console.log(json);
  var obj = {
    side : json.side,
    side_num : Number(json.side_num)
  }
  setting.updateOne({site : json.site},{$set : obj}, function(error,body){
    if(error){
      console.log(error);
      return;
    }
    console.log(body);
    res.send({"msg" : "설정업데이트 성공"});
  });
});


router.get('/setting_trailing',  isAuthenticated, function(req,res){
  var site = req.query.site;
  setting.findOne({site : site},function(error, json){
    if(error){
      res.render('setting',error);
      return;
    }
    
    res.render('setting_trailing',json);
  })
});

router.post('/api/setting_trailing',  isAuthenticated,  function(req,res){
  var json = new Object(req.body);
  
  var obj = {
    trailingHighRate : Number(json.trailingHighRate),
    trailingLowRate : Number(json.trailingLowRate),
    trailFeeRate : Number(json.trailFeeRate),
    entryPrice : Number(json.entryPrice),
    highPrice : Number(json.highPrice),
    lowPrice : Number(json.lowPrice)
  }
  console.log(obj);
  setting.updateOne({site : json.site},{$set : obj}, function(error,body){
    if(error){
      console.log(error);
      return;
    }
    console.log(body);
    res.send({"msg" : "설정업데이트 성공"});
  });
});

router.post('/api/botOnOff', isAuthenticated,  function(req,res){
    //var botName = "/home/gmc/GMC_DefenceBot/" + req.body.id + ".js"; //봇이름
    var botPath = webSetting.botPath;
    var botName = botPath + req.body.id + ".js"; //봇이름
    var logFile = req.body.id + ".log." + moment().format("YYYY-MM-DD"); //로그 파일 이름
    var flag = req.body.flag; //start or stop
    console.log("botName : "+botName);
    console.log("logFile : "+ logFile);
    console.log("flag : "+flag);
    if(flag === "start"){ //봇시작
      console.log("봇시작");
      var options = {logFile : logFile, max: 3, silent: false, args: []};
      
      forever.startDaemon(botName, options);
      res.send({msg : "start : " + botName, success : true, err : "", });
      
    }else if("stop"){ //봇중지
      console.log("봇중지");
      forever.list(false, function(err, processes){
        if(err){
            console.log("err : "+err);
            res.send({msg : "stop", success : false, err : err});
            return;
        }
        if(processes){
            for(i=0; i<processes.length; i++){
              console.log("processes[i].file : " + processes[i].file);
              if(processes[i].file.indexOf(botName) !== -1){ 
                var runner = forever.stop(processes[i].pid, true);
                runner.on('stop', function (process) {
                    forever.log.info('Forever stopped process:' + '\n' + process);
                });
                        
                runner.on('error', function(err) {
                    forever.log.error('Forever cannot find process with id: ' + err);
                    //process.exit(1);
                });
              }
            }
        }
        res.send({msg : "stop : " + botName, success : true, err : ""});
      });
    }
});


router.post('/api/siteOnOff', isAuthenticated, function(req,res){
  var site = req.body.site;
  var execFlag = Boolean(Number(req.body.execFlag));
  console.log("site : " + site);
  console.log("execFlag : " + execFlag);

  setting.updateOne({site : site},{$set : {execFlag : execFlag}},function(error, body){
    if(error){
      console.log(error);
      return;
    }
    res.send({});
  });
});


router.post('/api/trailingOnOff', isAuthenticated, function(req,res){
  var site = req.body.site;
  var isTrailingStop = Boolean(Number(req.body.isTrailingStop));
  console.log("site : " + site);
  console.log("isTrailingStop : " + isTrailingStop);

  setting.updateOne({site : site},{$set : {isTrailingStop : isTrailingStop}},function(error, body){
    if(error){
      console.log(error);
      return;
    }
    res.send({});
  });
});

router.get('/log',  isAuthenticated, function(req, res){
  var site = req.query.site;
  res.render('log',{site : site});
});

router.get('/api/log',  isAuthenticated,  function(req,res){
  var logDate = req.query.logDate;
  var site = req.query.site;
  var logFileName = "./log/"+site +".log." + logDate;  
  console.log("logFileName : "+logFileName);
  try {
    if (fs.existsSync(logFileName)) {
      //file exists
      fs.readFile(logFileName, (err, data) => {  
        if (err) throw err;
        var obj = {title : "<h2>"+site+ " 로그" + "</h2>", log : String(data).replace(/\n/g, "<br />"), existedLog : true, err : "" }
        res.send(obj);
      });
    }else{
      var obj = {existedLog : false, title : "", log : "", err : "파일이 존재하지 않습니다"}  
      res.send(obj);
    }
  }catch(err){
    var obj = {existedLog : false, title : "", log : "", err : "파일이 존재하지 않습니다"}
    res.send(obj);
  }
});

router.get('/orderHistory',  function(req, res){
  var site = req.query.site;
  res.render('orderHistory',{site : site});
});

router.get('/api/orderHistory',  isAuthenticated, function(req, res){
  console.log("/api/orderHistory 실행");
  var site = req.query.site;
  var logDate = req.query.logDate;
  if(logDate === undefined){
    logDate = new Date().toISOString().slice(0,10);
  }
  order.find({site : site, "start_time" : {"$gte": new Date(logDate+"T00:00:00.000Z"),"$lte": new Date(logDate+"T23:59:59.000Z")}}).sort({start_time : "desc"}).exec(function(error, result){
    if(error){
      console.log(error);
      res.send(error);
    }
    console.log(result);
    res.send(result);
  });
});

router.get('/orderHistoryTotal',  isAuthenticated,  function(req, res){
  var site = req.query.site;
  res.render('orderHistoryTotal',{site : site});
});


router.get('/api/orderHistoryTotal',  isAuthenticated, function(req, res){
  console.log("/api/orderHistoryTotal 실행");
  var site = req.query.site; //.skip(0).limit(20)
  order.find({site : site}).sort({start_time : "desc"}).exec(function(error, result){
    if(error){
      console.log(error);
      res.send(error);
    }
    console.log(result);
    res.send(result);
  });
});


router.get('/avg_order_history',  isAuthenticated,  function(req, res){
  var site_type = req.query.site_type;
  res.render('avg_order_history',{site_type : site_type});
});

router.get('/api/avg_order_history',  isAuthenticated, function(req, res){
  console.log("/api/avg_order_history 실행");
  var site_type = req.query.site_type;
  console.log('site_type : '+ site_type);
  orderDB2.find({site_type : site_type}).sort({start_time : "desc"}).exec(function(error, result){
    if(error){
      console.log(error);
      res.send(error);
    }
    console.log(result);
    res.send(result);
  });
});


 module.exports = router;
