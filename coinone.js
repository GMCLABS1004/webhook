var coinoneAPI = require('./API/coinoneAPI.js');
coinone = new coinoneAPI('0d246678-06c0-4b44-9eb6-bd8ef507fc5a', 'dfb81257-4f3d-4beb-bafe-81dc122aae75');
var orderID =0;
var price =3.02;
var amount =1000;

// coinone.limitBuy("ANKR", price, amount, function(error, response, body){
//     if(error){
//         console.log("코인원 주문에러 : "+error);
//         return;
//     }
//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log("코인원 주문에러 error1 : " + error);
//         return;
//     }
//     if(json.errorCode !== "0"){
//         console.log("코인원 주문에러 error2 : " + body);
//         return;
//     }
    
//     orderID = json.orderId;
//     console.log("매수주문 : "+body);

// });


coinone.myOrderInfo('31bdaa1e-1e4d-11e9-9ec7-00e04c3600d7', "ANKR", function(error, response, body){
    if(error){
        console.log("주문 조회 error1 : " + error);
        return;
    }

    try{
        var json = JSON.parse(body);
    }catch(error){
        console.log("주문 조회 조회 error1 : " + error);
        return;
    }
    
    if(json.errorCode !== "0"){
        console.log("주문 조회 조회 error2 : " + body);
        return;
    }
    console.log("주문조회 : "+body);
    console.log('json.info.remainQty : ' + json.info.remainQty);
    
});


// coinone.cancelOrder("ANKR", price, amount, '31bdaa1e-1e4d-11e9-9ec7-00e04c3600d7', "bid", function(error, response, body){
//     if(error){
//         console.log("코인원 주문취소 조회 error1 : " + error);
//         return;
//     }
    
//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log("코인원 주문취소 조회 error1 : " + error);
    
//         return;
//     }
//     if(json.errorCode !== "0"){
//         console.log("코인원 주문취소 조회 error2 : " + body);
//         return;
//     }
//     console.log("주문취소 : "+body);
// });

// coinone.myOrderInfo('31581d23-1e4d-11e9-9ec7-00e04c3600d7', "ANKR", function(error, response, body){
//     if(error){
//         console.log("코인원 매수/매도 값 조회 error1 : " + error);
//         return;
//     }

//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log("코인원 매수/매도 값 조회 error1 : " + error);
//         return;
//     }
    
//     if(json.errorCode !== "0"){
//         console.log("코인원 매수/매도 값 조회 error2 : " + body);
//         return;
//     }
//     console.log(body);
//     console.log('json.info.remainQty : ' + json.info.remainQty);
// });


// coinone.cancelOrder("ANKR", 11612000, 0.0021, "31581d23-1e4d-11e9-9ec7-00e04c3600d7", "bid", function(error, response, body){
//     if(error){
//         console.log("코인원 주문취소 조회 error1 : " + error);
       
//         return;
//     }
    
//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log("코인원 주문취소 조회 error1 : " + error);
       
//         return;
//     }
    
//     if(json.errorCode !== "0"){
//         console.log("코인원 주문취소 조회 error2 : " + body);
       
//         return;
//     }
//     cb(null, data);
// });

// coinone.ticker("ANKR", function(error, response, body){
//     if(error){
//       console.log("코인원 매수/매도 값 조회 error1 : " + error);
//       return;
//     }
    
//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log("코인원 매수/매도 값 조회 error1 : " + error);
//         return;
//     }
    
//     if(json.errorCode !== "0"){
//         console.log("코인원 매수/매도 값 조회 error2 : " + body);
//         return;
//     }
//     var json = JSON.parse(body);
//     console.log("ticker");
//     console.log(json);
//     console.log(Number(json.last));
    
//   });