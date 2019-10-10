var request = require('request');
const crypto = require('crypto');
module.exports = class korbitAPI{
    /**
     * 
     * @param {String} token 
     * @param {String} key 
     */
    constructor(client_id, client_secret){
        this.client_id = client_id;
        this.client_secret = client_secret;
        this.token = ""
    }

    /**
     * 
     * @param {String} currency_pair : "btc_krw" 
     * @param {function} callback error, response, body
     */
    ticker(currency_pair, callback){
        var options = {
            method : 'GET',
            url : 'https://api.korbit.co.kr/v1/ticker',
            qs : {currency_pair : currency_pair}
        }
        
        request(options,function(error, response, body){
            
            callback(error, response, body);
        
        });
    }

    /**
     * 
     * @param {String} currency_pair : "btc_krw" 
     * @param {function} callback error, response, body
     */
    orderbook(currency_pair, callback){
        var options = {
            method : 'GET',
            url : 'https://api.korbit.co.kr/v1/orderbook',
            qs : {currency_pair : currency_pair}
        }
        
        request(options,function(error, response, body){
            
            callback(error, response, body);
        
        });
    }

    
    /**
     * 
     * @param {function} callback error, httpResponse, body
     */
    access_token(callback){
        var options = {
            method : 'POST',
            url : 'https://api.korbit.co.kr/v1/oauth2/access_token',
            form : {
                client_id :  this.client_id,
                client_secret : this.client_secret,
                grant_type : 'client_credentials'
            }
        }
        request(options, function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }

    /**
     * 
     * @param {function} callback error, httpResponse, body
     */
    balances(callback){
        var options = {
            method : 'GET',
            url : 'https://api.korbit.co.kr/v1/user/balances',
            headers : {
                Authorization: `Bearer ${this.token}`
            }
        }
        request(options,function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }


    order(currency_pair, side, price, coin_amount, callback){
        var options = {
            method : 'POST',
            url : 'https://api.korbit.co.kr/v1/user/orders/'+side,
            headers : {
                Authorization: `Bearer ${this.token}`
            },
            form : {
                currency_pair :  currency_pair,
                type : "limit",
                price : price,
                coin_amount : coin_amount,
                fiat_amount : 0
            }
        }
        request(options, function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }    

    cancel(currency_pair, id, callback){
        var options = {
            method : 'POST',
            url : 'https://api.korbit.co.kr/v1/user/orders/cancel',
            headers : {
                Authorization: `Bearer ${this.token}`
            },
            form : {
                currency_pair :  currency_pair,
                id : id
            }
        }
        request(options, function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }


    /**
     * 
     * @param {*} currency_pair "btc_krw" 
     * @param {*} status  'unfilled', 'partially_filled', 'filled' 
     * @param {*} orderId "89999"
     * @param {*} callback 
     */
    order_info(currency_pair, status, orderId, callback){
        var options = {
            method : 'GET',
            url : 'https://api.korbit.co.kr/v1/user/orders',
            headers : {
                Authorization: `Bearer ${this.token}`
            },
            qs : {
                currency_pair :  currency_pair,
                status :  status,
                id :  orderId
            }
        }
        request(options, function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }

    /**
     * 미체결내역
     * @param {String} currency_pair : "btc_krw" 
     * @param {*} callback 
     */
    open(currency_pair, callback){
        var options = {
            method : 'GET',
            url : 'https://api.korbit.co.kr/v1/user/orders/open',
            headers : {
                Authorization: `Bearer ${this.token}`
            },
            qs : {
                currency_pair :  currency_pair,
            }
        }
        request(options, function(error, httpResponse, body){
            callback(error, httpResponse, body);
        });
    }
}