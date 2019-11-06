var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var positionSchema = new Schema({
    site_type : {type:String, default : "oversee", required : true},
    last_price : {type:Number, default : 0},
    list : {type:Array, default : []},
    timestamp : {type : Date, default : Date.now},
});

positionSchema.index({site_type :1});
module.exports = mongoose.model('position', positionSchema,'position');