const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());

// Anti-caching for HTML entry points to ensure browsers always load latest client updates
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// Serve static frontend files if they exist (for production deployment)
app.use(express.static(path.join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Ch-Ua': '"Not.A/Brand";v="8", "Chromium";v="114", "Google Chrome";v="114"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

// Pre-populated verified series IDs for lightning-fast lookups (bypasses search latency & blocks)
const seriesCache = {
  "blue lock": "01J76XYD7E91K8QP6CY0Y53900",
  "jujutsu kaisen": "01J76XYCERXE60T7FKXVCCAQ0H",
  "attack on titan": "01J76XY7KWP8KX5RFGVZY5TR95",
  "shingeki no kyojin": "01J76XY7KWP8KX5RFGVZY5TR95",
  "solo leveling": "01J76XYCPSY3C4BNPBRY8JMCBE",
  "one piece": "01J76XY7E9FNDZ1DBBM6PBJPFK",
  "naruto": "01J76XY7E827QQQT0ERKCGH4CD",
  "bleach": "01J76XY7E4JCPK14V53BVQWD9Y",
  "chainsaw man": "01J76XYCRVY3QGYAMRR3STW941",
  "demon slayer": "01J76XYBPP2A7D38XGF4PSQVPD",
  "kimetsu no yaiba": "01J76XYBPP2A7D38XGF4PSQVPD",
  "my hero academia": "01J76XYAE4S59RVPJETN0MFRX5",
  "boku no hero academia": "01J76XYAE4S59RVPJETN0MFRX5",
  "berserk": "01J76XY7EF75DJNQCV04HTPDZK",
  "hunter x hunter": "01J76XY7EXQV9RE9KQ3JYE0WZ9",
  "dragon ball": "01J76XY8QP28R81ZVFQ9Q3N5PQ",
  "death note": "01J76XY7FYW2T2SDXP32NEFY8H",
  "black clover": "01J76XYB8HNWARAQ67A4GAWG5Y",
  "vinland saga": "01J76XY7FQY59WRK2YWX5T4E5N",
  "sakamoto days": "01J76XYE3130E1W5HKTJ7VD912",
  "one-punch man": "01J76XY7KT7J224EBK6J816Y1Q",
  "haikyuu!!": "01J76XY868R0R68Z6605Y50N5W",
  "tokyo ghoul": "01J76XY7EH974P6P8Q1V8K827Q",
  "toukyou ghoul": "01J76XY7EH974P6P8Q1V8K827Q"
};

const chapterListCache = {};
const chapterPagesCache = {};

const aliasMap = {
  'attack on titan': 'Shingeki no Kyojin',
  'shingeki no kyojin': 'Shingeki no Kyojin',
  'my hero academia': 'Boku no Hero Academia',
  'boku no hero academia': 'Boku no Hero Academia',
  'tokyo ghoul': 'Toukyou Ghoul',
  'toukyou ghoul': 'Tokyo Ghoul',
  'demon slayer': 'Kimetsu no Yaiba',
  'kimetsu no yaiba': 'Kimetsu no Yaiba',
  'black clover': 'Black Clover',
  'chainsaw man': 'Chainsaw Man',
  'solo leveling': 'Solo Leveling',
  'jujutsu kaisen': 'Jujutsu Kaisen',
  'blue lock': 'Blue Lock',
  'one piece': 'One Piece',
  'naruto': 'Naruto',
  'bleach': 'Bleach',
  'dragon ball': 'Dragon Ball',
  'death note': 'Death Note',
  'berserk': 'Berserk',
  'hunter x hunter': 'Hunter x Hunter',
  'vinland saga': 'Vinland Saga',
  'haikyuu!!': 'Haikyuu!!',
  'sakamoto days': 'Sakamoto Days',
  'oshi no ko': 'Oshi no Ko',
  'spy x family': 'Spy x Family',
  'one-punch man': 'One-Punch Man'
};

async function getSeriesId(rawTitle) {
  let title = rawTitle.replace(/\(.*\)/g, '').trim();
  const lower = title.toLowerCase();
  const searchTitle = aliasMap[lower] || title;
  
  if (seriesCache[lower]) return seriesCache[lower];
  if (seriesCache[searchTitle.toLowerCase()]) return seriesCache[searchTitle.toLowerCase()];

  const searchRes = await axios.get(`https://weebcentral.com/search/data?text=${encodeURIComponent(searchTitle)}`, { headers: HEADERS });
  const searchHtml = searchRes.data;
  
  const parts = searchHtml.split('href="');
  let seriesId = null;
  let fallbackId = null;
  
  for (const part of parts) {
    const match = part.match(/^([^"]*\/series\/([A-Z0-9]+)\/[^"]*)"/i);
    if (match) {
      const id = match[2];
      if (!fallbackId) fallbackId = id;
      
      const blockContent = part.split('</a>')[0] || part;
      const textContent = blockContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      
      if (textContent.includes(searchTitle.toLowerCase())) {
        const regex = new RegExp(`(?:^|\\s)${searchTitle.toLowerCase().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s|$)`, 'i');
        if (regex.test(textContent)) {
          seriesId = id;
          break;
        }
      }
    }
  }
  
  if (!seriesId) seriesId = fallbackId;
  if (seriesId) {
    seriesCache[searchTitle.toLowerCase()] = seriesId;
    seriesCache[lower] = seriesId;
  }
  return seriesId;
}

async function getChapterList(seriesId) {
  if (chapterListCache[seriesId]) {
    return chapterListCache[seriesId];
  }

  const chaptersRes = await axios.get(`https://weebcentral.com/series/${seriesId}/full-chapter-list`, { headers: HEADERS });
  const chaptersHtml = chaptersRes.data;
  
  const blocks = chaptersHtml.split('<a href="');
  const chapters = [];
  
  for (const block of blocks) {
    if (block.includes('/chapters/')) {
      const match = block.match(/.*\/chapters\/([A-Z0-9]+)/i);
      const text = block.split('</a>')[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (match) {
        const numMatch = text.match(/(?:Chapter|Punch|Episode|Ch\.?)\s*([0-9]+(?:\.[0-9]+)?)/i);
        const number = numMatch ? parseFloat(numMatch[1]) : null;
        chapters.push({
          id: match[1],
          text: numMatch ? `Chapter ${numMatch[1]}` : (text.slice(0, 30) || 'Chapter'),
          number: number
        });
      }
    }
  }
  
  chapters.sort((a, b) => {
    if (a.number !== null && b.number !== null) return a.number - b.number;
    return 0;
  });

  if (chapters.length > 0) {
    chapterListCache[seriesId] = chapters;
  }
  return chapters;
}

// Endpoint to get ALL chapters for a manga
app.get('/api/proxy-chapters', async (req, res) => {
  try {
    let { title } = req.query;
    if (!title) return res.status(400).json({ error: 'Title required' });

    const seriesId = await getSeriesId(title);
    if (!seriesId) return res.status(404).json({ error: 'Series not found on WeebCentral' });

    const chapters = await getChapterList(seriesId);
    if (!chapters || chapters.length === 0) return res.status(404).json({ error: 'No chapters found' });

    const minChapter = chapters[0]?.number ?? 1;
    const maxChapter = chapters[chapters.length - 1]?.number ?? chapters.length;

    res.json({
      success: true,
      seriesId,
      total: chapters.length,
      minChapter,
      maxChapter,
      chapters
    });
  } catch (err) {
    console.error('proxy-chapters error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to fetch real manga chapter pages
app.get('/api/proxy-manga', async (req, res) => {
  try {
    let { title, chapter } = req.query;
    if (!title || !chapter) return res.status(400).json({ error: 'Title and chapter required' });

    console.log(`[Proxy] Fetching: ${title} Ch ${chapter}`);
    const seriesId = await getSeriesId(title);
    if (!seriesId) return res.status(404).json({ error: 'Series not found on WeebCentral' });

    const chapters = await getChapterList(seriesId);
    if (!chapters || chapters.length === 0) return res.status(404).json({ error: 'No chapters found' });

    const targetNum = parseFloat(chapter);
    let chapterObj = chapters.find(c => c.number === targetNum);
    if (!chapterObj) {
      chapterObj = chapters.find(c => String(c.number) === String(chapter));
    }
    if (!chapterObj) {
      const escaped = String(chapter).replace('.', '\\.');
      const regex = new RegExp(`(?:Chapter|Ch\\.?|Punch|Episode)\\s*0*${escaped}\\b`, 'i');
      chapterObj = chapters.find(c => regex.test(c.text));
    }

    if (!chapterObj) {
      return res.status(404).json({ error: `Chapter ${chapter} not found` });
    }

    const chapterId = chapterObj.id;
    if (chapterPagesCache[chapterId]) {
      return res.json({ pages: chapterPagesCache[chapterId], total: chapterPagesCache[chapterId].length });
    }

    const imagesRes = await axios.get(`https://weebcentral.com/chapters/${chapterId}/images?is_prev=False&current_page=1&reading_style=long_strip`, { headers: HEADERS });
    const imagesHtml = imagesRes.data;

    const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/g;
    const pages = [];
    let match;
    while ((match = imgRegex.exec(imagesHtml)) !== null) {
      if (!match[1].includes('brand.png') && !match[1].includes('broken_image.jpg')) {
        pages.push(match[1]);
      }
    }

    if (pages.length === 0) return res.status(404).json({ error: 'No images found for this chapter' });

    chapterPagesCache[chapterId] = pages;
    res.json({ pages, total: pages.length });
  } catch (err) {
    console.error('proxy-manga error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proxy for MangaDex Cover Images or external CDN images
app.get('/api/proxy-image', async (req, res) => {
  try {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('No URL provided');
    
    const referer = imageUrl.includes('mangadex.org') ? 'https://mangadex.org/' : 'https://weebcentral.com/';
    const response = await axios({
      method: 'get',
      url: imageUrl,
      responseType: 'stream',
      headers: {
        'Referer': referer,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=31536000');
    response.data.pipe(res);
  } catch (err) {
    console.error("Image Proxy Error:", err.message);
    res.status(500).send('Error fetching image');
  }
});

// Proxy for MangaDex JSON API to bypass browser adblockers/CORS
app.get('/api/proxy-mangadex', async (req, res) => {
  try {
    let targetUrl = req.query.url;
    if (req.url.includes('?url=')) {
      targetUrl = req.url.substring(req.url.indexOf('?url=') + 5);
      try {
        targetUrl = decodeURIComponent(targetUrl);
      } catch (e) {}
    }
    if (!targetUrl) return res.status(400).json({ error: 'No URL provided' });
    
    if (!targetUrl.startsWith('https://api.mangadex.org/')) {
       return res.status(403).json({ error: 'Forbidden target URL' });
    }

    const response = await axios({
      method: 'get',
      url: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    
    res.json(response.data);
  } catch (err) {
    console.error("MangaDex API Proxy Error:", err.message);
    res.status(500).json({ error: 'Error proxying MangaDex API' });
  }
});

// SPA Fallback with anti-cache headers for index.html
app.use((req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WeebCentral Proxy Server running on port ${PORT}`));
