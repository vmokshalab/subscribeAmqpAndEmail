var amqpLib = require('amqplib'),
    fs = require('fs'),
    express = require('express'),
    Mailgun = require('mailgun-js');

//read config.json file and parse json data
var filename = __dirname + "/config.json";
var config = JSON.parse (fs.readFileSync(filename,'utf8'));

var url = config.rabbitmq.amqpurl; // default to localhost
var open = amqpLib.connect(url);

var app = express();
console.log("process.env.PORT=" + process.env.PORT)
var allowCrossDomain = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  // intercept OPTIONS method
  if ('OPTIONS' === req.method) { res.send(200); }
  else { next(); }
};

app.configure(function () {
    app.use(express.logger('dev'));     /* 'default', 'short', 'tiny', 'dev' */
     app.use(allowCrossDomain);
    app.use(express.bodyParser());
});

app.listen(process.env.PORT || 2455);

/*try {
    //Cron Job started
    new cronJob( config.cron.schedule, function ()
    {
       console.log( "Starting subscribeamqpemail instance(using schedule)....." + new Date() +" "+config.cron.schedule);
        setTimeout( function () { StockTweets(); }, 0 );
    }, null, true, config.cron.timeZone );
   
} 
catch(ex) 
{
    console.log("cron pattern not valid");
}*/

open.then(function(conn) {
  var ok = conn.createChannel();
  ok = ok.then(function(ch) {
      console.log("rabbitMQ connected");
    ch.assertQueue(config.rabbitmq.queue+'');
    ch.bindQueue(config.rabbitmq.queue,config.rabbitmq.exchange,'Dummy');
    ch.consume(config.rabbitmq.queue, function(msg) {
        console.log("Start consuming message from rabbitMQ Queue");
      if (msg !== null) {
        console.log(msg.content.toString());
        ch.ack(msg);
        var requestObj = JSON.parse(msg.content.toString());
          //Instantiate Mailgun
    var mailgun = new Mailgun({apiKey: config.mailgun.api_key, domain: config.mailgun.domain});
    var from = config.mailgun.default_from;
    if(requestObj.FromEmail !== null && requestObj.FromEmail !== "" && requestObj.FromEmail !== undefined){
        console.log("Checked for FromEmail parameter");
        from = requestObj.FromEmail
    }
    //Create Mail Message
    var data = {
      from: from,
      to: requestObj.ToEmail,
      subject: requestObj.Subject,
      text: requestObj.Body
    };
    
    console.log("Got the message to be sent as mail");
    
     //Send Mail Message
    try{
            console.log("Try Sending mail");
            mailgun.messages().send(data, function (error, body) {
            if(error !== undefined){
                console.log('Exception while sending mail...'+ error.message);
            }else{
                console.log('Mail Send Successfully...');
                console.log(body);
            }
        });
    }
    catch ( e ){ 
        console.log('Exception while sending mail...');
        console.log( "Exception: "+e.message );
    }
      }
    });
  });
  return ok;
}).then(null, console.warn);

