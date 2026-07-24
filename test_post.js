const url = 'https://xybbhnteetzoccazcdae.supabase.co/rest/v1/posts';
const key = 'sb_publishable_3kLoucvT569s61RLznkEVw_WG__2n_n';

fetch(url, {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    username: 'admin',
    user_level: 1,
    user_badge: 'Novato',
    bet_id: 26,
    bet_title: 'Test Post',
    chosen_option: 'A',
    chosen_option_text: 'Option A',
    odds: 1.9,
    comment: 'Test comment from script',
    likes: 0
  })
})
.then(res => res.json())
.then(data => {
  console.log("Insert result:", JSON.stringify(data));
})
.catch(err => console.error(err));
