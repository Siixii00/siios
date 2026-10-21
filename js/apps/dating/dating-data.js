// 約會（虛擬見面）的資料與純函式：場景、關係階段、提示詞、回覆解析、關係紀錄。
// 不依賴瀏覽器，方便測試；畫面與儲存在 index.js。

// ───── 關係階段（由好感度決定，影響角色的態度與可以做的互動）─────
export const STAGES = [
    { id: 'stranger', name: '初識', min: 0, start: 5, hint: '你們還不太熟：禮貌、帶點好奇與距離感，不會有肢體接觸。' },
    { id: 'friend', name: '朋友', min: 25, start: 30, hint: '你們是熟悉的朋友：輕鬆自在、會開玩笑；偶爾自然的小接觸（碰一下手臂、遞東西）可以。' },
    { id: 'close', name: '曖昧', min: 50, start: 55, hint: '彼此有明顯的好感：會害羞、試探、在意對方的反應；牽手、靠近都可以，但仍然含蓄。' },
    { id: 'lover', name: '交往中', min: 75, start: 82, hint: '你們是親密的戀人：自然、溫柔、願意直接表達愛意；擁抱、依偎、牽手都很自然。' },
    // 訂婚、已婚是人生的決定，不會因為好感度高就自動發生，只能在「關係設定」手動指定
    { id: 'engaged', name: '訂婚', min: 88, start: 90, manual: true, hint: '你們已經訂婚，正在一起準備共同的未來：互相信任、會談到婚禮、新家與以後的生活，默契與承諾感都很強。' },
    { id: 'married', name: '已婚', min: 95, start: 97, manual: true, hint: '你們是結了婚的夫妻：生活在一起，有共同的家與日常；親密、踏實、互相照顧，像老夫老妻般自然，也會有日常的小摩擦與玩笑。' }
];

const stageIndex = id => Math.max(0, STAGES.findIndex(s => s.id === id));

// 最低階段：使用者手動指定的（stageFloor），加上自動模式下從世界書／角色設定讀到的（hint）；兩者取較高。
// 手動指定關係（autoChat 關閉）時，不再採用世界書的判斷——使用者說了算
function floorOf(rel) {
    const manual = STAGES.find(s => s.id === rel?.stageFloor) || null;
    const hinted = rel?.autoChat === false ? null : STAGES.find(s => s.id === rel?.hint?.stageId) || null;
    if (manual && hinted) return stageIndex(manual.id) >= stageIndex(hinted.id) ? manual : hinted;
    return manual || hinted;
}

// 只看好感度（不含手動指定的階段）
export function stageFor(affection) {
    const a = Number(affection) || 0;
    return [...STAGES].reverse().find(s => !s.manual && a >= s.min) || STAGES[0];
}

// 關係紀錄實際的階段：好感度算出的階段，和使用者手動指定的階段（stageFloor）取較高者。
// 手動指定的是「關係狀態」，不會因為某一輪好感下降就消失（結了婚不會因為吵架就變成朋友）
export function relationStage(rel) {
    const auto = stageFor(rel?.affection);
    const floor = floorOf(rel);
    return floor && stageIndex(floor.id) > stageIndex(auto.id) ? floor : auto;
}

// 解鎖與提示詞用的好感度：手動指定的階段至少視為達到該階段的門檻
export function effAffection(rel) {
    const floor = floorOf(rel);
    return Math.max(Number(rel?.affection) || 0, floor ? floor.min : 0);
}

