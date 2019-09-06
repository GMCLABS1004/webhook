var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var signalSchema = new Schema({
    scriptNo : {type:Number, default : 1},       
    side : {type:String, default : ""}, //Buy || Sell || Exit
    log : {type:String, default : ""},
    timestamp : {type : Date, default : Date.now}
});
module.exports = mongoose.model('signal', signalSchema,'signal');