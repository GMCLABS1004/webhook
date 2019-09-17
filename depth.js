var crypto = require("crypto");
var request = require("request");
var url = 'https://testnet.bitmex.com';
var apiKey = '-2YJMJOGLRMvUgaBD1_KzbLt'
var secreteKey = 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd';
var symbol = 'XBTUSD';
var requestHeader = setRequestHeader(url, apiKey, secreteKey, 'GET', 'orderbook/L2', 'symbol='+symbol+'&depth=1');
request(requestHeader, function(error, response, body){
    if(error){
        console.log(error);
        return;
    }
    var json = JSON.parse(body);
    console.log(body);
});

function setRequestHeader(url, apiKey, apiSecret, verb, endpoint, data){
    path = '/api/v1/'+ endpoint;
    expires = new Date().getTime() + (60 * 1000); // 1 min in the future
    var requestOptions;
    if(verb === 'POST' || verb === 'PUT'){
        var postBody = JSON.stringify(data);
        var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + expires + postBody).digest('hex');
        var headers = {
            'content-type' : 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'api-expires': expires,
            'api-key': apiKey,
            'api-signature': signature
        };
        requestOptions = {
            headers: headers,
            url: url+path,
            method: verb,
            body: postBody
        };
    }else{ //'GET'
        var query = '?'+ data;
        var signature = crypto.createHmac('sha256', apiSecret).update(verb + path + query + expires).digest('hex');
        var headers = {
          'content-type' : 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'api-expires': expires,
          'api-key': apiKey,
          'api-signature': signature
        };
        requestOptions = {
            headers: headers,
            url: url+path + query,
            method: verb
        };
    }
    return requestOptions;
}
