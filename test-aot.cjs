const axios = require('axios');
async function test() {
  const chaptersRes = await axios.get('https://weebcentral.com/series/01J76XY7KWP8KX5RFGVZY5TR95/full-chapter-list');
  const html = chaptersRes.data;
  console.log(html.substring(html.indexOf('<a href="/chapters/'), html.indexOf('<a href="/chapters/') + 500));
}
test();
