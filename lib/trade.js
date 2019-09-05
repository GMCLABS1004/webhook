
module.exports = function(){
    
}

function bitmex(){
    async.waterfall([
        function init(cb){
            var data ={
                ticker : 0, //현재가
                walletBalance : 0, //지갑잔고
                marginBalance : 0, //마진 밸런스
                availableMargin : 0, // 사용가능잔고
                leverage : 1, //setting값 
                margin : 0.1, //setting값
                openingQty : 0, // 들어가 있는 수량
                isSide : 'none', //들어가 있는 side// Sell or Buy
            }
            cb(null, data);
        },
        
        function ticker(data,cb){ //현재가 조회
            var requestOptions = setRequestHeader(apiKeyId, apiSecret, 'GET','trade','symbol='+symbol+'&count=1'+'&reverse='+true);//'currency=XBt'
            request(requestOptions, function(error,response,body){
                if(error) {
                    console.log("error : " +error);
                    res.send(error);
                    return;
                }
                var json = JSON.parse(body);
                console.log(body);
                data.ticker = json[0].price;
                cb(null, data);
            });
        },
        function position(data, cb){
            var requestOptions = setRequestHeader(apiKeyId, apiSecret, 'GET','position','');//'currency=XBt'
            request(requestOptions, function(err,response,body){
                if(err) {
                    console.log(err);
                    return;
                }
                //console.log(body);
                var json = JSON.parse(body);
                //console.log(json);
                for(i=0; i<json.length; i++){
                    if(json[i].currentQty > 0 && json[i].symbol==='XBTUSD'){
                        console.log("매수");
                        data.openingQty = json[i].currentQty;
                        data.isSide = "Buy";
                    }else if(json[i].currentQty < 0 && json[i].symbol==='XBTUSD'){
                        console.log("매도");
                        data.openingQty = json[i].currentQty;
                        data.isSide = "Sell";
                    }
                }
                cb(null, data);
            });
        },
        function order1(data, cb){ //주문1
            
            if(data.isSide === req.body.side){ //진입한 포지션 === 요청포지션
            console.log("첫주문은 서로 다른 포지션이야 합니다."); //로직종료
            res.send({}); 
            return;
            }
            
            if(data.isSide === 'none'){ //진입한 포지션이 없으면 첫번째 주문 생략
            cb(null, data);
            }
            else if(req.body.side === 'Exit'){ //포지션종료
            console.log("포지션 종료"); //로직종료
            var requestClearHeader = setRequestHeader(apiKeyId, apiSecret, 'POST','order/closePosition', {symbol : symbol});
            request(requestClearHeader, function(error, response, body) {
                if(error){
                console.log(error)    
                res.send(error);
                return;
                }
                res.send({}); 
                return;
            });
            }
            else if(data.isSide === 'Buy' || data.isSide === 'Sell'){ //진입한 포지션O && Buy or Sell
            var side = req.body.side;
            var orderQty =  Math.abs(data.openingQty); //기존 수량 그대로 주문
            var requestHeader = setRequestHeader(apiKeyId, apiSecret, 'POST','order',
                {symbol : symbol, side : side, orderQty : orderQty, ordType : "Market", text : "auto"});

            request(requestHeader, function(error, response, body){
                if(error){
                console.log(error)    
                res.send(error);
                return;
                }
                console.log("주문1 : " + body);
                cb(null, data);
            });
            }
        },
        function getUserMargin(data, cb){ //잔액조회
            if(req.body.side === 'Exit'){
            return cb(null, data);
            }
            
            var requestOptions = setRequestHeader(apiKeyId, apiSecret, 'GET','user/margin','currency=XBt');
            request(requestOptions, function(error, response, body){
                if(error){
                    console.log(error);
                    res.send(error);
                    return;
                }
                var json = JSON.parse(body);
                data.walletBalance = json.walletBalance / 100000000;
                data.marginBalance = json.marginBalance / 100000000;
                data.availableMargin = json.availableMargin / 100000000;
                //console.log("margin : " + body);
                cb(null, data);
            });
        },
        function order2(data, cb){
            if(req.body.side === 'Exit'){
            return cb(null, data);
            }

            var orderQty = Math.floor(((((data.availableMargin * data.margin) * data.leverage) * data.ticker) ));
            var side = req.body.side;
            var requestHeader = setRequestHeader(apiKeyId, apiSecret, 'POST','order',
                        {symbol : symbol, side : side, orderQty : orderQty, ordType : "Market", text : "auto"});
            
            request(requestHeader, function(error, response, body){
                if(error){
                    console.log(error)    
                    res.send(error);
                    return;
                }
                console.log("주문2 : " + body);
                //var resBody = JSON.parse(body);
                cb(null, data);
            });
        }
    ],function(error, data){
        if(error){
            console.log("waterfall error : " + error);
            res.send(error);
            return;
        }
        res.send({});
    });
}


function setRequestHeader(apiKey, apiSecret, verb, endpoint, data){
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
            url: bitmexURL+path,
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
            url: bitmexURL+path + query,
            method: verb
        };
    }
    return requestOptions;
  }