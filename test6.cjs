const axios = require('axios');
async function test() {
  const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
  const chaptersRes = await axios.get(`https://weebcentral.com/series/01J76XY7KT7J224EBK6J816Y1Q/full-chapter-list`, { headers: HEADERS });
  const blocks = chaptersRes.data.split('<a href="');
  let count = 0;
  for (const block of blocks) {
    if (block.includes('/chapters/')) {
      const match = block.match(/<span[^>]*>(.*?)<\/span>/s);
      if (match) console.log(match[1].trim());
      count++;
      if (count >= 10) break;
    }
  }
}
test();
