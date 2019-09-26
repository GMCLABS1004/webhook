const winston = require('winston');
require('winston-daily-rotate-file');
require('date-utils');
var div_test = require('./lib/div_test');

var logger_bitmex;
var logfileName0_1 = './log/bitmex' +'.log'; //로그파일 경로1
var logfileName0_2 = './log/bitmex' +'.debug.log'; //로그파일 경로2
create_logger(logfileName0_1, logfileName0_2, function(loggerHandle){ logger_bitmex = loggerHandle; logger_bitmex.info("비트멕스"); div_test(logger_bitmex);}); //logger 생성

var logger_bithumb;
var logfileName1_1 = './log/bithumb' +'.log'; //로그파일 경로1
var logfileName1_2 = './log/bithumb' +'.debug.log'; //로그파일 경로2
create_logger(logfileName1_1, logfileName1_2, function(loggerHandle){ logger_bithumb = loggerHandle; logger_bithumb.info("빗썸");}); //logger 생성


var logger_coinone;
var logfileName2_1 = './log/coinone' +'.log'; //로그파일 경로1
var logfileName2_2 = './log/coinone' +'.debug.log'; //로그파일 경로2
create_logger(logfileName2_1, logfileName2_2, function(loggerHandle){ logger_coinone = loggerHandle; logger_coinone.info("코인원");}); //logger 생성


var logger_upbit;
var logfileName3_1 = './log/upbit' +'.log'; //로그파일 경로1
var logfileName3_2 = './log/upbit' +'.debug.log'; //로그파일 경로2
create_logger(logfileName3_1, logfileName3_2, function(loggerHandle){ logger_upbit = loggerHandle; logger_upbit.info("업비트");}); //logger 생성




/**
 * 
 * @param {String} info 레벨 로그 logfileName1 
 * @param {String} debug 레벨 로그 logfileName2 
 */
function create_logger(logfileName1, logfileName2, callback){
    var handle =  winston.createLogger({
        level: 'debug', // 최소 레벨
        // 파일저장
        transports: [
            new winston.transports.DailyRotateFile({
                level : 'info',
                filename : logfileName1, // log 폴더에 system.log 이름으로 저장
                zippedArchive: false, // 압축여부
                maxFiles: '14d',
                format: winston.format.printf(
                    info => `${new Date().toFormat('YYYY-MM-DD HH24:MI:SS')} [${info.level.toUpperCase()}] - ${info.message}`)
            }),
    
            new winston.transports.DailyRotateFile({
                filename : logfileName2, // log 폴더에 system.log 이름으로 저장
                zippedArchive: false, // 압축여부
                maxFiles: '14d',
                format: winston.format.printf(
                    info => `${new Date().toFormat('YYYY-MM-DD HH24:MI:SS')} [${info.level.toUpperCase()}] - ${info.message}`)
            }),
            // 콘솔 출력
            new winston.transports.Console({
                format: winston.format.printf(
                    info => `${new Date().toFormat('YYYY-MM-DD HH24:MI:SS')} [${info.level.toUpperCase()}] - ${info.message}`)
            })
        ]
    });
  
    callback(handle);
  }