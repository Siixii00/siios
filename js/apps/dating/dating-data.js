// 約會（虛擬見面）的資料與純函式：場景、關係階段、提示詞、回覆解析、關係紀錄。
// 不依賴瀏覽器，方便測試；畫面與儲存在 index.js。

// ───── 關係階段（由好感度決定，影響角色的態度與可以做的互動）─────
export const STAGES = [
    { id: 'stranger', name: '初識', min: 0, hint: '你們還不太熟：禮貌、帶點好奇與距離感，不會有肢體接觸。' },
    { id: 'friend', name: '朋友', min: 25, hint: '你們是熟悉的朋友：輕鬆自在、會開玩笑；偶爾自然的小接觸（碰一下手臂、遞東西）可以。' },
    { id: 'close', name: '曖昧', min: 50, hint: '彼此有明顯的好感：會害羞、試探、在意對方的反應；牽手、靠近都可以，但仍然含蓄。' },
    { id: 'lover', name: '戀人', min: 75, hint: '你們是親密的戀人：自然、溫柔、願意直接表達愛意；擁抱、依偎、牽手都很自然。' }
];

export function stageFor(affection) {
    const a = Number(affection) || 0;
    return [...STAGES].reverse().find(s => a >= s.min) || STAGES[0];
}

// ───── 時段（用真實時間，場景有適合的時段）─────
export const TIME_SLOTS = [
    { id: 'morning', name: '早晨', from: 5, to: 10 },
    { id: 'noon', name: '中午', from: 10, to: 14 },
    { id: 'afternoon', name: '下午', from: 14, to: 17 },
    { id: 'evening', name: '傍晚', from: 17, to: 19 },
    { id: 'night', name: '夜晚', from: 19, to: 23 },
    { id: 'late', name: '深夜', from: 23, to: 29 } // 23:00–05:00
];

export function timeSlot(date = new Date()) {
    const h = date.getHours();
    const hh = h < 5 ? h + 24 : h;
    return TIME_SLOTS.find(s => hh >= s.from && hh < s.to) || TIME_SLOTS[0];
}

