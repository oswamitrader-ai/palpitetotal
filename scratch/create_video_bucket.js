acces tokenconst https = require('https');
const ACCESS_TOKEN = '<REMOVED_SECRET>';
const PROJECT_REF = 'xybbhnteetzoccazcdae';

const query = JSON.stringify({
  query: `
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('videos', 'videos', true)
    ON CONFLICT (id) DO NOTHING;
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
}, res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => console.log('Bucket resultado:', b));
});
req.write(query);
req.end();
