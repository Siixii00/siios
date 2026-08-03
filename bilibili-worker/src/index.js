export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
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
      
      if (path === '/api/bilibili/video/info') {
        return handleVideoInfo(request, corsHeaders);
      }
      
      if (path === '/api/bilibili/video/playurl') {
        return handlePlayUrl(request, env, corsHeaders);
      }
      
      if (path === '/api/bilibili/recommend') {
        return handleRecommend(request, corsHeaders);
      }
      
      if (path === '/api/bilibili/hot') {
        return handleHot(request, corsHeaders);
      }
      
      if (path === '/api/bilibili/popular') {
        return handlePopular(request, corsHeaders);
      }
      
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders
      });
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

  const githubUser = await verifyGitHubToken(request, env);
  if (!githubUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
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
    
    // Try to extract from URL
    const urlMatch = data.data.url?.match(/SESSDATA=([^&]+)/);
    if (urlMatch) cookies.SESSDATA = decodeURIComponent(urlMatch[1]);
    
    // Store in KV
    await env.BILIBILI_KV.put(githubUser.id, JSON.stringify({
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
  const githubUser = await verifyGitHubToken(request, env);
  if (!githubUser) {
    return new Response(JSON.stringify({ isLoggedIn: false }), { headers: corsHeaders });
  }

  const stored = await env.BILIBILI_KV.get(githubUser.id);
  
  if (!stored) {
    return new Response(JSON.stringify({ isLoggedIn: false }), { headers: corsHeaders });
  }
  
  const data = JSON.parse(stored);
  return new Response(JSON.stringify({ isLoggedIn: true, user: data.user }), { headers: corsHeaders });
}

async function handleVideoInfo(request, corsHeaders) {
  const url = new URL(request.url);
  const bvid = url.searchParams.get('bvid');
  
  if (!bvid) {
    return new Response(JSON.stringify({ error: 'bvid required' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const response = await fetch(`${BILIBILI_API}/x/web-interface/view?bvid=${bvid}`, {
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
    title: data.data.title,
    cover: data.data.pic,
    duration: data.data.duration,
    cid: data.data.cid,
    pages: data.data.pages
  }), { headers: corsHeaders });
}

async function handlePlayUrl(request, env, corsHeaders) {
  const url = new URL(request.url);
  const bvid = url.searchParams.get('bvid');
  const cid = url.searchParams.get('cid');
  
  if (!bvid || !cid) {
    return new Response(JSON.stringify({ error: 'bvid and cid required' }), {
      status: 400,
      headers: corsHeaders
    });
  }

  const githubUser = await verifyGitHubToken(request, env);
  if (!githubUser) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  const stored = await env.BILIBILI_KV.get(githubUser.id);
  if (!stored) {
    return new Response(JSON.stringify({ error: 'Not logged in' }), {
      status: 401,
      headers: corsHeaders
    });
  }

  const userData = JSON.parse(stored);
  const cookieStr = Object.entries(userData.cookies).map(([k, v]) => `${k}=${v}`).join('; ');

  const response = await fetch(
    `${BILIBILI_API}/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64&fnver=0&fnval=16&fourk=1`,
    {
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.bilibili.com'
      }
    }
  );
  
  const data = await response.json();
  
  if (data.code !== 0) {
    return new Response(JSON.stringify({ error: data.message }), {
      status: 400,
      headers: corsHeaders
    });
  }
  
  return new Response(JSON.stringify({
    quality: data.data.quality,
    dash: data.data.dash
  }), { headers: corsHeaders });
}

async function handleRecommend(request, corsHeaders) {
  const url = new URL(request.url);
  const ps = url.searchParams.get('ps') || '20';
  
  const response = await fetch(`${BILIBILI_API}/x/web-interface/index/top/rcmd?ps=${ps}`, {
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
}

async function handleHot(request, corsHeaders) {
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
    return new Response(JSON.stringify({ error: data.message }), {
      status: 400,
      headers: corsHeaders
    });
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

async function handlePopular(request, corsHeaders) {
  const url = new URL(request.url);
  const ps = url.searchParams.get('ps') || '20';
  
  const response = await fetch(`${BILIBILI_API}/x/web-interface/ranking/v2?type=all`, {
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
  
  const videos = data.data.list.map(item => ({
    bvid: item.bvid,
    title: item.title,
    cover: item.pic,
    views: item.stat?.view,
    danmu: item.stat?.danmaku,
    duration: item.duration,
    owner: item.owner?.name,
    tag: item.tname || '排行榜'
  }));
  
  return new Response(JSON.stringify({ videos }), { headers: corsHeaders });
}

async function verifyGitHubToken(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  
  const token = auth.slice(7);
  
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `token ${token}` }
    });
    
    if (!response.ok) return null;
    
    const user = await response.json();
    return { id: user.id.toString(), login: user.login };
  } catch {
    return null;
  }
}