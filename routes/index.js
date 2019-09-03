var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/api/webhook',function(req,res, next){
  var date = new Date();
  console.log("[" + date.toISOString() + "] : " + JSON.stringify(req));
  res.send({});
});


module.exports = router;
