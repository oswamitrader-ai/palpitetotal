const urlBase = 'https://xybbhnteetzoccazcdae.supabase.co/rest/v1';
const key = 'sb_publishable_3kLoucvT569s61RLznkEVw_WG__2n_n';

function req(table) {
  return fetch(`${urlBase}/${table}`, {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  }).then(r => r.json());
}

Promise.all([
  req('platform_settings?id=eq.default'),
  req('bets'),
  req('bet_options'),
  req('bet_history'),
  req('categories'),
  req('user_bets'),
  req('orders'),
  req('user_portfolios'),
  req('transactions'),
  req('posts'),
  req('profiles'),
  req('post_likes'),
  req('post_comments')
]).then(results => {
  const names = ['settings', 'bets', 'bet_options', 'history', 'categories', 'user_bets', 'orders', 'portfolios', 'transactions', 'posts', 'profiles', 'likes', 'comments'];
  results.forEach((r, i) => {
    console.log(names[i] + ' count:', Array.isArray(r) ? r.length : (r.error ? r.error : 1));
    if (r.error || r.message) {
      console.log('Error in', names[i], r);
    }
  });
}).catch(e => console.error(e));