// ───── 場景 ─────
// unlock：好感度達到才能去；cost：入場／消費（虛擬錢包）；best：適合的時段；
// atmosphere：給角色的場景描寫；activities：場景專屬的活動；events：隨機小插曲
export const SCENES = [
    {
        id: 'cafe', name: '咖啡廳', icon: 'fa-coffee', desc: '溫馨的角落座位，咖啡香與輕音樂', unlock: 0, cost: 120, best: ['morning', 'noon', 'afternoon'],
        atmosphere: '一間有木質桌椅與暖黃燈光的咖啡廳，空氣裡有咖啡與烘焙的香味，背景播著輕柔的爵士樂，窗邊的座位可以看到街景。',
        activities: [
            { id: 'order', name: '點飲料', icon: 'fa-mug-hot', text: '翻開菜單，和對方討論各自要點什麼', delta: 1 },
            { id: 'dessert', name: '分享甜點', icon: 'fa-birthday-cake', text: '點了一份甜點，把叉子遞給對方一起吃', delta: 2 },
            { id: 'window', name: '看窗外', icon: 'fa-road', text: '安靜地看著窗外的行人，等對方開口聊聊近況', delta: 1 },
            { id: 'playlist', name: '聊喜歡的歌', icon: 'fa-music', text: '提起店裡正在播的歌，問對方平常都聽些什麼', delta: 1 }
        ],
        events: ['店員端來的拉花拿鐵上，意外畫了一顆愛心。', '鄰桌的小孩不小心把氣球放開，氣球飄到了你們桌邊。', '窗外突然下起了陣雨，路上的人紛紛跑著躲雨。']
    },
    {
        id: 'park', name: '公園', icon: 'fa-tree', desc: '林蔭步道、湖邊長椅與野餐草地', unlock: 0, cost: 0, best: ['morning', 'afternoon', 'evening'],
        atmosphere: '一座綠意盎然的城市公園，有林蔭步道、小湖與長椅，遠處有人在放風箏、遛狗，風吹過樹葉沙沙作響。',
        activities: [
            { id: 'walk', name: '散步', icon: 'fa-walking', text: '沿著步道並肩慢慢走，隨意聊著天', delta: 1 },
            { id: 'picnic', name: '野餐', icon: 'fa-utensils', text: '在草地上鋪開野餐墊，拿出帶來的點心', delta: 2 },
            { id: 'boat', name: '湖上划船', icon: 'fa-water', text: '提議租一艘小船在湖上划一圈', delta: 2 },
            { id: 'bench', name: '坐長椅', icon: 'fa-chair', text: '在湖邊的長椅坐下，靜靜看著水面', delta: 1 }
        ],
        events: ['一隻小狗跑過來，在你們腳邊繞了好幾圈。', '一陣風吹過，一片花瓣落在對方的肩上。', '遠處有街頭藝人開始彈起吉他。']
    },
    {
        id: 'beach', name: '海邊', icon: 'fa-umbrella-beach', desc: '海浪、沙灘與一整片天空', unlock: 20, cost: 0, best: ['afternoon', 'evening'],
        atmosphere: '一片安靜的沙灘，海浪規律地拍打岸邊，海風帶著鹹味，天空很開闊；傍晚時整片海被夕陽染成金橘色。',
        activities: [
            { id: 'shell', name: '撿貝殼', icon: 'fa-shapes', text: '彎下腰在沙灘上找漂亮的貝殼，撿到就拿給對方看', delta: 2 },
            { id: 'barefoot', name: '赤腳踩浪', icon: 'fa-shoe-prints', text: '脫下鞋子，在淺淺的浪花裡走走', delta: 2 },
            { id: 'sunset', name: '看夕陽', icon: 'fa-sun', text: '在沙灘上坐下，看太陽慢慢沉進海裡', delta: 2 },
            { id: 'write', name: '沙上寫字', icon: 'fa-pen', text: '撿起樹枝，在沙上寫下一句話，問對方猜得到嗎', delta: 2 }
        ],
        events: ['一個大浪突然打上來，把兩個人的褲腳都弄濕了。', '遠處的海面有一艘小漁船亮起了燈。', '你們發現沙灘上有一排小螃蟹的腳印。']
    },
    {
        id: 'restaurant', name: '餐廳', icon: 'fa-utensils', desc: '燭光與好吃的料理', unlock: 15, cost: 800, best: ['noon', 'evening', 'night'],
        atmosphere: '一間氣氛安靜的餐廳，桌上有小蠟燭與花，燈光偏暗，餐具輕輕碰撞，服務生動作很輕。',
        activities: [
            { id: 'order', name: '一起點餐', icon: 'fa-clipboard-list', text: '一邊看菜單，一邊問對方想吃什麼', delta: 1 },
            { id: 'share', name: '分食', icon: 'fa-drumstick-bite', text: '把自己盤子裡的一小口夾給對方嚐嚐', delta: 2 },
            { id: 'toast', name: '舉杯', icon: 'fa-glass-cheers', text: '舉起杯子，為今天的見面乾杯', delta: 2 },
            { id: 'story', name: '聊聊過去', icon: 'fa-comment-dots', text: '趁著等餐，聊起彼此小時候最難忘的一件事', delta: 2 }
        ],
        events: ['服務生送上一份你們沒點的小甜點，說是招待。', '隔壁桌的人在慶祝生日，餐廳裡響起了生日歌。', '餐廳的燈光忽然暗下來，只剩桌上的燭火。']
    },
    {
        id: 'cinema', name: '電影院', icon: 'fa-film', desc: '黑暗中的大螢幕與爆米花', unlock: 10, cost: 400, best: ['afternoon', 'evening', 'night'],
        atmosphere: '一間安靜的電影院，座位柔軟，大螢幕的光在黑暗中閃動，空氣裡有爆米花的味道。',
        activities: [
            { id: 'pick', name: '選電影', icon: 'fa-ticket-alt', text: '站在海報前，問對方想看哪一部', delta: 1 },
            { id: 'popcorn', name: '分爆米花', icon: 'fa-cookie', text: '把爆米花桶放在兩人中間，一起吃', delta: 1 },
            { id: 'whisper', name: '悄悄話', icon: 'fa-comment', text: '電影進行到一半，湊近小聲說出自己的感想', delta: 2 },
            { id: 'review', name: '散場後聊', icon: 'fa-comments', text: '走出影廳，聊聊對剛才電影的想法', delta: 2 }
        ],
        events: ['電影裡出現了很感人的一幕，你們都安靜了下來。', '爆米花桶不小心被打翻了一點。', '散場燈亮起時，你們發現彼此靠得比想像中近。']
    },
    {
        id: 'aquarium', name: '水族館', icon: 'fa-fish', desc: '藍色的光影與悠游的魚群', unlock: 20, cost: 500, best: ['morning', 'noon', 'afternoon'],
        atmosphere: '昏暗而安靜的水族館，巨大的水槽透出幽藍的光，魚群與水母緩緩游過，人聲被水聲蓋過。',
        activities: [
            { id: 'jelly', name: '看水母', icon: 'fa-water', text: '站在水母缸前，一起看它們慢慢漂浮', delta: 2 },
            { id: 'photo', name: '拍照', icon: 'fa-camera', text: '請對方站在藍色的光前，替他拍一張照', delta: 2 },
            { id: 'favorite', name: '選最喜歡的', icon: 'fa-heart', text: '各自說出最喜歡的一種生物，猜猜對方選哪個', delta: 1 },
            { id: 'tunnel', name: '海底隧道', icon: 'fa-archway', text: '一起走過頭頂都是魚的隧道', delta: 2 }
        ],
        events: ['一隻大魟魚貼著玻璃游過，好像在對你們打招呼。', '導覽廣播說五分鐘後有餵食秀。', '水母缸的燈光變成了粉紫色。']
    },
    {
        id: 'market', name: '夜市', icon: 'fa-store', desc: '熱鬧的攤位與小吃香氣', unlock: 10, cost: 300, best: ['evening', 'night'],
        atmosphere: '人聲鼎沸的夜市，攤位的燈泡一盞接一盞，空氣裡混著炸物、烤肉與甜點的香味，人潮擁擠。',
        activities: [
            { id: 'snack', name: '吃小吃', icon: 'fa-hamburger', text: '排隊買了一份招牌小吃，分給對方一半', delta: 2 },
            { id: 'game', name: '玩遊戲', icon: 'fa-bullseye', text: '在射氣球的攤位前，挑戰贏一隻娃娃給對方', delta: 2 },
            { id: 'lost', name: '人擠人', icon: 'fa-users', text: '人群太擠，伸手讓對方跟緊自己', delta: 2 },
            { id: 'drink', name: '喝飲料', icon: 'fa-glass-whiskey', text: '買了兩杯手搖飲，各嚐一口對方的口味', delta: 1 }
        ],
        events: ['攤販大聲吆喝，說你們是今天的幸運客人，送了一份小點心。', '人潮突然擠過來，兩個人差點被衝散。', '遠處傳來廟會表演的鑼鼓聲。']
    },
    {
        id: 'bookstore', name: '書店', icon: 'fa-book-open', desc: '安靜的書架與紙張的味道', unlock: 0, cost: 0, best: ['morning', 'noon', 'afternoon'],
        atmosphere: '一間安靜的獨立書店，高高的木書架，紙張與咖啡的味道，只聽得到翻書與腳步的輕響。',
        activities: [
            { id: 'recommend', name: '互相推薦', icon: 'fa-book', text: '各自找一本想推薦給對方的書', delta: 2 },
            { id: 'read', name: '並肩閱讀', icon: 'fa-glasses', text: '在角落的沙發坐下，各自翻著書', delta: 1 },
            { id: 'quote', name: '讀一段給你聽', icon: 'fa-quote-left', text: '翻到喜歡的一段，輕聲唸給對方聽', delta: 2 },
            { id: 'gift', name: '挑一本送他', icon: 'fa-gift', text: '偷偷挑了一本書，打算結帳後送給對方', delta: 2 }
        ],
        events: ['你們同時伸手去拿同一本書。', '書店的貓咪跳上桌子，坐在翻開的書上。', '店員說這個角落有一本絕版的書。']
    },
    {
        id: 'stars', name: '山頂看星星', icon: 'fa-star', desc: '遠離城市的夜空', unlock: 45, cost: 0, best: ['night', 'late'],
        atmosphere: '一座沒有燈光的山頂，夜風有點涼，頭頂是滿天的星星，遠處是城市小小的燈海，四周很安靜。',
        activities: [
            { id: 'constellation', name: '找星座', icon: 'fa-star', text: '仰起頭，指著天空找找看認得的星座', delta: 2 },
            { id: 'blanket', name: '披上毯子', icon: 'fa-bed', text: '把帶來的毯子攤開，邀請對方一起坐下', delta: 3 },
            { id: 'wish', name: '許願', icon: 'fa-magic', text: '看到流星時，閉上眼睛許一個願望', delta: 3 },
            { id: 'secret', name: '說個祕密', icon: 'fa-lock', text: '在安靜的夜裡，小聲說出一個一直沒對人說的祕密', delta: 3 }
        ],
        events: ['一顆流星劃過了天空。', '夜風變大，對方輕輕縮了縮肩膀。', '遠處的城市燈火一盞盞熄滅，星星變得更亮了。']
    },
    {
        id: 'home', name: '家中', icon: 'fa-home', desc: '放鬆的沙發、電影與宵夜', unlock: 60, cost: 0, best: ['evening', 'night', 'late'],
        atmosphere: '一個溫暖舒適的家，柔和的燈光、軟軟的沙發，空氣裡有淡淡的香氣，安靜、放鬆、不用在意別人的眼光。',
        activities: [
            { id: 'cook', name: '一起下廚', icon: 'fa-utensils', text: '捲起袖子，一起在廚房做一道簡單的料理', delta: 3 },
            { id: 'movie', name: '窩著看片', icon: 'fa-tv', text: '把毯子拉到兩人身上，選一部片子窩在沙發看', delta: 3 },
            { id: 'game', name: '玩遊戲', icon: 'fa-gamepad', text: '拿出雙人遊戲，約好輸的人要答應對方一件事', delta: 2 },
            { id: 'talk', name: '深夜長談', icon: 'fa-moon', text: '關掉大燈，只留一盞小夜燈，慢慢聊著心裡的話', delta: 3 }
        ],
        events: ['停電了，屋裡一下子暗下來，只剩窗外的月光。', '燉鍋裡的湯溢了出來，兩個人手忙腳亂。', '對方靠在沙發上睡著了。']
    }
];

