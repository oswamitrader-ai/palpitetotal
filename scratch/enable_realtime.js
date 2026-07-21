const https = require('https');

const ACCESS_TOKEN = '<REMOVED_SECRET>';
const PROJECT_REF = 'xybbhnteetzoccazcdae';

const query = JSON.stringify({
  query: `
    ALTER PUBLICATION supabase_realtime ADD TABLE bets;
    ALTER PUBLICATION supabase_realtime ADD TABLE user_bets;
    ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
    ALTER PUBLICATION supabase_realtime ADD TABLE posts;
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  `
});

const req = https.request({
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(query)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Resultado:', body);
  });
});

req.write(query);
req.end();
