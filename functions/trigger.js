const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/daq-system-rig/us-central1/aggregateFiveMinute',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write('{}');
req.end();
