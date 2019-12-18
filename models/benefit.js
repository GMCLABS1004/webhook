var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var benefitSchema = new Schema({
    site: {type:String, default : "bitmex1"},
    site_type: {type:String, default : "oversee"},
    timestamp : {type:Date}, //탈출시간
    start_asset_sum : {type:Number, default : 0}, //site전체 첫 총자산합
    end_asset_sum : {type:Number, default : 0}, //site전체 첫 총자산합
    before_asset_sum : {type:Number, default : 0}, //탈출전 site전체 총자산합
    after_asset_sum : {type:Number, default : 0}, //탈출후 site전체 총자산합
    benefit : {type:Number, default : 0}, //position
    benefitRate : {type:Number, default : 0}, //site 전체 총자산대비 수익율
    type_log : {type:String, default : ""}, //trailingStop, rentry, etc
});

benefitSchema.index({site :1});
module.exports = mongoose.model('benefit', benefitSchema,'benefit');