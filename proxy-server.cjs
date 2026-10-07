const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(cors());

// Serve static frontend files if they exist (for production deployment)
app.use(express.static(path.join(__dirname, 'dist')));

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
};

app.get('/api/proxy-manga', async (req, res) => {
  try {
    let { title, chapter } = req.query;
    if (!title || !chapter) return res.status(400).json({ error: 'Title and chapter required' });
    
    // Clean title for search
    title = title.replace(/\(.*\)/g, '').trim();
    
    // Alias mapping for WeebCentral
    const aliasMap = {
      'Attack on Titan': 'Shingeki no Kyojin',
      'My Hero Academia': 'Boku no Hero Academia',
      'Boku no Hero Academia': 'My Hero Academia',
      'Sakamoto Days': 'Sakamoto Days',
      'Tokyo Ghoul': 'Toukyou Ghoul',
      'Toukyou Ghoul': 'Tokyo Ghoul',
      'Black Clover': 'Black Clover'
    };
    if (aliasMap[title]) title = aliasMap[title];
    
    console.log(`[Proxy] Searching for: ${title} Ch ${chapter}`);

    // 1. Search for series ID
    const searchRes = await axios.get(`https://weebcentral.com/search/data?text=${encodeURIComponent(title)}`, { headers: HEADERS });
    const searchHtml = searchRes.data;
    
    // Split by <a href=".../series/ID/Title">
    const parts = searchHtml.split('href="');
    let seriesId = null;
    let fallbackId = null;
    
    for (const part of parts) {
       const match = part.match(/^([^"]*\/series\/([A-Z0-9]+)\/[^"]*)"/i);
       if (match) {
          const url = match[1];
          const id = match[2];
          if (!fallbackId) fallbackId = id; // Store first found as fallback
          
          // Check the text inside this block for the exact title
          const blockContent = part.split('</a>')[0] || part;
          const textContent = blockContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
          
          if (textContent.includes(title.toLowerCase())) {
             // If we find an exact match (e.g. "Jujutsu Kaisen" without the "0")
             // It's a bit tricky because textContent might be "Jujutsu Kaisen jujutsu kaisen"
             // But if we do a regex to find exactly the title wrapped in spaces or end of string
             const regex = new RegExp(`(?:^|\\s)${title.toLowerCase().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?:\\s|$)`, 'i');
             if (regex.test(textContent)) {
                seriesId = id;
                break;
             }
          }
       }
    }
    
    if (!seriesId) seriesId = fallbackId;
    if (!seriesId) return res.status(404).json({ error: 'Series not found on WeebCentral' });
    const chaptersRes = await axios.get(`https://weebcentral.com/series/${seriesId}/full-chapter-list`, { headers: HEADERS });
    const chaptersHtml = chaptersRes.data;
    
    // Find the link for the specific chapter
    const blocks = chaptersHtml.split('<a href="');
    let chapterId = null;
    
    // Look for exact chapter match, ignoring leading zeros and supporting prefixes like "Punch"
    const escapedChapter = chapter.replace('.', '\\.');
    // Matches "> Chapter 1", "> Punch 1", "> Ch. 1", or just "> 1"
    const chRegex = new RegExp(`>\\s*(?:[A-Za-z]+\\s*\\.?\\s*)?0*${escapedChapter}\\b`, 'i');
    
    for (const block of blocks) {
      if (block.includes('/chapters/')) {
        // Extract all text inside the block to check against
        const textOnly = block.replace(/<[^>]+>/g, ' ').trim();
        
        // WeebCentral puts the chapter name in a span. Let's see if the text matches our chapter number.
        // We use a robust regex that checks for the number preceded by optional words like "Chapter", "Punch", etc.
        // And we ensure it's preceded by a word boundary or start of string so we don't match the "1" in "271"
        const robustRegex = new RegExp(`(?:^|\\b)(?:Chapter|Punch|Episode|Ch\\.?)\\s*0*${escapedChapter}\\b`, 'i');
        const fallbackRegex = new RegExp(`(?:^|\\b)0*${escapedChapter}\\b`, 'i');
        
        if (robustRegex.test(textOnly) || fallbackRegex.test(textOnly)) {
          const match = block.match(/.*\/chapters\/([A-Z0-9]+)/i);
          if (match) {
            chapterId = match[1];
            break; // Found it!
          }
        }
      }
    }
    
    if (!chapterId) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    
    console.log(`[Proxy] Found chapter ID: ${chapterId}`);
    
    // 3. Fetch image list
    const imagesRes = await axios.get(`https://weebcentral.com/chapters/${chapterId}/images?is_prev=False&current_page=1&reading_style=long_strip`, { headers: HEADERS });
    const imagesHtml = imagesRes.data;
    
    // Parse all image URLs
    const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/g;
    const pages = [];
    let match;
    while ((match = imgRegex.exec(imagesHtml)) !== null) {
      if (!match[1].includes('brand.png') && !match[1].includes('broken_image.jpg')) {
        pages.push(match[1]);
      }
    }
    
    if (pages.length === 0) return res.status(404).json({ error: 'No images found for this chapter' });
    
    res.json({ pages });
    
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

// SPA Fallback (using app.use for Express 5 compatibility instead of app.get('*'))
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WeebCentral Proxy Server running on port ${PORT}`));
