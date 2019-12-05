var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var marginSchema = new Schema({
    site: {type:String, default : "bitmex1", required : true},
    site_type: {type:String, default : "oversee"},
    walletBalance : {type:Number, default : 0}, //총액
    marginBalance : {type:Number, default : 0}, //position
    availableMargin : {type:Number, default : 0}, //이용가능금액
});

marginSchema.index({site :1});
module.exports = mongoose.model('margin', marginSchema,'margin');