export const sceneById = id => SCENES.find(s => s.id === id) || null;

export function customScene(name, desc) {
    const n = String(name || '').trim().slice(0, 20) || '特別的地方';
    const d = String(desc || '').trim().slice(0, 200) || '一個只屬於你們的地方';
    return {
        id: 'custom', name: n, icon: 'fa-map-marker-alt', desc: d, unlock: 0, cost: 0, best: [], custom: true,
        atmosphere: `${n}：${d}`,
        activities: [
            { id: 'look', name: '四處看看', icon: 'fa-eye', text: '好奇地四處看看這個地方，說出自己的感覺', delta: 1 },
            { id: 'memory', name: '聊回憶', icon: 'fa-comment-dots', text: '聊起這個地方讓自己想到的往事', delta: 2 },
            { id: 'photo', name: '拍張照', icon: 'fa-camera', text: '拿出手機，邀請對方一起拍張紀念照', delta: 2 }
        ],
        events: ['一陣風吹來，帶來了不知名的花香。', '有人從遠處經過，對你們笑了笑。']
    };
}

// ───── 互動（肢體接觸）：好感度達標才解鎖，含蓄描寫 ─────
export const INTERACTIONS = [
    { id: 'highfive', name: '擊掌', icon: 'fa-hands', min: 0, text: '笑著舉起手，想和對方擊個掌', delta: 1 },
    { id: 'walk', name: '並肩走', icon: 'fa-walking', min: 10, text: '放慢腳步，和對方並肩走著', delta: 1 },
    { id: 'pat', name: '摸摸頭', icon: 'fa-hand-sparkles', min: 30, text: '伸手輕輕拍了拍對方的頭', delta: 2 },
    { id: 'hand', name: '牽手', icon: 'fa-hand-holding-heart', min: 45, text: '猶豫了一下，伸手輕輕牽起對方的手', delta: 3 },
    { id: 'hug', name: '擁抱', icon: 'fa-people-arrows', min: 60, text: '張開手臂，給了對方一個擁抱', delta: 3 },
    { id: 'lean', name: '依偎', icon: 'fa-heart', min: 70, text: '輕輕靠在對方的肩上', delta: 3 }
];

