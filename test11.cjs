const axios = require('axios');
async function test() {
  const chapter = '1';
  const HEADERS = { 'User-Agent': 'Mozilla/5.0' };
  const searchRes = await axios.get('https://weebcentral.com/search/data?text=One%20Punch%20Man', { headers: HEADERS });
  const seriesMatch = searchRes.data.match(/href="[^"]*\/series\/([A-Z0-9]+)\/[^"]*"/i);
  const seriesId = seriesMatch[1];
  
  const chaptersRes = await axios.get(`https://weebcentral.com/series/${seriesId}/full-chapter-list`, { headers: HEADERS });
  const chaptersHtml = chaptersRes.data;
  
  const blocks = chaptersHtml.split('<a href="');
  let chapterId = null;
  const escapedChapter = chapter.replace('.', '\\.');
  
  for (const block of blocks) {
    if (block.includes('/chapters/')) {
      const textOnly = block.replace(/<[^>]+>/g, ' ').trim();
      const robustRegex = new RegExp(`(?:Chapter|Punch|Episode|Ch\\.?|)\\s*0*${escapedChapter}\\b`, 'i');
      if (robustRegex.test(textOnly)) {
        console.log('Regex Matched block!');
        const match = block.match(/.*\/chapters\/([A-Z0-9]+)/i);
        if (match) {
          chapterId = match[1];
          break;
        }
      }
    }
  }
  console.log('Resulting chapterId:', chapterId);
}
test();
