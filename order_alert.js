var orderDB = require('./models/order');
var mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
// replace the value below with the Telegram token you receive from @BotFather
const token = '923302959:AAHKTAgloEI67wS7YxGlZp4jZi9DJOt8350';
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});
var webSetting = require('./webSetting');
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
});

setTimeout(alert(), 0);
setInterval(alert(), 5000);



function alert(){
    return function(){
        orderDB.find({isSend : false}).sort({timestamp : "desc"}).exec(function(error, res){
            if(error){
                console.log(error);
                return;
            }
            console.log(res);
            for(i=0; i<res.length; i++){
                var dateArr = new Date( res[i].timestamp.getTime() + (1000 * 60 *60 *9)).toISOString().split("T");
                var msg = 
                "거래소 : " + res[i].site + "\n" +
                "타입 : " +  res[i].side + "\n" +
                "가격 : " +  price_comma(res[i].price) + "\n" +
                "수량 : " +  amount_comma(res[i].amount) + "\n" +
                "날짜 : " +  dateArr[0] + "\n" + 
                "시간 : " +  dateArr[1].split("Z")[0];
                // bot.sendMessage(487119052, msg); //대표님
                // bot.sendMessage(803791407, msg); //연호형님
                // bot.sendMessage(728701781, msg); //수식형님
                bot.sendMessage(888129309, msg); //주태경
                //console.log("msg : " + msg);
                orderDB.findByIdAndUpdate(res[i]._id, {$set :{isSend : true}},function(err, body){
                    if(err){
                        console.log(err);
                        return;
                    }
                    console.log(body);
                });
            }
        });
    }
}


function price_comma(num){
    var price = 0
    if(res[i].price < 100){ //가격이 100원보다 작으면 ',' 표시 안하고 그대로 출력
        price = res[i].price;
    }else{ //가격이 100원보다 크면 ',' 표시 
        price = numeral(res[i].price).format( '₩0,0' )
    }
    return price;
}

function amount_comma(num){
    var coin = Number(num);
    if(coin >= 0.000001){
        return numeral(coin).format( '₩0,0.0000' ); // 1000.00000123 =>  1,000.00000123
    }else{
        return coin.toFixed(4); // 0.00000078 -> 0.00000078
    }
}
