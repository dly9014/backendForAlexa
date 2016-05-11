
var AWS = require('aws-sdk');
const https = require('https');
var sqs = new AWS.SQS();
var s3 = new AWS.S3();

exports.handler = function(event, context) {
	// event is the input JSON
	console.log('backendEMC function was invoked');	

	
	sqs.receiveMessage({
		QueueUrl: 'https://sqs.us-east-1.amazonaws.com/431311541923/toEMC',
		MaxNumberOfMessages: 1, 
		VisibilityTimeout: 20, 
		WaitTimeSeconds: 3 
	}, function(err, data) {
		// If there are any messages to get
		if (data.Messages) {
			
			var messageIn = data.Messages[0];
			var msgId = messageIn.MessageId; // single value so no parse
			console.log('message ID = ' + msgId );
			var msgReceipt = messageIn.ReceiptHandle ; // single value so no parse
			console.log('message receipt = ' + msgReceipt );
			var msgBody = JSON.parse(messageIn.Body); // parse to get subvalues
			
			var customer = msgBody.customer;
			console.log('customer = ' + customer);
			
			var pathToGet = '/w/api.php?action=query&titles=' + customer + '&prop=revisions&rvprop=content&format=json';
	
			var options = {
			  hostname: 'en.wikipedia.org',
			  port: 443,
			  path: pathToGet
			};

			https.get(options, function(res) {

				// initialize the container for our data
				var body = '';
				console.log("statusCode: ", res.statusCode); 		

				// this event fires many times, each time collecting another piece of the response
				res.on('data', function (chunk) {
					body += chunk;
				});

				// this event fires *one* time, after all the `data` events/chunks have been gathered
				res.on('end', function () {
					var parsedBody = JSON.parse(body);	
					var retValue = JSON.stringify( parsedBody["query"]["pages"]["515707"]["pageid"] ); // equivalent to JSON.stringify(body.query.pages.515707.pageid), but handles the integer
					console.log('retValue = ' + retValue);

/*					// don't delete right now for testing purposes *************
					// delete the original message that spawned this backend process from the 'toEMC' queue					
					var delParams = {
					  QueueUrl: 'https://sqs.us-east-1.amazonaws.com/431311541923/toEMC',
					  ReceiptHandle: msgReceipt
					};
					sqs.deleteMessage(delParams, function(err, data) {
					  if (err) console.log(err, err.stack); // an error occurred
					  else     console.log(data);           // successful response
					});					
*/					

/*					// random ID generator
					var value = "foobar";
					// generate random guid for filename
					var guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
						var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
						return v.toString(16);
					});
*/

					// put the data in the s3 bucket
					var s3params = {
							Bucket: 'emcalexa',
							Key: 'myKey',
							Body: JSON.stringify(parsedBody),
							ContentType: 'json'
						};
			

					s3.putObject(s3params, function(err, data) {
						if (err) { 
							console.log(err, err.stack); // an error occurred
						} else { 
							// successful response
							var eTag = JSON.parse(data.ETag);
							console.log('data.ETag = ' + JSON.parse(data.ETag));
						
							var outMsgParams = {
								MessageBody: eTag,
								QueueUrl: 'https://sqs.us-east-1.amazonaws.com/431311541923/fromEMC',
								MessageAttributes: {
									responseTo: {
										DataType: 'String',
										StringValue: msgId
									}
								}
							};
									 
							sqs.sendMessage(outMsgParams, function(err,data){
								if(err) {
									console.log('error:',"Fail Send Message" + err);
									context.done('error', "ERROR Put SQS");  // ERROR with message
								} else {
									console.log('data:',data);
									console.log('message ID:',data.MessageId);
									//context.done(null,'');  // SUCCESS 
								};
							});																				
						};
					});														
				});
			}).on('error', function (e) {
				console.log("Got error: ", e);
			});						
			
		};
	});
  
};