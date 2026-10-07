const axios = require('axios');
async function test() {
  const searchRes = await axios.get('https://weebcentral.com/search/data?text=One+Punch+Man', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const matches = [...searchRes.data.matchAll(/href="[^"]*\/series\/([A-Z0-9]+)\/([^"]*)"/ig)];
  for(const m of matches) console.log(m[1], m[2]);
}
test();
