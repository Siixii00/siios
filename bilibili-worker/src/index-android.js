// Bilibili API Worker
// 使用 Android App Key 和正確的簽名算法

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
      if (path === '/api/bilibili/hot') {
        return await handleHot(headers);
      }
      
      if (path === '/api/bilibili/search') {
        const keyword = url.searchParams.get('keyword');
        return await handleSearch(keyword, headers);
      }
      
      if (path === '/api/bilibili/recommend') {
        return await handleRecommend(headers);
      }
      
      return new Response(JSON.stringify({ 
        message: 'Bilibili API Worker (Android Mode)',
        status: 'ready'
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

// App Key 和 Salt（從 Bilibili Android APP 逆向工程獲得）
const APP_KEY = 'bca7e84c2d947ac6';
const APP_SALT = '60698ba2f68e01ce44738920a0ffe768';

// 模擬 Android APP 的 User-Agent
const ANDROID_UA = 'Mozilla/5.0 BiliDroid/6.4.0 (bbcallen@gmail.com) os/android model/M1903F11I mobi_app/android build/6040500 channel/bili innerVer/6040500 osVer/9.0.0 network/2';

// 計算簽名（MD5）
async function calcSign(param) {
  const data = param + APP_SALT;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('MD5', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 生成帶簽名的參數
async function buildSignedParams(params) {
  const sortedParams = Object.keys(params).sort().map(key => 
    `${key}=${encodeURIComponent(params[key])}`
  ).join('&');
  
  const sign = await calcSign(sortedParams);
  return `${sortedParams}&sign=${sign}`;
}

// 獲取熱門視頻
async function handleHot(headers) {
  try {
    const response = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=20', {
      method: 'GET',
      headers: {
        'User-Agent': ANDROID_UA,
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

// 搜索視頻
async function handleSearch(keyword, headers) {
  if (!keyword) {
    return new Response(JSON.stringify({ 
      error: 'keyword required',
      videos: []
    }), { headers });
  }
  
  try {
    const ts = Math.floor(Date.now() / 1000);
    const params = {
      appkey: APP_KEY,
      build: '6040500',
      channel: 'bili',
      device: 'phone',
      keyword: keyword,
      mobi_app: 'android',
      platform: 'android',
      pn: '1',
      ps: '20',
      ts: ts,
      type: 'video'
    };
    
    const signedQuery = await buildSignedParams(params);
    const url = `https://app.bilibili.com/x/v2/search?${signedQuery}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': ANDROID_UA,
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.code === 0 && data.data && data.data.items) {
      const videos = data.data.items
        .filter(item => item.go_to === 'video')
        .map(item => ({
          bvid: item.param,
          title: item.title,
          cover: item.cover,
          views: item.play || 0,
          danmu: item.danmaku || 0,
          duration: item.duration || 0,
          owner: item.author || '',
          tag: item.category || '搜索結果'
        }));
      
      return new Response(JSON.stringify({ 
        success: true,
        videos: videos,
        source: 'search_android',
        keyword: keyword,
        count: videos.length
      }), { headers });
    }
    
    throw new Error(`Search API error: ${data.message || data.code}`);
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      keyword: keyword,
      videos: []
    }), { headers });
  }
}

// 獲取推薦視頻
async function handleRecommend(headers) {
  try {
    const ts = Math.floor(Date.now() / 1000);
    const params = {
      appkey: APP_KEY,
      build: '6040500',
      channel: 'bili',
      device: 'phone',
      mobi_app: 'android',
      platform: 'android',
      ps: '20',
      ts: ts
    };
    
    const signedQuery = await buildSignedParams(params);
    const url = `https://app.bilibili.com/x/v2/feed/index?${signedQuery}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': ANDROID_UA,
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.code === 0 && data.data && data.data.items) {
      const videos = data.data.items
        .filter(item => item.card_type === 'small_cover_v2' || item.card_type === 'small_cover')
        .map(item => {
          const v = item.cover || {};
          return {
            bvid: v.bvid || '',
            title: v.title || '',
            cover: v.pic || '',
            views: v.stat?.view || 0,
            danmu: v.stat?.danmaku || 0,
            duration: v.duration || 0,
            owner: v.owner?.name || '',
            tag: v.tname || '推薦'
          };
        })
        .filter(v => v.bvid);
      
      return new Response(JSON.stringify({ 
        success: true,
        videos: videos,
        source: 'recommend_android',
        count: videos.length
      }), { headers });
    }
    
    throw new Error(`Recommend API error: ${data.message || data.code}`);
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      videos: []
    }), { headers });
  }
}