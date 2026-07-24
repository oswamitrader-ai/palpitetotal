const url = 'https://xybbhnteetzoccazcdae.supabase.co/rest/v1/bets?select=*';
const key = 'sb_publishable_3kLoucvT569s61RLznkEVw_WG__2n_n';

fetch(url, {
  headers: {
    'apikey': key
    // NOT sending Authorization bearer key to simulate unauthenticated RLS!
  }
})
.then(res => res.json())
.then(data => {
  console.log("bets without bearer:", JSON.stringify(data).substring(0, 200));
})
.catch(err => console.error(err));
