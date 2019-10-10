var express = require('express');
var router = express.Router();
var fs = require('fs');
var signal = require("../models/signal");
var setting = require("../models/setting");
var order = require("../models/order");
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
  if (req.isAuthenticated())
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

router.get('/logout', function (req, res) {
  req.logout();
  res.redirect('/login');
});

router.get('/changePW', isAuthenticated, function(req, res) {
  res.render('changePW');
});


/* GET home page. */
router.get('/', isAuthenticated, function(req, res){
  res.redirect('manage');
});

// router.get('/main', isAuthenticated, function(req, res, next){
//   res.render('main', {user_info : req.user});
// });

router.get('/manage', isAuthenticated, function(req, res, next){
  var date = new Date();
  console.log("[" + date.toISOString() + "] : " + req.body);
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
  
      console.log("status2 호출 : " + JSON.stringify(status));
      res.render('manage',status);
    });
  });
});


router.post('/api/marginTrade', function(req,res){
  var sigData = {
    scriptNo : Number(req.body.scriptNo),
    side : req.body.side,
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

router.get('/setting',isAuthenticated, function(req,res){
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

router.post('/api/setting', isAuthenticated, function(req,res){
  var json = new Object(req.body);
  var obj = {
    url : json.url,
    apiKey : json.apiKey,
    secreteKey : json.secreteKey,
    scriptNo : Number(json.scriptNo),
    leverage : Number(json.leverage),
    margin : Number(json.margin),
    minOrdCost : Number(json.minOrdCost),
    ordInterval : Number(json.ordInterval),
    minOrdRate : Number(json.minOrdRate),
    maxOrdRate : Number(json.maxOrdRate)
  }
  setting.updateOne({site : json.site},{$set : obj}, function(error,body){
    if(error){
      console.log(error);
      return;
    }
    res.send({"msg" : "설정업데이트 성공"});
  });
});

router.post('/api/botOnOff', isAuthenticated, function(req,res){
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


router.post('/api/siteOnOff',isAuthenticated, function(req,res){
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

router.get('/log',function(req, res){
  var site = req.query.site;
  res.render('log',{site : site});
});

router.get('/api/log', isAuthenticated, function(req,res){
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

router.get('/orderHistory', isAuthenticated, function(req, res){
  var site = req.query.site;
  res.render('orderHistory',{site : site});
});

router.get('/api/orderHistory',isAuthenticated, function(req, res){
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

router.get('/orderHistoryTotal', isAuthenticated, function(req, res){
  var site = req.query.site;
  res.render('orderHistoryTotal',{site : site});
});


router.get('/api/orderHistoryTotal',isAuthenticated, function(req, res){
  console.log("/api/orderHistoryTotal 실행");
  var site = req.query.site;
  order.find({site : site}).sort({start_time : "desc"}).exec(function(error, result){
    if(error){
      console.log(error);
      res.send(error);
    }
    console.log(result);
    res.send(result);
  });
});


 module.exports = router;
