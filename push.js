var config = require('./config.json');
var agent = require("./agent/_header");
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
redisClient.smembers("push-tokens", function (err, replies) {
	console.log(replies);
	devices = replies;
});

// subscribe to redis channel "push-tokens-change" and refresh tokens
subscriber.subscribe("push-tokens-change");
subscriber.on("message", function(channel, message) {
	console.log("push-tokens-change")
	redisClient.smembers("push-tokens", function (err, replies) {
        	console.log(replies);
        	devices = replies;
	});
});


var mqtt = require('mqtt');
var mqttclient = mqtt.createClient(parseInt(config.mqtt.port, 10), config.mqtt.host, function(err, client) {
		keepalive: 1000
});
mqttclient.on('connect', function() {
	console.log("subscribing")
	mqttclient.subscribe('push/message');
	mqttclient.subscribe('push/alert');

	mqttclient.on('message', function(topic, message) {
		count++
		switch(topic) {
			case "push/alert":
				console.log ("alert: " + message);
				pushAlert = message
				pushMessage = ""
				break;
			case "push/message":
				object = JSON.parse(message)
				console.log ("message: " + object.alert);
				pushAlert = object.alert
				pushMessage = object.message
				break;
			default: 
				console.log ("invalid topic " & topic);
		}
		for (d in devices) {
			console.log("push " + count + ": " + devices[d])
			agent.createMessage()
  				.alert(pushAlert)
  				.set('payload', pushMessage)
				.set('timestamp', Date.now() / 1000)
				.set('messageID', count)
				.contentAvailable(true)
  				.device(devices[d])
  				.send();
		}
	});
});

