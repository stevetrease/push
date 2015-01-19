console.log("process.env.NODE_ENV:" + process.env.NODE_ENV);
switch (process.env.NODE_ENV) {
	case 'development':
		console.log ("production mode");
		var config = require('./config.json');
		break;
	case 'production':
		console.log ("development mode");
	default:	
		var config = require('./config.json');
}




var agent = require("./agent/_header");
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
redisClient.smembers("push-tokens-devices", function (err, replies) {
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
	redisClient.smembers("push-tokens-devices", function (err, replies) {	
		devices = [];
		console.log("loading " +  replies.length + " devices");	
		for (r in replies) { 
			var obj = JSON.parse(replies[r]);
			devices.push(obj);
		}
	});
});


var mqtt = require('mqtt');
var mqttclient = mqtt.createClient(parseInt(config.mqtt.port, 10), config.mqtt.host, function(err, client) {
		keepalive: 1000
});
mqttclient.on('connect', function() {
	console.log("subscribing");
	mqttclient.subscribe('push/message');
	mqttclient.subscribe('push/alert');

	mqttclient.on('message', function(topic, message) {
		count++;
		switch(topic) {
			case "push/alert":
				console.log ("alert: " + message);
				pushAlert = message;
				pushMessage = "";
				break;
			case "push/message":
				object = JSON.parse(message)
				console.log ("message: " + object.alert);
				pushAlert = object.alert;
				pushMessage = object.message;
				break;
			default: 
				console.log ("invalid topic " & topic);
		}
		for (d in devices) {
			console.log("-   push " + count + ": " + devices[d].device);
			agent.createMessage()
  				.alert(pushAlert)
  				.sound()      // fix for silent pushes not working woth prod for iOS 8.1
  				.set('payload', pushMessage)
				.set('timestamp', Date.now() / 1000)
				.set('messageID', count)
				.contentAvailable(true)
  				.device(devices[d].token)
  				.send();
		}
	});
});


feedback
	.set('interval', '30s')
	.connect();
feedback.use (function (device, timestamp, done) {
	var token = device.toString();
	var ts = timestamp.getTime();
	
	console.log ("feedback event: device " + token);	
});