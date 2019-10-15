var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var orderSchema = new Schema({
    site_type : {type:String, default : 'korean'}, //총자산
    totalAsset : {type:Number, default : 0}, //총자산
    type : {type:String, default : ""},
    side : {type:String, default : ""},
    start_price : {type:Number, default : 0}, //가격
    end_price : {type:Number, default : 0}, //가격
    price : {type:Number, default : 0}, //가격
    amount : {type:Number, default : 0}, //수량
    value : {type:Number, default : 0}, //가치
    feeRate : {type:Number, default : 0}, //수수료 비율
    fee : {type:Number, default : 0}, //수수료
    benefit : {type:Number, default : 0}, //수익
    benefitRate : {type:Number, default : 0}, //수익
    div_cnt : {type:Number, default : 0}, //수익
    start_time : {type : Date, default : Date.now},
    end_time : {type : Date, default : Date.now}
});
orderSchema.index({ site :1, start_time : 1, end_time :1});
module.exports = mongoose.model('order_avg', orderSchema,'order_avg');