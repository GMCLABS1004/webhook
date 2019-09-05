var BithumAPI = require('./API/bithumbAPI');
//var bithumAPI = new BithumAPI("223985a94a23a587e7aee533b82f7a4e", "4f76cce9768fbdc7f90c6b1fb7021846");

var bithumAPI = new BithumAPI("7446cc38540523fe9a0a04b033414ab5", "50684360909e128d413356721be9b614");

var rgParams = {
    currency : "BTC"
};

bithumAPI.bithumPostAPICall('/info/balance', rgParams, function(error, response, body){
    if(error){
        console.log("빗썸 balance 값 조회 error1 : " + error);
        return;
    }
    try{
        var json = JSON.parse(body);
    }catch(error){
        console.log("빗썸 balance 값 조회 error1 : " + error);
        return;
    }

    if(json.status !== "0000"){
        console.log("빗썸 balance 값 조회 error2 : " + body);
        return;
    }
    console.log(body);

});