// ───── 好感度規則 ─────
export const AFFECTION_MIN_DELTA = -5;
export const AFFECTION_MAX_DELTA = 8;
export const DAILY_GAIN_CAP = 15; // 一個角色一天最多增加的好感（避免一直刷）

export const clampDelta = n => Math.max(AFFECTION_MIN_DELTA, Math.min(AFFECTION_MAX_DELTA, Math.round(Number(n) || 0)));
export const clampAffection = n => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ───── 提示詞 ─────
export function buildDatePrompt({ charName, userName, scene, slot, affection, mood = '', turns = 0, gift = null }) {
    const stage = stageFor(affection);
    const lines = [
        '# 約會（虛擬見面）',
        `你是「${charName}」，現在和「${userName || '對方'}」在一個虛擬的空間裡面對面見面約會。這是一場實際發生的見面，不是聊天室：你們在同一個場景裡，你能看到、聽到、碰到身邊的一切。`,
        `場景：${scene.name}（${scene.desc}）`,
        `環境：${scene.atmosphere}`,
        `現在的時間：${slot.name}。依這個時段描寫光線、人潮與氣氛。`,
        `關係：${stage.name}（好感度 ${affection}/100）。${stage.hint}`,
        mood ? `你目前的心情：${mood}。` : '',
        turns === 0 ? '這是見面的開場：描寫你抵達或見到對方的瞬間與第一句話。' : '',
        gift ? `對方剛送了你禮物「${gift.name}」${gift.price ? `（價值 $${gift.price}）` : ''}：依你的個性與目前的關係自然地反應。` : '',
        '',
        '## 演出規則',
        '- 完全以角色的身分回應，不要提到 AI、模型、提示詞或「約會系統」。不替對方說話、不替對方決定動作或感受。',
        '- 用（）描寫你的動作、表情與周遭環境，用「」說出你的話；2 到 5 句，貼近你的個性與說話方式，不要每次都用相同的句型開頭。',
        '- 場景要有存在感：偶爾帶到聲音、氣味、光線、天氣或周圍的人，並且前後一致（不要憑空換地點）。',
        '- 好感度是你「真實的感受」：被冒犯、被敷衍或太快越界就不高興、可以拒絕或拉開距離；被用心對待、被理解才會真的靠近。不必每一步都討好對方。',
        '- 描寫保持含蓄，不使用露骨內容。',
        '',
        '## 回覆結尾（必須）',
        `在回覆最後另起一行，輸出這兩個標籤（對方看不到）：`,
        `<affection>整數，${AFFECTION_MIN_DELTA} 到 +${AFFECTION_MAX_DELTA}，這一輪你對對方的好感增減；平淡的一輪給 0 或 +1</affection>`,
        '<mood>你現在的心情，兩到四個字</mood>'
    ];
    return lines.filter(l => l !== '').join('\n').replace(/\n(#)/g, '\n\n$1');
}

// 解析回覆：取出好感增減與心情，剩下的是要顯示的文字。標籤缺漏時 delta／mood 為 null
export function parseReply(raw) {
    let text = String(raw ?? '');
    const a = text.match(/<affection>\s*([+-]?\d+)\s*<\/affection>/i);
    const m = text.match(/<mood>\s*([^<]{1,12}?)\s*<\/mood>/i);
    text = text
        .replace(/<affection>[\s\S]*?<\/affection>/gi, '')
        .replace(/<mood>[\s\S]*?<\/mood>/gi, '')
        .replace(/<\/?(affection|mood)>?/gi, '') // 被截斷時殘留的半個標籤
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return { text, delta: a ? clampDelta(a[1]) : null, mood: m ? m[1].trim() : null };
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export { esc };

// 顯示用：先跳脫 HTML（模型與使用者的文字都不可信），再把（動作）與 *動作* 標成旁白樣式
export function renderNarration(text) {
    return esc(text)
        .replace(/（[^（）\n]*）|\*[^*\n]+\*/g, m => `<span class="dt-act">${m}</span>`)
        .replace(/\n/g, '<br>');
}

// ───── 關係紀錄（每個角色一筆，存在 SettingsDB 的 dating_relations）─────
export const emptyRelation = () => ({ affection: 20, dates: 0, lastDate: null, daily: { day: '', gained: 0 }, history: [] });

// 套用一輪的好感變化：正的受每日上限限制；回傳 { relation, applied, capped }
export function applyAffection(relation, delta, now = new Date()) {
    const rel = { ...emptyRelation(), ...relation, daily: { ...(relation?.daily || {}) } };
    const today = dayKey(now);
    if (rel.daily.day !== today) rel.daily = { day: today, gained: 0 };
    let applied = clampDelta(delta);
    let capped = false;
    if (applied > 0) {
        const room = Math.max(0, DAILY_GAIN_CAP - rel.daily.gained);
        if (applied > room) { applied = room; capped = true; }
        rel.daily.gained += applied;
    }
    const before = rel.affection;
    rel.affection = clampAffection(before + applied);
    return { relation: rel, applied: rel.affection - before, capped };
}

// 約會結束：記下一筆紀錄（最多留 30 筆）
export function finishDate(relation, entry) {
    const rel = { ...emptyRelation(), ...relation };
    rel.dates = (rel.dates || 0) + 1;
    rel.lastDate = entry.endedAt;
    rel.history = [entry, ...(rel.history || [])].slice(0, 30);
    return rel;
}

// 沒有 AI 時的本地摘要
export function localSummary({ scene, slot, turns, before, after }) {
    const diff = after - before;
    const mood = diff >= 6 ? '氣氛很好，彼此靠近了不少' : diff > 0 ? '相處得很愉快' : diff < 0 ? '有點不太順利' : '平靜地度過了時光';
    return `${slot.name}在${scene.name}約會，聊了 ${turns} 輪，${mood}。`;
}
