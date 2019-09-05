'use strict'

const debug = require('debug')('namebit');
const request = require('request');
const crypto = require('crypto');
// const _ = require('underscore');
const formurlencoded = require('form-urlencoded').default;
// const socketCluster = require('socketcluster-client');

var config = {
    apiHost : "http://api.namebit.me"
};

function NamebitApi(key, secret) {
    this.userId = null//'g.oodman.company.kr@gmail.com';
    this.apiKey = key;
	this.apiSecret = secret;
    this.config = config;
}
NamebitApi.prototype.setConfig = function(cfg) {
	this.config = cfg;
}

NamebitApi.prototype.call = async function(path, param) {
    var client = this;

    // add default nonce
    if (!param.nonce) {
        param.nonce = new Date().getTime();
    }
    debug("[Req] Path : %o \nParam : %o", path, param);

	var payload = formurlencoded(param);
    // debug("\nPayload = ", payload, "\n");

    var sig = crypto.createHmac('sha512', client.apiSecret).update(payload).digest('hex');

    var headers = {
        'User-Agent': 'Namebit-JS 1.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-cdax-apikey': this.apiKey,
        'x-cdax-sig': sig
    }

    var option = {
        url: this.config.apiHost + path,
        headers: headers,
        timeout: 30000,
        body: payload
    };

    // debug("\nHeaders = ", headers, "\Payload = ", payload)

    return new Promise((resolve, reject) => {
        request.post(option, (err, res, rawBody) => {
            // debug("Err : ",  err);
            // debug("Res : ",  res);
            debug("[Res] Path : %o \nParam : %o", path, param);
            //console.log("err : "+ err);
            //console.log("rawBody : "+rawBody);
           
            if (err || res.statusCode != 200) {
                debug(err);
                debug("authApi-Error : %o", res.statusCode);
                reject(err);
            }
            else {
                try {
                    var body = JSON.parse(rawBody);
                    resolve(body);
                    
                    debug("RAW %o", rawBody);
                    debug("Result[%s] %o", path, body);
                }
                catch (e) {
                    debug("Status=", res.status, "\nError: ", e, "\nData = ", rawBody);
                    reject(e);
                }
            }
        });
    });
}

// Export data
module.exports = NamebitApi;
