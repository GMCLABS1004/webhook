var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var orderSchema = new Schema({
    site : {type:String, default : "bitmex", unique : true, required : true},
    url : {type:String, default : ""},
    symbol : {type:String, default : ""},       
    side : {type:String, default : 1}, //스크립트 넘버
    price : {type:Number, default : 1}, //레버리지
    amount : {type:Number, default : 10}, //마진
    timestamp : {type : Date, default : Date.now},
    isSend : {type:Boolean, default : false} //telegram 전송여부
});

module.exports = mongoose.model('order', orderSchema,'order');