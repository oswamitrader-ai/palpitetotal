const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xybbhnteetzoccazcdae.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3kLoucvT569s61RLznkEVw_WG__2n_n';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testInsertProfile() {
  const { data, error } = await supabase.from('profiles').upsert({
    id: 'user_test_' + Date.now(),
    username: 'TestUser',
    email: 'test@example.com',
    xp: 150,
    level: 1,
    referral_count: 0,
    interests: 'Tempo,Esportes'
  });

  console.log('Data:', data);
  console.log('Error:', error);
}

testInsertProfile();
