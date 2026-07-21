const https = require('https');

const ACCESS_TOKEN = '<REMOVED_SECRET>';
const PROJECT_REF = 'xybbhnteetzoccazcdae';

const query = JSON.stringify({
  query: "SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'profiles';"
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
    console.log('Políticas de Segurança (RLS):', body);
  });
});

req.write(query);
req.end();
