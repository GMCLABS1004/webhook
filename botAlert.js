var forever = require('forever');

var botArr = new Array();
botArr.push({botName : "marginTrade", msg : "마진거래", isSend : false});
const TelegramBot = require('node-telegram-bot-api');
// replace the value below with the Telegram token you receive from @BotFather
var setting = require('./botAlert.json');
const token = setting.token;//'944707193:AAHwPFrFbWZYK673jSnVTsJC9QEm_gNcR8Q'
console.log(token);
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, {polling: true});

setTimeout(alarmBotStatus(), 0);
setInterval(alarmBotStatus(), 10000);
//bot.sendMessage(888129309, '[Stopped] '+ botArr[0].msg); //주태경
function alarmBotStatus(){
    return function(){
        forever.list(false, function(err,processes){
            if(err){
              console.log(err);
              //res.send({error : err, botStatus : ""});
            }else{
              if(processes){
                for(i=0; i<botArr.length; i++){
                  for(j=0; j<processes.length; j++){
                    if(processes[j].file.indexOf(botArr[i].botName) !== -1 && processes[j].running === true){ //forever list에 봇이 존재하면서 정상동작중이면
                        if( botArr[i].isSend === true){
                            botArr[i].isSend =false;
                        }
                    }
                    else if(processes[j].file.indexOf(botArr[i].botName) !== -1 && processes[j].running === false){ //forever list에 봇이 존재하면서 stopped이면
                        
                        if( botArr[i].isSend === false){
                            botArr[i].isSend = true;
                            bot.sendMessage(487119052, '[Stopped] ' + botArr[i].msg); //대표님
                            bot.sendMessage(803791407, '[Stopped] ' + botArr[i].msg); //연호형님
                            bot.sendMessage(728701781, '[Stopped] '+ botArr[i].msg); //수식형님
                            bot.sendMessage(888129309, '[Stopped] '+ botArr[i].msg); //주태경
                            var runner = forever.restart(processes[j].file, true);
                            runner.on('restart', function (processes) {
                              if (processes) {
                                forever.log.info('Forever restarted process(es):');
                                processes.split('\n').forEach(function (line) {
                                  forever.log.data(line);
                                });
                              } 
                              else{
                                forever.log.info('No forever processes running');
                              }
                            });
                        }
                    }
                  }
                }
                //console.log("isSend : " + botArr[0].isSend);
              }
            }
        });
    }
}



// // // Matches "/echo [whatever]"
// bot.onText(/\/echo (.+)/, (msg, match) => {
//   // 'msg' is the received Message from Telegram
//   // 'match' is the result of executing the regexp above on the text content
//   // of the message
 
//   const chatId = msg.chat.id;
//   const resp = match[1]; // the captured "whatever"
 
//   // send back the matched "whatever" to the chat
//   bot.sendMessage(chatId, resp);
// });
 
// // Listen for any kind of message. There are different kinds of
// // messages.
// bot.on('message', (msg) => {
//     console.log(msg);
//   const chatId = msg.chat.id;

//   // send a message to the chat acknowledging receipt of their message
//   bot.sendMessage(chatId, 'Received your message');
// });