const request = require("request");
const md5 = require('md5');

module.exports = class digifinexAPI{
    
    constructor(apiKey, apiSecret){
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.url = 'https://openapi.digifinex.vip';
    }

    ticker(callback){
        var contents = "/v2/ticker?apiKey=" + this.apiKey;
        var link = this.url + contents;

        //usdt_btc, btc_ist 현재가 조회
        request(link, function(error, response, body){
            callback(error, response, body);
        });
    }

    depth(symbol, callback){
        var timeStampNow = Math.floor(Date.now() / 1000);
        var params = {symbol: symbol, apiKey: this.apiKey, timestamp: timeStampNow , apiSecret : this.apiSecret};//
        var sign = this.getSignData(params);
        var contents = "/v2/depth?apiKey=" + this.apiKey +"&symbol=" + symbol+ "&timestamp=" + timeStampNow + "&sign=" + sign;
        var link = this.url + contents;
        //2.ist 매수/매도 값 조회
        request(link,function(error, response, body){

            callback(error, response, body);
        });
    }

    myPosition(callback){
        var timeStampNow = Math.floor(Date.now() / 1000); //Date.getTime();
        var params = {apiKey: this.apiKey, timestamp: timeStampNow , apiSecret : this.apiSecret};//
        var sign = this.getSignData(params);
        var contents = "/v2/myposition?apiKey=" + this.apiKey + "&timestamp=" + timeStampNow + "&sign=" + sign;
        var link = this.url + contents;
        
        //잔액 조회
        request(link,function(error, response, body){
            callback(error, response, body);
        });
    }

    order_history(){
        var type = "buy";
        var timeStampNow = Math.floor(Date.now() / 1000);
        var params = {apiKey : this.apiKey, timestamp: timeStampNow, type : type, apiSecret : this.apiSecret};
        var sign = getSignData(params);
        var contents = "/v2/order_history?" + "&apiKey="+this.apiKey+"&timestamp="+ timeStampNow+"&type="+type+"&sign="+sign;
        var link = this.url + contents;
        
        //open History에서 매수목록만 조회 => neverSellPrice 계산!
        request(link, function(error, response, body){
            callback(error, response, body);
        });
    }
    
    order(symbol, type, price, amount){
        return function(){
            var timeStampNow = Number(Math.floor(Date.now() / 1000)); //Date.getTime();
            var params = {symbol: symbol, price : price, amount : amount, type : type, apiKey : this.apiKey, timestamp: timeStampNow , apiSecret : this.apiSecret};//
            var sign = getSignData(params); 
            var obj = {symbol : symbol, price : price, amount : amount, type : type, apiKey : this.apiKey, timestamp : timeStampNow, sign : sign }

            //주문1
            request.post({url : this.url + "/v2/trade", form : obj},function(error, response, body){
                callback(error, response, body);
            });
        }
    }

    orderCancel(order_id){
        return function(){
            var timeStampNow = Number(Math.floor(Date.now() / 1000)); //Date.getTime();
            var params = {order_id: order_id, apiKey : this.apiKey, timestamp : timeStampNow, apiSecret : this.apiSecret};
            var sign = getSignData(params); 
            var obj = {order_id: order_id, apiKey : this.apiKey, timestamp : timeStampNow, sign : sign };
            
            //주문취소 
            request.post({url : this.url + "/v2/cancel_order", form : obj},function(error, response, body){
                callback(error, response, body);
            });
        }
    }

    getSignData(params){
        var arr = [];
        var keys = Object.keys(params).sort(); //[ 'apiKey', 'apiSecret', 'symbol', 'timestamp', 'type' ]
    
        keys.forEach(function(key){
            arr.push(params[key]);
        });
    
        var sign = md5(arr.join('')); 
        return sign;
    }
}
