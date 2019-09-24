var request = require('request');
const crypto = require('crypto');
module.exports = class coinoneAPI{
    /**
     * 
     * @param {String} token 
     * @param {String} key 
     */
    constructor(token, key){
        this.token = token;
        this.key = key;
    }

    ticker(currency, callback){
        var options = {
            method : 'GET',
            url : 'https://api.coinone.co.kr/ticker/',
            qs : {currency : currency}
        }
        
        request(options,function(error, response, body){
            
            callback(error, response, body);
        
        });
    }

    /**
     * 
     * @param {String} currency : "BTC" 
     * @param {function} callback error, response, body
     */
    orderbook(currency, callback){
        var options = {
            method : 'GET',
            url : 'https://api.coinone.co.kr/orderbook/',
            qs : {currency : currency}
        }
        
        request(options,function(error, response, body){
            
            callback(error, response, body);
        
        });
    }

    /**
     * 
     * @param {function} callback error, httpResponse, body
     */
    balance(callback){
        var url = 'https://api.coinone.co.kr/v2/account/balance/';
        var payload = {
            'access_token': this.token,
            'nonce': Date.now()
        }

        var options = this.getPrivateOptions(url, payload);

        request(options,function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }
    
    limit_orders(currency, callback){
        var url = 'https://api.coinone.co.kr/v2/order/limit_orders/';
        var payload = {
            'access_token': this.token,
            'currency': currency,
            'nonce': Date.now()
        }
        var options = this.getPrivateOptions(url, payload);
        request(options,function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }

    /**
     * 
     * @param {String} currency : "bsv" 
     * @param {Number} price : 130000
     * @param {Number} qty : 1
     * @param {function} callback error, httpResponse, body
     */
    limitBuy(currency, price, qty, callback){
        var url = 'https://api.coinone.co.kr/v2/order/limit_buy/';
        var payload = {
            'access_token': this.token,
            'price': price,
            'qty': parseFloat(qty).toFixed(4),
            'currency': currency,
            'nonce': Date.now()
        }
        var options = this.getPrivateOptions(url, payload);
        request(options,function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }

    /**
     * 
     * @param {String} currency : "bsv"
     * @param {Number} price : 130000
     * @param {Number} qty : 1
     * @param {function} callback error, httpResponse, body
     */
    limitSell(currency, price, qty, callback){
        var url = 'https://api.coinone.co.kr/v2/order/limit_sell/';
        var payload = {
            'access_token': this.token,
            'price': price,
            'qty': parseFloat(qty).toFixed(4),
            'currency': currency,
            'nonce': Date.now()
        }
        var options = this.getPrivateOptions(url, payload);
        request(options,function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }

    /**
     * 
     * @param {String} currency : "bsv"
     * @param {Number} price : 130000
     * @param {Number} qty : 1
     * @param {String} orderID : orderId
     * @param {String} orderType : "buy" or "sell"
     * @param {function} callback  error, httpResponse, body
     */
    cancelOrder(currency, price, qty, orderID, orderType, callback){
        var url = 'https://api.coinone.co.kr/v2/order/cancel/';
        var payload = {
          'access_token': this.token,
          'order_id': orderID,
          'price': price,
          'qty': parseFloat(qty).toFixed(4),
          'is_ask': orderType === 'sell' ? 1 : 0,
          'currency': currency,
          'nonce': Date.now()
        }
        var options = this.getPrivateOptions(url, payload);
        request(options,function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }

    myOrderInfo(order_id, currency, callback){
        var url = 'https://api.coinone.co.kr/v2/order/order_info/';
        var payload = {
          'access_token': this.token,
          'nonce': Date.now(),
          'order_id': order_id,
          'currency': currency,
        }
        var options = this.getPrivateOptions(url, payload);
        request(options,function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }


    getPrivateOptions(url, payload){
        payload = new Buffer(JSON.stringify(payload)).toString('base64')
        var headers = {
        'content-type':'application/json',
        'X-COINONE-PAYLOAD': payload,
        'X-COINONE-SIGNATURE': crypto
                                .createHmac('sha512', this.key.toUpperCase())
                                .update(payload)
                                .digest('hex')
        }

        var options = {
            'method': 'post',
            'url': url,
            'headers': headers,
            'data': payload
        }
        return options;
    }
}