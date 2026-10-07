const axios = require('axios');
async function test() {
  const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
  const searchRes = await axios.get('https://weebcentral.com/search/data?text=One%20Punch%20Man', { headers: HEADERS });
  const seriesMatch = searchRes.data.match(/href="([^"]*\/series\/([A-Z0-9]+)\/[^"]*)"/i);
  console.log('Series Match URL:', seriesMatch[1], 'ID:', seriesMatch[2]);
  
  const chaptersRes = await axios.get(`https://weebcentral.com/series/${seriesMatch[2]}/full-chapter-list`, { headers: HEADERS });
  const blocks = chaptersRes.data.split('<a href="');
  console.log('Total blocks:', blocks.length);
  
  const chRegex = new RegExp(`Chapter\\s+0*1\\b`, 'i');
  for (const block of blocks) {
    if (block.includes('/chapters/') && chRegex.test(block)) {
      console.log('Found chapter 1 match in block:', block.substring(0, 100));
    }
  }
}
test();
