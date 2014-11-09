// Locate your certificate
var join = require('path').join
  , pfx = join(__dirname, '../_certs/prod.p12');


// Create a new agent
var apnagent = require('apnagent')
	, agent = module.exports = new apnagent.Agent();

// set our credentials
agent.set('pfx file', pfx);

// our credentials were for development
agent.enable('production');


agent.on('message:error', function (err, msg) {
  switch (err.name) {
    // This error occurs when Apple reports an issue parsing the message.
    case 'GatewayNotificationError':
      console.log('[message:error] GatewayNotificationError: %s', err.message);

      // The err.code is the number that Apple reports.
      // Example: 8 means the token supplied is invalid or not subscribed
      // to notifications for your application.
      if (err.code === 8) {
        console.log('    > %s', msg.device().toString());
        // In production you should flag this token as invalid and not
        // send any futher messages to it until you confirm validity
      }

      break;

    // This happens when apnagent has a problem encoding the message for transfer
    case 'SerializationError':
      console.log('[message:error] SerializationError: %s', err.message);
      break;

    // unlikely, but could occur if trying to send over a dead socket
    default:
      console.log('[message:error] other error: %s', err.message);
      break;
  }
});





agent.connect(function (err) {
	//  gracefully handle auth problems
	if (err && err.name === 'GatewayAuthorizationError') {
		console.log('Authentication Error: %s', err.message);
           	process.exit(1);
        } else if (err) {
       		// handle any other err (not likely)
       		consol.log(err.name);
                throw err;
        }

        // it worked!
        var env = agent.enabled('sandbox')
        	? 'sandbox'
              	: 'production';
        console.log('apnagent [%s] gateway connected', env);
	console.log();
});
