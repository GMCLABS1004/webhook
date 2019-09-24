var upbitAPI= require('./API/upbitAPI');
var upbit = new upbitAPI('DqvxjopaOh3v1ynwxDVDkBDWu8vxAiXhwVcqpxk4','HEx8ak9dJRZxgX9xRNDPRaHr3L79d7dn6ZMsHtL7');
var side = "bid";
var price = 3.82;
var amount = 1000;
var orderID = 0;

upbit.accounts(function(error, response, body){
    if(error){
        console.log(error);
        return;

    }
    console.log(body);
});


// upbit.order("KRW-ADT", side, price, amount, function(error, response, body){
//     if(error){
//         console.log("업비트 주문에러 error1 : "+error);
//         return;
//     }
    
//     // try{
//     //     var json = JSON.parse(body);
//     // }catch(error){
//     //     console.log("업비트 주문에러 error2 : " + error);
//     //     return;
//     // }
//     console.log("주문성공 : " +body);
//     console.log("uuid : "+ body.uuid);
//     orderID = body.uuid;
//     upbit.order_info(orderID, function(error, response, body){
//         if(error){
//             console.log("업비트 order_info 조회 error1 : " + error);
//             return;
//         }
        
//         // try{
//         //     var json = JSON.parse(body);
//         // }catch(error){
//         //     console.log("업비트 order_info 조회 error2 : " + error);
//         //     return;
//         // }

//         // if(typeof(json["error"]) === 'object'){
//         //     console.log("업비트 order_info error3 : " + body);
//         //     return;
//         // }
//         console.log("오더인포 : " + body);
//         console.log("json.remaining_volume : " + body.remaining_volume);
//     });
// });


// upbit.cancel('74d2f92e-961c-467c-80a7-185da4b7d367', function(error, response, body){
//     if(error){
//         console.log("업비트 주문취소 error1 : " + error);
//         return;
//     }
//     console.log(body);
// });

// upbit.ticker("KRW-ADT", function(error, response, body){
//     if(error){
//       console.log("업비트 현재가 조회 error1 : " + error);
//       return;
//     }
    
//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log("업비트 현재가 조회 error2 : " + error);
//         return;
//     }

//     if(typeof(json["error"]) === 'object'){
//         console.log("업비트 현재가 조회 error1 : " + body);
//         return;
//     }

//     var json = JSON.parse(body);
//     console.log("ticker");
//     console.log(json);
//     //data.ticker = json[0].trade_price;
//     console.log("json[0].trade_price : "+ json[0].trade_price);
//   });


// upbit.order_info('32f9b332-11dd-4b2b-b453-aed15d42d8ff', function(error, response, body){
//     if(error){
//         console.log("업비트 order_info 조회 error1 : " + error);
//         // data.isError = true;
//         // data.isContinue = true;
//         // return cb(null, data);
//     }

//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log("업비트 order_info 조회 error2 : " + error);
//         // data.isError = true;
//         // data.isContinue = true;
//         // return cb(null, data);
//     }

//     if(typeof(json["error"]) === 'object'){
//         console.log("업비트 order_info error3 : " + body);
//         // data.isError = true;
//         // data.isContinue = true;
//         // return cb(null, data);
//     }
//     console.log(body);
//     // data.totalOrdValue -= (data.canceledPrice * Number(json.remaining_volume));
//     // data.isContinue=true;
    
//     // cb(null, data);
// });


