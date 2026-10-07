const axios = require('axios');
async function test() {
  const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
  const searchRes = await axios.get('https://weebcentral.com/search/data?text=One%20Punch%20Man', { headers: HEADERS });
  
  const seriesRegex = /href="([^"]*\/series\/[A-Z0-9]+\/[^"]*)"/i;
  const seriesMatch = searchRes.data.match(seriesRegex);
  
  const chaptersRes = await axios.get(seriesMatch[1] + '/full-chapter-list', { headers: HEADERS });
  const html = chaptersRes.data;
  
  const blocks = html.split('<a href="');
  console.log("Last block:");
  console.log(blocks[blocks.length-1].substring(0, 150));
  
  console.log("\nSearching for chapter 1:");
  for (const b of blocks) {
    if (b.includes('Chapter 1<') || b.includes('Chapter 01<') || b.includes('Chapter 001<')) {
       console.log(b.substring(0, 150));
    }
  }
}
test();
