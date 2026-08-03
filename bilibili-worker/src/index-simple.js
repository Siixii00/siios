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
        return handleQRLogin(request, env, corsHeaders);
      }
      
      if (path === '/api/bilibili/auth/poll') {
        return handlePollLogin(request, env, corsHeaders);
      }
      
      if (path === '/api/bilibili/auth/status') {
        return handleLoginStatus(request, env, corsHeaders);
      }
      
      if (path === '/api/bilibili/recommend') {
        return handleRecommend(request, env, corsHeaders);
      }
      
      if (path === '/api/bilibili/hot') {
        return handleHot(request, env, corsHeaders);
      }
      
      return new Response(JSON.stringify({ 
        message: 'Bilibili API Worker',
        endpoints: ['/api/bilibili/auth/login', '/api/bilibili/auth/poll', '/api/bilibili/recommend', '/api/bilibili/hot']
      }), { headers: corsHeaders });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

const BILIBILI_API = 'https://api.bilibili.com';
const PASSPORT_API = 'https://passport.bilibili.com';
const USER_ID = 'default_user';

async function handleQRLogin(request, env, corsHeaders) {
  const response = await fetch(`${PASSPORT_API}/x/passport-login/web/qrcode/generate`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com'
    }
  });
  
  const data = await response.json();
  
  if (data.code !== 0) {
    return new Response(JSON.stringify({ error: data.message }), {
      status: 400,
      headers: corsHeaders
    });
  }
  
  return new Response(JSON.stringify({
    url: data.data.url,
    qrcode_key: data.data.qrcode_key
  }), { headers: corsHeaders });
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

  const response = await fetch(`${PASSPORT_API}/x/passport-login/web/qrcode/poll?qrcode_key=${qrcodeKey}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com'
    }
  });
  
  const data = await response.json();
  
  if (data.code === 0 && data.data.code === 0) {
    let cookies = {};
    
    const urlMatch = data.data.url?.match(/SESSDATA=([^&]+)/);
    if (urlMatch) cookies.SESSDATA = decodeURIComponent(urlMatch[1]);
    
    const biliJctMatch = data.data.url?.match(/bili_jct=([^&]+)/);
    if (biliJctMatch) cookies.bili_jct = decodeURIComponent(biliJctMatch[1]);
    
    const dedeMatch = data.data.url?.match(/DedeUserID=([^&]+)/);
    if (dedeMatch) cookies.DedeUserID = decodeURIComponent(dedeMatch[1]);
    
    await env.BILIBILI_KV.put(USER_ID, JSON.stringify({
      cookies,
      user: { mid: data.data.mid },
      updatedAt: Date.now()
    }));
    
    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  }
  
  return new Response(JSON.stringify({
    success: false,
    code: data.data?.code,
    message: data.data?.message || 'Waiting'
  }), { headers: corsHeaders });
}

async function handleLoginStatus(request, env, corsHeaders) {
  const stored = await env.BILIBILI_KV.get(USER_ID);
  
  if (!stored) {
    return new Response(JSON.stringify({ isLoggedIn: false }), { headers: corsHeaders });
  }
  
  const data = JSON.parse(stored);
  return new Response(JSON.stringify({ isLoggedIn: true, user: data.user }), { headers: corsHeaders });
}

async function handleRecommend(request, env, corsHeaders) {
  const url = new URL(request.url);
  const ps = url.searchParams.get('ps') || '20';
  
  const stored = await env.BILIBILI_KV.get(USER_ID);
  
  let headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Origin': 'https://www.bilibili.com'
  };
  
  if (stored) {
    const userData = JSON.parse(stored);
    if (userData.cookies && Object.keys(userData.cookies).length > 0) {
      const cookieStr = Object.entries(userData.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
      headers['Cookie'] = cookieStr;
    }
  }
  
  try {
    const response = await fetch(`${BILIBILI_API}/x/web-interface/index/top/rcmd?ps=${ps}`, {
      headers: headers
    });
    
    const data = await response.json();
    
    if (data.code !== 0) {
      return new Response(JSON.stringify({ videos: [], fallback: true, error: data.message }), { headers: corsHeaders });
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
    
    return new Response(JSON.stringify({ videos }), { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ 
      videos: [], 
      fallback: true, 
      error: error.message 
    }), { headers: corsHeaders });
  }
}

async function handleHot(request, env, corsHeaders) {
  const url = new URL(request.url);
  const ps = url.searchParams.get('ps') || '20';
  
  const response = await fetch(`${BILIBILI_API}/x/web-interface/popular?ps=${ps}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.bilibili.com'
    }
  });
  
  const data = await response.json();
  
  if (data.code !== 0) {
    return new Response(JSON.stringify({ videos: [], fallback: true }), { headers: corsHeaders });
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
  
  return new Response(JSON.stringify({ videos }), { headers: corsHeaders });
}