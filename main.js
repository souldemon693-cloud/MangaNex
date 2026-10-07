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
    useMangaDex: false,
    mangaDexId: null,
    mangaDexChapters: null,
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
    state = { ...state, ...JSON.parse(savedState) };
    if (state.currentMangaId === '01j76xyd7e91k8qp6cy0y53900' || !state.useMangaDex) {
      state.currentMangaId = '';
      state.useMangaDex = true;
    }
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
    state.useMangaDex = true;
    state.mangaDexId = mangaId;
    
    const existing = bookmarks.find(b => b.id === mangaId);
    if (existing) {
       state.chapter = existing.chapter;
       state.page = existing.page;
    } else {
       state.chapter = 1;
       state.page = 1;
    }
    
    state.mangaDexChapters = null;
    state.currentChapterPages = null;
    state.maxChapter = 100;
    
    saveState();
    navigateToReader();
  };

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
        '304ceac3-8cdb-4fe7-acf7-2b6ff7a60613', // Attack on Titan
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
        'edb82d3c-20f6-4cf9-a879-7457478642fe', // Haikyu!!
        '319df2e2-e6a6-4e3a-a31c-68539c140a84', // Slam Dunk
        '736a2bf0-f875-4b52-a7b4-e8c40505b68a'  // Mob Psycho 100
      ];
      const famousIds = [...shonenIds, ...seinenIds, ...sportsIds];
      
      // Explicit Ranking requested by user (Max 40 for the API limit)
      // Added fully native/colored editions of famous mangas that don't trigger proxy errors!
      const rankedIds = [
        "4141c5dc-c525-4df5-afd7-cc7d192a832f", // Blue Lock (Native)
        "c52b2ce3-7f95-469c-96b0-479524fb7a1a", // Jujutsu Kaisen
        "a2c1d849-af05-4bbc-b2a7-866ebb10331f", // One Piece (Colored)
        "a787b10a-02d0-46c0-8236-0d01d69ad4a3", // Naruto (Colored)
        "a460ab18-22c1-47eb-a08a-9ee85fe37ec8", // Bleach (Colored)
        "af0527c1-8734-4498-b128-7090340bc10d", // Dragon Ball (Colored)
        "c1d6d092-811d-49d2-b143-0d12bc3fd9dd", // My Hero Academia (Colored)
        "62040a44-0935-46b7-a691-5ae5833af0ae", // Demon Slayer (Colored)
        "e896c48c-3150-437d-ba57-d8567eb399ae", // Chainsaw Man (Colored)
        "db692d58-4b13-4174-ae8c-30c515c0689c", // Hunter x Hunter (Native)
        "801513ba-a712-498c-8f57-cae55b38cc92", // Berserk (Native)
        "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0", // Solo Leveling
      ];
      const idsQuery = rankedIds.map(id => `ids[]=${id}`).join('%26');
      
      // Check cache first to avoid blank screen on rate limits
      const cachedData = localStorage.getItem('manganex_cache');
      let data1 = { data: [] };
      let data2 = { data: [] };
      
      try {
        const res1 = await fetch(`/api/proxy-mangadex?url=https://api.mangadex.org/manga?limit=40%26includes[]=cover_art%26${idsQuery}`);
        if (!res1.ok) throw new Error('API Rate Limit or Error');
        data1 = await res1.json();
        
        const res2 = await fetch(`/api/proxy-mangadex?url=https://api.mangadex.org/manga?limit=100%26includes[]=cover_art%26order[followedCount]=desc%26contentRating[]=safe%26contentRating[]=suggestive`);
        if (!res2.ok) throw new Error('API Rate Limit or Error');
        data2 = await res2.json();
      } catch (err) {
        console.warn("MangaDex API fetch failed, falling back to cache or hardcoded data:", err);
        if (cachedData) {
          const parsedCache = JSON.parse(cachedData);
          allMangaDataCache = parsedCache;
          renderGrid(parsedCache);
          renderCarousel(parsedCache);
          return;
        } else {
          // If no cache, use this ultra-reliable hardcoded fallback so the app never crashes
          console.warn("No cache found. Using hardcoded emergency fallback.");
          const fallbackData = [
            { id: "4141c5dc-c525-4df5-afd7-cc7d192a832f", attributes: { title: { en: "Blue Lock" } }, relationships: [{ type: "cover_art", attributes: { fileName: "7ee723d4-b926-4a81-acd9-53adb3fbe461.jpg" } }] },
            { id: "a2c1d849-af05-4bbc-b2a7-866ebb10331f", attributes: { title: { en: "One Piece" } }, relationships: [{ type: "cover_art", attributes: { fileName: "da0341d8-5526-452c-8bd3-dc8e3cd89f99.jpg" } }] },
            { id: "c52b2ce3-7f95-469c-96b0-479524fb7a1a", attributes: { title: { en: "Jujutsu Kaisen" } }, relationships: [{ type: "cover_art", attributes: { fileName: "6d9134b2-21ea-4d02-ac2b-7c0d1c6a2aaa.jpg" } }] },
            { id: "db692d58-4b13-4174-ae8c-30c515c0689c", attributes: { title: { en: "Hunter x Hunter" } }, relationships: [{ type: "cover_art", attributes: { fileName: "aa112927-f1e5-4fe4-a4db-7fd4a1536e3c.jpg" } }] },
            { id: "801513ba-a712-498c-8f57-cae55b38cc92", attributes: { title: { en: "Berserk" } }, relationships: [{ type: "cover_art", attributes: { fileName: "81e1c82d-6672-400c-8c58-4ff9bfb89031.jpg" } }] }
          ];
          allMangaDataCache = fallbackData;
          renderGrid(fallbackData);
          renderCarousel(fallbackData);
          return;
        }
      }
      
      let allData = [];
      
      const blockedIds = [
        "304ceac3-8cdb-4fe7-acf7-2b6ff7a60613", // Attack on Titan
        "4f3bcae4-2d96-4c9d-932c-90181d9c873e", // My Hero Academia
        "789642f8-ca89-4e4e-8f7b-eee4d17ea08b", // Demon Slayer
        "c52b2ce3-7f95-469c-96b0-479524fb7a1a", // Jujutsu Kaisen
        "db692d58-4b13-4174-ae8c-30c515c0689c", // Hunter x Hunter
        "a77742b1-befd-49a4-bff5-1ad4e6b0ef7b", // Chainsaw Man
        "6a1d1cb1-ecd5-40d9-89ff-9d88e40b136b", // Tokyo Ghoul
        "e7eabe96-aa17-476f-b431-2497d5e9d060", // Black Clover
        "71763dfb-8b85-4a74-92df-dfe46478fc5d", // Kaiju No 8
        "6b958848-c885-4735-9201-12ee77abcb3c", // SPY x FAMILY
        "d8a959f7-648e-4c8d-8f23-f1f3f8e129f3", // One-Punch Man
        "32d76d19-8a05-4db0-9fc2-e0b0648fe9d0"  // Solo Leveling
      ];

      data1.data.forEach(manga => {
         const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown';
         const lowerTitle = title.toLowerCase();
         if (!blockedIds.includes(manga.id) && !lowerTitle.includes('solo level') && !lowerTitle.includes('attack on titan') && !lowerTitle.includes('spy x family')) {
            allData.push(manga);
         }
      });
      
      data2.data.forEach(manga => {
         const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown';
         const lowerTitle = title.toLowerCase();
         if (!blockedIds.includes(manga.id) && !allData.find(m => m.id === manga.id) && !lowerTitle.includes('solo level') && !lowerTitle.includes('attack on titan') && !lowerTitle.includes('spy x family')) {
            allData.push(manga);
         }
      });
      
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
           const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0];
           const coverArt = manga.relationships.find(r => r.type === 'cover_art');
           const fileName = coverArt ? coverArt.attributes.fileName : '';
           const coverUrl = fileName ? `/api/proxy-image?url=https://uploads.mangadex.org/covers/${manga.id}/${fileName}.512.jpg` : 'placeholder.jpg';
           
           const slide = document.createElement('div');
           slide.className = 'promo-slide';
           slide.style.cssText = `scroll-snap-align: center; flex: 0 0 100%; position: relative; aspect-ratio: 21/9; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); overflow: hidden; cursor: pointer; border: 1px solid rgba(255,140,0,0.2); background-color: #111;`;
           slide.onclick = () => openManga(manga.id, title);
           
           slide.innerHTML = `
             <!-- Blurred background layer using the cover -->
             <div style="position: absolute; inset: -20px; background-image: url('${coverUrl}'); background-size: cover; background-position: center; filter: blur(15px); opacity: 0.5;"></div>
             
             <!-- Real Cover (Uncropped) -->
             <img src="${coverUrl}" alt="${title}" style="position: absolute; right: 5%; top: 5%; bottom: 5%; height: 90%; object-fit: contain; border-radius: 6px; box-shadow: -10px 0 30px rgba(0,0,0,0.8); z-index: 2;">
             
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
           const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0];
           const coverArt = manga.relationships.find(r => r.type === 'cover_art');
           const fileName = coverArt ? coverArt.attributes.fileName : '';
           const coverUrl = fileName ? `/api/proxy-image?url=https://uploads.mangadex.org/covers/${manga.id}/${fileName}.256.jpg` : 'placeholder.jpg';
           
           const views = Math.floor(Math.random() * 300000 + 50000).toLocaleString();
           
           const item = document.createElement('div');
           item.style.cssText = "display: flex; gap: 1rem; align-items: center; cursor: pointer; transition: transform 0.2s; padding: 0.5rem; border-radius: 8px;";
           item.onmouseover = () => { item.style.transform = 'translateX(5px)'; item.style.background = 'rgba(255,255,255,0.05)'; };
           item.onmouseout = () => { item.style.transform = 'none'; item.style.background = 'transparent'; };
           item.onclick = () => openManga(manga.id, title);
           
           item.innerHTML = `
              <img src="${coverUrl}" alt="${title}" style="width: 50px; height: 70px; object-fit: cover; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
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
        
        const coverRel = manga.relationships.find(r => r.type === 'cover_art');
        const coverFile = coverRel ? coverRel.attributes.fileName : '';
        const coverUrl = coverFile ? `/api/proxy-image?url=https://uploads.mangadex.org/covers/${manga.id}/${coverFile}.256.jpg` : '';
        
        // Build card
        const card = document.createElement('div');
        card.className = 'manga-catalog-card';
        card.innerHTML = `
          <div class="manga-cover" style="background-image: url('${coverUrl}'); background-size: cover; background-position: center; height: 260px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); transition: all 0.3s ease;">
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
          state.currentMangaTitle = title;
          state.useMangaDex = true;
          state.mangaDexId = manga.id;
          
          const existing = bookmarks.find(b => b.id === manga.id);
          if (existing) {
             state.chapter = existing.chapter;
             state.page = existing.page;
          } else {
             state.chapter = 1;
             state.page = 1;
          }
          
          state.mangaDexChapters = null;
          state.currentChapterPages = null;
          state.maxChapter = 100;
          
          saveState();
          navigateToReader();
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
    const max = state.maxChapter || MAX_CHAPTER;
    for (let i = 1; i <= max; i++) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `Chapter ${i}`;
      chapterSelect.appendChild(option);
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
    state.chapter = parseInt(e.target.value);
    state.page = 1;
    if (mangaPageLeft) mangaPageLeft.src = '';
    if (mangaPageRight) mangaPageRight.src = '';
    loadPage();
  });

  prevChapterBtn.addEventListener('click', () => {
    if (state.chapter > 1) {
      state.chapter--;
      chapterSelect.value = state.chapter;
      state.page = 1;
      if (mangaPageLeft) mangaPageLeft.src = '';
      if (mangaPageRight) mangaPageRight.src = '';
      loadPage();
    }
  });

  nextChapterBtn.addEventListener('click', () => {
    if (state.chapter < (state.maxChapter || MAX_CHAPTER)) {
      state.chapter++;
      chapterSelect.value = state.chapter;
      state.page = 1;
      if (mangaPageLeft) mangaPageLeft.src = '';
      if (mangaPageRight) mangaPageRight.src = '';
      loadPage();
    }
  });

  function getImageUrl(chapter, page) {
    if (state.useMangaDex) {
      return state.currentChapterPages ? state.currentChapterPages[page - 1] : null;
    }
    // Serve high-quality fallback placeholder manga pages for blocked series!
    // Alternate between the two generated pages for a continuous reading feel.
    return page % 2 !== 0 ? '/manga_page_1.png' : '/manga_page_2.png';
  }

  function preloadImage(chapter, page) {
    if (state.useMangaDex && state.currentChapterPages && page > state.currentChapterPages.length) return;
    const key = `${chapter}-${page}`;
    if (!preloadedImages[key]) {
      const url = getImageUrl(chapter, page);
      if (url) {
        const img = new Image();
        img.src = url;
        preloadedImages[key] = img;
      }
    }
  }

  function preloadAhead() {
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
      img.onload = () => resolve(url);
      img.onerror = () => reject();
      img.src = url;
    });
  }

  async function fetchMangaDexChapter(chapterNumber) {
    try {
      if (!state.mangaDexId) {
        const searchRes = await fetch(`/api/proxy-mangadex?url=https://api.mangadex.org/manga?title=${encodeURIComponent(state.currentMangaTitle)}%26limit=1`);
        const searchData = await searchRes.json();
        if (!searchData.data || searchData.data.length === 0) throw new Error("Manga not found");
        state.mangaDexId = searchData.data[0].id;
      }
      if (!state.mangaDexChapters) {
        const aggRes = await fetch(`/api/proxy-mangadex?url=https://api.mangadex.org/manga/${state.mangaDexId}/aggregate?translatedLanguage[]=en`);
        const aggData = await aggRes.json();
        const chapters = {};
        let maxCh = 1;
        for (const vol of Object.values(aggData.volumes)) {
          for (const ch of Object.values(vol.chapters)) {
            chapters[ch.chapter] = ch.id;
            const num = parseFloat(ch.chapter);
            if (!isNaN(num) && num > maxCh) maxCh = Math.floor(num);
          }
        }
        state.mangaDexChapters = chapters;
        state.maxChapter = maxCh;
        rebuildChapterSelect();
      }
      
      let chapterUuid = state.mangaDexChapters[String(chapterNumber)];
      
      // If the specific chapter doesn't exist (e.g. Chapter 1 is missing), fallback to the first available chapter!
      if (!chapterUuid) {
          const availableChapters = Object.keys(state.mangaDexChapters).map(Number).filter(n => !isNaN(n)).sort((a,b) => a-b);
          if (availableChapters.length > 0) {
              const lowestCh = availableChapters[0];
              chapterUuid = state.mangaDexChapters[String(lowestCh)];
              state.chapter = lowestCh; // Update the UI to reflect the actual chapter loaded
              chapterSelect.value = lowestCh;
              console.log(`Chapter ${chapterNumber} missing. Auto-falling back to Chapter ${lowestCh}`);
          } else {
              throw new Error("No chapters found for this manga.");
          }
      }
      
      const serverRes = await fetch(`/api/proxy-mangadex?url=https://api.mangadex.org/at-home/server/${chapterUuid}`);
      const serverData = await serverRes.json();
      const baseUrl = serverData.baseUrl;
      const hash = serverData.chapter.hash;
      
      if (!hash || !serverData.chapter.data || serverData.chapter.data.length === 0) {
          throw new Error("MangaDex does not host this chapter (External Redirect).");
      }
      
      state.currentChapterPages = serverData.chapter.data.map(filename => `${baseUrl}/data/${hash}/${filename}`);
    } catch (e) {
      console.error("MangaDex Error:", e.message);
      
      // Fallback to local WeebCentral proxy server
      try {
        console.log(`Trying local proxy for ${state.currentMangaTitle} Chapter ${chapterNumber}...`);
        const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';
        const proxyRes = await fetch(`${baseUrl}/api/proxy-manga?title=${encodeURIComponent(state.currentMangaTitle)}&chapter=${chapterNumber}`);
        if (!proxyRes.ok) {
            const errData = await proxyRes.json();
            throw new Error(errData.error || "Proxy failed");
        }
        const proxyData = await proxyRes.json();
        if (proxyData.pages && proxyData.pages.length > 0) {
            state.currentChapterPages = proxyData.pages;
            console.log("Successfully loaded from proxy!");
            return;
        } else {
            throw new Error("Proxy returned empty pages array");
        }
      } catch (proxyError) {
        console.error("Proxy Error:", proxyError.message);
        state.currentChapterPages = [];
        showToast("Failed to fetch chapter from MangaDex & Proxy.");
      }
    }
  }

  async function loadPage(animationDir = null) {
    if (!state.inReaderMode) return;
    isEndOfChapter = false;
    saveState();
    
    if (animationDir) applyAnimation(animationDir);

    const errorOverlay = document.getElementById('errorOverlay');
    if (errorOverlay) errorOverlay.style.display = 'none';

    pageInfo.textContent = `Loading...`;
    prevBtn.disabled = true;
    nextBtn.disabled = true;

    if (state.useMangaDex && (!state.currentChapterPages || state.currentChapterPages.length === 0 || animationDir === null)) {
      await fetchMangaDexChapter(state.chapter);
    }

    if (state.isSpread) {
      const url1 = getImageUrl(state.chapter, state.page);
      const url2 = getImageUrl(state.chapter, state.page + 1);

      if (url1) {
        mangaPageLeft.src = url1;
        mangaPageLeft.classList.remove('hidden');
        mangaPageLeft.classList.add('spread');
        
        if (url2) {
          mangaPageRight.src = url2;
          mangaPageRight.classList.remove('hidden');
          mangaPageRight.classList.add('spread');
          pageInfo.textContent = `Ch ${state.chapter} | Pg ${state.page}-${state.page + 1}`;
          
          Promise.all([loadImagePromise(url1), loadImagePromise(url2)]).then(() => {
             isLoading = false;
             prevBtn.disabled = state.page === 1;
             nextBtn.disabled = false;
             preloadAhead();
          }).catch(handleImageError);
        } else {
          mangaPageRight.classList.add('hidden');
          pageInfo.textContent = `Ch ${state.chapter} | Pg ${state.page} (End)`;
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
      
      const url = getImageUrl(state.chapter, state.page);
      if (url) {
        mangaPageRight.src = url;
        mangaPageRight.classList.remove('hidden');
        mangaPageRight.style.display = '';
        pageInfo.textContent = `Ch ${state.chapter} | Pg ${state.page}`;
        
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
    if (state.useMangaDex && state.currentMangaId) {
      console.warn("MangaDex chapter loading failed, falling back to WeebCentral Proxy!");
      state.useMangaDex = false;
      loadPage();
      return;
    }
    
    if (state.page > 1) {
      handleEndOfChapter();
    } else {
      mangaPageLeft.classList.add('hidden');
      mangaPageRight.classList.add('hidden');
      const errorOverlay = document.getElementById('errorOverlay');
      if (errorOverlay) {
        errorOverlay.innerHTML = `<h3>CHAPTER UNAVAILABLE</h3><p style="font-size: 1rem; color: #ccc; margin-top: 1rem; font-family: Inter, sans-serif; font-weight: normal;">This chapter cannot be loaded because MangaDex does not host the images directly (they redirect to official publishers like MangaPlus). Please read this chapter on the official source.</p>`;
        errorOverlay.style.display = 'block';
      }
      pageInfo.textContent = "Error";
    }
  }

  function handleEndOfChapter() {
    if (state.page > 1) {
      state.page -= state.isSpread ? 2 : 1;
      if (state.page < 1) state.page = 1;
      pageInfo.textContent = `Ch ${state.chapter} | Pg ${state.page} (End)`;
      isEndOfChapter = true;
    }
  }

  function goNext() {
    if (!isLoading) {
      if (isEndOfChapter) {
        if (state.chapter < (state.maxChapter || MAX_CHAPTER)) {
          if (confirm("this chapter is over, do you want to move to a next chapter?")) {
            state.chapter++;
            chapterSelect.value = state.chapter;
            state.page = 1;
            loadPage();
          }
        } else {
          showToast("You have reached the latest chapter.");
        }
        return;
      }
      state.page += state.isSpread ? 2 : 1;
      loadPage('next');
    }
  }

  function goPrev() {
    if (state.page > 1 && !isLoading) {
      state.page -= state.isSpread ? 2 : 1;
      if (state.page < 1) state.page = 1;
      loadPage('prev');
    }
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
    const title = manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown';
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('spy x family') || lowerTitle.includes('attack on titan') || lowerTitle.includes('solo level')) return null;

    const coverArt = manga.relationships ? manga.relationships.find(r => r.type === 'cover_art') : null;
    const fileName = coverArt ? coverArt.attributes.fileName : '';
    const coverUrl = fileName ? `/api/proxy-image?url=https://uploads.mangadex.org/covers/${manga.id}/${fileName}.256.jpg` : 'placeholder.jpg';
    
    const card = document.createElement('div');
    card.className = 'manga-card';
    card.innerHTML = `
      <img src="${coverUrl}" alt="${title}">
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
      const res = await fetch('https://api.mangadex.org/manga?limit=24&order[latestUploadedChapter]=desc&includes[]=cover_art&contentRating[]=safe');
      const data = await res.json();
      grid.innerHTML = '';
      if(data.data) {
         data.data.forEach(manga => {
            const card = createMangaCard(manga);
            if (card) grid.appendChild(card);
         });
      }
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
      const res = await fetch(`/api/proxy-mangadex?url=https://api.mangadex.org/manga?limit=100%26order[followedCount]=desc%26includes[]=cover_art%26contentRating[]=safe`);
      const data = await res.json();
      grid.innerHTML = '';
      if(data.data) {
        data.data.forEach((manga, i) => {
          const card = createMangaCard(manga);
          if (!card) return;
          const rankBadge = document.createElement('div');
          rankBadge.style.cssText = 'position: absolute; top: -10px; left: -10px; background: #ffaa00; color: white; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; font-family: Oswald, sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 10;';
          rankBadge.innerText = i + 1;
          card.style.position = 'relative';
          card.appendChild(rankBadge);
          grid.appendChild(card);
        });
      }
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
        
        const res = await fetch(`/api/proxy-mangadex?url=https://api.mangadex.org/manga?limit=30%26${orderString}%26includes[]=cover_art%26contentRating[]=safe`);
        const data = await res.json();
        if(data.data) {
           data.data.forEach(manga => {
              const card = createMangaCard(manga);
              if (card) grid.appendChild(card);
           });
        }
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
        const authRes = await fetch(`/api/proxy-mangadex?url=https://api.mangadex.org/author?name=${encodeURIComponent(author.search)}`);
        const authData = await authRes.json();
        const worksGrid = authorBox.querySelector('.creator-works-grid');
        worksGrid.innerHTML = '';

        if(authData.data && authData.data.length > 0) {
          const authorId = authData.data[0].id;
          const mangaRes = await fetch(`/api/proxy-mangadex?url=https://api.mangadex.org/manga?authors[]=${authorId}%26includes[]=cover_art%26contentRating[]=safe`);
          const mangaData = await mangaRes.json();
          
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
         console.error("Author fetch error", err);
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
    
    const fetchPromises = bookmarks.map(b => 
      fetch(`/api/proxy-mangadex?url=https://api.mangadex.org/manga/${b.id}?includes[]=cover_art`).then(r => r.json())
    );

    Promise.all(fetchPromises).then(results => {
      results.forEach(res => {
        if(res.data) {
          const card = createMangaCard(res.data);
          if (card) grid.appendChild(card);
        }
      });
    }).catch(err => console.error("Favorites fetch err", err));
  }

});
