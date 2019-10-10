var korbitAPI = require('./API/korbitAPI.js');
var apiKey = 'E7ZfIiba5QoVuuTZZNdOLD3TCtdBFgpOgMZqca5FJn9Lppb0xNAtjlQ5L0QCg';
var secreteKey = 'Id7rWDd4ycz6XotLOC76yrCbe6gltnVPEywcUjlu2PkLTlsWJefro8SAbcGa0';
var korbit = new korbitAPI(apiKey, secreteKey);
var currency = 'btc_krw'//'snt_krw';
var side = "buy"
var price = 16;
var amount = 200;
var orderId = 1916018;


// korbit.access_token(function(error, response, body){
//     if(error){
//         console.log(error);
//         return;
//     }

//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log(error);
//         return;
//     }
//     korbit.token = json.access_token;

//     // korbit.cancel(currency, orderId, function(error, response, body){
//     //     if(error){
//     //         console.log(error);
//     //         return;
//     //     }
//     //     console.log(body);
//     //     korbit.order_info(currency, "", orderId, function(error, response, body){
//     //         if(error){
//     //             console.log(error);
//     //             return;
//     //         }
//     //         console.log(body);
//     //     });
//     // });

//     korbit.order_info(currency, "", orderId, function(error, response, body){
//         if(error){
//             console.log(error);
//             return;
//         }
//         console.log(body);
//     });
// });




// korbit.access_token(function(error, response, body){
//     if(error){
//         console.log(error);
//         return;
//     }

//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log(error);
//         return;
//     }
//     korbit.token = json.access_token;

//     // korbit.balances(function(error, response, body){
//     //     if(error){
//     //         console.log(error);
//     //         return;
//     //     }
//     //     console.log(body);
//     //     try{
//     //         var json = JSON.parse(body);
//     //     }catch(error){
//     //         console.log("코인원 balance 값 조회 error1 : " + error);
//     //         return;
//     //     }
//     //     console.log(json.krw);
//     //     console.log(json.btc);
//     // });

//     korbit.order(currency, side, price, amount, function(error, response, body){
//         if(error){
//             console.log(error);
//             return;
//         }

//         try{
//             var json = JSON.parse(body);
//         }catch(error){
//             console.log(error);
//             return;
//         }
//         orderId = json.orderId;
//         console.log(body);
//         console.log(typeof(json.orderId));
        
//     });
// });


korbit.ticker(currency, function(error, response, body){
    if(error){
        console.log(error);
        return;
    }
    console.log(body);
});


// korbit.orderbook(currency, function(error, response, body){
//     if(error){
//         console.log(error);
//         return;
//     }
//     console.log(body);
// });


// korbit.balance(function(error, response, body){
//     if(error){
//         console.log(error);
//         return;
//     }
//     console.log(body);
// });