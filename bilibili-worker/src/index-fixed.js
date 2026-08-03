export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === '/api/bilibili/auth/login') {
        return await handleQRLogin(corsHeaders);
      }
      
      if (path === '/api/bilibili/auth/poll') {
        return await handlePollLogin(request, env, corsHeaders);
      }
      
      if (path === '/api/bilibili/recommend') {
        return await handleRecommend(request, env, corsHeaders);
      }
      
      if (path === '/api/bilibili/hot') {
        return await handleHot(corsHeaders);
      }
      
      return new Response(JSON.stringify({ 
        message: 'Bilibili API Worker',
        status: 'ok',
        endpoints: [
          '/api/bilibili/auth/login',
          '/api/bilibili/auth/poll',
          '/api/bilibili/recommend',
          '/api/bilibili/hot'
        ]
      }), { headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

const BILIBILI_API = 'https://api.bilibili.com';
const PASSPORT_API = 'https://passport.bilibili.com';
const USER_ID = 'default_user';

async function handleQRLogin(corsHeaders) {
  try {
    const response = await fetch(`${PASSPORT_API}/x/passport-login/web/qrcode/generate`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    
    const data = await response.json();
    
    if (data.code !== 0) {
      return new Response(JSON.stringify({ 
        error: 'Bilibili API error',
        code: data.code,
        message: data.message 
      }), {
        status: 400,
        headers: corsHeaders
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      url: data.data.url,
      qrcode_key: data.data.qrcode_key
    }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to generate QR code',
      message: error.message 
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

async function handlePollLogin(request, env, corsHeaders) {
  const url = new URL(request.url);
  const qrcodeKey = url.searchParams.get('qrcode_key');
  
  if (!qrcodeKey) {
    return new Response(JSON.stringify({ error: 'qrcode_key required' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  try {
    const response = await fetch(`${PASSPORT_API}/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcodeKey)}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/'
      }
    });
    
    const data = await response.json();
    
    if (data.code === 0 && data.data.code === 0) {
      let cookies = {};
      
      // Extract cookies from URL
      const urlParams = new URLSearchParams(data.data.url?.split('?')[1] || '');
      
      const sessdata = urlParams.get('SESSDATA');
      if (sessdata) cookies.SESSDATA = sessdata;
      
      const biliJct = urlParams.get('bili_jct');
      if (biliJct) cookies.bili_jct = biliJct;
      
      const dedeUserID = urlParams.get('DedeUserID');
      if (dedeUserID) cookies.DedeUserID = dedeUserID;
      
      // Store cookies in KV if available
      if (env && env.BILIBILI_KV) {
        await env.BILIBILI_KV.put(USER_ID, JSON.stringify({
          cookies,
          user: { mid: data.data.mid },
          updatedAt: Date.now()
        }));
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        user: { mid: data.data.mid }
      }), { headers: corsHeaders });
    }
    
    return new Response(JSON.stringify({
      success: false,
      code: data.data?.code,
      message: data.data?.message || 'Waiting'
    }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Poll failed',
      message: error.message 
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

async function handleRecommend(request, env, corsHeaders) {
  const url = new URL(request.url);
  const ps = url.searchParams.get('ps') || '20';
  
  try {
    let headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.bilibili.com/',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
      'Origin': 'https://www.bilibili.com'
    };
    
    // Add cookies if available
    if (env && env.BILIBILI_KV) {
      const stored = await env.BILIBILI_KV.get(USER_ID);
      if (stored) {
        const userData = JSON.parse(stored);
        if (userData.cookies && Object.keys(userData.cookies).length > 0) {
          const cookieStr = Object.entries(userData.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
          headers['Cookie'] = cookieStr;
        }
      }
    }
    
    const response = await fetch(`${BILIBILI_API}/x/web-interface/index/top/rcmd?ps=${ps}`, {
      method: 'GET',
      headers: headers
    });
    
    const data = await response.json();
    
    if (data.code !== 0) {
      return new Response(JSON.stringify({ 
        videos: [], 
        fallback: true, 
        error: data.message,
        code: data.code
      }), { headers: corsHeaders });
    }
    
    const videos = data.data.item.map(item => ({
      bvid: item.bvid,
      title: item.title,
      cover: item.pic,
      views: item.stat?.view,
      danmu: item.stat?.danmaku,
      duration: item.duration,
      owner: item.owner?.name,
      tag: item.tname || '推荐'
    }));
    
    return new Response(JSON.stringify({ 
      success: true,
      videos: videos,
      count: videos.length
    }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ 
      videos: [], 
      fallback: true, 
      error: error.message 
    }), { headers: corsHeaders });
  }
}

async function handleHot(corsHeaders) {
  try {
    const response = await fetch(`${BILIBILI_API}/x/web-interface/popular?ps=20`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com/'
      }
    });
    
    const data = await response.json();
    
    if (data.code !== 0) {
      return new Response(JSON.stringify({ 
        videos: [], 
        fallback: true 
      }), { headers: corsHeaders });
    }
    
    const videos = data.data.list.map(item => ({
      bvid: item.bvid,
      title: item.title,
      cover: item.pic,
      views: item.stat?.view,
      danmu: item.stat?.danmaku,
      duration: item.duration,
      owner: item.owner?.name,
      tag: item.tname || '热门'
    }));
    
    return new Response(JSON.stringify({ 
      success: true,
      videos: videos,
      count: videos.length
    }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ 
      videos: [], 
      fallback: true, 
      error: error.message 
    }), { headers: corsHeaders });
  }
}