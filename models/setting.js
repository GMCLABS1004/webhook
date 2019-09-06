var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var settingSchema = new Schema({
    site : {type:String, default : "bitmex", unique : true, required : true},
    url : {type:String, default : "https://testnet.bitmex.com"},
    symbol : {type:String, default : "XBTUSD"},       
    apiKey : {type:String, default : "-2YJMJOGLRMvUgaBD1_KzbLt"},
    secreteKey : {type:String, default : "aEvaHawjJK5bU3ePZqNtzSt7I6smHfelkDRV6YS_lmmQffwd"},
    leverage : {type:Number, default : 1},            
    margin : {type:Number, default : 10},
    scriptNo : {type:Number, default : 1},
    minOrdCost : {type:Number, default : 20000}
});

module.exports = mongoose.model('setting', settingSchema,'setting');