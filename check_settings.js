const url = 'https://xybbhnteetzoccazcdae.supabase.co/rest/v1/platform_settings?select=*';
const key = 'sb_publishable_3kLoucvT569s61RLznkEVw_WG__2n_n';

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
})
.then(res => res.json())
.then(data => {
  console.log("platform_settings no banco:");
  console.log(JSON.stringify(data, null, 2));
})
.catch(err => console.error(err));
