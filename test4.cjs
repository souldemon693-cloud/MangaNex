const axios = require('axios');
async function test() {
  const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
  const searchRes = await axios.get('https://weebcentral.com/search/data?text=One%20Punch%20Man', { headers: HEADERS });
  const seriesRegex = /href="([^"]*\/series\/[A-Z0-9]+\/[^"]*)"/i;
  const seriesMatch = searchRes.data.match(seriesRegex);
  console.log('URL:', seriesMatch[1]);
  const chaptersRes = await axios.get(seriesMatch[1] + '/full-chapter-list', { headers: HEADERS });
  require('fs').writeFileSync('weeb.html', chaptersRes.data);
  console.log('Saved to weeb.html');
}
test();
