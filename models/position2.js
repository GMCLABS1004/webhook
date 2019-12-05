var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var position2Schema = new Schema({
    site: {type:String, default : "bitmex1", required : true},
    site_type: {type:String, default : "oversee"},
    avgEntryPrice: {type:Number, default : 0},//position
    isOpen: {type:Boolean, default : false}, //position
    liquidationPrice: {type:Number, default : 0},//position
    markPrice: {type:Number, default : 0}, //position
    realisedPnl: {type:Number, default : 0}, //position
    size: {type:Number, default : 0}, //position
    symbol : {type:String, default : "XBTUSD"}, //position
    unrealisedPnl: {type:Number, default : 0}, //position
    unrealisedRoePcnt: {type:Number, default : 0}, //position
    value: {type:Number, default : 0}, //position
    leverage : {type:Number, default : 0}, //setting
    margin: {type:Number, default : 0}, //setting
});

position2Schema.index({site :1});
module.exports = mongoose.model('position2', position2Schema,'position2');