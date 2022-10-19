var async = require('async');
var path_module = require('path');
var mime = require('mime');
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
var order_unfilled = require("../models/order_unfilled");
var orderDB2 = require('../models/order_avg');
var position = require("../models/position");
var position2 = require("../models/position2");
var margin = require("../models/margin");
var ticker = require("../models/ticker");
var bid_1h = require("../models/bid_1h");
var benefitDB = require("../models/benefit");
var json2xls = require('json2xls');
var webSetting = require("../webSetting");
var numeral = require('numeral');
var moment = require('moment');
var forever = require('forever');
var passport = require('passport');
const Users = require('../models/users');
const { Console } = require('console');
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
    res.redirect('/positionAll');//
});

router.get('/logout', isAuthenticated, function (req, res) {
  req.logout();
  if(webSetting.redis_exec){
    req.session.destroy();
  }
  
  res.redirect('/login');
});

router.get('/changePW', isAuthenticated,  function(req, res) {
  res.render('changePW');
});


/* GET home page. */
router.get('/', isAuthenticated,  function(req, res){
  res.redirect('positionAll');//manage
});

// router.get('/main',  function(req, res, next){
//   res.render('main', {user_info : req.user});
// });

// table
router.get('/positionAll_2',   function(req, res, next){
  res.render('positionAll_2');
});

router.get('/positionAll_internal_2',   function(req, res, next){
  res.render('positionAll_internal_2');
});

router.get('/orderHistoryTotal_2',  isAuthenticated,  function(req, res){
  var site = req.query.site;
  res.render('orderHistoryTotal_2',{site : site});
});

router.get('/avg_order_history_table', isAuthenticated, function(req, res, next){
  var site_type = req.query.site_type;
  res.render('avg_order_history_table',{site_type : site_type});
});


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
  //console.log(data);
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
  //console.log('/api/insertScript');
  var data = new Object(req.body);
  //console.log(data);
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
    //console.log(body);
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
  var list = [];
  var last_price = 0;
  var totalBenefit =0;
  var totalBenefitRate =0;
  var choi_list = [];
// console.log(res);
  async.waterfall([
  function readSetting(cb){
    var set_list =[];
    setting.find({execFlag : true},function(error,res){
      if(error){
        console.log(error);
        return;
      }
    
      for(i=0; i<res.length; i++){
        if(res[i].site.indexOf('bitmex') !== -1){
          set_list.push(res[i]);    
        }
      }
      choi_list = set_list;
      cb(null, set_list);
    });
  },

  function get_start_asset(set_list, cb){

    for(i=0; i<set_list.length; i++){
        order.find({site : set_list[i].site}).sort({start_time : "asc"}).exec(function(error, json){
            for(j=0; j<json.length; j++){
                totalBenefit = (totalBenefit + json[j].benefit);
                totalBenefitRate = (totalBenefitRate + json[j].benefitRate);
            }
            });
    }
    cb(null, set_list);
  },


  function get_last_price(set_list, cb){
    
    if(set_list.length > 0){
      ticker.findOne({site : "bitmex"}, function(error, json){
          if(error){
              console.log(error);
              return;
          }
          last_price = json.last_price;
          cb(null, set_list); 
      });
    }else{
      cb(null, set_list);
    }
  },
  function getPosition(set_list, cb){
    //console.log(set_list)
    for(i=0; i<set_list.length; i++){
      setTimeout(getPosition_bitmex(set_list[i], function(error, data){
        if(error){
          console.log(error);
          return;
        }
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
        //console.log("waterfall 결과");
        //console.log(list);
      
      //console.log('last_price : '+ last_price);
      list.sort(function(a,b){ //수량을 오름차순 정렬(1,2,3..)
          return a.site.split('bitmex')[1] - b.site.split('bitmex')[1];
      });
      //console.log({site_type : "oversee", last_price : last_price, list : list});
      var data = {site_type : "oversee", last_price : last_price, list : list, totalBenefit : totalBenefit, totalBenefitRate : totalBenefitRate};
      //console.log(data);
      res.send(data);
  });
})

function getPosition_bitmex(set, callback){
  return function(){
      var data = {};
      async.waterfall([
        function get_position(cb){
          position2.findOne({site : set.site}, function(error, obj){
            if(error){
                console.log(err);
                return;
            }
            // console.log("getPosition_bitmex");
            // console.log(body);
            //var obj = JSON.parse(body)
            
            //console.log(obj);
            data["site"] = obj.site;
            data["avgEntryPrice"] = obj.avgEntryPrice;
            data["isOpen"] = obj.isOpen;
            data["realisedPnl"] = obj.realisedPnl;
            data["unrealisedPnl"] = obj.unrealisedPnl;
            data["unrealisedRoePcnt"] = obj.unrealisedRoePcnt;
            
            data["size"] = obj.size;
            data["value"] = obj.value;
            
            data["leverage"] = set.leverage;
            data["margin"] = set.margin;
            // data["leverage_real"] = obj.leverage;
            // data["margin_real"] = obj.margin;
            data["scriptNo"] = set.scriptNo;
            data["side_num"] = set.side_num;
            data["pgSide"] = set.side;
            data["pgSide2"] = set.side2;
            data["isTrailingStop"] = (set.isTrailingStop === true)? "checked" : "unchecked";
            data["trailPrice1"] = set.trailPrice1;
            data["trailPrice2"] = set.trailPrice2;
            data["rentryPrice1"] = set.rentryPrice1;
            data["rentryPrice2"] = set.rentryPrice2;
            cb(null);
          });
        },
        function get_margin(cb){
          margin.findOne({site : set.site},function(error, json){
            if(error){
                console.log(err);
                return;
            }
            data["walletBalance"] = json.walletBalance;
            data["marginLeverage"] = json.marginLeverage;
            data["marginUsedPcnt"] = json.marginUsedPcnt;
            cb(null);
          });
        },
        function get_firt_asset(cb){
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
            cb(null);
          });
        },
        function get_unfilled_order_cnt(cb){ //미체결내역 갯수
          order_unfilled.find({site : set.site}).count().exec(function(error, cnt){
            if(error){
              console.log(error);
              return;
            }
            if(cnt > 0){
              data["isUnfilled"] = true;
            }else{
              data["isUnfilled"] = false;
            }
            cb(null);
          })
        }
      ], function(error, results){
        if(error){
          console.log(error);
          return;
        }
        callback(null, data);
      });
      // position2.findOne({site : set.site}, function(error, obj){
      //     if(error){
      //         console.log(err);
      //         return;
      //     }
      //     // console.log("getPosition_bitmex");
      //     // console.log(body);
      //     //var obj = JSON.parse(body)
      //     var data = {};
      //     data["site"] = obj.site;
      //     data["avgEntryPrice"] = obj.avgEntryPrice;
      //     data["isOpen"] = obj.isOpen;
      //     data["realisedPnl"] = obj.realisedPnl;
      //     data["unrealisedPnl"] = obj.unrealisedPnl;
      //     data["unrealisedRoePcnt"] = obj.unrealisedRoePcnt;
          
      //     data["size"] = obj.size;
      //     data["value"] = obj.value;

      //     data["leverage"] = set.leverage;
      //     data["margin"] = set.margin;
      //     // data["leverage_real"] = obj.leverage;
      //     // data["margin_real"] = obj.margin;
      //     data["scriptNo"] = set.scriptNo;
      //     data["side_num"] = set.side_num;
      //     data["pgSide"] = set.side;
          
      //     //setTimeout(correct_wrong_pgside(data.size,  data["pgSide"], new Object(set) ),0);
          
      //     margin.findOne({site : set.site},function(error, json){
      //         if(error){
      //             console.log(err);
      //             return;
      //         }
      //         data["walletBalance"] = json.walletBalance;
      //         data["marginLeverage"] = json.marginLeverage;
      //         data["marginUsedPcnt"] = json.marginUsedPcnt;

      //         //최초자산 조회
      //         order.find({site : set.site}).sort({start_time : "asc"}).limit(1).exec(function(error, body){
      //             if(error){
      //                 console.log(error);
                      
      //                 return;
      //             }
      //             // console.log(body);
      //             if(body.length > 0){
      //                 //console.log("")
      //                 data["walletBalance_before"] = body[0].totalAsset;
      //             }else{
      //                 data["walletBalance_before"] = data.walletBalance;
      //             }
      //             cb(null, data);
      //         });
      //     });
          
      // });
  }
}


// router.get('/api/positionAll', isAuthenticated,  function(req, res){
//   position.find({site_type : "oversee"}, function(error, json){
//     if(error){
//       console.log(error);
//       res.send(error);
//       return;
//     }
//     //console.log(json);
//     res.send(json[0]);
//   });
// })

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
    //console.log(json);
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

// function getPosition_bitmex(set, cb){
//   return function(){
//     var requestOptions = setRequestHeader(set.url, set.apiKey, set.secreteKey,'GET','position','');
//     request(requestOptions, function(err,responsedata,body){
//       if(err){
//         console.log(err);
//       }
//       console.log("getPosition_bitmex");
//       console.log(body);
//       var obj = JSON.parse(body);
//       var data = bitmex_position_notSearch(set);
      
//       if(obj.length === 0){
//         // data["leverage"] = set.leverage;
//         // data["margin"] = set.margin;
//         // data["scriptNo"] = set.scriptNo;
//         return cb(null, data);
//       }
//       for(var i=0; i<obj.length; i++){
//         if(obj[i].symbol === 'XBTUSD'){
//           data = bitmex_position_parse(set.site, obj[i]);
//           data["leverage"] = set.leverage;
//           data["margin"] = set.margin;
//           data["scriptNo"] = set.scriptNo;
//           data["side_num"] = set.side_num;
//         }
//       }

//       var requestOptions = setRequestHeader(set.url, set.apiKey, set.secreteKey, 'GET','user/margin','currency=XBt');
//       request(requestOptions, function(error, response, body){
//           if(error){
//               console.log(error);
//               //res.send(error);
//               return;
//           }
//           var json = JSON.parse(body);
//           data.walletBalance = json.walletBalance / 100000000;
          
//           //최초자산 조회
//           order.find({site : set.site}).sort({start_time : "asc"}).limit(1).exec(function(error, body){
//             if(error){
//               console.log(error);
//               //res.send(error);
//               return;
//             }
//             console.log(body);
//             if(body.length > 0){
//               console.log("")
//               data["walletBalance_before"] = body[0].totalAsset;
//             }else{
//               data["walletBalance_before"] = data.walletBalance;
//             }
//             cb(null, data);
//           });
          
//       });
//     })
//   }
// }

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
// function setRequestHeader(url, apiKey, apiSecret, verb, endpoint, data){
//   path = '/api/v1/'+ endpoint;
//   expires = new Date().getTime() + (60 * 1000); // 1 min in the future
//   var requestOptions;
//   if(verb === 'POST' || verb === 'PUT'){
//       var postBody = JSON.stringify(data);
//       var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
//       var headers = {
//           'content-type' : 'application/json',
//           'Accept': 'application/json',
//           'X-Requested-With': 'XMLHttpRequest',
//           'api-expires': expires,
//           'api-key': apiKey,
//           'api-signature': signature
//       };
//       requestOptions = {
//           headers: headers,
//           url: url+path,
//           method: verb,
//           body: postBody
//       };
//   }else{ //'GET'
//       var query = '?'+ data;
//       var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + query + expires).digest('hex');
//       var headers = {
//         'content-type' : 'application/json',
//         'Accept': 'application/json',
//         'X-Requested-With': 'XMLHttpRequest',
//         'api-expires': expires,
//         'api-key': apiKey,
//         'api-signature': signature
//       };
//       requestOptions = {
//           headers: headers,
//           url: url+path + query,
//           method: verb
//       };
//   }
//   return requestOptions;
// }


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
    //console.log("api/manage 호출");
    // console.log(body);
    // console.log(typeof(body));
    // console.log( JSON.parse(body));
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
    //console.log(json);
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
        //console.log(processes);
        //실행중인 봇 체크 
        for(i=0; i<botArr.length; i++){
          for(j=0; j<processes.length; j++){
            if(processes[j].file.indexOf(botArr[i].botName) !== -1){
              botArr[i].isExec = "checked"; 
            }
          }
        }
        //console.log("botArr : " + JSON.stringify(botArr));
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
    type_log : req.body.type_log, //div || trailingStop || rentry
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
    //console.log(json);
    res.render('setting',json);
  })
});


