console.log("process.env.NODE_ENV:" + process.env.NODE_ENV);
switch (process.env.NODE_ENV) {
	case 'sandbox':
		console.log ("sandbox mode");
		var prod_mode = "sandbox";
		var config = require('./config.json');
		var agent = require("./agent/_header_sand");
		var pushTokenDevices = "push-tokens-devices-sand";
		break;
	case 'production':
	default:	
		console.log ("production mode");
		var config = require('./config.json');
		var prod_mode = "production";
		var agent = require("./agent/_header_prod");
		var pushTokenDevices = "push-tokens-devices";
}


var feedbackagent = require ('apnagent');
var feedback = new feedbackagent.Feedback ();
var redis = require('redis')
   ,redisClient = redis.createClient(parseInt(config.redis.port,10), config.redis.host);
var subscriber = redis.createClient(parseInt(config.redis.port,10), config.redis.host);





redisClient.on('connect'     , log('redis connect'));
redisClient.on('ready'       , log('redis ready'));
redisClient.on('reconnecting', log('redis reconnecting'));
redisClient.on('error'       , log('redis error'));
function log(type) {
    return function() {
        console.log(type, arguments);
    }
}
 
var count = 0;
var devices = [];

// get initial set of push tokens
redisClient.smembers(pushTokenDevices, function (err, replies) {
	console.log("loading " +  replies.length + " devices");
	for (r in replies) { 
		var obj = JSON.parse(replies[r]);
		devices.push(obj);
	}
});

// subscribe to redis channel "push-tokens-change" and refresh tokens
subscriber.subscribe("push-tokens-change");
subscriber.on("message", function(channel, message) {
	console.log("push-tokens-change");
	redisClient.smembers(pushTokenDevices, function (err, replies) {	
		devices = [];
		console.log("loading " +  replies.length + " devices");	
		for (r in replies) { 
			var obj = JSON.parse(replies[r]);
			devices.push(obj);
		}
	});
});


var mqtt = require('mqtt');
var mqttclient = mqtt.connect(config.mqtt.host, config.mqtt.options);
mqttclient.on('connect', function() {
	console.log("connect");
	mqttclient.subscribe('push/message');
	mqttclient.subscribe('push/alert');

	mqttclient.on('message', function(topic, message) {


              	// superess Particle boot messages
               	function stringStartsWith (string, prefix) {
               		return string.slice(0, prefix.length) == prefix;
                }
		var x = message.toString();
                if (stringStartsWith(x, "Particle")) {
			return;
		}


		count++;
		switch(topic) {
			case "push/alert":
				console.log ("alert " + count + ": " + message.toString());
				pushAlert = message.toString();
				pushMessage = message.toString();
				break;
			case "push/message":
				console.log ("message " + count +": " + message.toString());
				pushAlert = message.toString();
				pushMessage = message.toString();
				break;

			default: 
				console.log ("invalid topic " & topic);
		}
		for (d in devices) {
			console.log("-    " + devices[d].device);
			var push = agent.createMessage()
  				.sound()      // fix for silent pushes not working woth prod for iOS 8.1
  				.set('payload', pushMessage)
				.set('timestamp', Date.now() / 1000)
				.set('messageID', count)
				.contentAvailable(true)
  				.device(devices[d].token);
  			switch(topic) {
			case "push/alert":
			  	push.alert(pushAlert);
				break;
			case "push/message":
				push.alert();
				break;
			}	
			push.send();
		}
	});
});


feedback
	.set('interval', '30s')
	.connect();
feedback.use (function (device, timestamp, done) {
	var token = device.toString();
	var ts = timestamp.getTime();
	
	mqttclient.publish("push/alert", prod_mode + " feedback event for device " + token);
	console.log ("feedback event: device " + token);	
});
