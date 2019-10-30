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

var webSetting = require("../webSetting");
var moment = require('moment');
var forever = require('forever');
var passport = require('passport');
const Users = require('../models/users');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.post('/api/botOnOff',  function(req,res){
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


router.post('/api/siteOnOff', function(req,res){
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

router.get('/api/log',  function(req,res){
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

router.get('/api/orderHistoryTotal', function(req, res){
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

router.get('/api/read_setting', function(req,res){
  var site = req.query.site;
  setting.findOne({site : site},function(error, json){
    if(error){
      res.send(error);
      return;
    }
    console.log(json);
    res.send(json);
  });
});

module.exports = router;
