const mongoose = require('mongoose');
var Schema = mongoose.Schema;

var userSchema = new Schema({
    id : {type : String, defulat : "", unique : true, required : true},
    pw : {type : String, required : true}
});

userSchema.index({ id :1, currency : 1});

userSchema.methods.comparePassword = function(inputPassword, cb) {
    if (inputPassword === this.password) {
      cb(null, true);
    } else {
      cb('error');
    }
  };

module.exports = mongoose.model('users', userSchema,'users');

