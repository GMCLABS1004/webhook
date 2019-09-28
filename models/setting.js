var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var settingSchema = new Schema({
    site : {type:String, default : "bitmex", required : true},
    url : {type:String, default : "https://testnet.bitmex.com"},
    symbol : {type:String, default : "XBTUSD"},       
    apiKey : {type:String, unique : true, default : "-2YJMJOGLRMvUgaBD1_KzbLt"},
    secreteKey : {type:String, unique : true, default : "aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd"},
    leverage : {type:Number, default : 1}, //레버리지      
    margin : {type:Number, default : 10}, //마진
    scriptNo : {type:Number, default : 1}, //스크립트 넘버
    minOrdCost : {type:Number, default : 2000},//주문최소비용
    ordInterval : {type:Number, default : 5},//주문 인터벌
    minOrdRate : {type:Number, default : 50}, //최소주문비율
    maxOrdRate : {type:Number, default : 90}, //최대주문비율
    execFlag : {type:Boolean, default : true}, //실행 on/off
    isExiting :  {type:Boolean, default : false}, //탈출중인지 여부
    isEntering :  {type:Boolean, default : false}, //진입중인지 여부
});

module.exports = mongoose.model('setting', settingSchema,'setting');