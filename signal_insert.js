var signal = require('./models/signal');
var orderDB = require('./models/order');
var mongoose = require('mongoose');
var webSetting = require('./webSetting.json');

mongoose.connect(webSetting.dbPath, function(error){
    if(error){
        console.log(error);
        return;
    }
    var sigData = {
        scriptNo : 2,
        side : "Buy",
        side_num : 1,
        log : "",
        timestamp : new Date().getTime() + (1000 * 60 * 60 * 9)
    }
    signal.insertMany(sigData, function(error, res){
        if(error){
            console.log("신호 insert");
            return;
        }

        signal.find({}, function(error, res){
            if(error){
                console.log("신호 insert");
                return;
            }
            console.log(res);
            console.log(res[0].timestamp);
            console.log(res[0].timestamp.getTime());
            orderDB.find({site : "bithumb"}).sort({start_time : "desc"}).limit(1).exec(function(error,data){
                if(error){
                    console.log(error);
                    return;
                }

                console.log("주문내역");
                console.log(data[0].start_time);
                console.log(data[0].start_time.getTime());
            });

        });
    })
})