// 解鎖條件：數字＝好感度門檻；物件可以同時要求好感度、約會次數、關係階段。回傳 { ok, missing: ['好感度 45', ...] }
export function unlockReq(u) {
    if (typeof u === 'number') return { affection: u };
    return { affection: 0, ...(u || {}) };
}
export function checkUnlock(u, rel) {
    const req = unlockReq(u), missing = [];
    if (effAffection(rel) < (req.affection || 0)) missing.push(`好感度 ${req.affection}`);
    // 使用者手動指定了曖昧以上的關係，代表這段關係本來就存在，不必再補約會次數
    const given = floorOf(rel) && stageIndex(floorOf(rel).id) >= stageIndex('close');
    if (!given && (rel?.dates || 0) < (req.dates || 0)) missing.push(`約會 ${req.dates} 次`);
    if (req.stage && stageIndex(relationStage(rel).id) < stageIndex(req.stage)) missing.push(`關係達到「${STAGES[stageIndex(req.stage)].name}」`);
    return { ok: missing.length === 0, missing };
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
        id: 'restaurant', name: '餐廳', icon: 'fa-utensils', desc: '燭光與好吃的料理', unlock: { affection: 15, dates: 1 }, cost: 800, best: ['noon', 'evening', 'night'],
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
        id: 'stars', name: '山頂看星星', icon: 'fa-star', desc: '遠離城市的夜空', unlock: { affection: 45, dates: 2 }, cost: 0, best: ['night', 'late'],
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
        id: 'home', name: '家中', icon: 'fa-home', desc: '放鬆的沙發、電影與宵夜', unlock: { affection: 60, dates: 3, stage: 'close' }, cost: 0, best: ['evening', 'night', 'late'],
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

SCENES.push(
    {
        id: 'bridal', name: '婚紗店', icon: 'fa-ring', desc: '白紗、西裝與試穿的笑聲', unlock: { affection: 75, dates: 5, stage: 'lover' }, cost: 0, best: ['morning', 'noon', 'afternoon'],
        atmosphere: '一間明亮的婚紗店，長長的鏡子、整排的白紗與西裝，店員輕聲細語地介紹款式，空氣裡有淡淡的花香。',
        activities: [
            { id: 'try', name: '試穿', icon: 'fa-tshirt', text: '拿起一件禮服，請對方看看適不適合自己', delta: 3 },
            { id: 'mirror', name: '站在鏡前', icon: 'fa-user-friends', text: '兩人並肩站在大鏡子前，看著鏡中的彼此', delta: 3 },
            { id: 'plan', name: '聊婚禮', icon: 'fa-calendar-alt', text: '一邊看樣品冊，一邊聊著心中理想的婚禮', delta: 3 },
            { id: 'photo', name: '拍試穿照', icon: 'fa-camera', text: '請店員幫忙拍一張兩人的試穿紀念照', delta: 3 }
        ],
        events: ['店員驚呼說你們站在一起特別登對。', '試衣間的簾子拉開，對方看起來讓人移不開眼。', '店員遞來一束捧花，說可以試著拿拿看。']
    },
    {
        id: 'newhome', name: '我們的家', icon: 'fa-house-user', desc: '婚後的日常與餐桌', unlock: { affection: 90, stage: 'married' }, cost: 0, best: ['morning', 'evening', 'night', 'late'],
        atmosphere: '屬於你們兩個人的家：餐桌上有兩個杯子，玄關有成對的拖鞋，牆上掛著合照，處處是一起生活的痕跡。',
        activities: [
            { id: 'breakfast', name: '一起做早餐', icon: 'fa-bread-slice', text: '一早起來，並肩在廚房準備早餐', delta: 2 },
            { id: 'chores', name: '分工家務', icon: 'fa-broom', text: '商量今天的家務該怎麼分', delta: 1 },
            { id: 'future', name: '聊未來', icon: 'fa-seedling', text: '坐在沙發上，聊聊接下來想一起完成的事', delta: 3 },
            { id: 'rest', name: '一起發懶', icon: 'fa-couch', text: '什麼都不做，窩在一起度過安靜的假日', delta: 2 }
        ],
        events: ['你們發現冰箱裡剛好少了一樣料理的食材。', '窗外下起了雨，兩個人決定哪裡也不去。', '翻出一本舊相簿，裡面是你們剛認識時的照片。']
    }
);

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
    { id: 'hand', name: '牽手', icon: 'fa-hand-holding-heart', min: 45, dates: 1, text: '猶豫了一下，伸手輕輕牽起對方的手', delta: 3 },
    { id: 'dance', name: '邀舞', icon: 'fa-music', min: 55, dates: 1, text: '伸出手，邀請對方隨著音樂跳一小段舞', delta: 3 },
    { id: 'hug', name: '擁抱', icon: 'fa-people-arrows', min: 60, dates: 2, text: '張開手臂，給了對方一個擁抱', delta: 3 },
    { id: 'lean', name: '依偎', icon: 'fa-heart', min: 70, dates: 2, text: '輕輕靠在對方的肩上', delta: 3 },
    { id: 'forehead', name: '輕吻額頭', icon: 'fa-kiss-wink-heart', min: 80, stage: 'lover', text: '靠近一點，輕輕在對方的額頭上落下一吻', delta: 3 },
    { id: 'ring', name: '看戒指', icon: 'fa-ring', min: 88, stage: 'engaged', text: '握著對方的手，一起看著無名指上的戒指', delta: 3 }
];

