var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/api/webhook',function(req,res, next){
  console.log("[" + new Date() + "] : " + JSON.stringify(req));
  res.send({});
});


module.exports = router;
