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
        return await handleQRLogin(request, env, corsHeaders);
      }
      
      if (path === '/api/bilibili/auth/poll') {
        return await handlePollLogin(request, env, corsHeaders);
      }
      
      if (path === '/api/bilibili/auth/status') {
        return await handleLoginStatus(request, env, corsHeaders);
      }
      
      if (path === '/api/bilibili/video/info') {
        return await handleVideoInfo(request, corsHeaders);
      }
      
      if (path === '/api/bilibili/video/playurl') {
        return await handlePlayUrl(request, env, corsHeaders);
      }
      
      if (path === '/api/bilibili/recommend') {
        return await handleRecommend(request, corsHeaders);
      }
      
      if (path === '/api/bilibili/hot') {
        return await handleHot(request, corsHeaders);
      }
      
      if (path === '/api/bilibili/popular') {
        return await handlePopular(request, corsHeaders);
      }
      
      if (path === '/api/bilibili/video/subtitle') {
        return await handleSubtitle(request, env, corsHeaders);
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
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Bilibili 的風控要求請求帶有 buvid3/buvid4；先向 finger/spi 要一組，在這個 isolate 存活期間重複使用
let buvidCookie = null;
let buvidFetchedAt = 0;
async function getBuvid() {
  if (buvidCookie && Date.now() - buvidFetchedAt < 6 * 3600 * 1000) return buvidCookie;
  try {
    const res = await fetch(BILIBILI_API + '/x/frontend/finger/spi', { headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com' } });
    const data = await res.json();
    if (data.code === 0 && data.data?.b_3) {
      buvidCookie = 'buvid3=' + data.data.b_3 + '; buvid4=' + (data.data.b_4 || '');
      buvidFetchedAt = Date.now();
    }
  } catch { /* 拿不到就不帶，之後的請求會自己回報錯誤 */ }
  return buvidCookie || '';
}

// 回傳 { code, message, data }；網路或格式錯誤時 code 為 -1，不會丟例外
async function biliJson(url, cookie = '') {
  const buvid = await getBuvid();
  const cookies = [buvid, cookie].filter(Boolean).join('; ');
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA, 'Referer': 'https://www.bilibili.com', 'Origin': 'https://www.bilibili.com', ...(cookies ? { Cookie: cookies } : {}) } });
  } catch (e) {
    return { code: -1, message: '連不到 Bilibili：' + e.message };
  }
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { code: -1, message: 'Bilibili 沒有回傳 JSON（HTTP ' + res.status + '，可能被風控擋下）' };
  }
}
const PASSPORT_API = 'https://passport.bilibili.com';

async function handleQRLogin(request, env, corsHeaders) {
  const data = await biliJson(`${PASSPORT_API}/x/passport-login/web/qrcode/generate`);
  
  if (data.code !== 0) {
    // Bilibili 會擋 Cloudflare 的連線（HTTP 412）。前端看到 qrcode_banned 會改顯示「手動輸入 Cookie」。
    return new Response(JSON.stringify({
      error: 'qrcode_banned',
      message: data.message,
      instructions: [
        '用電腦瀏覽器打開 https://www.bilibili.com 並登入',
        '按 F12 打開開發者工具，切到 Console',
        '輸入 document.cookie 後按 Enter，複製輸出的整串文字',
        '回到這裡貼上並儲存'
      ]
    }), { headers: corsHeaders });
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

  const data = await biliJson(`${PASSPORT_API}/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(qrcodeKey)}`);
  
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

  const data = await biliJson(`${BILIBILI_API}/x/web-interface/wbi/view?bvid=${encodeURIComponent(bvid)}`);
  
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

  const data = await biliJson(`${BILIBILI_API}/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}&qn=64&fnver=0&fnval=16&fourk=1`, cookieStr);
  
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

// 字幕：前端用 data.subtitles[0].subtitle_url 直接去抓字幕檔。Bilibili 回的網址是「//」開頭，
// 在前端頁面上會被當成相對網址而失敗，所以這裡補成 https。有登入就帶上 Cookie（部分字幕需要登入）。
async function handleSubtitle(request, env, corsHeaders) {
  const url = new URL(request.url);
  const bvid = url.searchParams.get('bvid');
  const cid = url.searchParams.get('cid');

  if (!bvid || !cid) {
    return new Response(JSON.stringify({ error: 'bvid and cid required' }), { status: 400, headers: corsHeaders });
  }

  let cookie = '';
  const githubUser = await verifyGitHubToken(request, env);
  if (githubUser) {
    const stored = await env.BILIBILI_KV.get(githubUser.id);
    if (stored) {
      const { cookies } = JSON.parse(stored);
      cookie = Object.entries(cookies).map(([k, v]) => k + '=' + v).join('; ');
    }
  }

  const data = await biliJson(`${BILIBILI_API}/x/player/v2?bvid=${encodeURIComponent(bvid)}&cid=${encodeURIComponent(cid)}`, cookie);

  if (data.code !== 0) {
    return new Response(JSON.stringify({ error: data.message }), { status: 400, headers: corsHeaders });
  }

  const subtitles = (data.data?.subtitle?.subtitles || []).map(sub => ({
    lan: sub.lan,
    lan_doc: sub.lan_doc,
    subtitle_url: sub.subtitle_url?.startsWith('//') ? 'https:' + sub.subtitle_url : sub.subtitle_url
  }));

  return new Response(JSON.stringify({ subtitles }), { headers: corsHeaders });
}

async function handleRecommend(request, corsHeaders) {
  const url = new URL(request.url);
  const ps = url.searchParams.get('ps') || '20';
  
  const data = await biliJson(`${BILIBILI_API}/x/web-interface/index/top/rcmd?ps=${encodeURIComponent(ps)}`);
  
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
  
  const data = await biliJson(`${BILIBILI_API}/x/web-interface/popular?ps=${encodeURIComponent(ps)}`);
  
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
  
  const data = await biliJson(`${BILIBILI_API}/x/web-interface/ranking/v2?type=all`);
  
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