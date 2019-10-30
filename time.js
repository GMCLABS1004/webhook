var orderDB = require('./models/order');
var mongoose = require('mongoose');


mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }


    orderDB.find({}, function(error, res){
        if(error){
            console.log(error);
            return;
        }
        console.log()
    });
});


