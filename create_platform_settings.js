const https = require('https');

const ACCESS_TOKEN = '<REMOVED_SECRET>';
const PROJECT_REF = 'xybbhnteetzoccazcdae';

const createSql = `
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  creator_royalty_pct NUMERIC(5,2) DEFAULT 3.00,
  house_margin_pct NUMERIC(5,2) DEFAULT 8.00,
  xp_create_bet INTEGER DEFAULT 100,
  xp_place_bet INTEGER DEFAULT 50,
  xp_share_feed INTEGER DEFAULT 50,
  xp_referral INTEGER DEFAULT 300,
  welcome_bonus NUMERIC(12,2) DEFAULT 1000.00,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insere valores padrão se a tabela estiver vazia
INSERT INTO public.platform_settings (id, creator_royalty_pct, house_margin_pct, xp_create_bet, xp_place_bet, xp_share_feed, xp_referral, welcome_bonus)
VALUES ('default', 3.00, 8.00, 100, 50, 50, 300, 1000.00)
ON CONFLICT (id) DO NOTHING;

-- Habilita RLS e libera leitura/escrita
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir tudo em platform_settings" ON public.platform_settings;
CREATE POLICY "Permitir tudo em platform_settings" ON public.platform_settings FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
`;

const postData = JSON.stringify({ query: createSql });

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
    console.log('Resposta platform_settings:', body);
  });
});

req.write(postData);
req.end();
