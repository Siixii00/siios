// 現實世界的購物平台：把「商品關鍵字」變成各平台的搜尋連結（只連到外部網站，不爬取、不代購、不代付款）。
// 純函式，不碰瀏覽器，方便測試。連結只帶商品關鍵字，不帶任何個人資料；只能產生這份名單裡的網域。

// lang：這個平台搜尋用哪種語言的關鍵字（zh 繁中、cn 簡中、ja 日文、en 英文）
// kinds：特別適合的商品類型（挑禮物時優先顯示）
export const SHOPS = [
    { id: 'shopee', name: '蝦皮', lang: 'zh', host: 'shopee.tw', kinds: ['daily', 'beauty', 'fashion', 'tech', 'food', 'collectible'], url: q => `https://shopee.tw/search?keyword=${q}` },
    { id: 'momo', name: 'momo', lang: 'zh', host: 'www.momoshop.com.tw', kinds: ['daily', 'beauty', 'tech', 'fashion', 'food'], url: q => `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${q}&searchType=1` },
    { id: 'pchome', name: 'PChome', lang: 'zh', host: '24h.pchome.com.tw', kinds: ['tech', 'daily', 'food'], url: q => `https://24h.pchome.com.tw/search/?q=${q}` },
    { id: 'books', name: '博客來', lang: 'zh', host: 'search.books.com.tw', kinds: ['book'], url: q => `https://search.books.com.tw/search/query/key/${q}/cat/all` },
    { id: 'pinkoi', name: 'Pinkoi', lang: 'zh', host: 'www.pinkoi.com', kinds: ['handmade', 'design', 'accessory', 'decor'], url: q => `https://www.pinkoi.com/search?q=${q}` },
    { id: 'amazon', name: 'Amazon', lang: 'en', host: 'www.amazon.com', kinds: ['tech', 'book', 'collectible', 'beauty'], url: q => `https://www.amazon.com/s?k=${q}` },
    { id: 'taobao', name: '淘寶', lang: 'cn', host: 's.taobao.com', kinds: ['daily', 'fashion', 'handmade', 'collectible', 'decor'], url: q => `https://s.taobao.com/search?q=${q}` },
    { id: 'pdd', name: '拼多多', lang: 'cn', host: 'mobile.yangkeduo.com', kinds: ['daily', 'food', 'tech'], url: q => `https://mobile.yangkeduo.com/search_result.html?search_key=${q}` },
    { id: 'xianyu', name: '閒魚', lang: 'cn', host: 'www.goofish.com', kinds: ['secondhand', 'collectible', 'tech'], url: q => `https://www.goofish.com/search?q=${q}` },
    { id: 'mercari', name: '煤爐', lang: 'ja', host: 'jp.mercari.com', kinds: ['secondhand', 'collectible', 'anime'], url: q => `https://jp.mercari.com/search?keyword=${q}` }
];

export const SHOP_IDS = SHOPS.map(s => s.id);
export const shopById = id => SHOPS.find(s => s.id === id) || null;

// 商品類型（AI 回傳的 kind 要落在這裡面，否則視為 daily）
export const KINDS = [
    { id: 'daily', name: '生活用品' }, { id: 'food', name: '食物飲料' }, { id: 'book', name: '書' }, { id: 'handmade', name: '手作' },
    { id: 'design', name: '設計小物' }, { id: 'accessory', name: '飾品配件' }, { id: 'decor', name: '居家佈置' }, { id: 'tech', name: '3C 電子' },
    { id: 'beauty', name: '美妝保養' }, { id: 'fashion', name: '服飾' }, { id: 'collectible', name: '收藏周邊' }, { id: 'secondhand', name: '二手稀有' }, { id: 'anime', name: '動漫' }
];
export const KIND_IDS = KINDS.map(k => k.id);
export const normalizeKind = k => (KIND_IDS.includes(k) ? k : 'daily');

// 預設全部開啟，順序就是顯示順序
export const DEFAULT_SHOP_PREFS = { enabled: [...SHOP_IDS] };

export function resolvePrefs(saved) {
    const ids = Array.isArray(saved?.enabled) ? saved.enabled.filter(id => SHOP_IDS.includes(id)) : null;
    const known = [...new Set(ids || [])];
    // 之後新增的平台，對存過設定的使用者預設不強制開啟（尊重他的選擇），所以只有「完全沒存過」才全開
    return { enabled: ids ? known : [...SHOP_IDS] };
}

const clean = s => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

// idea.queries：{ zh, cn, ja, en }；依平台語言挑關鍵字，缺的往別的語言補
export function queryFor(idea, shop) {
    const q = idea?.queries || {};
    const order = { zh: ['zh', 'cn', 'en', 'ja'], cn: ['cn', 'zh', 'en', 'ja'], ja: ['ja', 'en', 'zh', 'cn'], en: ['en', 'zh', 'cn', 'ja'] }[shop.lang] || ['zh'];
    for (const k of order) if (clean(q[k])) return clean(q[k]);
    return clean(idea?.name);
}

// 這個連結是不是「名單裡的平台」的網址（開啟前再檢查一次，避免被竄改的資料帶到別的網站）
export function isShopUrl(url) {
    try {
        const u = new URL(url);
        return u.protocol === 'https:' && SHOPS.some(s => u.hostname === s.host);
    } catch (_) { return false; }
}

// 產生某個商品點子在各平台的搜尋連結。kind 相符的平台排前面，其餘保持使用者設定的順序
export function shopLinks(idea, prefs = DEFAULT_SHOP_PREFS) {
    const enabled = resolvePrefs(prefs).enabled.map(shopById).filter(Boolean);
    const kind = normalizeKind(idea?.kind);
    const fit = enabled.filter(s => s.kinds.includes(kind)), rest = enabled.filter(s => !s.kinds.includes(kind));
    return [...fit, ...rest].map(shop => {
        const q = queryFor(idea, shop);
        return { id: shop.id, name: shop.name, query: q, url: shop.url(encodeURIComponent(q)), fit: fit.includes(shop) };
    }).filter(l => l.query && isShopUrl(l.url));
}
