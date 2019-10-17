var request = require('request');
// var options ={
//     url : 'http://127.0.0.1:3000/api/financialFuncAllOnOff',
//     method: "POST",
//     header : {
//         'content-type' : 'application/json',
//         'Accept': 'application/json'
//     },
//     json : {
//         symbol : "BTC_KRW",
//         updateData : 
//             {
//                 "execBithumb" : false, 
//                 "execCoinone" : false, 
//                 "execUpbit" : false
//             }
//     }
// }   

// request(options, function(error, response, body){
//     if(error){
//         console.log(error);
//         return;
//     }
//     console.log(body);
// });



function getFinanceBotOffOption(symbol, flag){
    var options ={
      url : 'http://127.0.0.1:3000/api/financialBotOnOff',
      method: "POST",
      header : {
          'content-type' : 'application/json',
          'Accept': 'application/json'
      },
      json : {
          "id" : 'financial'+symbol,
          "flag" : flag
      }
    }
    return options;   
}
var options = getFinanceBotOffOption("BTC_KRW", 'stop');
request(options, function(error, response, body){
    if(error){
        console.log(error);
        return;
    }
    console.log(body);
});

var options = getFinanceBotOffOption("BTC_KRW", 'stop');
request(options, function(error, response, body){
    if(error){
        console.log(error);
        return;
    }
    console.log(body);
});

var options = getFinanceBotOffOption("BTC_KRW", 'stop');
request(options, function(error, response, body){
    if(error){
        console.log(error);
        return;
    }
    console.log(body);
});

