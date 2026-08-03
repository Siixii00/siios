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
      if (path === '/api/bilibili/auth/login') {
        const response = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.bilibili.com'
          }
        });
        const data = await response.json();
        return new Response(JSON.stringify({
          url: data.data.url,
          qrcode_key: data.data.qrcode_key
        }), { headers });
      }
      
      if (path === '/api/bilibili/auth/poll') {
        const qrcodeKey = url.searchParams.get('qrcode_key');
        const response = await fetch(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcodeKey}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.bilibili.com'
          }
        });
        const data = await response.json();
        
        if (data.code === 0 && data.data.code === 0) {
          let cookies = {};
          const urlParams = new URLSearchParams(data.data.url.split('?')[1]);
          
          if (urlParams.get('SESSDATA')) cookies.SESSDATA = urlParams.get('SESSDATA');
          if (urlParams.get('bili_jct')) cookies.bili_jct = urlParams.get('bili_jct');
          
          if (env && env.BILIBILI_KV) {
            await env.BILIBILI_KV.put('user', JSON.stringify({
              cookies,
              user: { mid: data.data.mid }
            }));
          }
          
          return new Response(JSON.stringify({ success: true }), { headers });
        }
        
        return new Response(JSON.stringify({
          success: false,
          code: data.data?.code || 0,
          message: data.data?.message || ''
        }), { headers });
      }
      
      if (path === '/api/bilibili/recommend') {
        let cookieHeader = '';
        
        if (env && env.BILIBILI_KV) {
          const stored = await env.BILIBILI_KV.get('user');
          if (stored) {
            const userData = JSON.parse(stored);
            if (userData.cookies) {
              cookieHeader = Object.entries(userData.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
            }
          }
        }
        
        const headers2 = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.bilibili.com'
        };
        
        if (cookieHeader) {
          headers2['Cookie'] = cookieHeader;
        }
        
        const response = await fetch(`https://api.bilibili.com/x/web-interface/index/top/rcmd?ps=20`, {
          headers: headers2
        });
        const data = await response.json();
        
        if (data.code !== 0) {
          return new Response(JSON.stringify({ videos: [], error: data.message }), { headers });
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
        
        return new Response(JSON.stringify({ videos }), { headers });
      }
      
      if (path === '/api/bilibili/hot') {
        const response = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=20', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.bilibili.com'
          }
        });
        const data = await response.json();
        
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
        
        return new Response(JSON.stringify({ videos }), { headers });
      }
      
      return new Response(JSON.stringify({ message: 'ok' }), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers 
      });
    }
  }
};