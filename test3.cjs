const axios = require('axios');
async function test() {
  const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
  const searchRes = await axios.get('https://weebcentral.com/search/data?text=One%20Punch%20Man', { headers: HEADERS });
  
  const seriesRegex = /href="([^"]*\/series\/[A-Z0-9]+\/[^"]*)"/i;
  const seriesMatch = searchRes.data.match(seriesRegex);
  
  const chaptersRes = await axios.get(seriesMatch[1] + '/full-chapter-list', { headers: HEADERS });
  const html = chaptersRes.data;
  
  const blocks = html.split('<a href="');
  
  console.log("\nFirst 5 chapters blocks:");
  let count = 0;
  for (const b of blocks) {
    if (b.includes('/chapters/')) {
       console.log(b.substring(0, 150));
       count++;
       if(count >= 5) break;
    }
  }
}
test();
