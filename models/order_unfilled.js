var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var order_unfilledSchema = new Schema({
    site : {type:String, default : "-1", required : true},
    ordStatus : {type:String, default : ""},
    orderID : {type:String, default : ''}, //총자산
    parentID : { type: mongoose.Schema.Types.ObjectId, ref: 'order' },
    side : {type:String, default : ''}, //총자산
    price : {type:Number, default : ""},
    orderQty : {type:Number, default : ""}, //div || trailingStop
    leavesQty : {type:Number, default : ""},
    cumQty : {type:Number, default : 1},
    timestamp : {type : Date, default : Date.now},
});
order_unfilledSchema.index({site :1, orderID : 1, timestamp : 1});
module.exports = mongoose.model('order_unfilled', order_unfilledSchema,'order_unfilled');