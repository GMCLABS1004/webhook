var div_exit_bitmex = require('./lib/div_exit_bitmex');
var div_entry_bitmex = require('./lib/div_entry_bitmex');
var div_exit_bithumb = require('./lib/div_exit_bithumb');
var div_entry_bithumb = require('./lib/div_entry_bithumb');

// var data = {
//     idx : 1,
//     url : 'https://testnet.bitmex.com',
//     apiKey : '-2YJMJOGLRMvUgaBD1_KzbLt',
//     secreteKey : 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd',
//     symbol : 'XBTUSD',
//     goalAmt : 0,
//     totalOrdAmt : 0,
//     openingQty : 0, //진입한 포지션 수량 
//     side : "",
//     minAmtRate : 0.6, //최소주문비율
//     maxAmtRate : 0.8, //최대주문비율
//     isOrdered : false, //주문시도 여부
//     isSuccess : false, //주문성공 여부
//     isContinue : false, //주문분할 계속할지 여부
// }

// setTimeout(div_exit_bitmex(data), 0);

// var data = {
//     idx : 1,
//     url : 'https://testnet.bitmex.com',
//     apiKey : '-2YJMJOGLRMvUgaBD1_KzbLt',
//     secreteKey : 'aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd',
//     symbol : 'XBTUSD',
//     firstMargin : 0,
//     totalRemainAmt : 0, //미체결 수량
//     totalRemainVal : 0, //미체결 가치
//     goalValue : Math.floor(9960.5 / 2), //주문 목표 금액
//     totalOrdValue : 0, //주문넣은 가치 합산
//     side : "Buy", //주문 타입
//     minValueRate : 0.5, //최소주문비율
//     maxValueRate : 0.8, //최대주문비율
//     orderID : "", //주문id'
//     msg : "div1"
// }

// setTimeout(div_entry_bitmex(data), 10000);
var bithumb = require('./API/bithumbAPI');
var bithumAPI = new bithumb('7446cc38540523fe9a0a04b033414ab5', '50684360909e128d413356721be9b614');

//빗썸탈출
var data = {
    idx : 1,
    apiKey : '7446cc38540523fe9a0a04b033414ab5',
    secreteKey : '50684360909e128d413356721be9b614',
    ordInterval : 5000,
    minOrdVal : 1100, //원
    minOrdAmt : 0,
    siteMinVal : 1000, //원
    siteMinAmt : 0, //btc 수량
    goalAmt : 0.0005, //목표 수량
    totalOrdAmt : 0, //누적 주문 수량 
    openingQty : 0, //진입한 포지션 수량 
    side : "",
    minAmtRate : 0.001, //최소수량비율 
    maxAmtRate : 0.002, //최대수량비율
    orderID : "",
    isOrdered : false, //주문시도 여부
    isSuccess : false, //주문성공 여부
    isContinue : false, //주문분할 계속할지 여부
}
setTimeout(div_exit_bithumb(bithumAPI, data), 0);


//빗썸 진입
var data = {
    idx : 1,
    apiKey : '7446cc38540523fe9a0a04b033414ab5',
    secreteKey : '50684360909e128d413356721be9b614',
    ordInterval : 5000,
    firstMargin : 0,
    availableMargin : 0, //잔액
    totalRemainAmt : 0, //주문후 남은 주문수량
    totalRemainVal : 0, //주문후 남은 가치
    goalValue : 60000, //주문 목표 금액

    totalOrdValue : 0, //주문넣은 가치 합산
    side : 'bid', //주문 타입
    minOrdValue : 14000, //최소주문금액
    siteMinValue : 2000, //거래소 주문 최소 가치
    minValueRate : 0.5, //최소주문비율
    maxValueRate : 0.8, //최대주문비율
    orderID : "", //주문id
    msg : "div1"
}

setTimeout(div_entry_bithumb(bithumAPI, data), 10000);











