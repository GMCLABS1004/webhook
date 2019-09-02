var Slack = require('slack-node');
 
webhookUri = "http://15.164.94.164:3100/api/webhook";
 
slack = new Slack();
slack.setWebhook(webhookUri);
 
slack.webhook({
  channel: "#general",
  username: "webhookbot",
  text: "This is posted to #general and comes from a bot named webhookbot."
}, function(err, response) {
  console.log(response);
});