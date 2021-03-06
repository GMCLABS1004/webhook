var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var settingSchema = new Schema({
    site : {type:String, default : "bitmex", required : true},
    site_type : {type:String, default : "oversee", required : true},
    url : {type:String, default : "https://testnet.bitmex.com"},
    symbol : {type:String, default : "XBTUSD"},       
    apiKey : {type:String, unique : true, default : "-2YJMJOGLRMvUgaBD1_KzbLt"},
    secreteKey : {type:String, unique : true, default : "aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd"},
    leverage : {type:Number, default : 1}, //레버리지
    margin : {type:Number, default : 10}, //마진
    scriptNo : {type:Number, default : -1}, //스크립트 넘버
    minOrdCost : {type:Number, default : 2000},//주문최소비용
    ordInterval : {type:Number, default : 1},//주문 인터벌
    minOrdRate : {type:Number, default : 50}, //최소주문비율
    maxOrdRate : {type:Number, default : 90}, //최대주문비율
    side : {type:String, default : ''}, //프로그램 포지션1
    side2 : {type:String, default : 'exit'}, //프로그램 포지션2
    side_num : {type:Number, default : 1}, //현재 포지션번호
    execFlag : {type:Boolean, default : false}, //실행 on/off
    isExiting :  {type:Boolean, default : false}, //탈출중인지 여부
    isEntering :  {type:Boolean, default : false}, //진입중인지 여부
    isTrailingStop : {type:Boolean, default : false}, //트레일링 스탑 실행 여부
    trailingHighRate : {type:Number, default : 0}, //고점 대비 하락비율, 현재가 > entryPrice + 고점 대비 하락가격,  고점 대비 하락가격 = (highPrice - entryPrice) * trailingHighRate
    trailingLowRate : {type:Number, default : 0}, //고점 대비 하락비율, 현재가 > entryPrice + 고점 대비 하락가격,  고점 대비 하락가격 = (highPrice - entryPrice) * trailingHighRate
    trailFeeRate : {type:Number, default : 0},
    rentryFeeRate : {type:Number, default : 0},
    entryPrice : {type:Number, default : 0}, //진입가격
    highPrice : {type:Number, default : 0}, //진입후 ticker중 가장 높은 가격 업데이트
    lowPrice : {type:Number, default : 0}, //진입후 ticker중 가장 낮은 가격 업데이트
    trailPrice1 : {type:Number, default : 0},
    trailPrice2 : {type:Number, default : 0},
    rentryPrice1 : {type:Number, default : 0},
    rentryPrice2 : {type:Number, default : 0}
});
settingSchema.index({site :1, site_type : 1});
module.exports = mongoose.model('setting', settingSchema,'setting');