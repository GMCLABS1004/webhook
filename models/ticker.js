var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var tickerSchema = new Schema({
    site : {type:String, default : 'bitmex'},  
    site_type : {type:String, default : 'oversee'},
    last_price : {type:Number, default : 0},
    timestamp : {type : Date, default : Date.now}
});
tickerSchema.index({ site :1, site_type : 1});
module.exports = mongoose.model('ticker', tickerSchema,'ticker');