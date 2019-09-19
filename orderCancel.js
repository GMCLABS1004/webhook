var crypto = require("crypto");
var request = require("request");
var url = 'https://testnet.bitmex.com';
var symbol = "XBTUSD";
var apiKey = '-2YJMJOGLRMvUgaBD1_KzbLt';
var secreteKey = 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd';
var price = 10184.5;
var orderQty = 100000;
var side = "Buy";
var orderID = 0;
var requestHeader = setRequestHeader(url, apiKey, secreteKey, 'POST','order',
            {symbol : symbol, side : side, price : price, orderQty : orderQty, ordType : "Limit", text : "auto"});
request(requestHeader, function(error, response, body){
    if(error){
        console.log(error)    
        //res.send(error);
        return;
    }
    console.log("주문1 : " + body);
    var json = JSON.parse(body);
    console.log("site : bitmex " + "/ side : " + json.side + "/ price : " + (json.price) + "/ amount : "+ (json.orderQty) );
    console.log(json.orderID);
    orderID = json.orderID;
    // var side = "Buy";
    // var orderQty = 50;
    // var requestHeader = setRequestHeader(url, apiKey, secreteKey, 'POST','order',
    //         {symbol : symbol, side : side, price : price, orderQty : orderQty, ordType : "Limit", text : "auto"});
    // request(requestHeader, function(error, response, body){
    //     if(error){
    //         console.log(error)    
    //         //res.send(error);
    //         return;
    //     }

    //     console.log("주문2 : " + body);
    //     var json = JSON.parse(body);
    //     console.log("site : bitmex " + "/ side : " + json.side + "/ price : " + (json.price) + "/ amount : "+ (json.orderQty) );
    //     console.log(json.orderID);
       
    // });
    setTimeout(cancelOrder(orderID), 60000);
});


function cancelOrder(orderID){
    return function(){
        var requestHeader = setRequestHeader(url, apiKey, secreteKey, 'DELETE','order',
        {orderID : orderID});
        request(requestHeader, function(error, response, body){
            if(error){
                console.log(error)    
                //res.send(error);
                return;
            }
            var json = JSON.parse(body);
            remainAmt= json[0].orderQty - json[0].cumQty
            
        })
    }
}

function setRequestHeader(url, apiKey, apiSecret, verb, endpoint, data){
    path = '/api/v1/'+ endpoint;
    expires = new Date().getTime() + (60 * 1000); // 1 min in the future
    var requestOptions;
    if(verb === 'POST' || verb === 'PUT' || verb === 'DELETE'){
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
  
