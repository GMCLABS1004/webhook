var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var bid_1hSchema = new Schema({
    symbol: { type: String , default : "XBTUSD"},
    timestamp : { type: Date, unique : true},
    open : { type: Number, default : 0},
    high : { type: Number, default : 0},
    low : { type: Number, default : 0},
    close : { type: Number, default : 0},
    trades : { type: Number, default : 0},
    volume :{ type: Number, default : 0},
    vwap : { type: Number, default : 0},
    lastSize : { type: Number, default : 0},
    turnover : { type: Number, default : 0},
    homeNotional : { type: Number, default : 0},
    foreignNotional : { type: Number, default : 0},
    sma1 : { type: Number, default : 0}, //8
    sma2 : { type: Number, default : 0}, //26
    sma3 : { type: Number, default : 0}, //54
    sma4 : { type: Number, default : 0}, //90
    sma5 : { type: Number, default : 0}, //340
    ema : { type: Number, default : 0}, //340
});

bid_1hSchema.index({timestamp :1});

module.exports = mongoose.model('bid_1h', bid_1hSchema,'bid_1h');

