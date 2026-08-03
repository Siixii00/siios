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
        // 生成一個臨時的 OAuth URL
        const state = Math.random().toString(36).substring(7);
        const callbackUrl = encodeURIComponent('https://siixii00.github.io/siios/#/bilibili/callback');
        const authUrl = `https://passport.bilibili.com/oauth2/authorize?response_type=code&client_id=&redirect_uri=${callbackUrl}&state=${state}`;
        
        // 由於 Bilibili 沒有公開 OAuth，我們使用 QR Code
        const response = await fetch('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://www.bilibili.com/',
            'Origin': 'https://www.bilibili.com',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Ch-Ua-Platform': '"Android"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site'
          }
        });
        
        const data = await response.json();
        
        if (data.code !== 0) {
          // 如果還是被 ban，返回手動輸入的指示
          return new Response(JSON.stringify({
            error: 'qrcode_banned',
            message: 'Bilibili 限制了自動登入，請使用手動輸入方式',
            instructions: [
              '1. 在電腦瀏覽器打開 bilibili.com 並登入',
              '2. 按 F12 打開開發者工具',
              '3. 刉換到 Console 標籤',
              '4. 輸入：document.cookie',
              '5. 複製輸出的完整字串'
            ]
          }), { headers });
        }
        
        return new Response(JSON.stringify({
          url: data.data.url,
          qrcode_key: data.data.qrcode_key
        }), { headers });
      }
      
      if (path === '/api/bilibili/auth/poll') {
        const qrcodeKey = url.searchParams.get('qrcode_key');
        
        const response = await fetch(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcodeKey}`, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Referer': 'https://www.bilibili.com/',
            'Accept': 'application/json, text/plain, */*'
          }
        });
        
        const data = await response.json();
        
        if (data.code === 0 && data.data && data.data.code === 0) {
          // 成功登入，提取 Cookie
          const cookies = {};
          
          if (data.data.url) {
            const urlParams = new URLSearchParams(data.data.url.split('?')[1] || '');
            
            // 提取重要 Cookie
            const sessdata = urlParams.get('SESSDATA');
            const biliJct = urlParams.get('bili_jct');
            const dedeUserID = urlParams.get('DedeUserID');
            
            if (sessdata) cookies.SESSDATA = decodeURIComponent(sessdata);
            if (biliJct) cookies.bili_jct = biliJct;
            if (dedeUserID) cookies.DedeUserID = dedeUserID;
            
            // 構建完整 Cookie 字串
            const cookieString = Object.entries(cookies)
              .map(([k, v]) => `${k}=${v}`)
              .join('; ');
            
            return new Response(JSON.stringify({
              success: true,
              cookie: cookieString,
              cookies: cookies,
              user: { mid: data.data.mid }
            }), { headers });
          }
        }
        
        return new Response(JSON.stringify({
          success: false,
          code: data.data?.code || 0,
          message: data.data?.message || 'Waiting'
        }), { headers });
      }
      
      // 新增：直接使用 Cookie 獲取推薦
      if (path === '/api/bilibili/recommend') {
        const cookieHeader = request.headers.get('X-Bilibili-Cookie') || '';
        
        const response = await fetch('https://api.bilibili.com/x/web-interface/index/top/rcmd?ps=20', {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Referer': 'https://www.bilibili.com/',
            'Cookie': cookieHeader,
            'Accept': 'application/json, text/plain, */*'
          }
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
      
      return new Response(JSON.stringify({ message: 'ok' }), { headers });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers 
      });
    }
  }
};