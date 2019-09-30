var signal = require("./models/signal");
var mongoose = require('mongoose');
var webSetting = require('./webSetting');
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
    //프로그램 시작할때 저장되있는 신호 전부 삭제
    signal.remove({}, function(error, data){
        if(error){
            console.log(error);
            return;
        }
        signal.find({}).sort({timestamp : "asc"}).exec(function(error, res){
            if(error){
                console.log("");
                return;
            }
            console.log(res);
        });
    });
    
})