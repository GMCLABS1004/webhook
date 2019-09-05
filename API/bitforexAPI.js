const request = require("request");
var crypto = require('crypto');

module.exports = class bitforexAPI{
    
    constructor(accessKey, secretKey){
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.url = 'https://api.bitforex.com';
    }
    
    ticker(symbol,callback){
        request(this.url + '/api/v1/market/ticker?symbol='+symbol, function(error, response, body) {
            callback(error, response, body);

        });
    }

    mainAccount(currency, callback){
        var nonce = new Date().getTime();
        var contents = '/api/v1/fund/mainAccount?accessKey='+this.accessKey+'&currency='+currency+'&nonce='+ nonce;
        var signData = crypto.createHmac('sha256', this.secretKey).update(contents).digest('hex');
        var link = this.url + contents +"&signData=" + signData;
        
        //1. BTC잔액조회
        request.post({url : link, form: {}}, function(error, response, body){
            callback(error, response, body);
        });
    }

    allAccount(callback){
        var nonce = new Date().getTime();
        var contents = '/api/v1/fund/allAccount?accessKey='+this.accessKey+'&nonce='+ nonce;
        var signData = crypto.createHmac('sha256', this.secretKey).update(contents).digest('hex');
        var link = this.url + contents +"&signData=" + signData;
        
        //1. BTC잔액조회
        request.post({url : link, form: {}}, function(error, response, body){
            callback(error, response, body);
        });
    }

    depth(symbol, callback){
        //2.매수/매도 값 조회
        request(this.url + '/api/v1/market/depth?symbol='+symbol+'&size=200', function(error, response, body) {
            callback(error, response, body);
        });
    }

    order(symbol, tradeType, price, amount, callback){
        return function(){
            var nonce = new Date().getTime();
            var contents = '/api/v1/trade/placeOrder?accessKey='+this.accessKey+'&amount='+amount+'&nonce='+ nonce+'&price='+price+'&symbol='+symbol+'&tradeType='+tradeType;
            var signData = crypto.createHmac('sha256', this.secretKey).update(contents).digest('hex');
            var link = this.url + contents +"&signData=" + signData;
    
            //매매실행2
            request.post({url : link, form: {}}, function(error, httpResponse, body){

                callback(error, response, body);
                
            });
        }
    }

    orderCancel(symbol, orderId, callback){
        return function() {
            var nonce = new Date().getTime();
            var contents = '/api/v1/trade/cancelOrder?accessKey='+this.accessKey+'&nonce='+ nonce+ '&orderId='+ orderId+'&symbol='+symbol;
            var signData = crypto.createHmac('sha256', this.secretKey).update(contents).digest('hex');
            var link = this.url + contents +"&signData=" + signData;
            
            //주문취소 
            request.post({url : link, form : {}},function(error, response, body){
                callback(error, response, body);
            });
        }
    }
}
