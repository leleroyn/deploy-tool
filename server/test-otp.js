const http = require('http');

const data = JSON.stringify({username: 'jtzj', password: '123456'});
const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'Content-Length': data.length}
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Login Response:', body);
    const result = JSON.parse(body);
    if (result.tempToken) {
      testOtpSetup(result.tempToken);
    }
  });
});
req.write(data);
req.end();

function testOtpSetup(tempToken) {
  const data2 = JSON.stringify({tempToken});
  const options2 = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/otp/setup',
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'Content-Length': data2.length}
  };
  
  const req2 = http.request(options2, (res2) => {
    let body = '';
    res2.on('data', chunk => body += chunk);
    res2.on('end', () => {
      console.log('OTP Setup Response:', body);
      const result = JSON.parse(body);
      if (result.qrCode) {
        console.log('QR Code length:', result.qrCode.length);
        console.log('SUCCESS: QR Code generated!');
      }
    });
  });
  req2.write(data2);
  req2.end();
}
