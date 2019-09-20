var div_exit_bitmex = require('./lib/div_exit_bitmex');
var div_entry_bitmex = require('./lib/div_entry_bitmex');
var div_exit_bithumb = require('./lib/div_exit_bithumb');
var bithumb = require('./API/bithumbAPI');
var bithumAPI = new bithumb('7446cc38540523fe9a0a04b033414ab5', '50684360909e128d413356721be9b614');

// var rgParams = {
//     currency : "BHP",
//     order_id : "C0524000000000090319",
//     type : 'bid'
// };

// bithumAPI.bithumPostAPICall('/info/orders', rgParams, function(error, response, body){
//     if(error){
//         console.log("빗썸 미체결조회 error1 : " + error);
//         return;
//     }
    
//     try{
//         var json = JSON.parse(body);
//     }catch(error){
//         console.log("빗썸 미체결조회 error1 : " + error);
//         return;
//     }

//     if(json.status !== "0000"){
//         console.log("빗썸 미체결조회 error2 : " + body);
//         return;
//     }
    
//     body.units_remaining;
//     console.log(JSON.stringify(body));
// });


bithumAPI.ticker("BTC", function(error, response, body){
    if(error){
        console.log(error);
        return;
    }
    console.log(body);
    var json = JSON.parse(body);
    
    console.log(json.data.closing_price);
});









