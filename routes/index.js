var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  var date = new Date();
  console.log("[" + date.toISOString() + "] : " + req.body);
  res.render('index', { title: 'Express' });
});

router.post('/api/webhook',function(req,res){
  var date = new Date().getTime() + (1000 * 60 * 60 * 9);
  console.log("kkkk");
  console.log("[" + date.toISOString() + "] : " + JSON.stringify(req.body) );
  res.send({});
});

module.exports = router;
