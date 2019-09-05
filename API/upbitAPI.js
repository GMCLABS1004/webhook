const request = require("request");
const sign = require("jsonwebtoken").sign
const randomInt = require('random-int');
const queryEncode = require("querystring").encode;
module.exports = class upbitAPI{
    constructor(access_key, secret_key){
        this.access_key = access_key;
        this.secret_key = secret_key;
    }
    /**
     * 
     * @param {String} markets ex) KRW-BTC
     * @param {*} callback 
     */
    ticker(markets, callback){
        var options = { method: 'GET',
        url: 'https://api.upbit.com/v1/ticker',
        qs: { markets: markets } };

        request(options, function (error, response, body) {
            callback(error, response, body);
        });
    }
    
    accounts(callback){
        const payload = {access_key: this.access_key, nonce: (new Date).getTime() + randomInt(200,1000)};
        const token = sign(payload, this.secret_key);
        
        var options = {
          method: "GET",
          url: "https://api.upbit.com/v1/accounts",
          headers: {Authorization: `Bearer ${token}`}
        };
        
        request(options, function (error, response, body) {
            callback(error, response, body);
        });
    }

    /**
     * 
     * @param {String} markets 'KRW-BTC'
     * @param {function} callback error, response, body
     */
    orderbook(markets, callback){
        var options = {
            method: 'GET',
            url: 'https://api.upbit.com/v1/orderbook',
            qs: { markets: markets } 
        };

        request(options, function (error, response, body) {
            callback(error, response, body);
        });
    }

    /**
     * 주문가능정보 : 마켓별 주문 가능 정보 확인
     * @param {String} market "KRW-BTC" 
     */
    chance(market, callback){
        const query = queryEncode({market: market});
        const payload = {
            access_key: this.access_key,
            nonce: (new Date).getTime() + randomInt(200,1000),
            query: query
        };
        const token = sign(payload, this.secret_key);

        var options = {
            method: "GET",
            url: "https://api.upbit.com/v1/orders/chance?" + query,
            headers: {Authorization: `Bearer ${token}`}
        };

        request(options, function (error, response, body) {
            callback(error, response, body);
        });
    }

    /**
     * 
     * @param {String} market 'KRW-BTC'
     * @param {String} to 'yyyy-MM-dd'
     */
    candles_day(market, to, callback){ 
        var options = { method: 'GET',
        url: 'https://api.upbit.com/v1/candles/days',
        qs: { market: market, to : to } };
    
        request(options, function (error, response, body) {
            callback(error, response, body);
        });
    }

    orders(market, callback){
        const query = queryEncode({market: market});
        const payload = {
            access_key: this.access_key,
            nonce: (new Date).getTime() + randomInt(200,1000),
            query: query
        };
        const token = sign(payload, this.secret_key);

        var options = {
            method: "GET",
            url: "https://api.upbit.com/v1/orders?" + query,
            headers: {Authorization: `Bearer ${token}`}
        };

        request(options, function (error, response, body) {
            callback(error, response, body);
        });
        

        // var options = { 
        //     method: 'GET',
        //     url: 'https://api.upbit.com/v1/orders',
        //     qs: { market: market } 
        // };
    
        // request(options, function (error, response, body) {
        //     callback(error, response, body);
        // });
    }

    /**
     * 
     * @param {String} market : 'KRW-BTC'
     * @param {String} side  : 'bid' or 'ask'
     * @param {Number} price 
     * @param {Number} volume 
     */
    order(market, side, price, volume, callback){
        var market = market;
        var side = side; //ask
        var volume = volume; //주문수량 
        var price = price;
        var ord_type = "limit"; //지정가 주문
    
        const body = {market: market, side: side, volume: volume, price: price, ord_type: ord_type};
        const payload = {
            access_key: this.access_key,
            nonce: (new Date).getTime(),
            query: queryEncode(body)
        };

        const token = sign(payload, this.secret_key);
    
        var options = {
            method: "POST",
            url: "https://api.upbit.com/v1/orders",
            headers: {Authorization: `Bearer ${token}`},
            json: body
        };

        request(options, function (error, response, body) {
            callback(error, response, body);
        });
    }

    /**
     * 
     * @param {String} uuid 
     */
    cancel(uuid, callback){
        const query = queryEncode({uuid: uuid});
        const payload = {
            access_key: this.access_key,
            nonce: (new Date).getTime(),
            query: query
        };
        const token = sign(payload, this.secret_key);

        var options = {
            method: "DELETE",
            url: "https://api.upbit.com/v1/order?" + query,
            headers: {Authorization: `Bearer ${token}`}
        };
        callback(error, response, body);
    }
}
