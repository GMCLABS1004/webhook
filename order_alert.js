var orderDB = require('./models/order');
var mongoose = require('mongoose');
var numeral = require('numeral');
var setting = require('./order_alert.json');
const TelegramBot = require('node-telegram-bot-api');

// replace the value below with the Telegram token you receive from @BotFather
const token = setting.token//'923302959:AAHKTAgloEI67wS7YxGlZp4jZi9DJOt8350';
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
        orderDB.find({isSend : false}).sort({end_time : "asc"}).exec(function(error, res){
            if(error){
                console.log(error);
                return;
            }
            console.log(res);
            for(i=0; i<res.length; i++){
                var dateArr = new Date( res[i].end_time.getTime()).toISOString().split("T");
                var msg = 
                "거래소 : " + res[i].site + "\n" +
                "타입 : " +  res[i].type + " / "+ res[i].side + "\n" +
                "가격 : " +  price_comma(res[i].price) + "\n" +
                "수량 : " +  (res[i].amount) + "\n" +
                "가치 : " +  amount_comma(res[i].value) + "\n" +
                "수익율 : " +  (res[i].benefitRate) + "\n" +
                "날짜 : " +  dateArr[0] + "\n" + 
                "시간 : " +  dateArr[1].split("Z")[0];
                bot.sendMessage(487119052, msg); //대표님
                bot.sendMessage(803791407, msg); //연호형님
                bot.sendMessage(728701781, msg); //수식형님
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


function convert_side(side){
    if(side === 'bid'){
        return "Buy"
    }else if(side==='ask'){
        return "Sell"
    }
    return side;
}

function price_comma(num){
    var price = Number(num)
    if(price < 100){ //가격이 100원보다 작으면 ',' 표시 안하고 그대로 출력
        return price;
    }else{ //가격이 100원보다 크면 ',' 표시 
        return numeral(price).format( '₩0,0' )
    }
    
}

function amount_comma(num){
    var coin = Number(num);
    if(coin >= 0.000001){
        return numeral(coin).format( '₩0,0.0000' ); // 1000.00000123 =>  1,000.00000123
    }else{
        return coin.toFixed(4); // 0.00000078 -> 0.00000078
    }
}
