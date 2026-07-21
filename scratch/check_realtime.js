const https = require('https');

const ACCESS_TOKEN = '<REMOVED_SECRET>';
const PROJECT_REF = 'xybbhnteetzoccazcdae';

const query = JSON.stringify({
  query: "SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';"
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
    console.log('Tabelas com Realtime Ativo:', body);
  });
});

req.write(query);
req.end();
