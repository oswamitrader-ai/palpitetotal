const https = require('https');

const ACCESS_TOKEN = '<REMOVED_SECRET>';
const PROJECT_REF = 'xybbhnteetzoccazcdae';

const fixSql = `
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2) DEFAULT 1000.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 150;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interests TEXT DEFAULT 'Tempo,Esportes,Política';

-- Força o PostgREST a recarregar o schema cache
NOTIFY pgrst, 'reload schema';
`;

const postData = JSON.stringify({ query: fixSql });

const req = https.request({
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status HTTP:', res.statusCode);
    console.log('Resposta Fix Schema:', body);
  });
});

req.write(postData);
req.end();
