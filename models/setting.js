var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var settingSchema = new Schema({
    orderID : { type: String, unique : true},   //주문번호
    leverage : {type:String},                   //사용자
    margin : String,                            //심볼 ex) XBTUSD
    script : {type:Number, required:true},        //buy, sell
    avgPx : Number,                             //평균단가
    ordType : String,                           //주문 방식(시장,지정 ...)
    isBot : Boolean,                            //프로그램 상에서 주문(수동,자동)일 때 true
    text : String,                              //

    orderQty : Number,                          //총 주문 개수
    cumQty : Number,                            //채워진 개수
    leavesQty : Number,                         //남은 개수

    ordStatus : String,                         //주문 상태 (new, filled, partially filled, cancel)
    parentOrder : String                        //부모가 되는 주문 - 이것으로 검색후 한 번에 주문 취소
});

module.exports = mongoose.model('setting', settingSchema,'setting');