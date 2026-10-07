const axios = require('axios');
async function test() {
  const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
  const chaptersRes = await axios.get(`https://weebcentral.com/series/01J76XY7KT7J224EBK6J816Y1Q/full-chapter-list`, { headers: HEADERS });
  const blocks = chaptersRes.data.split('<a href="');
  let count = 0;
  for (let i = blocks.length - 1; i > blocks.length - 10; i--) {
    if (blocks[i].includes('/chapters/')) {
      const textOnly = blocks[i].replace(/<[^>]+>/g, ' ').trim();
      console.log('Chapter:', textOnly.substring(0, 100));
      count++;
    }
  }
}
test();
