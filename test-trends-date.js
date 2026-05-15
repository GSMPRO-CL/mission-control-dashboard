require('dotenv').config({ path: __dirname + '/.env' });
async function test() {
  const params = new URLSearchParams({
    engine:  'google_trends',
    q:       'Apple',
    geo:     'CL',
    date:    'today 12-m',
    api_key: process.env.SERPAPI_KEY,
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  const data = await res.json();
  const timeline = data.interest_over_time?.timeline_data || [];
  console.log(timeline.slice(0, 3).map(p => p.date));
}
test();
