var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var signalSchema = new Schema({
    scriptNo : {type:Number, default : 1},       
    side : {type:String, default : ""}, //Buy || Sell || Exit
    side_num : {type:Number, default : 0},
    site : {type:String, default : "ALL"}, //ALL : 스크립트 넘버가 같은 모든 계정을 실행, bitmex1 -> 특정 계정에만 주문 실행,
    log : {type:String, default : ""}, 
    type_log : {type:String, default : ""}, //div || trailingStop || rentry
    timestamp : {type : Date, default : Date.now}
});
module.exports = mongoose.model('signal', signalSchema,'signal');