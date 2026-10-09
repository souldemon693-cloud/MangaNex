document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements - Views
  const logoBtn = document.getElementById('logoBtn');
  const homeView = document.getElementById('homeView');
  const readerView = document.getElementById('readerView');
  const readerControls = document.getElementById('readerControls');
  
  // Auth DOM Elements
  const authView = document.getElementById('authView');
  const usernameInput = document.getElementById('usernameInput');
  const passwordInput = document.getElementById('passwordInput');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const authError = document.getElementById('authError');
  const topNav = document.getElementById('topNav');
  
  // Home Actions & SPA Nav Buttons
  const homeBtnTop = document.getElementById('homeBtnTop'); // Featured
  const updatesBtn = document.getElementById('updatesBtn');
  const rankingBtn = document.getElementById('rankingBtn');
  const mangaListBtn = document.getElementById('mangaListBtn');
  const creatorsBtn = document.getElementById('creatorsBtn');
  const bookmarksTopBtn = document.getElementById('bookmarksTopBtn');
  const aboutUsBtn = document.getElementById('aboutUsBtn');

  // New SPA Views
  const updatesView = document.getElementById('updatesView');
  const rankingView = document.getElementById('rankingView');
  const mangaListView = document.getElementById('mangaListView');
  const creatorsView = document.getElementById('creatorsView');
  const bookmarksView = document.getElementById('bookmarksView');
  const aboutView = document.getElementById('aboutView');

  // DOM Elements - Reader
  const pageContainer = document.getElementById('pageContainer');
  const pageFlipper = document.getElementById('pageFlipper');
  const chapterSelect = document.getElementById('chapterSelect');
  const mangaPageLeft = document.getElementById('mangaPageLeft');
  const mangaPageRight = document.getElementById('mangaPageRight');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const pageInfo = document.getElementById('pageInfo');
  const pageControls = document.querySelector('.page-controls');
  
  // Settings
  const toggleDirectionBtn = document.getElementById('toggleDirectionBtn');
  const toggleSpreadBtn = document.getElementById('toggleSpreadBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const prevChapterBtn = document.getElementById('prevChapterBtn');
  const nextChapterBtn = document.getElementById('nextChapterBtn');
  const toast = document.getElementById('toast');
  const navLinksContainer = document.getElementById('navLinksContainer');
  const readerHomeBtn = document.getElementById('readerHomeBtn');
  
  const MAX_CHAPTER = 354;
  
  // State
  let state = {
    chapter: 1,
    page: 1,
    isRTL: true, // Default to RTL for manga!
    isSpread: false,
    inReaderMode: false,
    mangaDexId: null,
    currentMangaTitle: '',
    availableChapters: [],
    maxChapter: 100,
    currentChapterPages: null
  };
  let bookmarks = JSON.parse(localStorage.getItem('manganexBookmarks')) || [];
  let isLoading = false;
  let isEndOfChapter = false;
  let preloadedImages = {};
  
  let allMangaDataCache = []; // To easily build bookmarks page

  // Load saved state
  const savedState = localStorage.getItem('egozoneState');
  if (savedState) {
    try {
      const parsed = JSON.parse(savedState);
      state = { ...state, ...parsed };
      state.currentChapterPages = null; // Always fresh load pages
    } catch (e) {}
  }

  // ---- Auth Logic ----
  let currentUser = localStorage.getItem('egozoneUser');
  let usersDB = JSON.parse(localStorage.getItem('egozoneUsersDB') || '{}');

  function showAuth() {
    authView.style.display = 'flex';
    homeView.style.display = 'none';
    readerView.style.display = 'none';
    topNav.style.display = 'none';
  }

  function hideAuth() {
    authView.style.display = 'none';
    topNav.style.display = 'flex';
    if (state.inReaderMode) {
      navigateToReader();
    } else {
      navigateToHome();
    }
  }

  signupBtn.addEventListener('click', () => {
    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();
    if (!user || !pass) {
      authError.textContent = 'Enter username and password.';
      return;
    }
    if (usersDB[user]) {
      authError.textContent = 'Username already taken.';
      return;
    }
    usersDB[user] = pass;
    localStorage.setItem('egozoneUsersDB', JSON.stringify(usersDB));
    currentUser = user;
    localStorage.setItem('egozoneUser', currentUser);
    hideAuth();
  });

  loginBtn.addEventListener('click', () => {
    const user = usernameInput.value.trim();
    const pass = passwordInput.value.trim();
    if (!user || !pass) {
      authError.textContent = 'Enter username and password.';
      return;
    }
    if (usersDB[user] && usersDB[user] === pass) {
      currentUser = user;
      localStorage.setItem('egozoneUser', currentUser);
      hideAuth();
    } else {
      authError.textContent = 'Invalid credentials.';
    }
  });

  // ---- Shared Navigation ----
  window.openManga = function(mangaId, mangaTitle) {
    if (!mangaTitle && allMangaDataCache) {
      const m = allMangaDataCache.find(m => m.id === mangaId);
      if (m) {
        mangaTitle = m.attributes.title.en || Object.values(m.attributes.title)[0] || 'Unknown';
        if (mangaTitle === 'Unknown' && m.attributes.altTitles) {
          const enAlt = m.attributes.altTitles.find(t => t.en);
          if (enAlt) mangaTitle = enAlt.en;
        }
      }
    }
    
    state.currentMangaTitle = mangaTitle || 'Unknown';
    state.mangaDexId = mangaId;
    
    const existing = bookmarks.find(b => b.id === mangaId);
    if (existing) {
       state.chapter = existing.chapter;
       state.page = existing.page;
    } else {
       state.chapter = 1;
       state.page = 1;
    }
    
    state.availableChapters = [];
    state.currentChapterPages = null;
    state.maxChapter = 100;
    
    saveState();
    navigateToReader();
  };

  // ---- Universal MangaDex API Fetcher (Works on localhost, Render, and GitHub Pages) ----
  async function fetchMangaDex(url) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
      try {
        const proxyRes = await fetch(`/api/proxy-mangadex?url=${encodeURIComponent(url)}`);
        if (proxyRes.ok && proxyRes.headers.get('content-type')?.includes('application/json')) {
          return await proxyRes.json();
        }
      } catch (e) {}
    }
    // Direct MangaDex API call (fully CORS enabled in all modern browsers)
    try {
      const directRes = await fetch(url);
      if (directRes.ok && directRes.headers.get('content-type')?.includes('application/json')) {
        return await directRes.json();
      }
    } catch (e) {
      console.warn("Direct MangaDex fetch attempt failed:", e);
    }
    if (!isLocal) {
      try {
        const proxyRes = await fetch(`/api/proxy-mangadex?url=${encodeURIComponent(url)}`);
        if (proxyRes.ok && proxyRes.headers.get('content-type')?.includes('application/json')) {
          return await proxyRes.json();
        }
      } catch (e) {}
    }
    throw new Error(`MangaDex fetch failed for: ${url}`);
  }

  // ---- Dynamic Homepage Content ----
  async function fetchTrendingMangas() {
    const grid = document.getElementById('mangaGrid');
    if (!grid) return;
    grid.innerHTML = '<div style="color: #888; text-align: center; grid-column: 1 / -1;">Fetching popular mangas from MangaDex...</div>';
    
    // Discover Mangas button scroll logic
    const discoverMangasBtn = document.getElementById('discoverMangasBtn');
    if (discoverMangasBtn) {
      discoverMangasBtn.addEventListener('click', () => {
        const target = document.getElementById('catalogHeader');
        if (target) {
           target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    try {
      const shonenIds = [
        'a1c7c817-4e59-43b7-9365-09675a149a6f', // One Piece
        '275c3ee8-bdeb-4070-a333-6add23a8415a', // Naruto
        '37b87be0-b1f4-4507-affa-06c99ebb27f8', // Dragon Ball
        '239d6260-d71f-43b0-afff-074e3619e3de', // Bleach
        '789642f8-ca89-4e4e-8f7b-eee4d17ea08b', // Demon Slayer
        'c52b2ce3-7f95-469c-96b0-479524fb7a1a', // Jujutsu Kaisen
        '4f3bcae4-2d96-4c9d-932c-90181d9c873e', // My Hero Academia
        'db692d58-4b13-4174-ae8c-30c515c0689c', // Hunter x Hunter
        'dd8a907a-3850-4f95-ba03-ba201a8399e3', // Fullmetal Alchemist
        'a77742b1-befd-49a4-bff5-1ad4e6b0ef7b', // Chainsaw Man
        'e7eabe96-aa17-476f-b431-2497d5e9d060', // Black Clover
        '52ede55c-1584-4019-b85b-3902a423c3ab', // Fairy Tail
        'd8a959f7-648e-4c8d-8f23-f1f3f8e129f3', // One-Punch Man
        '1044287a-73df-48d0-b0b2-5327f32dd651', // JoJo's
        '46e9cae5-4407-4576-9b9e-4c517ae9298e'  // Promised Neverland
      ];
      const seinenIds = [
        '801513ba-a712-498c-8f57-cae55b38cc92', // Berserk
        'd1a9fdeb-f713-407f-960c-8326b586e6fd', // Vagabond
        '9d351a80-5037-4334-a020-6985899f5b1f', // Monster
        '5d1fc77e-706a-4fc5-bea8-486c9be0145d', // Vinland Saga
        'ad06790a-01e3-400c-a449-0ec152d6756a', // 20th Century Boys
        '4301d363-ee02-43f4-ae24-4cbf29a74830', // Goodnight Punpun
        '6a1d1cb1-ecd5-40d9-89ff-9d88e40b136b', // Tokyo Ghoul
        '75ee72ab-c6bf-4b87-badd-de839156934c', // Death Note
        '34f45c13-2b78-4900-8af2-d0bb551101f4', // Dorohedoro
        'be8fe64b-37da-4fba-b14d-603aba19be1f', // Claymore
        'e171c073-4415-499b-85bc-ea93825127ac', // Pluto
        '07823fcd-f2c9-458c-9824-3eae62b2a006', // Parasyte
        '0fa5dab2-250a-4f69-bd15-9ceea54176fa'  // Akira
      ];
      const sportsIds = [
        'f65444dc-3694-4e31-a166-8afb2938ed55', // Gintama
        '4141c5dc-c525-4df5-afd7-cc7d192a832f', // Blue Lock
        'c8b55f34-21a4-4ca7-8e5d-d58d38fe3203', // Blue Lock (Colored Edition)
        'edb82d3c-20f6-4cf9-a879-7457478642fe', // Haikyu!!
        '319df2e2-e6a6-4e3a-a31c-68539c140a84', // Slam Dunk
        '736a2bf0-f875-4b52-a7b4-e8c40505b68a'  // Mob Psycho 100
      ];
      const famousIds = [...shonenIds, ...seinenIds, ...sportsIds];
      
      const rankedIds = [
        "4141c5dc-c525-4df5-afd7-cc7d192a832f", // Blue Lock
        "c8b55f34-21a4-4ca7-8e5d-d58d38fe3203", // Blue Lock (Colored Edition)
        "a1c7c817-4e59-43b7-9365-09675a149a6f", // One Piece
        "c52b2ce3-7f95-469c-96b0-479524fb7a1a", // Jujutsu Kaisen
        "db692d58-4b13-4174-ae8c-30c515c0689c", // Hunter x Hunter
        "801513ba-a712-498c-8f57-cae55b38cc92", // Berserk
        "6b1eb93e-473a-4ab3-9922-1a66d2a29a4a", // Naruto
        "a460ab18-22c1-47eb-a08a-9ee85fe37ec8", // Bleach
        "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0", // Solo Leveling
        "e896c48c-3150-437d-ba57-d8567eb399ae", // Chainsaw Man
        "304ceac3-8cdb-4fe7-acf7-2b62403ab1e4", // Attack on Titan
        "b58373e3-7762-4211-9657-36e2d832c3f1", // Tokyo Ghoul
        "d8a959f7-648e-4c8d-8f23-f1f3f8e129f3", // One Punch-Man
      ];

      // Check cache first to avoid blank screen or loading lag
      const cachedData = localStorage.getItem('manganex_cache');
      let allData = [];

      // 1. On localhost, try live proxy to MangaDex
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        try {
          const idsQuery = rankedIds.map(id => `ids[]=${id}`).join('&');
          const data1 = await fetchMangaDex(`https://api.mangadex.org/manga?limit=40&includes[]=cover_art&${idsQuery}`);
          const data2 = await fetchMangaDex(`https://api.mangadex.org/manga?limit=100&includes[]=cover_art&order[followedCount]=desc&contentRating[]=safe&contentRating[]=suggestive`);
          if (data1?.data) {
            allData = [...data1.data];
            (data2?.data || []).forEach(m => {
              if (!allData.find(x => x.id === m.id)) allData.push(m);
            });
          }
        } catch (e) {
          console.warn("Local live fetch failed, will load local static dataset:", e);
        }
      }

      // 2. Load pre-packaged high-quality catalog dataset (works 100% on GitHub Pages with zero CORS or rate limits!)
      if (!allData || allData.length === 0) {
        try {
          const staticRes = await fetch('./manga_data.json');
          if (staticRes.ok) {
            allData = await staticRes.json();
          }
        } catch (e) {
          console.warn("Could not load ./manga_data.json:", e);
        }
      }

      // 3. Fallback to localStorage cache
      if ((!allData || allData.length === 0) && cachedData) {
        allData = JSON.parse(cachedData);
      }

      // 4. Emergency hardcoded fallback with 100% verified covers
      if (!allData || allData.length === 0) {
        allData = [
          { id: "4141c5dc-c525-4df5-afd7-cc7d192a832f", attributes: { title: { en: "Blue Lock" }, tags: [{ attributes: { name: { en: "Sports" } } }] }, relationships: [{ type: "cover_art", attributes: { fileName: "7ee723d4-b926-4a81-acd9-53adb3fbe461.jpg" } }] },
          { id: "c8b55f34-21a4-4ca7-8e5d-d58d38fe3203", attributes: { title: { en: "Blue Lock (Colored Edition)" }, tags: [{ attributes: { name: { en: "Sports" } } }, { attributes: { name: { en: "Colored" } } }] }, relationships: [{ type: "cover_art", attributes: { fileName: "010f2b44-97a0-4d4e-870a-e8f93f87fa8f.jpg" } }] },
          { id: "a1c7c817-4e59-43b7-9365-09675a149a6f", attributes: { title: { en: "One Piece" }, tags: [{ attributes: { name: { en: "Action" } } }] }, relationships: [{ type: "cover_art", attributes: { fileName: "2f4aca53-64c7-46ac-ae85-3bc9b3169890.png" } }] },
          { id: "c52b2ce3-7f95-469c-96b0-479524fb7a1a", attributes: { title: { en: "Jujutsu Kaisen" }, tags: [{ attributes: { name: { en: "Action" } } }] }, relationships: [{ type: "cover_art", attributes: { fileName: "258999da-cbcf-4dd9-8786-91f5eaa968b8.png" } }] },
          { id: "db692d58-4b13-4174-ae8c-30c515c0689c", attributes: { title: { en: "Hunter x Hunter" }, tags: [{ attributes: { name: { en: "Adventure" } } }] }, relationships: [{ type: "cover_art", attributes: { fileName: "aa112927-f1e5-4fe4-a4db-7fd4a1536e3c.jpg" } }] },
          { id: "801513ba-a712-498c-8f57-cae55b38cc92", attributes: { title: { en: "Berserk" }, tags: [{ attributes: { name: { en: "Horror" } } }] }, relationships: [{ type: "cover_art", attributes: { fileName: "81e1c82d-6672-400c-8c58-4ff9bfb89031.jpg" } }] },
          { id: "6b1eb93e-473a-4ab3-9922-1a66d2a29a4a", attributes: { title: { en: "Naruto" }, tags: [{ attributes: { name: { en: "Action" } } }] }, relationships: [{ type: "cover_art", attributes: { fileName: "c5a3090c-4ca0-40a2-9102-e0ee0c6dac15.jpg" } }] },
          { id: "a460ab18-22c1-47eb-a08a-9ee85fe37ec8", attributes: { title: { en: "Bleach" }, tags: [{ attributes: { name: { en: "Action" } } }] }, relationships: [{ type: "cover_art", attributes: { fileName: "7c8f9203-2b82-41f2-beb3-e7fb00e151e2.jpg" } }] },
          { id: "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0", attributes: { title: { en: "Solo Leveling" }, tags: [{ attributes: { name: { en: "Fantasy" } } }] }, relationships: [{ type: "cover_art", attributes: { fileName: "e90bdc47-c8b9-4df7-b2c0-17641b645ee1.jpg" } }] },
          { id: "e896c48c-3150-437d-ba57-d8567eb399ae", attributes: { title: { en: "Chainsaw Man" }, tags: [{ attributes: { name: { en: "Horror" } } }] }, relationships: [{ type: "cover_art", attributes: { fileName: "fa06e4e4-ef2a-477b-bfb6-a2a88793620b.jpg" } }] }
        ];
      }

      // Sort: explicitly ranked ones first, then maintain popular order
      allData.sort((a, b) => {
         const idxA = rankedIds.indexOf(a.id);
         const idxB = rankedIds.indexOf(b.id);
         if (idxA !== -1 && idxB !== -1) return idxA - idxB;
         if (idxA !== -1) return -1;
         if (idxB !== -1) return 1;
         return 0; 
      });
      
      // Randomize the "underrated" masterpieces (everything not in rankedIds)
      const rankedCount = allData.filter(m => rankedIds.includes(m.id)).length;
      const topRanked = allData.slice(0, rankedCount);
      const remaining = allData.slice(rankedCount);
      
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      allData = [...topRanked, ...remaining];
      
      // Save to cache for future requests to prevent rate limit errors showing a blank screen
      localStorage.setItem('manganex_cache', JSON.stringify(allData));
      
      allMangaDataCache = allData;
      
      // Render Promo Carousel (Top 10 mangas)
      function renderCarousel(mangas) {
        const carousel = document.getElementById('promoCarousel');
        if(!carousel) return;
        carousel.innerHTML = '';
        
        // Grab 10 mangas instead of 5
        const top10 = (mangas || []).slice(0, 10);
        top10.forEach(manga => {
           const title = (manga.attributes && manga.attributes.title) ? (manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown') : 'Unknown';
           const coverArt = manga.relationships ? manga.relationships.find(r => r.type === 'cover_art') : null;
           const fileName = coverArt && coverArt.attributes ? coverArt.attributes.fileName : '';
           const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.512.jpg` : 'logo.jpg';
           
           const slide = document.createElement('div');
           slide.className = 'promo-slide';
           slide.style.cssText = `scroll-snap-align: center; flex: 0 0 100%; position: relative; aspect-ratio: 21/9; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); overflow: hidden; cursor: pointer; border: 1px solid rgba(255,140,0,0.2); background-color: #111;`;
           slide.onclick = () => openManga(manga.id, title);
           
           slide.innerHTML = `
             <!-- Blurred background layer using the cover -->
             <div style="position: absolute; inset: -20px; overflow: hidden;">
               <img src="${coverUrl}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null; this.src='logo.jpg';" style="width: 100%; height: 100%; object-fit: cover; filter: blur(15px); opacity: 0.5;">
             </div>
             
             <!-- Real Cover (Uncropped) -->
             <img src="${coverUrl}" alt="${title}" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null; this.src='logo.jpg';" style="position: absolute; right: 5%; top: 5%; bottom: 5%; height: 90%; object-fit: contain; border-radius: 6px; box-shadow: -10px 0 30px rgba(0,0,0,0.8); z-index: 2;">
             
             <!-- Dark gradient overlay for text readability -->
             <div style="position: absolute; inset: 0; background: linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.2) 100%); z-index: 1;"></div>
             
             <!-- Badge -->
             <div style="position: absolute; top: 15px; left: 15px; background: rgba(255, 140, 0, 0.9); color: white; padding: 6px 15px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; font-family: 'Oswald', sans-serif; text-transform: uppercase; box-shadow: 0 4px 10px rgba(0,0,0,0.5); z-index: 3;">TODAY'S FAVORITES</div>
             
             <!-- Title -->
             <div style="position: absolute; bottom: 20px; left: 20px; max-width: 50%; z-index: 3;">
               <h2 style="color: white; font-family: 'Oswald', sans-serif; font-size: clamp(1.5rem, 4vw, 2.5rem); margin: 0; line-height: 1.1; text-shadow: 2px 2px 10px rgba(0,0,0,0.8); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${title}</h2>
               <p style="color: rgba(255,140,0,0.9); font-family: 'Inter', sans-serif; font-size: 1rem; margin-top: 8px; font-weight: 700;">READ NOW ➔</p>
             </div>
           `;
           carousel.appendChild(slide);
        });
        
        // Auto-scroll every 5 seconds
        setInterval(() => {
          if (!carousel.children.length) return;
          const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth;
          
          if (carousel.scrollLeft >= maxScrollLeft - 10) {
            // Reached the end, loop back to the first slide smoothly
            carousel.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            // Scroll to the next slide
            carousel.scrollBy({ left: carousel.clientWidth, behavior: 'smooth' });
          }
        }, 5000);
      }
      
      renderCarousel(allData);
      
      allMangaDataCache = allData;
      renderGrid(allData);
      
      // Render Hottest Sidebar (Top 20 most popular from the list)
      function renderHottestSidebar() {
        const hottestContainer = document.getElementById('hottestList');
        if(!hottestContainer) return;
        hottestContainer.innerHTML = '';
        
        // Take the explicitly ranked mangas to show as Hottest
        const sortedHottest = [...allData].slice(0, 50);
        
        sortedHottest.forEach((manga, index) => {
           const title = (manga.attributes && manga.attributes.title) ? (manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown') : 'Unknown';
           const coverArt = manga.relationships ? manga.relationships.find(r => r.type === 'cover_art') : null;
           const fileName = coverArt && coverArt.attributes ? coverArt.attributes.fileName : '';
           const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.256.jpg` : 'logo.jpg';
           
           const views = Math.floor(Math.random() * 300000 + 50000).toLocaleString();
           
           const item = document.createElement('div');
           item.style.cssText = "display: flex; gap: 1rem; align-items: center; cursor: pointer; transition: transform 0.2s; padding: 0.5rem; border-radius: 8px;";
           item.onmouseover = () => { item.style.transform = 'translateX(5px)'; item.style.background = 'rgba(255,255,255,0.05)'; };
           item.onmouseout = () => { item.style.transform = 'none'; item.style.background = 'transparent'; };
           item.onclick = () => openManga(manga.id, title);
           
           item.innerHTML = `
              <img src="${coverUrl}" alt="${title}" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null; this.src='logo.jpg';" style="width: 50px; height: 70px; object-fit: cover; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
              <div style="display: flex; flex-direction: column; gap: 0.2rem; flex: 1;">
                 <div style="display: flex; gap: 0.8rem; align-items: flex-start;">
                   <span style="font-weight: 800; font-size: 1.4rem; color: rgba(255,255,255,0.6); font-family: 'Oswald', sans-serif; width: 20px; text-align: center;">${index + 1}</span>
                   <div style="display: flex; flex-direction: column;">
                     <span style="font-weight: bold; color: white; font-size: 0.95rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">${title}</span>
                     <span style="color: rgba(255,140,0,0.8); font-size: 0.8rem; margin-top: 0.3rem;">🔥 ${views} Views</span>
                   </div>
                 </div>
              </div>
           `;
           hottestContainer.appendChild(item);
        });
      }
      
      renderHottestSidebar();
      
    } catch (e) {
      console.error("Error loading mangas:", e);
      const grid = document.getElementById('catalogRoot') || document.getElementById('mangaGrid');
      if (grid) grid.innerHTML = `<div style="color: #ff1133;">Failed to load trending mangas. Error: ${e.message}</div>`;
    }
  }
  
  function renderGrid(mangas) {
      const grid = document.getElementById('mangaGrid');
      if (!grid) return;
      grid.innerHTML = '';
      
      const honeycomb = document.getElementById('honeycomb-background');
      if (honeycomb) honeycomb.innerHTML = '';
      let hexRows = [];
      let currentHexRow = null;

      mangas.forEach((manga, index) => {
        let title = 'Unknown';
        if (manga.attributes && manga.attributes.title) {
           title = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown';
        }
        if (title === 'Unknown' && manga.attributes && manga.attributes.altTitles) {
           const enAlt = manga.attributes.altTitles.find(t => t.en);
           if (enAlt) title = enAlt.en;
        }
        
        const coverRel = manga.relationships ? manga.relationships.find(r => r.type === 'cover_art') : null;
        const coverFile = coverRel && coverRel.attributes ? coverRel.attributes.fileName : '';
        const coverUrl = coverFile ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFile}.256.jpg` : 'logo.jpg';
        
        // Build card
        const card = document.createElement('div');
        card.className = 'manga-catalog-card';
        card.innerHTML = `
          <div class="manga-cover" style="position: relative; height: 260px; border-radius: 8px; overflow: hidden; background: #e8e2d9; border: 1px solid rgba(255,140,0,0.2); transition: all 0.3s ease;">
            <img src="${coverUrl}" alt="${title}" referrerpolicy="no-referrer" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.onerror=null; this.src='logo.jpg';">
          </div>
          <div style="padding: 0.8rem 0;">
            <div class="manga-title" style="color: var(--text-main); font-weight: 600; font-size: 1rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${title}</div>
            <div style="color: #d2691e; font-size: 0.85rem; font-weight: bold; margin-top: 5px;">${bookmarks.some(b => b.id === manga.id) ? '🔖 Bookmarked (Ch ' + bookmarks.find(b => b.id === manga.id).chapter + ')' : ''}</div>
          </div>
        `;
        
        card.style.cursor = 'pointer';
        const cover = card.querySelector('.manga-cover');
        card.addEventListener('mouseenter', () => {
          cover.style.transform = 'translateY(-5px)';
          cover.style.boxShadow = `0 10px 20px rgba(0,0,0,0.2), 0 0 15px rgba(255, 140, 0, 0.4)`;
          cover.style.borderColor = `rgba(255, 140, 0, 0.8)`;
        });
        card.addEventListener('mouseleave', () => {
          cover.style.transform = 'none';
          cover.style.boxShadow = 'none';
          cover.style.borderColor = 'rgba(255,140,0,0.2)';
        });
        
        card.addEventListener('click', () => {
          openManga(manga.id, title);
        });
        
        // Extract tags for category filtering
        let categories = [];
        if (index < 50) categories.push('Popular');
        if (manga.attributes && manga.attributes.tags) {
           const tags = manga.attributes.tags.map(t => t.attributes.name.en);
           if (tags.includes('Sports')) categories.push('Sports');
           if (tags.includes('Fantasy') || tags.includes('Isekai')) categories.push('Fantasy');
           if (tags.includes('Psychological') || tags.includes('Supernatural')) categories.push('Psychological');
           if (tags.includes('Horror') || tags.includes('Thriller')) categories.push('Horror');
           if (tags.includes('Action') || tags.includes('Adventure')) categories.push('Action');
        }
        if (categories.length === 0) categories.push('Other');
        card.dataset.category = categories.join(' ');
        
        grid.appendChild(card);
        
        if (honeycomb && coverUrl) {
          if (index % 6 === 0) {
            currentHexRow = document.createElement('div');
            currentHexRow.className = 'hex-row';
            hexRows.push(currentHexRow);
          }
          const hex = document.createElement('div');
          hex.className = 'hex-cell';
          hex.style.backgroundImage = `url('${coverUrl}')`;
          currentHexRow.appendChild(hex);
        }
      });
      
      if (honeycomb) {
        for (let i = 0; i < 4; i++) {
          hexRows.forEach(row => honeycomb.appendChild(row.cloneNode(true)));
        }
      }
      
      // Unified Filter Logic
      const filterBtns = document.querySelectorAll('.filter-btn');
      const searchInput = document.getElementById('mangaSearchInput');
      
      function applyFilters() {
         const activeBtn = document.querySelector('.filter-btn.active');
         const filter = activeBtn ? activeBtn.dataset.filter : 'all';
         const query = searchInput ? searchInput.value.toLowerCase() : '';
         
         const cards = document.querySelectorAll('.manga-catalog-card');
         cards.forEach(card => {
            const cardCats = card.dataset.category.split(' ');
            const matchesCategory = (filter === 'all' || cardCats.includes(filter));
            const titleElement = card.querySelector('.manga-title');
            const title = titleElement ? titleElement.innerText.toLowerCase() : '';
            const matchesSearch = query === '' || title.includes(query);
            
            if (matchesCategory && matchesSearch) {
               card.style.display = 'block';
            } else {
               card.style.display = 'none';
            }
         });
      }

      filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          filterBtns.forEach(b => {
            b.classList.remove('active');
            b.style.background = 'rgba(255, 140, 0, 0.1)';
            b.style.color = 'var(--text-main)';
            b.style.borderColor = 'rgba(255, 140, 0, 0.3)';
            b.style.fontWeight = 'normal';
          });
          const target = e.target;
          target.classList.add('active');
          target.style.background = 'rgba(255, 140, 0, 1)';
          target.style.color = 'white';
          target.style.borderColor = 'rgba(255, 140, 0, 1)';
          target.style.fontWeight = 'bold';
          
          applyFilters();
        });
      });
      
      if (searchInput) {
         searchInput.addEventListener('input', applyFilters);
      }
  }



  fetchTrendingMangas();

  // ---- Facts Logic ----
  const animeFactCard = document.getElementById('animeFactCard');
  const factModal = document.getElementById('factModal');
  const closeFactBtn = document.getElementById('closeFactBtn');
  const factModalTitle = document.getElementById('factModalTitle');
  const factModalText = document.getElementById('factModalText');
  const factTitle = document.getElementById('factTitle');
  const factDesc = document.getElementById('factDesc');

  const animeFacts = [
    { title: 'The Origins of Manga', desc: 'Manga has roots going back to the 12th century.', full: 'The first examples of sequential art in Japan date back to Choju-giga, scrolls from the 12th century depicting animals acting like humans. Modern manga as we know it took shape in the mid-20th century under pioneers like Osamu Tezuka.' },
    { title: 'One Piece Records', desc: 'The best-selling comic by a single author.', full: 'One Piece holds the Guinness World Record for "the most copies published for the same comic book series by a single author". As of recent counts, it has sold over 500 million copies worldwide!' },
    { title: 'Dragon Ball\'s Influence', desc: 'It inspired almost every modern shonen.', full: 'Dragon Ball\'s creator, Akira Toriyama, heavily influenced authors like Eiichiro Oda (One Piece) and Masashi Kishimoto (Naruto). The concept of energy transformations and power levels became a staple of action manga.' },
    { title: 'Jujutsu Kaisen\'s Name', desc: 'What does it actually mean?', full: 'Jujutsu Kaisen translates roughly to "Sorcery Fight". Gege Akutami created a unique power system based on "Cursed Energy", born from negative human emotions, which completely subverted the traditional magic systems in manga.' }
  ];

  let currentFact = null;

  function randomizeFact() {
    if (!factTitle) return;
    currentFact = animeFacts[Math.floor(Math.random() * animeFacts.length)];
    factTitle.textContent = currentFact.title;
    factDesc.textContent = currentFact.desc;
  }

  if (!state.inReaderMode) randomizeFact();

  if (animeFactCard) {
    animeFactCard.addEventListener('click', () => {
      if (currentFact && factModal) {
        factModalTitle.textContent = currentFact.title;
        factModalText.textContent = currentFact.full;
        factModal.classList.add('active');
      }
    });
  }

  if (closeFactBtn) {
    closeFactBtn.addEventListener('click', () => {
      factModal.classList.remove('active');
    });
  }


  // ---- Routing Logic ----
  function switchView(viewElement) {
    const allViews = [homeView, readerView, updatesView, rankingView, mangaListView, creatorsView, bookmarksView, aboutView, authView];
    allViews.forEach(view => {
      if(view) view.style.display = 'none';
    });
    
    // Clear active class from nav buttons
    const allNavBtns = [homeBtnTop, updatesBtn, rankingBtn, mangaListBtn, creatorsBtn, bookmarksTopBtn, aboutUsBtn];
    allNavBtns.forEach(btn => {
      if(btn) btn.classList.remove('active-nav');
    });

    if (viewElement) {
      if (viewElement === readerView) {
        viewElement.style.display = 'flex';
      } else {
        viewElement.style.display = 'block';
      }
    }
  }

  function navigateToReader() {
    state.inReaderMode = true;
    switchView(readerView);
    readerControls.style.display = 'flex';
    if(navLinksContainer) navLinksContainer.style.display = 'none';
    document.body.style.overflow = 'hidden';
    const honeycomb = document.getElementById('honeycomb-background');
    if (honeycomb) honeycomb.style.display = 'none';
    
    // Clear old images immediately so they don't persist while loading
    if (mangaPageLeft) mangaPageLeft.src = '';
    if (mangaPageRight) mangaPageRight.src = '';
    
    rebuildChapterSelect();
    saveState();
    loadPage();

    // Fetch full chapter list from proxy to populate all 300+ chapters!
    loadChaptersForCurrentManga();
  }

  function navigateToHome() {
    state.inReaderMode = false;
    switchView(homeView);
    if(homeBtnTop) homeBtnTop.classList.add('active-nav');
    
    readerControls.style.display = 'none';
    if(navLinksContainer) navLinksContainer.style.display = 'flex';
    document.body.style.overflow = 'auto';
    const honeycomb = document.getElementById('honeycomb-background');
    if (honeycomb) honeycomb.style.display = 'flex';
    saveState();
  }

  logoBtn.addEventListener('click', navigateToHome);
  if(homeBtnTop) homeBtnTop.addEventListener('click', navigateToHome);
  if(readerHomeBtn) readerHomeBtn.addEventListener('click', navigateToHome);

  if(updatesBtn) updatesBtn.addEventListener('click', () => { switchView(updatesView); updatesBtn.classList.add('active-nav'); loadUpdates(); });
  if(rankingBtn) rankingBtn.addEventListener('click', () => { switchView(rankingView); rankingBtn.classList.add('active-nav'); loadRanking(); });
  if(mangaListBtn) mangaListBtn.addEventListener('click', () => { switchView(mangaListView); mangaListBtn.classList.add('active-nav'); loadMangaList(); });
  if(creatorsBtn) creatorsBtn.addEventListener('click', () => { switchView(creatorsView); creatorsBtn.classList.add('active-nav'); loadCreators(); });
  if(bookmarksTopBtn) bookmarksTopBtn.addEventListener('click', () => { switchView(bookmarksView); bookmarksTopBtn.classList.add('active-nav'); loadFavorites(); });
  if(aboutUsBtn) aboutUsBtn.addEventListener('click', () => { switchView(aboutView); aboutUsBtn.classList.add('active-nav'); });

  if (currentUser) {
    if (state.inReaderMode) {
      navigateToReader();
    } else {
      navigateToHome();
    }
  } else {
    showAuth();
  }

  // ---- Reader Logic ----

  function rebuildChapterSelect() {
    chapterSelect.innerHTML = '';
    if (state.availableChapters && state.availableChapters.length > 0) {
      for (const ch of state.availableChapters) {
        const option = document.createElement('option');
        option.value = ch.number;
        option.textContent = ch.text || `Chapter ${ch.number}`;
        chapterSelect.appendChild(option);
      }
    } else {
      const max = state.maxChapter || MAX_CHAPTER;
      for (let i = 1; i <= max; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Chapter ${i}`;
        chapterSelect.appendChild(option);
      }
    }
    chapterSelect.value = state.chapter;
  }
  rebuildChapterSelect();

  updateUIState();

  function saveState() {
    localStorage.setItem('egozoneState', JSON.stringify(state));
    
    // Auto Bookmark feature
    if (state.inReaderMode && state.mangaDexId) {
      const existingIdx = bookmarks.findIndex(b => b.id === state.mangaDexId);
      if (existingIdx !== -1) {
        bookmarks[existingIdx].chapter = state.chapter;
        bookmarks[existingIdx].page = state.page;
      } else {
        bookmarks.push({
          id: state.mangaDexId,
          chapter: state.chapter,
          page: state.page
        });
      }
      localStorage.setItem('manganexBookmarks', JSON.stringify(bookmarks));
    }
  }

  function updateUIState() {
    toggleDirectionBtn.textContent = state.isRTL ? 'RTL Mode' : 'LTR Mode';
    toggleDirectionBtn.classList.toggle('active', state.isRTL);
    
    toggleSpreadBtn.textContent = state.isSpread ? 'Double Page' : 'Single Page';
    toggleSpreadBtn.classList.toggle('active', state.isSpread);
    
    pageFlipper.classList.toggle('rtl', state.isRTL);

    if (state.isRTL) {
      pageControls.style.flexDirection = 'row-reverse';
      nextBtn.textContent = '← Next';
      prevBtn.textContent = 'Prev →';
    } else {
      pageControls.style.flexDirection = 'row';
      nextBtn.textContent = 'Next →';
      prevBtn.textContent = '← Prev';
    }
  }

  const bookmarkCurrentBtn = document.getElementById('bookmarkCurrentBtn');
  if (bookmarkCurrentBtn) {
    bookmarkCurrentBtn.addEventListener('click', () => {
      if (!state.mangaDexId) return;
      
      const existingIdx = bookmarks.findIndex(b => b.id === state.mangaDexId);
      if (existingIdx !== -1) {
        bookmarks[existingIdx].chapter = state.chapter;
        bookmarks[existingIdx].page = state.page;
      } else {
        bookmarks.push({
          id: state.mangaDexId,
          chapter: state.chapter,
          page: state.page
        });
      }
      localStorage.setItem('manganexBookmarks', JSON.stringify(bookmarks));
      bookmarkCurrentBtn.style.background = 'rgba(255, 215, 0, 0.2)';
      bookmarkCurrentBtn.textContent = 'Bookmarked! ✓';
      setTimeout(() => {
        bookmarkCurrentBtn.style.background = '';
        bookmarkCurrentBtn.textContent = 'Bookmark 🔖';
      }, 2000);
    });
  }

  toggleDirectionBtn.addEventListener('click', () => {
    state.isRTL = !state.isRTL;
    updateUIState();
    saveState();
  });

  toggleSpreadBtn.addEventListener('click', () => {
    state.isSpread = !state.isSpread;
    if (state.isSpread && state.page % 2 === 0) {
      state.page -= 1; 
    }
    updateUIState();
    loadPage();
  });

  chapterSelect.addEventListener('change', (e) => {
    state.chapter = parseFloat(e.target.value);
    state.page = 1;
    state.currentChapterPages = null;
    if (mangaPageLeft) mangaPageLeft.src = '';
    if (mangaPageRight) mangaPageRight.src = '';
    loadPage();
  });

  prevChapterBtn.addEventListener('click', () => {
    goToPrevChapter();
  });

  nextChapterBtn.addEventListener('click', () => {
    goToNextChapter();
  });

  function getImageUrl(chapter, page) {
    if (state.currentChapterPages && state.currentChapterPages.length > 0) {
      return state.currentChapterPages[page - 1] || null;
    }
    return null;
  }

  function preloadImage(chapter, page) {
    if (!state.currentChapterPages || page > state.currentChapterPages.length) return;
    const url = state.currentChapterPages[page - 1];
    if (url && !preloadedImages[url]) {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.src = url;
      preloadedImages[url] = img;
    }
  }

  function preloadAhead() {
    if (!state.currentChapterPages) return;
    let pagesToPreload = state.isSpread ? 4 : 2;
    for (let i = 1; i <= pagesToPreload; i++) {
      preloadImage(state.chapter, state.page + (state.isSpread ? 1 : 0) + i);
    }
  }

  function applyAnimation(direction) {
    pageFlipper.classList.remove('anim-next', 'anim-prev');
    void pageFlipper.offsetWidth;
    pageFlipper.classList.add(direction === 'next' ? 'anim-next' : 'anim-prev');
  }

  function loadImagePromise(url) {
    return new Promise((resolve, reject) => {
      if (!url) return reject();
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.onload = () => resolve(url);
      img.onerror = () => reject();
      img.src = url;
    });
  }

  function getCleanTitle(title) {
    if (!title) return '';
    return title
      .replace(/\s*\(colored\)/i, '')
      .replace(/\s*\(official\)/i, '')
      .replace(/\s*\(native\)/i, '')
      .replace(/\s*\(webtoon\)/i, '')
      .replace(/\s*\(digital\)/i, '')
      .trim();
  }

  async function loadChaptersForCurrentManga() {
    if (!state.currentMangaTitle) return;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let baseUrl = isLocal ? 'http://localhost:3000' : '';

    if (!baseUrl) {
      try {
        const ping = await fetch('http://localhost:3000/api/proxy-chapters?title=ping', { signal: AbortSignal.timeout(600) });
        if (ping.ok || ping.status === 400 || ping.status === 404) {
          baseUrl = 'http://localhost:3000';
        }
      } catch (e) {}
    }

    if (baseUrl) {
      try {
        const searchTitle = getCleanTitle(state.currentMangaTitle);
        const res = await fetch(`${baseUrl}/api/proxy-chapters?title=${encodeURIComponent(searchTitle)}`);
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          if (data.chapters && data.chapters.length > 0) {
            state.availableChapters = data.chapters;
            state.maxChapter = data.maxChapter;
            rebuildChapterSelect();
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to load chapters from proxy:", e.message);
      }
    }

    // Fallback to MangaDex aggregate or chapters feed
    try {
      if (state.mangaDexId) {
        let chList = [];
        let maxCh = 1;
        try {
          const aggData = await fetchMangaDex(`https://api.mangadex.org/manga/${state.mangaDexId}/aggregate`);
          if (aggData && aggData.volumes) {
            for (const vol of Object.values(aggData.volumes)) {
              if (vol.chapters) {
                for (const ch of Object.values(vol.chapters)) {
                  const num = parseFloat(ch.chapter);
                  if (!isNaN(num)) {
                    if (num > maxCh) maxCh = Math.floor(num);
                    chList.push({ number: num, text: `Chapter ${num}`, id: ch.id });
                  }
                }
              }
            }
          }
        } catch (e) {}

        if (chList.length < 10) {
          try {
            const feedData = await fetchMangaDex(`https://api.mangadex.org/manga/${state.mangaDexId}/feed?limit=500&order[chapter]=asc`);
            if (feedData && feedData.data) {
              const seen = new Set(chList.map(c => c.number));
              feedData.data.forEach(c => {
                const num = parseFloat(c.attributes.chapter);
                if (!isNaN(num) && !seen.has(num)) {
                  seen.add(num);
                  if (num > maxCh) maxCh = Math.floor(num);
                  chList.push({ number: num, text: `Chapter ${num}`, id: c.id });
                }
              });
            }
          } catch(e) {}
        }

        chList.sort((a,b) => a.number - b.number);
        if (chList.length > 0) {
          state.availableChapters = chList;
          state.maxChapter = Math.max(maxCh, chList.length);
          rebuildChapterSelect();
        } else {
          state.maxChapter = Math.max(state.maxChapter || 50, 50);
          rebuildChapterSelect();
        }
      }
    } catch (e) {
      console.warn("MangaDex chapter loading error:", e.message);
    }
  }

  async function fetchChapterPages(chapterNumber) {
    state.currentChapterPages = null;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let baseUrl = isLocal ? 'http://localhost:3000' : '';

    if (!baseUrl) {
      try {
        const ping = await fetch('http://localhost:3000/api/proxy-chapters?title=ping', { signal: AbortSignal.timeout(600) });
        if (ping.ok || ping.status === 400 || ping.status === 404) {
          baseUrl = 'http://localhost:3000';
        }
      } catch (e) {}
    }

    // 1. Try local proxy scraper (WeebCentral) first if on localhost or proxy available
    if (baseUrl) {
      try {
        const searchTitle = getCleanTitle(state.currentMangaTitle);
        console.log(`[Reader] Fetching Chapter ${chapterNumber} of "${searchTitle}" via proxy...`);
        const res = await fetch(`${baseUrl}/api/proxy-manga?title=${encodeURIComponent(searchTitle)}&chapter=${chapterNumber}`);
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          if (data.pages && data.pages.length > 0) {
            state.currentChapterPages = data.pages.map(p => {
              if (p.startsWith('/api/') && baseUrl) {
                return `${baseUrl}${p}`;
              }
              if (p.startsWith('http') && !p.includes('/api/proxy-image')) {
                return `${baseUrl}/api/proxy-image?url=${encodeURIComponent(p)}`;
              }
              return p;
            });
            console.log(`[Reader] Successfully loaded ${data.pages.length} pages from proxy!`);
            return true;
          }
        }
      } catch (e) {
        console.warn(`[Reader] Proxy failed for Ch ${chapterNumber}:`, e.message);
      }
    }

    // 2. Direct MangaDex fetch (works on GitHub Pages, Render, and localhost!)
    if (state.mangaDexId) {
      try {
        console.log(`[Reader] Trying MangaDex for Chapter ${chapterNumber}...`);
        let chapterUuid = null;

        // Try English internal chapter
        try {
          const chData = await fetchMangaDex(`https://api.mangadex.org/chapter?manga=${state.mangaDexId}&chapter=${chapterNumber}&translatedLanguage[]=en&limit=10`);
          if (chData && chData.data && chData.data.length > 0) {
            const internal = chData.data.find(c => !c.attributes.externalUrl);
            if (internal) chapterUuid = internal.id;
          }
        } catch (e) {}

        // If English not found or external, try any language internal chapter
        if (!chapterUuid) {
          try {
            const anyData = await fetchMangaDex(`https://api.mangadex.org/chapter?manga=${state.mangaDexId}&chapter=${chapterNumber}&limit=10`);
            if (anyData && anyData.data && anyData.data.length > 0) {
              const internal = anyData.data.find(c => !c.attributes.externalUrl);
              if (internal) chapterUuid = internal.id;
            }
          } catch (e) {}
        }

        // Try chapterUuid from availableChapters
        if (!chapterUuid && state.availableChapters && state.availableChapters.length > 0) {
          const found = state.availableChapters.find(c => c.number === parseFloat(chapterNumber));
          if (found && found.id && found.id.length > 30) chapterUuid = found.id;
        }

        if (chapterUuid) {
          const serverData = await fetchMangaDex(`https://api.mangadex.org/at-home/server/${chapterUuid}`);
          const mdBaseUrl = serverData.baseUrl;
          const hash = serverData.chapter?.hash;
          if (hash && serverData.chapter?.data && serverData.chapter.data.length >= 1) {
            state.currentChapterPages = serverData.chapter.data.map(f => `${mdBaseUrl}/data/${hash}/${f}`);
            console.log(`[Reader] Loaded ${state.currentChapterPages.length} pages from MangaDex!`);
            return true;
          }
        }
      } catch (e) {
        console.warn(`[Reader] MangaDex fallback failed:`, e.message);
      }
    }

    state.currentChapterPages = [];
    return false;
  }

  async function loadPage(animationDir = null) {
    if (!state.inReaderMode) return;
    isEndOfChapter = false;
    saveState();

    if (animationDir) applyAnimation(animationDir);

    const errorOverlay = document.getElementById('errorOverlay');
    if (errorOverlay) errorOverlay.style.display = 'none';

    // If pages for the current chapter are not loaded yet, fetch them!
    if (!state.currentChapterPages || state.currentChapterPages.length === 0) {
      pageInfo.textContent = `Loading Ch ${state.chapter}...`;
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      isLoading = true;

      const success = await fetchChapterPages(state.chapter);
      if (!success || !state.currentChapterPages || state.currentChapterPages.length === 0) {
        isLoading = false;
        if (errorOverlay) {
          const isBlueLock = state.currentMangaTitle && state.currentMangaTitle.toLowerCase().includes('blue lock') && !state.currentMangaTitle.toLowerCase().includes('colored');
          let extraAction = '';
          if (isBlueLock) {
            extraAction = `
              <div style="margin-top: 1.2rem;">
                <button id="switchColoredBtn" class="primary-btn" style="background: linear-gradient(135deg, #ff8c00, #ff4500); padding: 0.7rem 1.6rem; font-size: 1rem; border-radius: 8px; cursor: pointer; border: none; color: white; font-weight: bold; box-shadow: 0 4px 15px rgba(255, 140, 0, 0.4);">
                  🎨 Read Blue Lock (Colored Edition)
                </button>
              </div>
            `;
          }

          errorOverlay.innerHTML = `
            <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📖</div>
            <h3 style="font-family: Oswald, sans-serif; font-size: 1.8rem; color: var(--accent-color); margin-bottom: 0.5rem; letter-spacing: 1px;">CHAPTER ${state.chapter}</h3>
            <p style="font-size: 1rem; color: var(--text-main); margin: 0.8rem 0; font-family: Inter, sans-serif; line-height: 1.6;">
              Could not load pages for Chapter ${state.chapter} of <strong>${state.currentMangaTitle}</strong>.
            </p>
            ${extraAction}
            <div style="display: flex; gap: 0.8rem; justify-content: center; margin-top: 1.2rem; flex-wrap: wrap;">
              <button id="nextChBtn" class="primary-btn" style="padding: 0.6rem 1.4rem; cursor: pointer;">Next Chapter ➔</button>
              <button id="retryChBtn" class="secondary-btn" style="padding: 0.6rem 1.4rem; cursor: pointer;">Retry</button>
            </div>
          `;
          errorOverlay.style.display = 'block';

          const switchColoredBtn = document.getElementById('switchColoredBtn');
          if (switchColoredBtn) {
            switchColoredBtn.onclick = () => {
              openManga("c8b55f34-21a4-4ca7-8e5d-d58d38fe3203", "Blue Lock (Colored Edition)");
            };
          }
          const nextChBtn = document.getElementById('nextChBtn');
          if (nextChBtn) {
            nextChBtn.onclick = () => goToNextChapter();
          }
          const retryBtn = document.getElementById('retryChBtn');
          if (retryBtn) {
            retryBtn.onclick = () => {
              state.currentChapterPages = null;
              loadPage();
            };
          }
        }
        pageInfo.textContent = `Ch ${state.chapter} (Unavailable)`;
        return;
      }
    }

    const totalPages = state.currentChapterPages.length;
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;

    isLoading = true;
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    if (state.isSpread) {
      const url1 = state.currentChapterPages[state.page - 1] || null;
      const url2 = state.currentChapterPages[state.page] || null;

      if (url1) {
        mangaPageLeft.src = url1;
        mangaPageLeft.classList.remove('hidden');
        mangaPageLeft.classList.add('spread');

        if (url2) {
          mangaPageRight.src = url2;
          mangaPageRight.classList.remove('hidden');
          mangaPageRight.classList.add('spread');
          pageInfo.textContent = `Ch ${state.chapter} | Pg ${state.page}-${state.page + 1} / ${totalPages}`;

          Promise.all([loadImagePromise(url1), loadImagePromise(url2)]).then(() => {
            isLoading = false;
            prevBtn.disabled = state.page === 1;
            nextBtn.disabled = false;
            preloadAhead();
          }).catch(handleImageError);
        } else {
          mangaPageRight.classList.add('hidden');
          pageInfo.textContent = `Ch ${state.chapter} | Pg ${state.page} / ${totalPages} (End)`;
          isEndOfChapter = true;

          loadImagePromise(url1).then(() => {
            isLoading = false;
            prevBtn.disabled = state.page === 1;
            nextBtn.disabled = false;
            preloadAhead();
          }).catch(handleImageError);
        }
      } else {
        handleImageError();
      }
    } else {
      mangaPageLeft.classList.add('hidden');
      mangaPageRight.classList.remove('spread');

      const url = state.currentChapterPages[state.page - 1] || null;
      if (url) {
        mangaPageRight.src = url;
        mangaPageRight.classList.remove('hidden');
        mangaPageRight.style.display = '';
        pageInfo.textContent = `Ch ${state.chapter} | Pg ${state.page} / ${totalPages}`;

        if (state.page === totalPages) {
          isEndOfChapter = true;
        }

        loadImagePromise(url).then(() => {
          isLoading = false;
          prevBtn.disabled = state.page === 1;
          nextBtn.disabled = false;
          preloadAhead();
        }).catch(handleImageError);
      } else {
        handleImageError();
      }
    }
  }

  function handleImageError() {
    isLoading = false;
    prevBtn.disabled = state.page === 1;
    nextBtn.disabled = false;
    showToast("Error loading page image. Try reloading or turning the page.");
  }

  function goNext() {
    if (isLoading) return;
    const totalPages = state.currentChapterPages ? state.currentChapterPages.length : 1;
    const step = state.isSpread ? 2 : 1;

    if (state.page + step <= totalPages) {
      state.page += step;
      loadPage('next');
    } else {
      // Reached the end of chapter!
      if (confirm(`You have finished Chapter ${state.chapter}. Move to the next chapter?`)) {
        goToNextChapter();
      }
    }
  }

  function goPrev() {
    if (isLoading) return;
    const step = state.isSpread ? 2 : 1;
    if (state.page > 1) {
      state.page -= step;
      if (state.page < 1) state.page = 1;
      loadPage('prev');
    } else {
      // At beginning of chapter
      if (state.chapter > 1) {
        if (confirm(`Go back to Chapter ${state.chapter - 1}?`)) {
          goToPrevChapter();
        }
      }
    }
  }

  function goToNextChapter() {
    let nextCh = state.chapter + 1;
    if (state.availableChapters && state.availableChapters.length > 0) {
      const idx = state.availableChapters.findIndex(c => c.number === state.chapter);
      if (idx !== -1 && idx + 1 < state.availableChapters.length) {
        nextCh = state.availableChapters[idx + 1].number;
      }
    }
    state.chapter = nextCh;
    chapterSelect.value = state.chapter;
    state.page = 1;
    state.currentChapterPages = null;
    loadPage();
  }

  function goToPrevChapter() {
    let prevCh = state.chapter - 1;
    if (state.availableChapters && state.availableChapters.length > 0) {
      const idx = state.availableChapters.findIndex(c => c.number === state.chapter);
      if (idx > 0) {
        prevCh = state.availableChapters[idx - 1].number;
      }
    }
    if (prevCh < 1) prevCh = 1;
    state.chapter = prevCh;
    chapterSelect.value = state.chapter;
    state.page = 1;
    state.currentChapterPages = null;
    loadPage();
  }

  nextBtn.addEventListener('click', () => goNext());
  prevBtn.addEventListener('click', () => goPrev());

  window.addEventListener('keydown', (e) => {
    if (!state.inReaderMode) return;
    if (e.key === 'ArrowRight') {
      state.isRTL ? goPrev() : goNext();
    } else if (e.key === 'ArrowLeft') {
      state.isRTL ? goNext() : goPrev();
    }
  });

  // ---- Fullscreen & Toast Logic ----
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      document.body.classList.add('fullscreen-mode');
      showToast('Use Left or Right arrow key to go to the next or previous page');
    } else {
      document.body.classList.remove('fullscreen-mode');
    }
  });

  // -------------------------
  // SPA DATA FETCHING & RENDERING
  // -------------------------

  function createMangaCard(manga) {
    const title = (manga.attributes && manga.attributes.title) ? (manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown') : 'Unknown';
    const coverArt = manga.relationships ? manga.relationships.find(r => r.type === 'cover_art') : null;
    const fileName = coverArt && coverArt.attributes ? coverArt.attributes.fileName : '';
    const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}.256.jpg` : 'logo.jpg';
    
    const card = document.createElement('div');
    card.className = 'manga-card';
    card.innerHTML = `
      <img src="${coverUrl}" alt="${title}" referrerpolicy="no-referrer" loading="lazy" onerror="this.onerror=null; this.src='logo.jpg';">
      <div class="manga-info">
        <h3 class="manga-title">${title}</h3>
      </div>
    `;
    card.onclick = () => openManga(manga.id, title);
    return card;
  }

  window.loadUpdates = async function() {
    const grid = document.getElementById('updatesGrid');
    const loader = document.getElementById('updatesLoader');
    if(grid.children.length > 0) return; // already loaded
    
    loader.style.display = 'block';
    try {
      let data = null;
      try {
        data = await fetchMangaDex(`https://api.mangadex.org/manga?limit=24&order[latestUploadedChapter]=desc&includes[]=cover_art&contentRating[]=safe`);
      } catch (e) {}

      grid.innerHTML = '';
      const list = (data && data.data && data.data.length > 0) ? data.data : (allMangaDataCache || []).slice(0, 24);
      list.forEach(manga => {
        const card = createMangaCard(manga);
        if (card) grid.appendChild(card);
      });
    } catch(err) {
      console.error("Updates error", err);
    } finally {
      loader.style.display = 'none';
    }
  }

  window.loadRanking = async function() {
    const grid = document.getElementById('rankingGrid');
    const loader = document.getElementById('rankingLoader');
    if(grid.children.length > 0) return;
    
    loader.style.display = 'block';
    try {
      let data = null;
      try {
        data = await fetchMangaDex(`https://api.mangadex.org/manga?limit=100&order[followedCount]=desc&includes[]=cover_art&contentRating[]=safe`);
      } catch (e) {}

      grid.innerHTML = '';
      const list = (data && data.data && data.data.length > 0) ? data.data : (allMangaDataCache || []);
      list.forEach((manga, i) => {
        const card = createMangaCard(manga);
        if (!card) return;
        const rankBadge = document.createElement('div');
        rankBadge.style.cssText = 'position: absolute; top: -10px; left: -10px; background: #ffaa00; color: white; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; font-family: Oswald, sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 10;';
        rankBadge.innerText = i + 1;
        card.style.position = 'relative';
        card.appendChild(rankBadge);
        grid.appendChild(card);
      });
    } catch(err) {
      console.error("Ranking error", err);
    } finally {
      loader.style.display = 'none';
    }
  }

  window.loadMangaList = async function() {
    const grid = document.getElementById('fullMangaGrid');
    const loader = document.getElementById('mangaListLoader');
    const sortSelect = document.getElementById('mangaListSort');
    
    async function fetchSortedManga(sortType) {
      loader.style.display = 'block';
      grid.innerHTML = '';
      try {
        let orderString = 'order[followedCount]=desc';
        if (sortType === 'az') orderString = 'order[title]=asc';
        if (sortType === 'za') orderString = 'order[title]=desc';
        
        let data = null;
        try {
          data = await fetchMangaDex(`https://api.mangadex.org/manga?limit=30&${orderString}&includes[]=cover_art&contentRating[]=safe`);
        } catch (e) {}

        let list = (data && data.data && data.data.length > 0) ? data.data : [...(allMangaDataCache || [])];
        if (!data || !data.data) {
          if (sortType === 'az') {
            list.sort((a,b) => {
              const tA = (a.attributes?.title?.en || Object.values(a.attributes?.title || {})[0] || '').toLowerCase();
              const tB = (b.attributes?.title?.en || Object.values(b.attributes?.title || {})[0] || '').toLowerCase();
              return tA.localeCompare(tB);
            });
          } else if (sortType === 'za') {
            list.sort((a,b) => {
              const tA = (a.attributes?.title?.en || Object.values(a.attributes?.title || {})[0] || '').toLowerCase();
              const tB = (b.attributes?.title?.en || Object.values(b.attributes?.title || {})[0] || '').toLowerCase();
              return tB.localeCompare(tA);
            });
          }
        }

        list.forEach(manga => {
          const card = createMangaCard(manga);
          if (card) grid.appendChild(card);
        });
      } catch(err) {
        console.error("Manga List error", err);
      } finally {
        loader.style.display = 'none';
      }
    }

    if(grid.children.length === 0) {
      await fetchSortedManga('popularity');
      
      sortSelect.addEventListener('change', (e) => {
        fetchSortedManga(e.target.value);
      });
    }
  }

  window.loadCreators = async function() {
    const list = document.getElementById('creatorsList');
    if(list.children.length > 0) return;

    // Hardcode some famous creators
    const creators = [
      { name: "Muneyuki Kaneshiro", search: "Muneyuki Kaneshiro", desc: "Writer of Blue Lock. Known for intense psychological sports dramas." },
      { name: "Hajime Isayama", search: "Hajime Isayama", desc: "Creator of Attack on Titan. Master of foreshadowing and dark fantasy." },
      { name: "Eiichiro Oda", search: "Oda Eiichiro", desc: "Creator of One Piece. World-building genius." }
    ];

    list.innerHTML = '';
    for (const author of creators) {
      const authorBox = document.createElement('div');
      authorBox.style.cssText = 'background: rgba(255,255,255,0.8); border: 1px solid rgba(255,140,0,0.3); border-radius: 12px; padding: 2rem;';
      
      authorBox.innerHTML = `
        <h3 style="font-family: Oswald, sans-serif; font-size: 2rem; color: var(--text-main); margin-bottom: 0.5rem;">${author.name}</h3>
        <p style="color: var(--text-main); margin-bottom: 1.5rem; font-size: 1.1rem;">${author.desc}</p>
        <div class="creator-works-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;">
          <div style="text-align: center; color: var(--text-main);">Loading works...</div>
        </div>
      `;
      list.appendChild(authorBox);

      // Fetch their works
      try {
        const authData = await fetchMangaDex(`https://api.mangadex.org/author?name=${encodeURIComponent(author.search)}`);
        const worksGrid = authorBox.querySelector('.creator-works-grid');
        worksGrid.innerHTML = '';

        if(authData.data && authData.data.length > 0) {
          const authorId = authData.data[0].id;
          const mangaData = await fetchMangaDex(`https://api.mangadex.org/manga?authors[]=${authorId}&includes[]=cover_art&contentRating[]=safe`);
          
          if(mangaData.data && mangaData.data.length === 0) {
             worksGrid.innerHTML = '<div style="color: var(--text-main);">No works found.</div>';
          } else if (mangaData.data) {
             mangaData.data.forEach(manga => {
                const card = createMangaCard(manga);
                if (card) worksGrid.appendChild(card);
             });
          }
        } else {
          worksGrid.innerHTML = '<div style="color: var(--text-main);">Works unavailable.</div>';
        }
      } catch(err) {
         console.warn("Author fetch error", err);
         const worksGrid = authorBox.querySelector('.creator-works-grid');
         if (worksGrid) {
           worksGrid.innerHTML = '';
           const matched = (allMangaDataCache || []).filter(m => {
             const t = (m.attributes?.title?.en || Object.values(m.attributes?.title || {})[0] || '').toLowerCase();
             if (author.name.includes('Kaneshiro') && t.includes('blue lock')) return true;
             if (author.name.includes('Isayama') && t.includes('titan')) return true;
             if (author.name.includes('Oda') && t.includes('one piece')) return true;
             return false;
           });
           if (matched.length > 0) {
             matched.forEach(m => {
               const card = createMangaCard(m);
               if (card) worksGrid.appendChild(card);
             });
           } else {
             worksGrid.innerHTML = '<div style="color: var(--text-main);">Works available in catalog.</div>';
           }
         }
      }
    }
  }

  window.loadFavorites = function() {
    const grid = document.getElementById('favoritesGrid');
    const emptyMsg = document.getElementById('favoritesEmpty');
    grid.innerHTML = '';
    
    if(bookmarks.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }
    
    emptyMsg.style.display = 'none';
    
    bookmarks.forEach(b => {
      let manga = (allMangaDataCache || []).find(m => m.id === b.id);
      if (manga) {
        const card = createMangaCard(manga);
        if (card) grid.appendChild(card);
      } else {
        fetchMangaDex(`https://api.mangadex.org/manga/${b.id}?includes[]=cover_art`).then(res => {
          if (res?.data) {
            const card = createMangaCard(res.data);
            if (card) grid.appendChild(card);
          }
        }).catch(() => {});
      }
    });
  }

});
