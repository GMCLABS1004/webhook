var createError = require('http-errors');
var express = require('express');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var redis = require('redis');
var session = require('express-session');
var redisStore = require('connect-redis')(session);
var mongoose = require('mongoose');
var passport = require('passport') //passport module add
  , LocalStrategy = require('passport-local').Strategy;
var cookieSession = require('cookie-session');
var flash = require('connect-flash');
var users = require('./routes/users');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var json2xls = require('json2xls');


var webSetting = require('./webSetting.json');
if(webSetting.redis_exec){
  var client = redis.createClient({host: webSetting.redis_server, port: 6379});
}
console.log("redis exec :" + webSetting.redis_exec)
var app = express();

mongoose.connect(webSetting.dbPath);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

if(webSetting.redis_exec){
  app.use(session({
    secret: 'ssshhhhh',
    // create new redis store.
    store: new redisStore({  client: client, ttl :  1000 * 60 * 60}), //host: webSetting.redis, port: 6379,
    saveUninitialized: false,
    resave: false
  }));
}else{
  app.use(cookieSession({
    keys: ['node_yun'],
    cookie: {
      maxAge: 1000 * 60 * 60 // 유효기간 1시간
    }
  }));
}

app.use(json2xls.middleware);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/remote', usersRouter);

/// catch 404 and forwarding to error handler
app.use(function(req, res, next){
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if(app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
      res.status(err.status || 500);
      res.render('error', {
          message: err.message,
          error: err
      });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
      message: err.message,
      error: {}
  });
});



module.exports = app;
