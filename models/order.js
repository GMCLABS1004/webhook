var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var orderSchema = new Schema({
    site : {type:String, default : "-1", required : true},
    symbol : {type:String, default : ""},
    totalAsset : {type:Number, default : 1}, //총자산
    type : {type:String, default : ""},
    side : {type:String, default : ""},
    price : {type:Number, default : 1}, //가격
    amount : {type:Number, default : 1}, //수량
    value : {type:Number, default : 1}, //가치
    feeRate : {type:Number, default : 1}, //수수료 비율
    fee : {type:Number, default : 1}, //수수료
    benefit : {type:Number, default : 0}, //수익
    benefitRate : {type:Number, default : 0}, //수익
    div_cnt : {type:Number, default : 0}, //수익
    start_time : {type : Date, default : Date.now},
    end_time : {type : Date, default : Date.now},
    isSend : {type:Boolean, default : false} //telegram 전송여부
});
orderSchema.index({ site :1, start_time : 1, end_time :1});
module.exports = mongoose.model('order', orderSchema,'order');