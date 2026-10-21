// 有年齡限制的商品（酒、菸、電子煙、成人用品）。未成年不會被提議，成年則可以，只是會標示「18 歲以上」。
// 純函式；只看商品名稱和搜尋關鍵字，用常見詞比對（不是完整名單）。
const RESTRICTED = [
    /啤酒|紅酒|白酒|葡萄酒|威士忌|伏特加|琴酒|龍舌蘭|清酒|燒酒|燒[酎]|米酒|高粱|紹興|調酒|雞尾酒|香檳|氣泡酒|梅酒|水果酒|烈酒|精釀|酒類|酒禮盒|洋酒|養樂多酒|whisk(?:e)?y|vodka|\bgin\b|\brum\b|tequila|\bsake\b|\bbeer\b|\bwine\b|champagne|cocktail|liquor|bourbon|cognac/i,
    /香菸|香烟|捲菸|卷烟|雪茄|菸草|烟草|菸斗|電子菸|电子烟|加熱菸|加热烟|煙彈|烟弹|尼古丁|cigar|cigarette|\bvape\b|\be-?cig|nicotine|tobacco/i,
    /成人用品|情趣|成人玩具|性愛|性爱|保險套|安全套|潤滑液|按摩棒|跳蛋|18禁|\br-?18\b|adult toy|sex toy|condom|lubricant/i
];
// 酒杯、酒精、料理酒之類不是酒類商品本身，不擋
const SAFE_CONTEXT = /酒杯|酒瓶|酒架|開瓶器|酒櫃|酒精|酒窩|料理酒|酒釀|酒粕|酒香|酒盒擺飾|wine glass|bottle opener|rubbing alcohol/i;

export function isAgeRestricted(...texts) {
    const t = texts.filter(Boolean).join(' ');
    if (!t) return false;
    // 先把安全用語拿掉再比對，避免「酒杯」被當成酒
    const stripped = t.replace(new RegExp(SAFE_CONTEXT.source, 'gi'), ' ');
    return RESTRICTED.some(re => re.test(stripped));
}

export const ideaIsRestricted = i => isAgeRestricted(i?.name, i?.queries?.zh, i?.queries?.cn, i?.queries?.ja, i?.queries?.en);

export const AGE_RULE_MINOR = '- 用戶未成年：絕對不要挑有年齡限制的商品（酒類、菸品、電子煙、成人用品等），挑適合未成年的。';
export const AGE_RULE_ADULT = '- 用戶已成年：如果對話或你們的關係裡自然有這類話題（例如對方愛喝酒、收藏酒），可以挑酒類等有年齡限制的商品，但不要勉強；不確定就挑別的。';
export const AGE_NOTE = '18 歲以上限定，請確認自己符合購買年齡';
