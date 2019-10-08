var BithumAPI = require('./API/bithumbAPI');
//var bithumAPI = new BithumAPI("223985a94a23a587e7aee533b82f7a4e", "4f76cce9768fbdc7f90c6b1fb7021846");

var bithumAPI = new BithumAPI("5278503811b8452d16103c577a0ca53b", "553d6c7cf5d99039debc697390528c35");

// var rgParams = {
//     currency : "BTC"
// };

// bithumAPI.bithumPostAPICall('/info/balance', rgParams, function(error, response, body){
//     if(error){
//         console.log("빗썸 balance 값 조회 error1 : " + error);
//         return;
//     }
//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log("빗썸 balance 값 조회 error1 : " + error);
//         return;
//     }

//     if(json.status !== "0000"){
//         console.log("빗썸 balance 값 조회 error2 : " + body);
//         return;
//     }
//     console.log(body);

// });


// var rgParams = {
//     order_currency : 'BHP',
//     payment_currency : 'KRW',
//     price : 1315,
//     type : 'bid',
//     units : 10
// };
// console.log(rgParams);
// bithumAPI.bithumPostAPICall('/trade/place', rgParams, function(error, response, body){
//     if(error){
//         console.log("빗썸 주문에러 error1 : " + error);
//         return;
//     }

//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log("빗썸 주문에러 error2 : " + error);
//         return;
//     }

//     if(json.status !== "0000"){
//         console.log("빗썸 주문에러 조회 error3 : " + body);
//         return;
//     }
//     console.log("주문결과");
//     console.log(json);
// });


var order_id = "C0524000000000184390"; 

var rgParams = {
    currency : "BHP",
    order_id : order_id,
    type : 'bid',
};

bithumAPI.bithumPostAPICall('/info/orders', rgParams, function(error, response, body){
    if(error){
        console.log("빗썸 미체결조회 error1 : " + error);
        return;
    }
    
    try{
        var json = JSON.parse(body);
    }catch(error){
        console.log("빗썸 미체결조회 error1 : " + error);
        return;
    }
    
    if(json.status === "0000"){
        console.log("주문조회결과");
        console.log(json);
    }
    console.log("주문조회결과");
    console.log(json);
});


// var rgParams = {
//     currency : "BHP",
//     order_id : order_id,
//     type : "bid",
// };

// bithumAPI.bithumPostAPICall('/trade/cancel', rgParams, function(error, response, body){
//     if(error){
//         console.log("빗썸 주문취소 error1 : " + error);
//         return;
//     }
//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log("빗썸 주문취소 error1 : " + error);  
//     }
//     console.log("취소결과");
//     console.log(json);
//     var rgParams = {
//         currency : "BHP",
//         order_id : order_id,
//         type : 'bid',
//     };
    
//     bithumAPI.bithumPostAPICall('/info/orders', rgParams, function(error, response, body){
//         if(error){
//             console.log("빗썸 미체결조회 error1 : " + error);
//             return;
//         }
        
//         try{
//             var json = JSON.parse(body);
//         }catch(error){
//             console.log("빗썸 미체결조회 error1 : " + error);
//             return;
//         }
        
//         if(json.status === "0000"){
//             console.log("주문조회결과");
//             console.log(json);
//         }
//         console.log("주문조회결과");
//         console.log(json);
//     });
// });