export const interactionUnlock = i => ({ affection: i.min, dates: i.dates || 0, ...(i.stage ? { stage: i.stage } : {}) });

// ───── 好感度規則 ─────
export const AFFECTION_MIN_DELTA = -5;
export const AFFECTION_MAX_DELTA = 8;
export const DAILY_GAIN_CAP = 15; // 一個角色一天最多增加的好感（避免一直刷）

export const clampDelta = n => Math.max(AFFECTION_MIN_DELTA, Math.min(AFFECTION_MAX_DELTA, Math.round(Number(n) || 0)));
export const clampAffection = n => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ───── 提示詞 ─────
export function buildDatePrompt({ charName, userName, scene, slot, affection, stage: stageIn = null, note = '', worldFacts = '', cardFacts = '', mood = '', turns = 0, gift = null }) {
    const stage = stageIn || stageFor(affection);
    const lines = [
        '# 約會（虛擬見面）',
        `你是「${charName}」，現在和「${userName || '對方'}」在一個虛擬的空間裡面對面見面約會。這是一場實際發生的見面，不是聊天室：你們在同一個場景裡，你能看到、聽到、碰到身邊的一切。`,
        `場景：${scene.name}（${scene.desc}）`,
        `環境：${scene.atmosphere}`,
        `現在的時間：${slot.name}。依這個時段描寫光線、人潮與氣氛。`,
        `關係：${stage.name}（好感度 ${affection}/100）。${stage.hint}`,
        note ? `使用者對你們關係的補充說明：${String(note).slice(0, 300)}（以此為準，不要和它矛盾）` : '',
        mood ? `你目前的心情：${mood}。` : '',
        worldFacts ? `\n## 必須遵守的世界設定（世界書）\n以下是這個世界的事實，約會中不能違背；與上面的場景規則或你的臆測衝突時，以它為準（例如你們的關係、身分、稱呼、各自的背景）。\n${worldFacts}` : '',
        cardFacts ? `\n## 你的角色設定（重申）\n${cardFacts}\n這是你的本質：說話方式、價值觀與底線都要符合，不要因為場景輕鬆就偏離。` : '',
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
export const emptyRelation = () => ({ affection: 10, dates: 0, lastDate: null, daily: { day: '', gained: 0 }, history: [], stageFloor: null, note: '', autoChat: true, chat: null, hint: null });

// ───── 從世界書與角色設定讀關係 ─────
// 有人把關係寫在世界書（因為角色設定常常不被好好遵守），所以也要讀。這是文字比對，不是理解：
// 只看提到這個角色（名字或 {{char}}）的句子，或角色卡自己的句子；「前女友」「已經離婚」「曾經」「過世」這類句子略過。
const HINT_PATTERNS = [
    { stageId: 'married', re: /已婚|結婚|夫妻|老公|老婆|丈夫|妻子|配偶|新婚|婚後/ },
    { stageId: 'engaged', re: /訂婚|未婚夫|未婚妻|婚約/ },
    { stageId: 'lover', re: /交往中|男朋友|女朋友|男友|女友|戀人|情侶|熱戀|情人/ },
    { stageId: 'close', re: /曖昧|暗戀|互有好感|互相喜歡/ }
];
const HINT_SKIP = /前(?:男|女)?(?:友|任|夫|妻)|離婚|離異|分手|過世|去世|逝世|不是|沒有|並非|尚未|還沒|未曾|曾經|以前|過去|如果|假如|想要|希望|夢想|幻想|假裝/;

// sources：[{ kind: 'card' | 'world', name, text }]；回傳 { stageId, source, snippet } 或 null
export function detectRelationHint({ charName = '', sources = [] } = {}) {
    const mentions = s => /\{\{\s*char\s*\}\}|<char>|<bot>/i.test(s) || (charName && s.includes(charName));
    let best = null;
    for (const src of sources) {
        const wholeEntry = src.kind === 'card' || (src.name && charName && String(src.name).includes(charName));
        for (const raw of String(src.text || '').split(/[。！？!?\n]/)) {
            const sentence = raw.trim();
            if (!sentence || HINT_SKIP.test(sentence)) continue;
            if (!wholeEntry && !mentions(sentence)) continue;
            for (const p of HINT_PATTERNS) {
                if (!p.re.test(sentence)) continue;
                if (!best || stageIndex(p.stageId) > stageIndex(best.stageId)) {
                    best = { stageId: p.stageId, source: src.name || (src.kind === 'card' ? '角色設定' : '世界書'), snippet: sentence.slice(0, 40) };
                }
                break;
            }
        }
    }
    return best;
}

// 約會提示詞用：把必須遵守的世界設定整理成一段文字（總長有上限，避免佔掉整個上下文）
export function formatWorldFacts(entries, maxChars = 2500) {
    const out = [];
    let used = 0;
    for (const e of entries || []) {
        const content = String(e?.content || '').trim();
        if (!content) continue;
        const block = e.name ? `[${e.name}] ${content}` : content;
        if (used + block.length > maxChars) { const room = maxChars - used; if (room > 80) out.push(block.slice(0, room) + '…'); break; }
        out.push(block);
        used += block.length;
    }
    return out.join('\n');
}

// ───── 用聊天室判斷好感度 ─────
// 從聊天訊息（含 Discord 同步進來的）統計：使用者說了幾句、有幾天聊過、最後一次聊天的時間
export function chatStatsFromMessages(msgs) {
    const seen = new Set(), days = new Set();
    let userMsgs = 0, charMsgs = 0, firstAt = 0, lastAt = 0;
    for (const m of msgs || []) {
        if (!m || (m.id && seen.has(m.id)) || (m.role !== 'user' && m.role !== 'assistant')) continue;
        if (m.id) seen.add(m.id);
        if (String(m.content || '').trim().length < 2) continue;
        m.role === 'user' ? userMsgs++ : charMsgs++;
        const t = Number(m.timestamp) || 0;
        if (t) { days.add(dayKey(new Date(t))); firstAt = firstAt ? Math.min(firstAt, t) : t; lastAt = Math.max(lastAt, t); }
    }
    return { userMsgs, charMsgs, activeDays: days.size, firstAt, lastAt };
}

// 由聊天統計估計好感度（0–55）：聊得多、聊得久（不同天數）加分，很久沒聊會扣一點。
// 只靠聊天最高到「曖昧」的程度——要更進一步，要靠約會與關係設定。
export const CHAT_AFFINITY_CAP = 55;
export function estimateAffinity(stats, now = Date.now()) {
    if (!stats || stats.userMsgs < 5) return 0;
    const volume = 40 * (1 - Math.exp(-stats.userMsgs / 120));
    const span = 15 * (1 - Math.exp(-stats.activeDays / 15));
    const idleDays = stats.lastAt ? Math.max(0, (now - stats.lastAt) / 86400000) : 0;
    const penalty = idleDays > 30 ? Math.min(12, (idleDays - 30) / 10) : 0;
    return Math.max(0, Math.min(CHAT_AFFINITY_CAP, Math.round(volume + span - penalty)));
}

// 把聊天評估套到關係紀錄：只會把好感度往上拉到評估值，不會往下扣；手動指定關係（autoChat 關閉）時不動
export function applyChatEstimate(relation, stats, now = Date.now()) {
    const rel = { ...emptyRelation(), ...relation };
    const estimate = estimateAffinity(stats, now);
    rel.chat = { at: now, estimate, userMsgs: stats?.userMsgs || 0, activeDays: stats?.activeDays || 0 };
    if (rel.autoChat !== false && estimate > rel.affection) rel.affection = estimate;
    return rel;
}

// 關係設定：stageId 為 'auto' 就依聊天紀錄；否則指定階段（好感度設成該階段的起點，並成為最低階段）
export function setRelationship(relation, { stageId = 'auto', note = '' } = {}, stats = null, now = Date.now()) {
    let rel = { ...emptyRelation(), ...relation, note: String(note || '').slice(0, 300) };
    if (stageId === 'auto') {
        rel.stageFloor = null;
        rel.autoChat = true;
        return applyChatEstimate(rel, stats, now);
    }
    const stage = STAGES.find(s => s.id === stageId);
    if (!stage) return rel;
    rel.autoChat = false;
    rel.stageFloor = stage.id === 'stranger' ? null : stage.id;
    rel.affection = clampAffection(stage.start); // 每個階段有自己的起點，指定後該階段的互動大多已解鎖
    return rel;
}

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
