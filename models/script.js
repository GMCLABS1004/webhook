var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var scriptSchema = new Schema({
    scriptName : {type:String, default : 1},      
    scriptNo : {type:Number, default : 1, unique : true},       
    version : {type:Number, default : 1},
    log : {type:String, default : ""},
    long1 : {type : Array, default : []},
    long2 : {type : Array, default : []},
    long3 : {type : Array, default : []},
    long4 : {type : Array, default : []},
    long5 : {type : Array, default : []},
    short1 : {type : Array, default : []},
    short2 : {type : Array, default : []},
    short3 : {type : Array, default : []},
    short4 : {type : Array, default : []},
    short5 : {type : Array, default : []},
    timestamp : {type : Date, default : Date.now}
});
scriptSchema.index({scriptNo :1});
module.exports = mongoose.model('script', scriptSchema,'script');