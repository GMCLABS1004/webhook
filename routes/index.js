var express = require('express');
var router = express.Router();
var signal = require("../models/signal");


/* GET home page. */
router.get('/', function(req, res, next){
  var date = new Date();
  console.log("[" + date.toISOString() + "] : " + req.body);
  res.render('index', { title: 'Express' });
});

router.post('/api/marginTrade', function(req,res){
  var sigData = {
    scriptNo : Number(req.body.scriptNo),
    side : req.body.side,
    log : req.body.log,
    timestamp : new Date().getTime() + (1000 * 60 * 60 * 9)
  }
  signal.insertMany(sigData, function(error, res){
    if(error){
      console.log(error);
      res.send(error);
      return;
    }
    res.send({});
  });
});
 module.exports = router;
