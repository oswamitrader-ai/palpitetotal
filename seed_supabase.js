const https = require('https');

const ACCESS_TOKEN = '<REMOVED_SECRET>';
const PROJECT_REF = 'xybbhnteetzoccazcdae';

const seedSql = `
INSERT INTO public.profiles (id, username, xp, level, referral_count, interests)
VALUES ('default_user', 'PalpiteiroMestre', 150, 1, 0, 'Tempo,Esportes,Política')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.transactions (amount, description, type, timestamp)
SELECT 1000.00, 'Bônus de Boas-Vindas Seguro', 'DEPOSIT', NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.transactions);

INSERT INTO public.bets (id, title, description, category, creator_name, option_a, option_b, odds_a, odds_b, status, is_trending, total_pool, created_at)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 'Será que chove hoje em São Paulo?', 'Baseado na previsão oficial do tempo de Congonhas.', 'Tempo', 'Sistema', 'Sim', 'Não', 1.80, 2.10, 'OPEN', true, 12450.00, NOW()),
  (2, 'O próximo debate eleitoral mencionará ''Moeda Única''?', 'Palavra exata dita por qualquer candidato na TV aberta.', 'Política', 'Sistema', 'Sim', 'Não', 1.95, 1.85, 'OPEN', true, 35200.00, NOW()),
  (3, 'O Palmeiras ganhará o clássico paulista neste domingo?', 'Partida oficial do Campeonato Brasileiro de Futebol.', 'Esportes', 'Sistema', 'Sim', 'Não', 2.15, 1.75, 'OPEN', true, 84000.00, NOW()),
  (4, 'O metrô da Linha Amarela atrasará no pico amanhã?', 'Definido como interrupção reportada por mais de 5 minutos.', 'Dia-a-dia', 'Sistema', 'Sim', 'Não', 1.65, 2.30, 'OPEN', true, 5400.00, NOW()),
  (5, 'O preço do pão francês passará de R$ 22/kg na padaria central?', 'Acompanhamento da tabela de preços na zona sul.', 'Dia-a-dia', 'Sistema', 'Sim', 'Não', 1.90, 1.90, 'OPEN', false, 1200.00, NOW()),
  (6, 'Quem levará o prêmio de melhor álbum no festival nacional?', 'Escolha oficial do júri técnico do evento.', 'Entretenimento', 'Sistema', 'Favorito', 'Indie Revelação', 1.40, 3.10, 'OPEN', true, 15800.00, NOW())
ON CONFLICT (id) DO NOTHING;

-- Adjust sequence for bets
SELECT setval('public.bets_id_seq', (SELECT MAX(id) FROM public.bets));

INSERT INTO public.posts (id, username, user_level, user_badge, bet_id, bet_title, chosen_option, chosen_option_text, odds, comment, likes, timestamp)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 'VidenteDasOdds', 4, 'Especialista', 1, 'Será que chove hoje em São Paulo?', 'A', 'Sim', 1.80, 'Chovendo canivete aqui na Zona Sul! Essa odd 1.80 é dinheiro grátis, confia!', 12, NOW() - INTERVAL '5 minutes'),
  (2, 'DebatedorProfissional', 3, 'Palpiteiro', 2, 'O próximo debate eleitoral mencionará ''Moeda Única''?', 'A', 'Sim', 1.95, 'Sempre trazem pauta econômica no segundo bloco. Vai ser citado de certeza!', 8, NOW() - INTERVAL '10 minutes'),
  (3, 'VerdaoDeCoracao', 5, 'Mestre Supremo', 3, 'O Palmeiras ganhará o clássico paulista neste domingo?', 'A', 'Sim', 2.15, 'O retrospecto em casa é absurdo e o rival tá poupando elenco. All-in!', 24, NOW() - INTERVAL '20 minutes')
ON CONFLICT (id) DO NOTHING;

-- Adjust sequence for posts
SELECT setval('public.posts_id_seq', (SELECT MAX(id) FROM public.posts));
`;

const postData = JSON.stringify({ query: seedSql });

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
    console.log('Seed Status:', res.statusCode);
    console.log('Seed Response:', body);
  });
});

req.write(postData);
req.end();
