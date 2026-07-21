const https = require('https');
const ACCESS_TOKEN = '<REMOVED_SECRET>';
const PROJECT_REF = 'xybbhnteetzoccazcdae';

const query = JSON.stringify({
  query: `
    ALTER TABLE bets
      ADD COLUMN IF NOT EXISTS bet_type TEXT DEFAULT 'CLASSIC',
      ADD COLUMN IF NOT EXISTS count_target INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS count_subject TEXT DEFAULT 'pessoas',
      ADD COLUMN IF NOT EXISTS count_location TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS live_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS count_min INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS count_max INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS camera_label TEXT DEFAULT '';
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
  res.on('end', () => console.log('Resultado migração:', body));
});
req.write(query);
req.end();
