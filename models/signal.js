var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var signalSchema = new Schema({
    scriptNo : {type:Number, default : 1},       
    side : {type:String, default : ""}, //Buy || Sell || Exit
    side_num : {type:Number, default : 0},
    log : {type:String, default : ""}, 
    type_log : {type:String, default : ""}, //div || trailingStop
    timestamp : {type : Date, default : Date.now}
});
module.exports = mongoose.model('signal', signalSchema,'signal');