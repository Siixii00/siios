export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // 獲取熱門視頻（不需要登入，公開 API）
      if (path === '/api/bilibili/hot') {
        return await handleHot(headers);
      }
      
      // 搜索視頻
      if (path === '/api/bilibili/search') {
        const keyword = url.searchParams.get('keyword');
        return await handleSearch(keyword, headers);
      }
      
      // 排行榜
      if (path === '/api/bilibili/ranking') {
        return await handleRanking(headers);
      }
      
      // 分區視頻
      if (path === '/api/bilibili/region') {
        const rid = url.searchParams.get('rid') || '1';
        return await handleRegion(rid, headers);
      }
      
      return new Response(JSON.stringify({ 
        message: 'Bilibili API Worker',
        status: 'ready',
        endpoints: [
          '/api/bilibili/hot - 獲取熱門視頻',
          '/api/bilibili/search?keyword=xxx - 搜索視頻',
          '/api/bilibili/ranking - 獲取排行榜',
          '/api/bilibili/region?rid=1 - 獲取分區視頻'
        ]
      }), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }), {
        status: 500,
        headers
      });
    }
  }
};

// 處理熱門視頻
async function handleHot(headers) {
  try {
    const response = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=20', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.code === 0 && data.data && data.data.list) {
      const videos = data.data.list.map(item => ({
        bvid: item.bvid,
        title: item.title,
        cover: item.pic,
        views: item.stat?.view || 0,
        danmu: item.stat?.danmaku || 0,
        duration: item.duration || 0,
        owner: item.owner?.name || '',
        tag: item.tname || '熱門'
      }));
      
      return new Response(JSON.stringify({ 
        success: true,
        videos: videos,
        source: 'hot',
        count: videos.length
      }), { headers });
    }
    
    throw new Error(`API error: ${data.message}`);
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      videos: []
    }), { headers });
  }
}

// 處理搜索
async function handleSearch(keyword, headers) {
  if (!keyword) {
    return new Response(JSON.stringify({ 
      error: 'keyword required',
      videos: []
    }), { headers });
  }
  
  try {
    const url = `https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword=${encodeURIComponent(keyword)}&page=1&page_size=20`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.code === 0 && data.data && data.data.result) {
      const videos = data.data.result.map(item => ({
        bvid: item.bvid,
        title: item.title?.replace(/<[^>]+>/g, '') || '',
        cover: item.pic,
        views: item.play || 0,
        danmu: item.video_review || 0,
        duration: item.duration || 0,
        owner: item.author || '',
        tag: item.typename || '搜索結果'
      }));
      
      return new Response(JSON.stringify({ 
        success: true,
        videos: videos,
        source: 'search',
        keyword: keyword,
        count: videos.length
      }), { headers });
    }
    
    throw new Error(`Search API error: ${data.message}`);
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      keyword: keyword,
      videos: []
    }), { headers });
  }
}

// 處理排行榜
async function handleRanking(headers) {
  try {
    const response = await fetch('https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all', {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.code === 0 && data.data && data.data.list) {
      const videos = data.data.list.map(item => ({
        bvid: item.bvid,
        title: item.title,
        cover: item.pic,
        views: item.stat?.view || 0,
        danmu: item.stat?.danmaku || 0,
        duration: item.duration || 0,
        owner: item.owner?.name || '',
        tag: item.tname || '排行榜'
      }));
      
      return new Response(JSON.stringify({ 
        success: true,
        videos: videos,
        source: 'ranking',
        count: videos.length
      }), { headers });
    }
    
    throw new Error(`Ranking API error: ${data.message}`);
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      videos: []
    }), { headers });
  }
}

// 處理分區視頻
async function handleRegion(rid, headers) {
  try {
    const response = await fetch(`https://api.bilibili.com/x/web-interface/dynamic/region?rid=${rid}&ps=20`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.code === 0 && data.data && data.data.archives) {
      const videos = data.data.archives.map(item => ({
        bvid: item.bvid,
        title: item.title,
        cover: item.pic,
        views: item.stat?.view || 0,
        danmu: item.stat?.danmaku || 0,
        duration: item.duration || 0,
        owner: item.owner?.name || '',
        tag: item.tname || '分區'
      }));
      
      return new Response(JSON.stringify({ 
        success: true,
        videos: videos,
        source: 'region',
        rid: rid,
        count: videos.length
      }), { headers });
    }
    
    throw new Error(`Region API error: ${data.message}`);
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      videos: []
    }), { headers });
  }
}