var div_exit_bitmex = require('./lib/div_exit_bitmex');
var div_entry_bitmex = require('./lib/div_entry_bitmex');


var data = {
    idx : 1,
    url : 'https://testnet.bitmex.com',
    apiKey : '-2YJMJOGLRMvUgaBD1_KzbLt',
    secreteKey : 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd',
    symbol : 'XBTUSD',
    goalAmt : 0,
    totalOrdAmt : 0,
    openingQty : 0, //진입한 포지션 수량 
    side : "",
    minAmtRate : 0.6, //최소주문비율
    maxAmtRate : 0.8, //최대주문비율
    isOrdered : false, //주문시도 여부
    isSuccess : false, //주문성공 여부
    isContinue : false, //주문분할 계속할지 여부
}

setTimeout(div_exit_bitmex(data), 0);

var data = {
    idx : 1,
    url : 'https://testnet.bitmex.com',
    apiKey : '-2YJMJOGLRMvUgaBD1_KzbLt',
    secreteKey : 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd',
    symbol : 'XBTUSD',
    firstMargin : 0,
    totalRemainAmt : 0, //미체결 수량
    totalRemainVal : 0, //미체결 가치
    goalValue : Math.floor(9960.5 / 2), //주문 목표 금액
    totalOrdValue : 0, //주문넣은 가치 합산
    side : "Buy", //주문 타입
    minValueRate : 0.5, //최소주문비율
    maxValueRate : 0.8, //최대주문비율
    orderID : "", //주문id'
    msg : "div1"
}

setTimeout(div_entry_bitmex(data), 10000);