// 測試 Worker：直接返回 Bilibili 數據
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // 測試：直接調用熱門 API
      const response = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=5', {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.bilibili.com/'
        }
      });
      
      const text = await response.text();
      
      // 返回原始數據
      return new Response(text, {
        status: response.status,
        headers
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error.message 
      }), { 
        status: 500,
        headers 
      });
    }
  }
};