// Bilibili 搜索代理 Worker
// 使用公開的搜索 API，繞過反爬蟲限制

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
      // 搜索熱門內容（使用多個熱門關鍵詞）
      if (path === '/api/bilibili/update') {
        return await handleUpdate(headers);
      }
      
      // 搜索特定關鍵詞
      if (path === '/api/bilibili/search') {
        const keyword = url.searchParams.get('keyword') || '熱門';
        return await handleSearch(keyword, headers);
      }
      
      return new Response(JSON.stringify({ 
        message: 'Bilibili 搜索代理',
        endpoints: [
          '/api/bilibili/update - 自動更新熱門內容',
          '/api/bilibili/search?keyword=xxx - 搜索指定內容'
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

// 熱門搜索關鍵詞列表
const HOT_KEYWORDS = [
  '遊戲', '動漫', '音樂', '舞蹈', '科技', 
  '生活', '美食', '搞笑', '知識', '熱門'
];

// 自動更新：搜索多個熱門關鍵詞並合併結果
async function handleUpdate(headers) {
  try {
    console.log('開始自動更新...');
    
    // 隨機選擇 3 個熱門關鍵詞
    const selectedKeywords = HOT_KEYWORDS
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    console.log('搜索關鍵詞:', selectedKeywords);
    
    // 並行搜索
    const searchPromises = selectedKeywords.map(keyword => 
      searchKeyword(keyword)
    );
    
    const results = await Promise.all(searchPromises);
    
    // 合併並去重
    const allVideos = [];
    const seenBvids = new Set();
    
    results.forEach(videos => {
      videos.forEach(video => {
        if (!seenBvids.has(video.bvid)) {
          seenBvids.add(video.bvid);
          allVideos.push(video);
        }
      });
    });
    
    console.log(`總共獲取 ${allVideos.length} 部不重複影片`);
    
    return new Response(JSON.stringify({ 
      success: true,
      videos: allVideos,
      source: 'auto_update',
      keywords: selectedKeywords,
      count: allVideos.length,
      timestamp: new Date().toISOString()
    }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      videos: []
    }), { headers });
  }
}

// 搜索單個關鍵詞
async function handleSearch(keyword, headers) {
  try {
    const videos = await searchKeyword(keyword);
    
    return new Response(JSON.stringify({ 
      success: true,
      videos: videos,
      source: 'search',
      keyword: keyword,
      count: videos.length
    }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      keyword: keyword,
      videos: []
    }), { headers });
  }
}

// 搜索關鍵詞並解析結果
async function searchKeyword(keyword) {
  // 使用移動端搜索 API（相對寬鬆）
  const searchUrl = `https://app.bilibili.com/x/v2/search?type=video&keyword=${encodeURIComponent(keyword)}&ps=20`;
  
  try {
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code !== 0 || !data.data || !data.data.items) {
      throw new Error(data.message || 'Search failed');
    }
    
    // 解析搜索結果
    return data.data.items
      .filter(item => item.go_to === 'video' && item.param)
      .map(item => ({
        bvid: item.param,
        title: item.title || '',
        cover: item.cover || '',
        views: item.play || 0,
        danmu: item.danmaku || 0,
        duration: item.duration || 0,
        owner: item.author || '',
        tag: item.category || keyword
      }));
  } catch (error) {
    console.error(`搜索 "${keyword}" 失敗:`, error.message);
    return [];
  }
}