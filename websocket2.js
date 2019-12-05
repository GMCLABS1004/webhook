var W3CWebSocket = require('websocket').w3cwebsocket;
 
var client = new W3CWebSocket('wss://testnet.bitmex.com/realtimemd');
var crypto = require('crypto');

// var username = "kwonseyoung.work@gmail.com"
// var apiKey = "-2YJMJOGLRMvUgaBD1_KzbLt";
// var apiSecret = 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd'
// var expires = new Date().getTime() //+ (60 * 1000); // 1 min in the future //4102358400
// //var signature = crypto.createHmac('sha256', apiSecret).update('GET/realtime'+expires).digest('hex');
// var signature = crypto.createHmac('sha256', apiSecret).update('GET/realtime'+expires).digest('hex');


client.onerror = function() {
    console.log('Connection Error');
};
 
client.onopen = function(){
    console.log('WebSocket Client Connected');
    //개인
    //client.send(JSON.stringify({"op": "authKeyExpires", "args": [apiKey, expires, signature]}));
    // client.send(JSON.stringify({"op": "subscribe", "args": ['margin']}));
    //client.send(JSON.stringify({"op": "subscribe", "args": ['orderBookL2_25:XBTUSD']}));

    // //멀티플렉싱1
    // console.log(JSON.stringify([1, username, username]))
    // console.log(JSON.stringify([0, username, username, {"op": "authKeyExpires", "args": [apiKey, expires, signature]}]));
    // console.log(JSON.stringify([0, username, username, {"subscribe": "position"}]));

    var username = "kwonseyoung.work@gmail.com"
    var apiKey = "-2YJMJOGLRMvUgaBD1_KzbLt";
    var apiSecret = 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd'
    var expires = new Date().getTime() //+ (60 * 1000); // 1 min in the future //4102358400
    //var signature = crypto.createHmac('sha256', apiSecret).update('GET/realtime'+expires).digest('hex');
    var signature = crypto.createHmac('sha256', apiSecret).update('GET/realtime'+expires).digest('hex');
    
    //멀티플렉싱2
    client.send(JSON.stringify([1, username, username]));
    client.send(JSON.stringify([0, username, username, {"op": "authKeyExpires", "args": [apiKey, expires, signature]}]));
    client.send(JSON.stringify([0, username, username, {"subscribe": "margin"}]));


    username = "jtk4556@gmail.com"
    apiKey = "7SKvgnAUMiz6rzLl2Tjd8WZm";
    apiSecret = '_9JeB-IrVckCdWJFbt6X2kgHmrOlJQKObca4WQpOGRHd03ZA'
    expires = new Date().getTime() //+ (60 * 1000); // 1 min in the future //4102358400
    //var signature = crypto.createHmac('sha256', apiSecret).update('GET/realtime'+expires).digest('hex');
    signature = crypto.createHmac('sha256', apiSecret).update('GET/realtime'+expires).digest('hex');
    client.send(JSON.stringify([1, username, username]));
    client.send(JSON.stringify([0, username, username, {"op": "authKeyExpires", "args": [apiKey, expires, signature]}]));
    client.send(JSON.stringify([0, username, username, {"subscribe": "margin"}]));
    // client.send('[0, "'+username+'" ,"'+username+'", {"op": "subscribe", "args": [ "execution", "margin","position","transact", "wallet","order"]}]');
};
 
client.onclose = function(){
    console.log('echo-protocol Client Closed');
};
 
client.onmessage = function(e){
    // if (typeof e.data === 'string'){
    //     //console.log("Received: '" + e.data + "'");
    // }
    var json = JSON.parse(e.data);
    //console.log(json);
    console.log(json[1]);
    console.log(json[3].data);
};