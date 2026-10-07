const axios = require('axios');
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
};
async function test() {
  const searchRes = await axios.get('https://weebcentral.com/search/data?text=' + encodeURIComponent('Shingeki no Kyojin'), { headers: HEADERS });
  const searchHtml = searchRes.data;
  const seriesMatch = searchHtml.match(/href="[^"]*\/series\/([A-Z0-9]+)\/[^"]*"/i);
  console.log('Series ID:', seriesMatch ? seriesMatch[1] : 'Not found');
  
  const seriesId = seriesMatch[1];
  const chaptersRes = await axios.get('https://weebcentral.com/series/' + seriesId + '/full-chapter-list', { headers: HEADERS });
  console.log('Chapters HTML length:', chaptersRes.data.length);
  const regex = new RegExp(`href="\\/chapters\\/([A-Z0-9]+)"(?:(?!<a )[\\s\\S])*?<span class="[^"]*">Chapter\\s+1[<\\s]`, 'i');
  console.log('Match 1:', chaptersRes.data.match(regex));
}
test();