router.get('/api/read_setting',  isAuthenticated, function(req,res){
  var site = req.query.site;
  setting.findOne({site : site},function(error, json){
    if(error){
      res.render('setting',error);
      return;
    }
    //console.log(json);
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
    side2 : json.side2,
    side_num : Number(json.side_num)
  }
  setting.updateOne({site : json.site},{$set : obj}, function(error,body){
    if(error){
      console.log(error);
      return;
    }
    //console.log(body);
    res.send({"msg" : "설정업데이트 성공"});
  });
});


router.get('/setting_trailing',  isAuthenticated, function(req,res){
  console.log("/setting_trailing 호출");
    var site = req.query.site;
    res.render('setting_trailing',{site : site});
});

router.get('/api/setting_trailing',  isAuthenticated, function(req,res){
  console.log("/setting_trailing 호출");
  var site = req.query.site;
  var obj={}
  setting.findOne({site : site},function(error, json){
    if(error){
      res.render('setting_trailing',error);
      return;
    }
    //console.log(json);
    obj["site"] = json.site;
    obj["trailingHighRate"] = json.trailingHighRate;
    obj["trailingLowRate"] = json.trailingLowRate;
    obj["trailFeeRate"] = json.trailFeeRate;
    obj["rentryFeeRate"] = json.rentryFeeRate;
    obj["pgSide"] = json.side;
    obj["pgSide2"] = json.side2;
    obj["entryPrice"] = json.entryPrice;
    obj["highPrice"] = json.highPrice;
    obj["lowPrice"] = json.lowPrice;

    if(json.site === 'bithumb' || json.site === 'coinone' || json.site === 'upbit' || json.site === 'korbit'){
      obj["isSide"] = null;
      res.send(obj);
      return;
    }

    position2.findOne({site : json.site}, function(error, data){
      if(error){
        res.render('setting_trailing',error);
        return;
      }
      obj["isSide"] = isPosition(data.size);
      // for(var i=0; i<data.list.length; i++){
      //   if(data.list[i].site === site){
      //     obj.isSide = isPosition(data.list[i].size);
      //     console.log("isSide : "+isPosition(data.list[i].size) );
      //   }
      // }
      // console.log("obj.isSide : "+ obj.isSide);
      // console.log(obj);
      res.send(obj);
    });
  })
});
function isPosition(size){
  if(size > 0){
      return "long"
  }else if(size < 0){
      return "short";
  }else{
      return "exit";
  }
}
router.post('/api/setting_trailing',  isAuthenticated,  function(req,res){
  var json = new Object(req.body);
  
  var obj = {
    trailingHighRate : Number(json.trailingHighRate),
    trailingLowRate : Number(json.trailingLowRate),
    trailFeeRate : Number(json.trailFeeRate),
    rentryFeeRate : Number(json.rentryFeeRate),
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


router.get('/api/orderHistoryTotal', isAuthenticated, function(req, res){
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


router.get('/benefit_history', isAuthenticated, function(req, res){
  res.render('benefit_history');
});


router.get('/api/benefit_history', isAuthenticated, function(req, res){
  benefitDB.find({}).sort({start_time : "desc"}).exec(function(error, json){
    if(error){
      console.log(error);
      return;
    }
    console.log(json);
    res.send(json);
  });
});

router.get('/benefit_history_page', isAuthenticated, function(req, res){
  res.render('benefit_history_page');
});


router.get('/api/benefit_history_page', isAuthenticated, function(req, res){
  var page = Number(req.query.page) ; //현재 페이지 번호
  var cntPerPage = Number(req.query.cntPerPage); //페이지당 문서 갯수
  //var pageCnt = Number(req.query.pageCnt); //화면에 표시할 페이지 갯수
  var total_cnt=0; //글 총갯수
  var totalPageSize =0; //총 페이지 갯수
  var start_page_num =0; //시작 페이지
  var end_page_num =0; //마지막 페이지
  var isPrev = false;
  var isNext = false;
  var prev_page_num =0;
  var next_page_num =0;

  // total_cnt / cntPerPage
  var start_asset_sum =0;
  var end_asset_sum =0;
  var totalBenefit =0;
  var totalBenefitRate =0;
  var data = [];
  //총 페이지 사이즈 = ( 글 갯수 - 1 / w_size ) + 1
  // totalPageSize = total_cnt / cntPerPage;
  // start_page_num = page -1 / totalPageSize * totalPageSize + 1
  // end_page_num = start_page_num -1 / totalPageSize - 1
  //시작번호 = ( (페이지 번호 -1) / 총 페이지 사이즈 ) * 총 페이지 사이즈 + 1
  //마지막번호 = 시작 페이지 번호 + 페이지 총 사이즈 -1
  async.waterfall([
    function get_end_asset(cb){
      benefitDB.findOne({}).sort({start_time : "desc"}).limit(1).exec(function(error, json){
        if(error){
          console.log(error);
          res.send(error);
        }
        if(json === null){
          res.send([]);
          return;
        }
        start_asset_sum = json.start_asset_sum;
        end_asset_sum = json.after_asset_sum;
        totalBenefit = (end_asset_sum - start_asset_sum)
        totalBenefitRate = ((totalBenefit/start_asset_sum) *100);
        cb(null);
      });
    },
    function get_trade_list(cb){
      benefitDB.find({}).sort({start_time : "desc"}).skip( (page-1) * cntPerPage).limit(cntPerPage).exec(function(error, result){
        if(error){
          console.log(error);
          res.send(error);
        }
        //console.log(result);
        data = new Object(result);
        cb(null);
      });
    },
    function get_total_order_cnt(cb){
      benefitDB.find({}).count(function(error, count){
        total_cnt = count;

        totalPageSize = Math.ceil(total_cnt / cntPerPage);  //총 페이지 사이즈 = (글 갯수 - 1 / w_size ) + 1
       
        if(totalPageSize < page){
            page = totalPageSize;
        }
        start_page_num =  (Math.floor((page-1) / 10) * 10) + 1 //시작번호 = ( (페이지 번호 -1) / 총 페이지 사이즈 ) * 총 페이지 사이즈 + 1
        end_page_num = start_page_num + 10 - 1 //마지막번호 = 시작 페이지 번호 + 페이지 총 사이즈 -1
        //start_page_num = start_page_num - (end_page_num - start_page_num) +1
        if (end_page_num > totalPageSize) {
          end_page_num = totalPageSize;
        }
        
        //이전페이지 활성화
        if(start_page_num.toString().length >= 2){
          isPrev=true;
          prev_page_num = start_page_num-1; //이전페이지 번호
        }

        //다음페이지 활성화
        if(end_page_num < totalPageSize){
          isNext = true;
          next_page_num = end_page_num+1; //다음 페이지 번호
        }

        cb(null);
      });
    },
  ], function(error, results){
    if(error){
      console.log(error);
      res.send(error);
    }
    console.log("page : "+ page);
    console.log("total_cnt : "+ total_cnt);
    console.log("cntPerPage : "+ cntPerPage);
    console.log("totalPageSize : "+ totalPageSize);
    console.log("start_page_num : "+ start_page_num);
    console.log("end_page_num : "+ end_page_num);
    console.log("start_asset_sum : "+start_asset_sum);
    console.log("end_asset_sum : "+end_asset_sum);
    console.log("totalBenefit : "+totalBenefit);
    console.log("totalBenefitRate : "+totalBenefitRate);
    var obj = {
      idx : (page -1) * cntPerPage,
      page : page, //현재 페이지
      cntPerPage : cntPerPage, //페이지당 문서 갯수
      totalPageSize : totalPageSize, //페이지 총 갯수
      start_page_num : start_page_num, //시작페이지
      end_page_num : end_page_num, //마지막페이지
      isPrev : isPrev,
      isNext : isNext,
      prev_page_num : prev_page_num, //이전페이지
      next_page_num : next_page_num, //다음 페이지
      start_asset_sum : start_asset_sum, //시작자산
      end_asset_sum : end_asset_sum, //종료자산
      totalBenefit : totalBenefit, //수익
      totalBenefitRate :  totalBenefitRate, //수익율
      list : data //주문목록
    }
    res.send(obj);
  });
});


router.get('/api/check_restore_progress',isAuthenticated, function(req, res){
  benefitDB.count({}, function(error, cnt){
    if(error){
      console.log(error);
      return;
    }
    res.send({cnt : cnt});
  })
});

router.get('/api/check_calc_progress',isAuthenticated, function(req, res){
  benefitDB.count({end_asset_sum : 0, before_asset_sum : 0, after_asset_sum : 0}, function(error, cnt){
    if(error){
      console.log(error);
      return;
    }
    res.send({cnt : cnt});
  })
});

router.post('/api/benefit_history_restore',isAuthenticated, function(req, res){
  console.log("restore");
  var restore_goal_cnt=0;
  async.waterfall([
    function remove(cb){
      benefitDB.remove({}, function(error, json){
        if(error){
          console.log(error);
          return;
        }
        console.log(json);
        cb(null);
      });
    },
    function restore(cb){
      order.find({site : {$regex : "bitmex"}, type : "exit"}).sort({start_time : "asc"}).exec(function(error, json){
        if(error){
            console.log(error);
            return;
        }
    
        console.log("count : "+ json.length);
        restore_goal_cnt = json.length;
        console.log(json[0]);
        console.log(json[1]);
        console.log(json[2]);
        console.log(json[3]);
        console.log(json[4]);
        for(var i=0; i<json.length; i++){
            
            var site = json[i].site;
            var start_time = json[i].start_time;
            var end_time = json[i].end_time;
            var benefit = json[i].benefit;
            var type_log = json[i].type_log;
            //console.log(i);
            if(i===0){
                console.log(i);
                console.log("first_restore_benefit_history");
                setTimeout(first_restore_benefit_history(site, start_time, end_time, benefit, type_log), i * 100);
            }else{
                console.log("restore_benefit_history");
                setTimeout(restore_benefit_history(site, start_time, end_time, benefit, type_log), i *100);
            }
        }
        cb(null);
      });
    }
  ], function(error, json){
    res.send({restore_goal_cnt : restore_goal_cnt});
  });
});

function restore_benefit_history(site, start_time, end_time, benefit, type_log){
  return function(){
      // console.log(start_time);
      // console.log(end_time);
      var start_asset_sum = 0;
      var end_asset_sum = 0;
      async.waterfall([
          //첫 자산들 총합
          function get_start_asset_sum(cb){
              //최초 한번만 실행
              get_restore_total_asset("asc",function(error, asset){
                  if(error){
                      console.log(error);
                      return;
                  }
                  // console.log("start_asset : "+asset);
                  start_asset_sum = asset;
                  cb(null);
              });
          },
          function restore(cb){
              var obj = {
                  site : site,
                  start_asset_sum : fixed8(start_asset_sum), 
                  benefit : fixed8(benefit),
                  type_log : type_log,
                  timestamp : end_time,
                  start_time : start_time,
                  end_time : end_time,
              }
              
              benefitDB.insertMany(obj, function(error, json){
                  if(error){
                      return;
                  }
                  console.log(json);
                  cb(null);
              })
          }
      ], function(error, results){
        
      })
  }
}

function first_restore_benefit_history(site, start_time, end_time, benefit, type_log){
  return function(){
      // console.log(start_time);
      // console.log(end_time);
      var start_asset_sum = 0;
      var end_asset_sum = 0;
      async.waterfall([
          //첫 자산들 총합
          function get_start_asset_sum(cb){
              //최초 한번만 실행
              get_restore_total_asset("asc",function(error, asset){
                  if(error){
                      console.log(error);
                      return;
                  }
                  // console.log("start_asset : "+asset);
                  start_asset_sum = asset;
                  end_asset_sum = asset;
                  cb(null);
              });
          }, 
          // function get_end_asset_sum(cb){ //탈출전 자산 합
          //     //최초 한번만 실행
          //     get_restore_total_asset( "desc",function(error, asset){
          //         if(error){
          //             console.log(error);
          //             return;
          //         }
          //         // console.log("end_asset : "+asset);

          //         end_asset_sum = asset;
          //         cb(null);
          //     });
          // },
          function restore(cb){
              var obj = {
                  site : site,
                  start_asset_sum : fixed8(start_asset_sum),
                  end_asset_sum : fixed8(end_asset_sum),
                  before_asset_sum : fixed8(end_asset_sum),  //최근 자산들 총합(탈출전)
                  after_asset_sum : fixed8(end_asset_sum + benefit),//최근 자산들 총합(탈출후)
                  benefit : fixed8(benefit),
                  benefitRate : (benefit / end_asset_sum) * 100,
                  type_log : type_log,
                  timestamp : end_time,
                  start_time : start_time,
                  end_time : end_time,
              }
              console.log(obj);
              benefitDB.insertMany(obj, function(error, json){
                  if(error){
                      return;
                  }
                  console.log(json);
                  cb(null);
              })
          }
          
      ], function(error, results){

      })
  }
}

function get_restore_total_asset(isSort, callback){
  var list = [];
  var total_asset=0;
  for(var i=1; i<=10; i++){
    order.findOne({"site" : "bitmex"+i}).sort({"start_time" : isSort}).limit(1).exec(function(error, json){
      if(error){
        console.log(error);
        return;
      }
      
      list.push(json);
      if(json !== null){
        total_asset += json.totalAsset;
      }
      
      if(list.length === 10){
          // console.log("totalAsset : "+ total_asset);
          // console.log(list);
          
          callback(null, total_asset);
      }
    });
  }
}


function get_total_asset(timestamp, isSort, callback){
  var list = [];
  var total_asset=0;
  for(var i=1; i<=10; i++){
    order.findOne({"site" : "bitmex"+i, "start_time" : {"$lt" : timestamp}}).sort({"start_time" : isSort}).limit(1).exec(function(error, json){
      if(error){
        console.log(error);
        return;
      }
      
      list.push(json);
      if(json !== null){
        total_asset += json.totalAsset;
      }
      
      if(list.length === 10){
          // console.log("totalAsset : "+ total_asset);
          // console.log(list);
          
          callback(null, total_asset);
      }
    });
  }
}

function fixed8(num){
  var str = new String(num);
  var arr = str.split(".");
  if(arr.length>1){
        var str2 = arr[1].slice(0,8);
      return Number(arr[0] + '.' + str2);	
  }
  return Number(arr[0])
}

router.post('/api/benefit_history_calc',isAuthenticated, function(req, res){
  //console.log("/api/benefit_history_calc");
  filled_data = {};
  var calc_goal_cnt =0;
  var end_asset_sum = 0;
  var before_asset_sum = 0;
  //var after_asset_sum = 0;

  async.waterfall([
      function init(cb){
          //end_asset_sum : {$gt : 0}
          //체결된 주문중 가장 최근 주문 1개
          benefitDB.find({end_asset_sum : {$gt : 0}}).sort({"start_time" : "desc"}).limit(1).exec(function(error, json){
              if(error){
                  console.log(error);
                  return;
              }
              console.log("초기화");
              console.log(json);
              if(json.length > 0){
                console.log("초기화O");
                  filled_data=new Object(json[0]);
                  end_asset_sum = filled_data.after_asset_sum;
                  before_asset_sum = filled_data.after_asset_sum;
                  cb(null);
              }else{
                console.log("초기화X");
                  return;
              }
          });
      },
      function calc(cb){
          //수익율 계산안된 모든 목록들 수익율 계산
          benefitDB.find({end_asset_sum : 0, before_asset_sum : 0, after_asset_sum : 0}).sort({"start_time" : "asc"}).exec(function(error, json){
              if(error){
                  console.log(error);
                  return;
              }
              console.log("calc");
              calc_goal_cnt = json.length;
              for(var i=0; i<json.length; i++){
                  var obj  = {
                      end_asset_sum : fixed8(end_asset_sum),
                      before_asset_sum : fixed8(before_asset_sum),
                      after_asset_sum : fixed8(before_asset_sum + json[i].benefit),
                      benefitRate : (json[i].benefit / end_asset_sum) * 100,
                  }
                  console.log(obj);
                  setTimeout(update_benefit_rate(json[i]._id, obj), i *100);//

                  // benefitDB.findByIdAndUpdate(
                  //     json[i]._id,
                  //     {$set : obj},
                  //     function(error, res){
                  //         if(error){
                  //             console.log(error);
                  //             return;
                  //         }
                  //     }
                  // )
                  end_asset_sum = obj.after_asset_sum;
                  before_asset_sum = obj.after_asset_sum;
              }
              cb(null);
          });
      }
  ], function(error, results){
      if(error){
          console.log(error);
          return;
      }
      res.send({calc_goal_cnt : calc_goal_cnt});
      //console.log(res);
  });
});

function update_benefit_rate(_id, obj){
  return function(){
    benefitDB.findByIdAndUpdate(
      _id,
      {$set : obj},
      function(error, res){
          if(error){
              console.log(error);
              return;
          }
          console.log(res);
      }
    ) 
  }
}



function calc_benefit_rate(){
  return function(){
      filled_data = {};
      var end_asset_sum = 0;
      var before_asset_sum = 0;
      //var after_asset_sum = 0;
      async.waterfall([
          function init(cb){
              //체결된 주문중 가장 최근 주문 1개
              benefitDB.find({end_asset_sum : {$gt : 0}}).sort({"start_time" : "desc"}).limit(1).exec(function(error, json){
                  if(error){
                      console.log(error);
                      return;
                  }
                  console.log(json);
                  if(json.length > 0){
                      filled_data=new Object(json[0]);
                      end_asset_sum = filled_data.after_asset_sum;
                      before_asset_sum = filled_data.after_asset_sum;
                      cb(null);
                  }else{
                      return;
                  }
                 
              });
          },
          function calc(cb){
              //수익율 계산안된 모든 목록들 수익율 계산
              benefitDB.find({end_asset_sum : 0, before_asset_sum : 0, after_asset_sum : 0}).sort({"start_time" : "asc"}).exec(function(error, json){
                  if(error){
                      console.log(error);
                      return;
                  }

                  for(var i=0; i<json.length; i++){
                      var obj  = {
                          end_asset_sum : fixed8(end_asset_sum),
                          before_asset_sum : fixed8(before_asset_sum),
                          after_asset_sum : fixed8(before_asset_sum + json[i].benefit),
                          benefitRate : (json[i].benefit / end_asset_sum) * 100,
                      }
                      console.log(obj);
                      benefitDB.findByIdAndUpdate(
                          json[i]._id,
                          {$set : obj},
                          function(error, res){
                              if(error){
                                  console.log(error);
                                  return;
                              }
                          }
                      )
                      end_asset_sum = obj.after_asset_sum;
                      before_asset_sum = obj.after_asset_sum;
                  }
                  cb(null);
              });
          }
      ], function(error, res){
          if(error){
              console.log(error);
              return;
          }
          console.log(res);
      });
  }
}

router.post('/api/benefit_history_update',isAuthenticated, function(req, res){
  var _id = req.body._id;
  var start_time = new Date(req.body.start_time);
  var benefit = Number(req.body.benefit);
  var end_asset_sum = 0;
  var before_asset_sum = 0;
  async.waterfall([
    function benefit_update(cb){
      benefitDB.findByIdAndUpdate(_id, {$set : {benefit :  benefit}}, function(error, json){
        if(error){
          console.log(error);
          return;
        }
        console.log("수익율 업데이트");
        console.log(json);
        cb(null);
      });
    },
    function refesh_benefit_his(cb){
      benefitDB.find({start_time : {$gte : start_time}}).sort({start_time : "asc"}).exec(function(error, json){
        if(error){
          console.log(error);
          return;
        }
    
        for(var i=0; i<json.length; i++){
          if(i === 0){
            before_asset_sum = json[0].before_asset_sum;
            //after_asset_sum = json[0].before_asset_sum + json[0].benefit;
          }

          var obj = {
            end_asset_sum : before_asset_sum,
            before_asset_sum : before_asset_sum,
            after_asset_sum : (before_asset_sum + json[i].benefit),
            benefitRate : (((before_asset_sum + json[i].benefit) - before_asset_sum) / before_asset_sum) * 100
          }

          //console.log(obj);
          benefitDB.findByIdAndUpdate(
              json[i]._id,
              {$set : obj},
              function(error, res){
                if(error){
                    console.log(error);
                    return;
                }
                console.log(res);

              }
          )
          // end_asset_sum = obj.after_asset_sum;
          before_asset_sum = obj.after_asset_sum;
        }
        cb(null);
      });
    }
  ], function(error, json){
    if(error){
      console.log(error);
      return;
    }
    res.send({});
  });
});

router.get('/benefit_history_update',isAuthenticated, function(req, res){
  // console.log(req.body);
  // res.send({});
  benefitDB.findById(req.query._id, function(error, json){
    if(error){
      console.log(error);
      return;
    }
    console.log(json);
    res.render("benefit_history_update",json);
  });
});


router.post('/api/benefit_history_delete', isAuthenticated, function(req, res){
  var deleteArr = req.body.deleteArr; //start or stop
  console.log("deleteArr : "+req.body.obj);
  console.log("deleteArr : "+req.body.deleteArr);
  console.log("length : " + deleteArr.length);
  console.log("typeof : " + typeof(deleteArr));
  var length = deleteArr.length;
  var checkArr = [];
  for(i=0; i<deleteArr.length; i++){
    benefitDB.findByIdAndDelete(deleteArr[i],function(error, json){
      if(error){
        console.log(error);
        return;
      }
      console.log(json);
      checkArr.push(json);
      if(checkArr.length === length){
        res.send({});
      }
    });
  }
});

// router.get('/api/benefit_history', isAuthenticated, function(req, res){
//   console.log("/api/benefit_history 실행");
//   var list = []  
//   for(var i=1; i<=10; i++){
//     get_benefit_history("bitmex"+i, function(error, data){
//       if(error){
//         console.log(error);
//         return;
//       }

//       list.push(data);
      
//       if(list.length === 10){
        
//         list.sort(function(a,b){ //시간순 내림차순 정렬(1,2,3..)
//           return b.timestamp - a.timestamp;
//         });
        
//         var before_end_asset_total=0;
//         var end_asset_total=0;
//         for(i in list){
//           if(list[i].start_asset !== 0){
//             end_asset_total += list[i].end_asset;
//           }
//         }

//         before_end_asset_total = end_asset_total;
//         for(i in list){
//           if(list[i].start_asset !== 0){
//             before_end_asset_total = before_end_asset_total - list[i].benefit;
//             list[i].benefitRate = (list[i].benefit / before_end_asset_total) * 100;//fixed4
//           }
//         }
        
//         //console.log(list);
//         list.sort(function(a,b){ //수량을 오름차순 정렬(1,2,3..)
//           return a.site.split('bitmex')[1] - b.site.split('bitmex')[1];
//         });
        
//         res.send(list);
//       }
//     });
//   }
// });

function get_benefit_history(site, callback){
  
    var data = {
      site : site,
      start_asset : 0,
      end_asset : 0,
      benefit : 0,
      benefitRate : 0,
      type : "",
      type_log : "",
      timestamp : -1,
    }

    async.waterfall([
      function get_start_asset(cb){
        order.findOne({site : site}).sort({start_time : "asc"}).limit(1).exec(function(error, json){
          if(error){
            console.log(error);
            res.send(error);
          }

          if(json=== null){
            return cb(null);
          }
          
          data.start_asset = json.totalAsset;
          cb(null);
        });
      },
      function get_end_asset(cb){
        order.findOne({site : site}).sort({start_time : "desc"}).limit(1).exec(function(error, json){
          if(error){
            console.log(error);
            res.send(error);
          }

          if(json=== null){
            return cb(null);
          }
  
          data.end_asset = json.totalAsset;
          cb(null);
        });
      },
      function get_last_exit_history(cb){
        order.findOne({site : site, type : "exit"}).sort({start_time : "desc"}).limit(1).exec(function(error, json){
          if(error){
            console.log(error);
            res.send(error);
          }
  
          if(json=== null){
            return cb(null);
          }
          
          data.type = json.type;
          data.type_log = json.type_log;
          data.benefit = json.benefit;
          data.benefitRate = json.benefitRate;
          data.timestamp = json.end_time;
          cb(null);
        });
      }
    ], function(error, results){
      if(error){
        console.log(error);
        res.send(error);
      }
      //console.log(data);
      callback(null, data);
    });
  
}



router.get('/choi2',  isAuthenticated,  function(req, res){
    var site = req.query.site;
    res.render('choi2',{site : site});
  });
  router.get('/choi_total',  isAuthenticated,  function(req, res){
    var site = req.query.site;
    res.render('choi_total',{site : site});
  });


  router.get('/api/choi_total',  isAuthenticated, function(req, res){
    console.log("/api/choi_total 실행");
    var site = req.query.site; //.skip(0).limit(20)
    if(site==null){
      site='';
    }
    var site1 = req.query.site1; //.skip(0).limit(20)
    if(site1==null){
      site1='';
    }
    var site2 = req.query.site2; //.skip(0).limit(20)
    if(site2==null){
      site2='';
    }
    var site3 = req.query.site3; //.skip(0).limit(20)
    if(site3==null){
      site3='';
    }
    var site4 = req.query.site4; //.skip(0).limit(20)
    if(site4==null){
      site4='';
    }
    var site5 = req.query.site5; //.skip(0).limit(20)
    if(site5==null){
      site5='';
    }
    var site6 = req.query.site6; //.skip(0).limit(20)
    if(site6==null){
      site6='';
    }
    var site7 = req.query.site7; //.skip(0).limit(20)
    if(site7==null){
      site7='';
    }
    var site8 = req.query.site8; //.skip(0).limit(20)
    if(site8==null){
      site8='';
    }
    var site9 = req.query.site9; //.skip(0).limit(20)
    if(site9==null){
      site9='';
    }

    var page = Number(req.query.page) ; //현재 페이지 번호
    var cntPerPage = Number(req.query.cntPerPage); //페이지당 문서 갯수
    //var pageCnt = Number(req.query.pageCnt); //화면에 표시할 페이지 갯수
    var total_cnt=0; //글 총갯수
    var totalPageSize =0; //총 페이지 갯수
    var start_page_num =0; //시작 페이지
    var end_page_num =0; //마지막 페이지
    var isPrev = false;
    var isNext = false;
    var prev_page_num =0;
    var next_page_num =0;
  
    // total_cnt / cntPerPage
    var start_asset =0;
    var end_asset =0;
    var totalBenefit =0;
    var totalBenefitRate =0;
    var data = [];
    //총 페이지 사이즈 = ( 글 갯수 - 1 / w_size ) + 1
    // totalPageSize = total_cnt / cntPerPage;
    // start_page_num = page -1 / totalPageSize * totalPageSize + 1
    // end_page_num = start_page_num -1 / totalPageSize - 1
    //시작번호 = ( (페이지 번호 -1) / 총 페이지 사이즈 ) * 총 페이지 사이즈 + 1
    //마지막번호 = 시작 페이지 번호 + 페이지 총 사이즈 -1
    //
    async.waterfall([
      
      function get_start_asset(cb){
        order.findOne(  {$or:[{"site":site},{"site":site1},{"site":site2},{"site":site3},{"site":site4},{"site":site5},{"site":site6},{"site":site7},{"site":site8},{"site":site9}] }).sort({start_time : "asc"}).limit(1).exec(function(error, json){
          if(error){
            console.log(error);
            res.send(error);
          }
          start_asset = json.totalAsset;
          cb(null);
        });
      },
      function get_end_asset(cb){
        
          order.find({$or:[{"site":site},{"site":site1},{"site":site2},{"site":site3},{"site":site4},{"site":site5},{"site":site6},{"site":site7},{"site":site8},{"site":site9}] }).sort({start_time : "asc"}).exec(function(error, json){
              if(error){
                console.log(error);
                res.send(error);
              }
              // end_asset = json.totalAsset;
              for(i=0; i<json.length; i++){
                  totalBenefit = (totalBenefit + json[i].benefit)
                  totalBenefitRate = (totalBenefitRate + json[i].benefitRate);
              }
          cb(null);
        });
      },
      function get_trade_list(cb){

        order.find(  {$or:[{"site":site},{"site":site1},{"site":site2},{"site":site3},{"site":site4},{"site":site5},{"site":site6},{"site":site7},{"site":site8},{"site":site9}] } ).sort({site:'desc',start_time : "desc"}).limit(1000).exec(function(error, result){
          if(error){
            console.log(error);
            res.send(error);
          }
          data = new Object(result);
          cb(null);
        });
      },
      function get_total_order_cnt(cb){
        order.find({$or:[{"site":site},{"site":site1},{"site":site2},{"site":site3},{"site":site4},{"site":site5},{"site":site6},{"site":site7},{"site":site8},{"site":site9}] }).count(function(error, count){
          total_cnt = count;
          //total_cnt / cntPerPage / page;
          // console.log("total_cnt : " + total_cnt);
          // console.log("cntPerPage : " + cntPerPage);
          // totalPageSize = Math.ceil(total_cnt / cntPerPage) -1;  //총 페이지 사이즈 = (글 갯수 - 1 / w_size ) + 1
          // if(totalPageSize % cntPerPage > 0){
          //   totalPageSize = totalPageSize+1;
          // }
          totalPageSize = Math.ceil(total_cnt / cntPerPage);  //총 페이지 사이즈 = (글 갯수 - 1 / w_size ) + 1
          
          if(totalPageSize < page){
            page = totalPageSize;
          }
  
          start_page_num = (Math.floor((page-1) / 10) * 10) + 1 //시작번호 = ( (페이지 번호 -1) / 총 페이지 사이즈 ) * 총 페이지 사이즈 + 1
          end_page_num = start_page_num + 10 - 1 //마지막번호 = 시작 페이지 번호 + 페이지 총 사이즈 -1
          //start_page_num = start_page_num - (end_page_num - start_page_num) +1
          if(end_page_num > totalPageSize){
            end_page_num = totalPageSize;
          }
          
          //이전페이지 활성화
          if(start_page_num.toString().length >= 2){
            isPrev=true;
            prev_page_num = start_page_num-1; //이전페이지 번호
          }
  
          //다음페이지 활성화
          if(end_page_num < totalPageSize){
            isNext = true;
            next_page_num = end_page_num+1; //다음 페이지 번호
          }
          cb(null);
        });
      },
    ], function(error, results){
      if(error){
        console.log(error);
        res.send(error);
      }
      // console.log("page : "+ page);
      // console.log("total_cnt : "+ total_cnt);
      // console.log("cntPerPage : "+ cntPerPage);
      // console.log("totalPageSize : "+ totalPageSize);
      // console.log("start_page_num : "+ start_page_num);
      // console.log("end_page_num : "+ end_page_num);
      // console.log("start_asset : "+start_asset);
      // console.log("end_asset : "+end_asset);
      // console.log("totalBenefit : "+totalBenefit);
      // console.log("totalBenefitRate : "+totalBenefitRate);
      
      var obj = {
        idx : (page -1) * cntPerPage,
        page : page, //현재 페이지
        cntPerPage : cntPerPage, //페이지당 문서 갯수
        totalPageSize : totalPageSize, //페이지 총 갯수
        start_page_num : start_page_num, //시작페이지
        end_page_num : end_page_num, //마지막페이지
        isPrev : isPrev,
        isNext : isNext,
        prev_page_num : prev_page_num, //이전페이지
        next_page_num : next_page_num, //다음 페이지
        start_asset : start_asset, //시작자산
        end_asset : end_asset, //종료자산
        totalBenefit : totalBenefit, //수익
        totalBenefitRate :  totalBenefitRate, //수익율
        list : data //주문목록
      }
      res.send(obj);
    });
  });






  router.get('/choi/api/bot',  isAuthenticated,  function(req, res){
    var list = [];
    var last_price = 0;
    var totalBenefit =0;
    var totalBenefitRate =0;
    var choi_list = [];
  // console.log(res);
    async.waterfall([
    function readSetting(cb){
      var set_list =[];
      setting.find({execFlag : true},function(error,res){
        if(error){
          console.log(error);
          return;
        }
      
        for(i=0; i<res.length; i++){
          if(res[i].site.indexOf('bitmex') !== -1){
            set_list.push(res[i]);   
            choi_list.push(res[i]);  
          }
        }
      
        cb(null, set_list);
      });
    },
  ], function(error, results){
        if(error){
            console.log(error);
        }
        var data = { choi_list};
        //console.log(data);
        res.send(data);
    });
  });





router.get('/choi',  isAuthenticated,  function(req, res){
    var site = req.query.site;
    res.render('choi',{site : site});
  });

  router.get('/api/choi',  isAuthenticated, function(req, res){
    console.log("/api/choi 실행");
    var site = req.query.site; //.skip(0).limit(20)
    var page = Number(req.query.page) ; //현재 페이지 번호
    var cntPerPage = Number(req.query.cntPerPage); //페이지당 문서 갯수
    //var pageCnt = Number(req.query.pageCnt); //화면에 표시할 페이지 갯수
    var total_cnt=0; //글 총갯수
    var totalPageSize =0; //총 페이지 갯수
    var start_page_num =0; //시작 페이지
    var end_page_num =0; //마지막 페이지
    var isPrev = false;
    var isNext = false;
    var prev_page_num =0;
    var next_page_num =0;
  
    // total_cnt / cntPerPage
    var start_asset =0;
    var end_asset =0;
    var totalBenefit =0;
    var totalBenefitRate =0;
    var data = [];
    //총 페이지 사이즈 = ( 글 갯수 - 1 / w_size ) + 1
    // totalPageSize = total_cnt / cntPerPage;
    // start_page_num = page -1 / totalPageSize * totalPageSize + 1
    // end_page_num = start_page_num -1 / totalPageSize - 1
    //시작번호 = ( (페이지 번호 -1) / 총 페이지 사이즈 ) * 총 페이지 사이즈 + 1
    //마지막번호 = 시작 페이지 번호 + 페이지 총 사이즈 -1
    //
    async.waterfall([
      
      function get_start_asset(cb){
        order.findOne({site : site}).sort({start_time : "asc"}).limit(1).exec(function(error, json){
          if(error){
            console.log(error);
            res.send(error);
          }
          start_asset = json.totalAsset;
          cb(null);
        });
      },
      function get_end_asset(cb){
        
          order.find({site : site}).sort({start_time : "asc"}).exec(function(error, json){
              if(error){
                console.log(error);
                res.send(error);
              }
              // end_asset = json.totalAsset;
              for(i=0; i<json.length; i++){
                  totalBenefit = (totalBenefit + json[i].benefit)
                  totalBenefitRate = (totalBenefitRate + json[i].benefitRate);
              }
          cb(null);
        });
      },
      function get_trade_list(cb){
        order.find({site : site}).sort({start_time : "desc"}).limit(1000).exec(function(error, result){
          if(error){
            console.log(error);
            res.send(error);
          }
          // var aasda = Number(result[0].benefit).toFixed(8)
  
          // aasda = aasda.toFixed(8)
          // console.log('teststs : ', aasda);
          // result.benefit = result.benefit.toFixed(8);
          //console.log(result);
          data = new Object(result);
          cb(null);
        });
      },
      function get_total_order_cnt(cb){
        order.find({site : site}).count(function(error, count){
          total_cnt = count;
          //total_cnt / cntPerPage / page;
          // console.log("total_cnt : " + total_cnt);
          // console.log("cntPerPage : " + cntPerPage);
          // totalPageSize = Math.ceil(total_cnt / cntPerPage) -1;  //총 페이지 사이즈 = (글 갯수 - 1 / w_size ) + 1
          // if(totalPageSize % cntPerPage > 0){
          //   totalPageSize = totalPageSize+1;
          // }
          totalPageSize = Math.ceil(total_cnt / cntPerPage);  //총 페이지 사이즈 = (글 갯수 - 1 / w_size ) + 1
          
          if(totalPageSize < page){
            page = totalPageSize;
          }
  
          start_page_num = (Math.floor((page-1) / 10) * 10) + 1 //시작번호 = ( (페이지 번호 -1) / 총 페이지 사이즈 ) * 총 페이지 사이즈 + 1
          end_page_num = start_page_num + 10 - 1 //마지막번호 = 시작 페이지 번호 + 페이지 총 사이즈 -1
          //start_page_num = start_page_num - (end_page_num - start_page_num) +1
          if(end_page_num > totalPageSize){
            end_page_num = totalPageSize;
          }
          
          //이전페이지 활성화
          if(start_page_num.toString().length >= 2){
            isPrev=true;
            prev_page_num = start_page_num-1; //이전페이지 번호
          }
  
          //다음페이지 활성화
          if(end_page_num < totalPageSize){
            isNext = true;
            next_page_num = end_page_num+1; //다음 페이지 번호
          }
          cb(null);
        });
      },
    ], function(error, results){
      if(error){
        console.log(error);
        res.send(error);
      }
      // console.log("page : "+ page);
      // console.log("total_cnt : "+ total_cnt);
      // console.log("cntPerPage : "+ cntPerPage);
      // console.log("totalPageSize : "+ totalPageSize);
      // console.log("start_page_num : "+ start_page_num);
      // console.log("end_page_num : "+ end_page_num);
      // console.log("start_asset : "+start_asset);
      // console.log("end_asset : "+end_asset);
      // console.log("totalBenefit : "+totalBenefit);
      // console.log("totalBenefitRate : "+totalBenefitRate);
      
      var obj = {
        idx : (page -1) * cntPerPage,
        page : page, //현재 페이지
        cntPerPage : cntPerPage, //페이지당 문서 갯수
        totalPageSize : totalPageSize, //페이지 총 갯수
        start_page_num : start_page_num, //시작페이지
        end_page_num : end_page_num, //마지막페이지
        isPrev : isPrev,
        isNext : isNext,
        prev_page_num : prev_page_num, //이전페이지
        next_page_num : next_page_num, //다음 페이지
        start_asset : start_asset, //시작자산
        end_asset : end_asset, //종료자산
        totalBenefit : totalBenefit, //수익
        totalBenefitRate :  totalBenefitRate, //수익율
        list : data //주문목록
      }
      res.send(obj);
    });
  });

  router.get('/api/choi2',  isAuthenticated, function(req, res){
    console.log("/api/choi2 실행");
    var site = req.query.site; //.skip(0).limit(20)
    var page = Number(req.query.page) ; //현재 페이지 번호
    var cntPerPage = Number(req.query.cntPerPage); //페이지당 문서 갯수
    //var pageCnt = Number(req.query.pageCnt); //화면에 표시할 페이지 갯수
    var total_cnt=0; //글 총갯수
    var totalPageSize =0; //총 페이지 갯수
    var start_page_num =0; //시작 페이지
    var end_page_num =0; //마지막 페이지
    var isPrev = false;
    var isNext = false;
    var prev_page_num =0;
    var next_page_num =0;
  
    // total_cnt / cntPerPage
    var start_asset =0;
    var end_asset =0;
    var totalBenefit =0;
    var totalBenefitRate =0;
    var data = [];
    //총 페이지 사이즈 = ( 글 갯수 - 1 / w_size ) + 1
    // totalPageSize = total_cnt / cntPerPage;
    // start_page_num = page -1 / totalPageSize * totalPageSize + 1
    // end_page_num = start_page_num -1 / totalPageSize - 1
    //시작번호 = ( (페이지 번호 -1) / 총 페이지 사이즈 ) * 총 페이지 사이즈 + 1
    //마지막번호 = 시작 페이지 번호 + 페이지 총 사이즈 -1
    //
    async.waterfall([
      
      function get_start_asset(cb){
        order.findOne({site : site}).sort({start_time : "asc"}).limit(1).exec(function(error, json){
          if(error){
            console.log(error);
            res.send(error);
          }
          start_asset = json.totalAsset;
          cb(null);
        });
      },
      function get_end_asset(cb){
        
          order.find({site : site}).sort({start_time : "asc"}).exec(function(error, json){
              if(error){
                console.log(error);
                res.send(error);
              }
              // end_asset = json.totalAsset;
              for(i=0; i<json.length; i++){
                  totalBenefit = (totalBenefit + json[i].benefit)
                  totalBenefitRate = (totalBenefitRate + json[i].benefitRate);
              }
          cb(null);
        });
      },
      function get_trade_list(cb){

        order.find({ $or: [ { site: "bitmex1" }, { site: "bitmex"},{ site: "bitmex2"},{ site: ""} ] }).sort({site:'desc',start_time : "desc"}).limit(1000).exec(function(error, result){
          if(error){
            console.log(error);
            res.send(error);
          }
          data = new Object(result);
          cb(null);
        });
      },
      function get_total_order_cnt(cb){
        order.find({ $or: [ { site: "bitmex1" }, { site: "bitmex"},{ site: "bitmex2"},{ site: ""} ] }).count(function(error, count){
          total_cnt = count;
          //total_cnt / cntPerPage / page;
          // console.log("total_cnt : " + total_cnt);
          // console.log("cntPerPage : " + cntPerPage);
          // totalPageSize = Math.ceil(total_cnt / cntPerPage) -1;  //총 페이지 사이즈 = (글 갯수 - 1 / w_size ) + 1
          // if(totalPageSize % cntPerPage > 0){
          //   totalPageSize = totalPageSize+1;
          // }
          totalPageSize = Math.ceil(total_cnt / cntPerPage);  //총 페이지 사이즈 = (글 갯수 - 1 / w_size ) + 1
          
          if(totalPageSize < page){
            page = totalPageSize;
          }
  
          start_page_num = (Math.floor((page-1) / 10) * 10) + 1 //시작번호 = ( (페이지 번호 -1) / 총 페이지 사이즈 ) * 총 페이지 사이즈 + 1
          end_page_num = start_page_num + 10 - 1 //마지막번호 = 시작 페이지 번호 + 페이지 총 사이즈 -1
          //start_page_num = start_page_num - (end_page_num - start_page_num) +1
          if(end_page_num > totalPageSize){
            end_page_num = totalPageSize;
          }
          
          //이전페이지 활성화
          if(start_page_num.toString().length >= 2){
            isPrev=true;
            prev_page_num = start_page_num-1; //이전페이지 번호
          }
  
          //다음페이지 활성화
          if(end_page_num < totalPageSize){
            isNext = true;
            next_page_num = end_page_num+1; //다음 페이지 번호
          }
          cb(null);
        });
      },
    ], function(error, results){
      if(error){
        console.log(error);
        res.send(error);
      }
      // console.log("page : "+ page);
      // console.log("total_cnt : "+ total_cnt);
      // console.log("cntPerPage : "+ cntPerPage);
      // console.log("totalPageSize : "+ totalPageSize);
      // console.log("start_page_num : "+ start_page_num);
      // console.log("end_page_num : "+ end_page_num);
      // console.log("start_asset : "+start_asset);
      // console.log("end_asset : "+end_asset);
      // console.log("totalBenefit : "+totalBenefit);
      // console.log("totalBenefitRate : "+totalBenefitRate);
      
      var obj = {
        idx : (page -1) * cntPerPage,
        page : page, //현재 페이지
        cntPerPage : cntPerPage, //페이지당 문서 갯수
        totalPageSize : totalPageSize, //페이지 총 갯수
        start_page_num : start_page_num, //시작페이지
        end_page_num : end_page_num, //마지막페이지
        isPrev : isPrev,
        isNext : isNext,
        prev_page_num : prev_page_num, //이전페이지
        next_page_num : next_page_num, //다음 페이지
        start_asset : start_asset, //시작자산
        end_asset : end_asset, //종료자산
        totalBenefit : totalBenefit, //수익
        totalBenefitRate :  totalBenefitRate, //수익율
        list : data //주문목록
      }
      res.send(obj);
    });
  });








router.get('/orderHistoryTotalPage',  isAuthenticated,  function(req, res){
  var site = req.query.site;
  res.render('orderHistoryTotalPage',{site : site});
});

router.get('/orderHistoryTotalPage',  isAuthenticated,  function(req, res){
    var site = req.query.site;
    res.render('orderHistoryTotalPage',{site : site});
  });



router.get('/api/orderHistoryTotalPage',  isAuthenticated, function(req, res){
  console.log("/api/orderHistoryTotalPage 실행");
  var site = req.query.site; //.skip(0).limit(20)
  var page = Number(req.query.page) ; //현재 페이지 번호
  var cntPerPage = Number(req.query.cntPerPage); //페이지당 문서 갯수
  //var pageCnt = Number(req.query.pageCnt); //화면에 표시할 페이지 갯수
  var total_cnt=0; //글 총갯수
  var totalPageSize =0; //총 페이지 갯수
  var start_page_num =0; //시작 페이지
  var end_page_num =0; //마지막 페이지
  var isPrev = false;
  var isNext = false;
  var prev_page_num =0;
  var next_page_num =0;

  // total_cnt / cntPerPage
  var start_asset =0;
  var end_asset =0;
  var totalBenefit =0;
  var totalBenefitRate =0;
  var data = [];
  //총 페이지 사이즈 = ( 글 갯수 - 1 / w_size ) + 1
  // totalPageSize = total_cnt / cntPerPage;
  // start_page_num = page -1 / totalPageSize * totalPageSize + 1
  // end_page_num = start_page_num -1 / totalPageSize - 1
  //시작번호 = ( (페이지 번호 -1) / 총 페이지 사이즈 ) * 총 페이지 사이즈 + 1
  //마지막번호 = 시작 페이지 번호 + 페이지 총 사이즈 -1
  //
  async.waterfall([
    
    function get_start_asset(cb){
      order.findOne({site : site}).sort({start_time : "asc"}).limit(1).exec(function(error, json){
        if(error){
          console.log(error);
          res.send(error);
        }
        start_asset = json.totalAsset;
        cb(null);
      });
    },
    function get_end_asset(cb){
      
        order.find({site : site}).sort({start_time : "asc"}).exec(function(error, json){
            if(error){
              console.log(error);
              res.send(error);
            }
            // end_asset = json.totalAsset;
            for(i=0; i<json.length; i++){
                totalBenefit = (totalBenefit + json[i].benefit)
                totalBenefitRate = (totalBenefitRate + json[i].benefitRate);
            }
        cb(null);
      });
    },
    function get_trade_list(cb){
      order.find({site : site}).sort({start_time : "desc"}).skip( (page-1) * cntPerPage).limit(cntPerPage).exec(function(error, result){
        if(error){
          console.log(error);
          res.send(error);
        }
        // var aasda = Number(result[0].benefit).toFixed(8)

        // aasda = aasda.toFixed(8)
        // console.log('teststs : ', aasda);
        // result.benefit = result.benefit.toFixed(8);
        //console.log(result);
        data = new Object(result);
        cb(null);
      });
    },
    function get_total_order_cnt(cb){
      order.find({site : site}).count(function(error, count){
        total_cnt = count;
        //total_cnt / cntPerPage / page;
        // console.log("total_cnt : " + total_cnt);
        // console.log("cntPerPage : " + cntPerPage);
        // totalPageSize = Math.ceil(total_cnt / cntPerPage) -1;  //총 페이지 사이즈 = (글 갯수 - 1 / w_size ) + 1
        // if(totalPageSize % cntPerPage > 0){
        //   totalPageSize = totalPageSize+1;
        // }
        totalPageSize = Math.ceil(total_cnt / cntPerPage);  //총 페이지 사이즈 = (글 갯수 - 1 / w_size ) + 1
        
        if(totalPageSize < page){
          page = totalPageSize;
        }

        start_page_num = (Math.floor((page-1) / 10) * 10) + 1 //시작번호 = ( (페이지 번호 -1) / 총 페이지 사이즈 ) * 총 페이지 사이즈 + 1
        end_page_num = start_page_num + 10 - 1 //마지막번호 = 시작 페이지 번호 + 페이지 총 사이즈 -1
        //start_page_num = start_page_num - (end_page_num - start_page_num) +1
        if(end_page_num > totalPageSize){
          end_page_num = totalPageSize;
        }
        
        //이전페이지 활성화
        if(start_page_num.toString().length >= 2){
          isPrev=true;
          prev_page_num = start_page_num-1; //이전페이지 번호
        }

        //다음페이지 활성화
        if(end_page_num < totalPageSize){
          isNext = true;
          next_page_num = end_page_num+1; //다음 페이지 번호
        }
        cb(null);
      });
    },
  ], function(error, results){
    if(error){
      console.log(error);
      res.send(error);
    }
    // console.log("page : "+ page);
    // console.log("total_cnt : "+ total_cnt);
    // console.log("cntPerPage : "+ cntPerPage);
    // console.log("totalPageSize : "+ totalPageSize);
    // console.log("start_page_num : "+ start_page_num);
    // console.log("end_page_num : "+ end_page_num);
    // console.log("start_asset : "+start_asset);
    // console.log("end_asset : "+end_asset);
    // console.log("totalBenefit : "+totalBenefit);
    // console.log("totalBenefitRate : "+totalBenefitRate);
    
    var obj = {
      idx : (page -1) * cntPerPage,
      page : page, //현재 페이지
      cntPerPage : cntPerPage, //페이지당 문서 갯수
      totalPageSize : totalPageSize, //페이지 총 갯수
      start_page_num : start_page_num, //시작페이지
      end_page_num : end_page_num, //마지막페이지
      isPrev : isPrev,
      isNext : isNext,
      prev_page_num : prev_page_num, //이전페이지
      next_page_num : next_page_num, //다음 페이지
      start_asset : start_asset, //시작자산
      end_asset : end_asset, //종료자산
      totalBenefit : totalBenefit, //수익
      totalBenefitRate :  totalBenefitRate, //수익율
      list : data //주문목록
    }
    res.send(obj);
  });
});

router.get('/order', isAuthenticated, function(req,res){
  var site = req.query.site;
  console.log("site : "+ site);
  res.render('order', {site : site});
});

router.post('/api/order', isAuthenticated, function(req,res){
  var site = req.body.site;
  var url = "";
  var apiKey = "";
  var secreteKey = "";
  var parentID = "";
  console.log("site : "+ site);
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
    function get_parent_order(cb){
      order.findOne({site : site}).sort({start_time : 'desc'}).limit(1).exec(function(error, json){
        if(error){
          console.log(error);
          return;
        }
        console.log(json._id);
        parentID = json._id;
        console.log(json);
        cb(null);
      });
    },
    function limit_order(cb){
      var obj = {
        symbol : req.body.symbol, 
        side : req.body.side, 
        price : req.body.price, 
        orderQty :  req.body.orderQty, 
        ordType : "Limit", 
        text : "limit order"
      }
      var requestHeader = setRequestHeader(url, apiKey, secreteKey, 'POST','order', obj);
      console.log('----------------------')
      console.log(requestHeader)

      request(requestHeader, function(error, response, body){
        if(error){
          res.send(error);
          return;
        }
        
        console.log(body);
        var json = JSON.parse(body);
        var data = {
          site : site,
          ordStatus : json.ordStatus, //New
          orderID : json.orderID,
          parentID : parentID,
          price : json.price,
          side : json.side,
          orderQty : json.orderQty,
          leavesQty : json.leavesQty,
          cumQty : json.cumQty,
          timestamp : new Date().getTime() + (1000 *60 * 60 * 9)
        }

        order_unfilled.insertMany(data, function(error, body){
          if(error){
            console.log(error);
            return;
          }
          console.log(body);
          cb(null);
        });
        
      });

   

    }
  ], function(error, results){
    if(error){
      console.log(error);
      return;
    }
    res.send({msg : "주문성공"});

  });
});

router.post('/api/orderCancel', isAuthenticated, function(req,res){
  var site = req.body.site;
  var orderID = req.body.orderID;
  var url, apiKey, secreteKey="";
  var isCancel = false;
  console.log('/api/orderCancel');
  console.log('site : '+ site);
  console.log('orderID : '+ orderID);
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
    function order_cancel(cb){
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
    function remove_unfilled_order(cb){
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
    res.send({msg : "취소성공"});
  });
  
});


router.get('/api/get_order_info', isAuthenticated, function(req,res){
  var site = req.query.site;
  console.log(site);
  var obj ={
    last_price : 0,
    avgEntryPrice : 0,
    size : 0,
    availableMargin : 0,
    levarge : 0,
    margin : 0
  }
  async.waterfall([
    function get_last_price(cb){
      //cb(null);
      ticker.findOne({site : 'bitmex'}, function(error, json){
        if(error){
          console.log(error);
          return;
        }
        console.log(json);
        
        obj.last_price = json.last_price;
        cb(null);
      });
    },
    function get_position(cb){
      
      position2.findOne({site : site}, function(error, json){
        if(error){
          console.log(error);
          return;
        }
        console.log(json);
        obj.avgEntryPrice = json.avgEntryPrice;
        obj.size = json.size;
        cb(null);
      });
    },
    function get_avail_balance(cb){
      margin.findOne({site : site}, function(error, json){
        if(error){
          console.log(error);
          return;
        }
        obj.availableMargin = json.availableMargin;
        cb(null);
      })
    },
    function get_leverage_margin(cb){
      setting.findOne({site : site}, function(error, json){
        if(error){
          console.log(error);
          return;
        }
        obj.leverage = json.leverage;
        obj.margin = json.margin;
        cb(null);
      })
    }
  ], function(error, results){
    if(error){
      console.log(error);
      return;
    }
    res.send(obj);
  });
});

router.get('/api/get_unfilled_history', isAuthenticated, function(req, res){
  var site = req.query.site;
  order_unfilled.find({site : site}, function(error, json){
    if(error){
      console.log(error);
      return;
    }
    console.log(json);
    res.send(json);
  });
});



router.get('/avg_order_history',  isAuthenticated,  function(req, res){
  var site_type = req.query.site_type;
  res.render('avg_order_history',{site_type : site_type});
});

router.get('/api/avg_order_history',  isAuthenticated, function(req, res){
  console.log("/api/avg_order_history 실행");
  var site_type = req.query.site_type;
  //console.log('site_type : '+ site_type);
  orderDB2.find({site_type : site_type}).sort({start_time : "desc"}).exec(function(error, result){
    if(error){
      console.log(error);
      res.send(error);
    }
    //console.log(result);
    res.send(result);
  });
});

// router.get('/api/avg_order_history',  isAuthenticated, function(req, res){
//   console.log("/api/avg_order_history 실행");
//   var site_type = req.query.site_type;
//   console.log('site_type : '+ site_type);
//   orderDB2.find({site_type : site_type}).sort({start_time : "desc"}).exec(function(error, result){
//     if(error){
//       console.log(error);
//       res.send(error);
//     }
//     console.log(result);
//     res.send(result);
//   });
// });






router.get('/bid_search',  isAuthenticated, function(req, res){
  res.render('bid_search');
});

router.get('/api/bid_search',  isAuthenticated, function(req, res){
  console.log("/api/bid_search 실행");
  var start_time = req.query.start_time;
  var end_time = req.query.end_time;

  if(start_time === undefined){
    start_time = new Date().toISOString().slice(0,10);
  }
  
  if(end_time === undefined){
    end_time = new Date().toISOString().slice(0,10);
  }
  bid_1h.find({"timestamp" : {"$gte": new Date(start_time+"T00:00:00.000Z"),"$lte": new Date(end_time+"T23:59:59.000Z")}}).sort({timestamp : "asc"}).exec(function(error, result){
    if(error){
      console.log(error);
      res.send(error);
    }
    //console.log(result);
    res.send(result);
  });
});

router.get('/api/bid_down',  isAuthenticated, function(req, res){
  // const file = webSetting.down_path+'data.xlsx';
  // fs.access(file, fs.F_OK, (err) => {
  //   if(err) {
  //     console.error(err)
  //     return
  //   }
  //   res.download(file); // Set disposition and send it.
  // });
  var start_time = req.query.start_time;
  var end_time = req.query.end_time;
  bid_1h.find({"timestamp" : {"$gte": new Date(start_time+"T00:00:00.000Z"),"$lte": new Date(end_time+"T23:59:59.000Z")}}).sort({timestamp : "asc"}).exec(function(error, json){
    if(error){
      console.log(error);
      res.send(error);
    }
    var arr = [];
    for(var i=0; i<json.length; i++){
      var time1 = json[i].timestamp.toISOString();
      var time1 = time1.split("T")[0];
      var time2 = json[i].timestamp.toISOString();
      var time2 = time2.split("T")[1].split(":");
      var obj = {
        t1 : time1,
        t2 : time2[0] + ":" + time2[1] + ":" + time2[2].split(".")[0],
        open : price_comma(json[i].open, 'bitmex'),
        high : price_comma(json[i].high, 'bitmex'),
        low : price_comma(json[i].low, 'bitmex'),
        close : price_comma(json[i].close, 'bitmex'),

        sma1 : price_comma(json[i].sma1, 'bitmex'),
        sma2 : price_comma(json[i].sma2, 'bitmex'),
        sma3 : price_comma(json[i].sma3, 'bitmex'),
        sma4 : price_comma(json[i].sma4, 'bitmex'),
        ema : price_comma(json[i].ema, 'bitmex'),
      };
      arr.push(obj);
    }
    res.xls('bid.xlsx', arr);
  });
});

function price_comma(num, site){
  var site_type='';
  if(site.indexOf("bitmex") !== -1){
      site_type='bitmex';
  }else{
      site_type = site;
  }

  var coin = Number(num);
  if(site_type === 'bitmex'){
      return numeral(coin).format( '₩0,0.0' ); // 1000.00000123 =>  1,000.00000123
  }else{
      return numeral(coin).format( '₩0,0' );
  }
}

router.get('/bid_restore',  isAuthenticated, function(req, res){
  res.render('bid_restore');
});

router.post('/api/bid_restore',  isAuthenticated, function(req, res){
  
  // setting.findOne({execFlag : true}, function(error, json){
  //   if(error){
  //     console.log(error);
  //     return;
  //   }

  // });
  var url = 'https://www.bitmex.com'
  var symbol = "XBTUSD";
  var apiKey = "IYT7EVPuT-d39e2oYbixiFxJ"; //bitmex API key
  var secretKey = "XT6vsX8GJr9Fpk1alXe9nv9DuVdY99hSNp96e2tIuhMkp-YN"; //bitmex API Secret
  
  var binSize = req.body.binSize; //분봉데이터 유형 ex) 1m, 5m, 1h, 1d
  var d = req.body.date;
  var interval=req.body.interval;
  if(interval === 'year'){
    d = new Date(d+"-01-01");
    // console.log(d);
    // console.log(d.getFullYear())
    setTimeout(RestoreBidYearData(url, apiKeyId, apiSecret, symbol, binSize, d.getFullYear()), 0);
  }
  else if(interval === 'month'){
    d = new Date(d+"-01");
    setTimeout(RestoreBidMonthData(url, apiKey, secretKey, symbol, binSize, d.getFullYear(), d.getMonth()+1),0);
  }else if(interval === 'day'){
    d = new Date(d);
    setTimeout(RestoreBidData(url, apiKey, secretKey, symbol, binSize, d.getFullYear(), d.getMonth()+1,  d.getDate()),0);
  }
  res.send({msg : "복구완료"});
});

function RestoreBidYearData(url, apiKeyId, apiSecret, symbol, binSize, year){
  return function(){
      for(var i=1; i<=12; i++){
          // setTimeout(RestoreBidMonthData(url, apiKeyId, apiSecret, symbol, binSize, year, i),i *20000);
          setTimeout(RestoreBidMonthData(url, apiKeyId, apiSecret, symbol, binSize, year, i),0);
      }
  }
}

//startDay부터 endDay까지(ex : 2018-10-01 ~ 2018-10-07) 분봉데이터 수집하여 DB에 저장 
//범위지정은 4일까지만 허용(많은 데이터 요청시 bitmex에서 접속제한 걸기때문)
function RestoreBidMonthData(url, apiKeyId, apiSecret, symbol, binSize, year, month){
  return function(){
      if(month < 10)
          month = "0" + month;
      
      var endDay = getMonthEndDay(year, month);
      console.log("endDay : "+ endDay);
      //1일부터
      var st1 = new Date(year + "-" + month + "-" + "01" + "T00:00:00.00Z");
      st1.setHours(st1.getHours()-9);
      st1.setMinutes(1);

      console.log(st1);

      //20일까지
      var et1 = new Date(year + "-" + month + "-" + "20" + "T15:00:00.00Z");
      console.log(et1);
      
      //20일부터
      var st2 = new Date(year + "-" + month + "-" + "20" + "T15:01:00.00Z");
      console.log(st2);

      //endDay까지
      var et2 = new Date(year + "-" + month + "-" + endDay + "T15:00:00.00Z");
      console.log(et2);
      
      var count =720;
      if(binSize === '1h'){
          count = 720;
      }
    
      var param1 = 'binSize=' + binSize + '&partial=false&symbol=' + symbol + '&count='+count+'&reverse=false&startTime=' + st1.toUTCString() +'&endTime=' + et1.toUTCString();
      var param2 = 'binSize=' + binSize + '&partial=false&symbol=' + symbol + '&count='+count+'&reverse=false&startTime=' + st2.toUTCString() +'&endTime=' + et2.toUTCString();
      console.log(param1);
      console.log(param2);
      try{
          (async function main() {
              //var result1 = await makeRequest(bitmexURL, apiKeyId, apiSecret, 'GET','trade/bucketed', param1);
              var requestOptions = setRequestHeader(url, apiKeyId, apiSecret,'GET', 'trade/bucketed', param1);
              console.log(requestOptions);
              request(requestOptions.url, function(err,response, body){
                  var result = JSON.parse(body);
                  var data1 = new Array();
                  for(var i=0; i<result.length; i++){
                      var temp = {};
                      temp["symbol"] = result[i].symbol;
                      temp["timestamp"] = new Date(result[i].timestamp).getTime() + (1000 * 60 * 60 * 8);
                      //temp["time1m"] = d;
                      temp["open"] = result[i].open;
                      temp["high"] = result[i].high;
                      temp["low"] = result[i].low;
                      temp["close"] = result[i].close;
                      temp["trades"] = result[i].trades;
                      temp["volume"] = result[i].volume;
                      temp["vwap"] = result[i].vwap;
                      temp["lastSize"] = result[i].lastSize;
                      temp["turnover"] = result[i].turnover;
                      temp["homeNotional"] = result[i].homeNotional;
                      temp["foreignNotional"] = result[i].foreignNotional;
                      data1.push(temp);
                  }
                  //console.log("data1");
                  //console.log(data1);
                  //분봉데이터 DB에 저장, 데이터 중복 허용 X
                  for(var i in data1){
                    bid_1h.findOneAndUpdate({
                          symbol : data1[i].symbol,
                          timestamp : data1[i].timestamp
                        }, data1[i], { upsert: true }, 
                        function(err, body){
                            if(err){
                              //console.log(err);
                              return;
                            } 
                            console.log(body);
                        }
                    );
                  }
              })
          })();
  
          (async function main() {
              var requestOptions = setRequestHeader(url, apiKeyId, apiSecret,'GET', 'trade/bucketed', param2);
  
              request(requestOptions.url, function(err,response, body){
                  var result = JSON.parse(body);
                  var data2 = new Array();
                  for(var i=0; i<result.length; i++){
                      var temp = {};
                      temp["symbol"] = result[i].symbol;
                      temp["timestamp"] = new Date(result[i].timestamp).getTime() + (1000 * 60 * 60 * 8);
                      //temp["time1m"] = d;
                      temp["open"] = result[i].open;
                      temp["high"] = result[i].high;
                      temp["low"] = result[i].low;
                      temp["close"] = result[i].close;
                      temp["trades"] = result[i].trades;
                      temp["volume"] = result[i].volume;
                      temp["vwap"] = result[i].vwap;
                      temp["lastSize"] = result[i].lastSize;
                      temp["turnover"] = result[i].turnover;
                      temp["homeNotional"] = result[i].homeNotional;
                      temp["foreignNotional"] = result[i].foreignNotional;
                      data2.push(temp);
                  }
  
                  //console.log("data2");
                  //console.log(data2);
                  //분봉데이터 DB에 저장, 데이터 중복 허용 X
                  for(var i in data2){
                    bid_1h.findOneAndUpdate({
                          symbol : data2[i].symbol,
                          timestamp : data2[i].timestamp
                        }, data2[i], { upsert: true }, 
                        function(err, body){
                            if(err){
                              //console.log(err);
                              return;
                            } 
                            console.log(body);
                        }
                    );
                  }
              })
          })();
              /*
              var result2 = await makeRequest(bitmexURL, apiKeyId, apiSecret, 'GET','trade/bucketed', param2);
              
              */
         
      }catch(error){ //분봉데이터가 없으면
          console.log("error : "+ error); 
          console.log("param1 :"+ param1); //못받은 데이터 출력
          console.log("param2 :"+ param2); //못받은 데이터 출력
      }
  }
}

function getMonthEndDay(year, month){
  var d = new Date();//오늘날짜 계산
  var thisMonth = (parseInt(year) === d.getFullYear() && parseInt(month) === (d.getMonth()+1)); //이번달인지 아닌지 판단
  var endDay = 0;
  console.log("thisMonth : "+ thisMonth);
  if(thisMonth === true){ //이번달이면
      console.log("이번달");
      endDay  = d.getDate(); //현재일자 GET
  }else{ //이번달이 아니면 
      console.log("이번달X");
      endDay = new Date(year, month, 0).getDate(); //month의 마지막 날짜 ex) 31 or 30 or 28 
  }
  return endDay;
}


function RestoreBidData(url, apiKeyId, apiSecret, symbol, binSize, year, month, startday){
  return function(){
      var startDay = (startday < 10)? "0" + startday : startday;
      if(month < 10)
          month = "0" + month;
      var dateString = year + "-" + month + "-" + startDay + "T00:00:00.00Z";
      
      var st1 = new Date(dateString);
      st1.setHours(st1.getHours()-9);
      st1.setMinutes(1);
      var et1 = new Date(st1);
      et1.setMinutes(720);
      
      var st2 = new Date(st1);
      st2.setHours(st2.getHours() + 12);
      st2.setMinutes(1);

      var et2 = new Date(st2);
      et2.setMinutes(720);
      
      var count =720;
      if(binSize === '1m'){
          count = 720;
      }else if(binSize === '1h'){
          count = 24;
      }

      console.log(st1);
      console.log(et1);
      console.log(st2);
      console.log(et2);
      var param1 = 'binSize=' + binSize + '&partial=false&symbol=' + symbol + '&count='+count+'&reverse=false&startTime=' + st1.toUTCString() +'&endTime=' + et2.toUTCString();
      //var param2 = 'binSize=' + binSize + '&partial=false&symbol=' + symbol + '&count='+count+'&reverse=false&startTime=' + st2.toUTCString() +'&endTime=' + et2.toUTCString();
      console.log(param1);
      
      try{
          (async function main() {
              //var result1 = await makeRequest(bitmexURL, apiKeyId, apiSecret, 'GET','trade/bucketed', param1);
              var requestOptions = setRequestHeader(url, apiKeyId, apiSecret,'GET', 'trade/bucketed', param1);

              request(requestOptions.url, function(err,response, body){
                  if(err){
                    console.log(err);
                    return;
                  }
                  console.log(body);
                  var result = JSON.parse(body);
                  var data1 = new Array();
                  for(var i=0; i<result.length; i++){
                      var temp = {};
                      //temp["symbol"] = result[i].symbol;
                      temp["timestamp"] = new Date(new Date(result[i].timestamp).getTime() + (1000 * 60 * 60 * 8));
                      //temp["time1m"] = d;
                      temp["open"] = result[i].open;
                      temp["high"] = result[i].high;
                      temp["low"] = result[i].low;
                      temp["close"] = result[i].close;
                      temp["trades"] = result[i].trades;
                      temp["volume"] = result[i].volume;
                      temp["vwap"] = result[i].vwap;
                      temp["lastSize"] = result[i].lastSize;
                      temp["turnover"] = result[i].turnover;
                      temp["homeNotional"] = result[i].homeNotional;
                      temp["foreignNotional"] = result[i].foreignNotional;
                      data1.push(temp);
                  }
                  
                  //console.log("data1");
                  //console.log(body);
                  //console.log(data1);
                  //분봉데이터 DB에 저장, 데이터 중복 허용 X
                  for(var i in data1){
                      bid_1h.findOneAndUpdate({
                            symbol : data1[i].symbol,
                            timestamp : data1[i].timestamp
                          }, data1[i], { upsert: true }, 
                          function(err, body){
                              if(err){
                                //console.log(err);
                                return;
                              } 
                              console.log(body);
                          }
                      );
                  }
              })
          })();
          
      }catch(error){ //분봉데이터가 없으면
          console.log("error : "+ error); 
          console.log("param1 :"+ param1); //못받은 데이터 출력
          console.log("param2 :"+ param2); //못받은 데이터 출력
      }
  }
}


 module.exports = router;
