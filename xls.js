var json2xls = require('json2xls');
// var json2excel = require('js2excel').json2excel;
// console.log(json2excel);
var numeral = require('numeral');
var webSetting = require("./webSetting");
var bid_1h = require("./models/bid_1h");
var mongoose = require('mongoose');
var fs = require('fs');
mongoose.connect(webSetting.dbPath, function(error){
    if(error){
      console.log(error);
      return;
    }
    bid_1h.find({}).sort({timestamp : "asc"}).exec(function(error, json){
        if(error){
          console.log(error);
          res.send(error);
        }
        var arr = [];
        for(var i=0; i<json.length; i++){
          var time1 = json[i].timestamp.toISOString();
          var time1 = time1.split("T")[0];
          var time2 = json[i].timestamp.toISOString();
          var time2 = time2.split("T")[1].split(":");
          var obj = {
            t1 : time1,
            t2 : time2[0] + ":" + time2[1] + ":" + time2[2].split(".")[0],
            open : price_comma(json[i].open, 'bitmex'),
            high : price_comma(json[i].high, 'bitmex'),
            low : price_comma(json[i].low, 'bitmex'),
            close : price_comma(json[i].close, 'bitmex'),
            
            sma1 : price_comma(json[i].sma1, 'bitmex'),
            sma2 : price_comma(json[i].sma2, 'bitmex'),
            sma3 : price_comma(json[i].sma3, 'bitmex'),
            sma4 : price_comma(json[i].sma4, 'bitmex'),
            ema : price_comma(json[i].ema, 'bitmex'),
          };
          arr.push(obj);
        }
        console.log(arr);
        var xls = json2xls(arr);
        fs.writeFile('data.xlsx', xls, 'binary', function(error){
            if(error){
                console.log(error);
                return;
            }
            console.log("파일 저장 완료");
        });

      });
});
function price_comma(num, site){
    var site_type='';
    if(site.indexOf("bitmex") !== -1){
        site_type='bitmex';
    }else{
        site_type = site;
    }
  
    var coin = Number(num);
    if(site_type === 'bitmex'){
        return numeral(coin).format( '₩0,0.0' ); // 1000.00000123 =>  1,000.00000123
    }else{
        return numeral(coin).format( '₩0,0' );
    }
  }



