const https = require('https');
const ACCESS_TOKEN = '<REMOVED_SECRET>';
const PROJECT_REF = 'xybbhnteetzoccazcdae';

const sql = `ALTER TABLE bets ADD COLUMN IF NOT EXISTS camera_url TEXT DEFAULT '';`;
const query = JSON.stringify({ query: sql });

const req = https.request({
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(query)
  }
}, res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => console.log('Resultado:', b));
});
req.write(query);
req.end();
