// 使用說明的內容：快速開始、每個 App 的用法、常見問題。純資料與搜尋函式（可在 node 測試）。
// 寫法：what 一句話說明用途；how 是步驟或功能點；tips 是容易忽略的地方。path 有填就會出現「開啟」按鈕。

export const QUICK_START = [
    { title: '1. 填 API（沒有這步就無法聊天）', body: '到「設定 → 聊天 API 串接」填入 API 位址、金鑰，選一個模型。金鑰只存在這台裝置上。' },
    { title: '2. 建立角色與你自己', body: '「設定 → Char 設定」建立角色（性格、說話風格、紀念日…）；「設定 → User 面具設定」寫你自己的資料，角色會用它認識你。' },
    { title: '3. 開始聊天', body: '到「Chats」按右上角 ＋，選角色開始新對話。輸入框左邊的 ＋ 是功能選單（相片、語音、轉帳、禮物、購物…）。' },
    { title: '4. 讓角色記住你', body: '聊天內容會自動變成記憶，可以到「Memory」查看、搜尋、修改。你說過很討厭的東西會一直被記住，角色也會默默避開。' },
    { title: '5. 想要更多功能', body: '「神秘門」可以讓角色使用外部工具（天氣、翻譯、商品搜尋…）；「設定 → Discord 整合」可以讓角色在 Discord 上也陪你聊天。' }
];

export const CATEGORIES = [
    { id: 'chat', name: '聊天與角色' },
    { id: 'life', name: '社群與影音（由 AI 生成內容）' },
    { id: 'game', name: '遊戲與娛樂' },
    { id: 'money', name: '錢包、購物與商店' },
    { id: 'tools', name: '生活工具' },
    { id: 'custom', name: '外觀與進階' }
];

export const ENTRIES = [
    // ───── 聊天與角色 ─────
    { id: 'import', cat: 'chat', name: '匯入其他來源', path: '/settings/import', what: '把 SillyTavern、ChatGPT、Claude 等地方的角色與聊天紀錄搬過來。',
      how: ['「設定 → 匯入其他來源」選檔案或貼上文字：Tavern 角色卡（JSON／PNG）、SillyTavern 聊天（.jsonl）、ChatGPT／Claude 的 conversations.json、「名字：內容」的純文字。', '先預覽再勾選，每段聊天可以放進新角色、匯入的角色卡或現有角色。', '勾「同時整理成記憶」：舊對話會先存成待整理的記憶，之後按「立即消化記憶」才會用你的 API 分類（類型、領域、重要度、意義）。'],
      tips: ['認得的格式全程在本機轉換，不會送出任何東西。', '本機認不得的格式可以請你設定的 AI 幫忙，但送出前會先告訴你要送什麼，你按確認才會送。', 'SXIOS 自己的備份檔請用「資料備份與還原」。'] },
    { id: 'chats', cat: 'chat', name: '聊天（Chats）', path: '/chats', what: '和角色對話的地方，每個角色可以有自己的對話。',
      how: ['輸入框左邊的 ＋ 會打開功能選單：思維鏈、心聲、生成總結、Wiki、相簿、拍照、影片、語音、檔案、表情、Icon、分享、位置、日程、轉帳、禮物、購物、外送、天氣、地圖、音樂。', '右上角選單可以改這個對話的設定、解除封鎖。', '長按一則訊息會出現操作選單（例如重新生成、刪除）。'],
      tips: ['「思維鏈」「心聲」要角色回覆過才看得到。', '「購物」會預先選好目前聊天的角色，請他幫你挑禮物。'] },
    { id: 'world-info', cat: 'chat', name: '世界書（World Info）', path: '/world-info', what: '放世界觀、設定與規則，角色聊天時會參考。',
      how: ['可匯入 JSON、TXT 或貼上文字；也有內建世界書可以安裝。', '「關鍵字設定」：訊息出現關鍵字才會帶入那一條。', '「全局禁詞」：角色不能用的詞。「劇場設定」：不同劇場各自的設定。'],
      tips: ['約會和各個 App 也會讀世界書。'] },
    { id: 'memory', cat: 'chat', name: '記憶管理（Memory）', path: '/memory', what: '角色對你的記憶：聊天、活動、購物、送禮都會自動留下。',
      how: ['可以搜尋、依來源分類、編輯或刪除。', '到「設定 → 記憶設定」調整整理與學習方式；記憶整理可以另外指定一組專用的 API。'],
      tips: ['你明確說過很討厭的東西一定會記住，而且角色不會特地宣布「我幫你避開了」。'] },
    { id: 'personal-wiki', cat: 'chat', name: '角色 Wiki', path: '/personal-wiki', what: '把角色的資料整理成頁面，方便你查看與補充。',
      how: ['按「同步角色數據」建立頁面。', '左上選單可以切換頁面，右下 ＋ 新增。'], tips: [] },
    { id: 'settings', cat: 'chat', name: '設定', path: '/settings', what: '所有基本設定都在這裡。',
      how: ['Char 設定：角色的性格、說話風格、紀念日、共同基金每週金額。', 'User 面具：你自己的資料，可以有多個。', '聊天 API 串接、合成服務（語音／圖片等）、MCP 工具整合。', 'Discord 整合、跨裝置同步、備份。'],
      tips: ['資料都存在這台裝置上；換手機前先備份或開跨裝置同步。'] },

    // ───── 社群與影音 ─────
    { id: 'instagram', cat: 'life', name: 'Instagram', path: '/instagram', what: '模擬的社群：動態、限時動態、Reels、商店。', how: ['需要先設好 API，內容才會產生。'], tips: [] },
    { id: 'facebook', cat: 'life', name: 'Facebook', path: '/facebook', what: '模擬的社群貼文。', how: ['需要先設好 API，內容才會產生。'], tips: [] },
    { id: 'twitter', cat: 'life', name: 'Twitter', path: '/twitter', what: '模擬的推特：時間軸、通知、書籤。', how: ['時間軸、通知、書籤三個頁面，可以發推文。'], tips: [] },
    { id: 'youtube', cat: 'life', name: 'YouTube', path: '/youtube', what: '影片首頁、收藏與個人頁。', how: ['首頁看推薦影片，底部中間的 ＋ 新增。'], tips: [] },
    { id: 'bilibili', cat: 'life', name: 'Bilibili', path: '/bilibili', what: '影片、動畫、直播分類。', how: ['播放使用官方嵌入播放器，不需要登入。'], tips: ['影片清單會定期自動更新。'] },
    { id: 'twitch', cat: 'life', name: 'Twitch', path: '/twitch', what: '模擬直播平台：推薦、追蹤、通知。', how: ['上方可以選角色。'], tips: [] },
    { id: 'weverse', cat: 'life', name: 'Weverse', path: '/weverse', what: '模擬的粉絲社群。', how: ['可以建立社群。'], tips: [] },
    { id: 'lofter', cat: 'life', name: 'LOFTER（18+）', path: '/lofter', what: '同人創作文章與推薦。', how: ['瀏覽、收藏文章。'], tips: ['未滿 18 歲不會開放。'] },
    { id: 'ao3', cat: 'life', name: 'AO3（18+）', path: '/ao3', what: '創作工作室：設定作品資訊與標籤、寫作與預覽、草稿。', how: ['填作品標題、分級、標籤，用編輯器寫作。', '「我的草稿」可以回來繼續寫。'], tips: ['未滿 18 歲不會開放。'] },
    { id: 'chrome', cat: 'life', name: 'Chrome', path: '/chrome', what: '模擬的瀏覽器。', how: ['有一般與無痕模式、歷史與書籤。'], tips: [] },

    // ───── 遊戲與娛樂 ─────
    { id: 'arcade', cat: 'game', name: '街機廳', path: '/arcade', what: '9 種小遊戲、200 多個關卡，加上每日挑戰和抽卡。',
      how: ['過關得星星（最多 3 星）；第一次拿到的新星星每顆 +$10 錢包的錢，另外有抽卡貨幣。', '每日挑戰第一次完成 $100，連續天數越多越多（最多算 7 天）。'],
      tips: ['街機廳每天最多賺 $300。', '角色會記得你玩了什麼。'] },
    { id: 'match-3', cat: 'game', name: '消消樂', path: '/match-3', what: '三消關卡遊戲。', how: ['交換相鄰方塊湊成三個以上就消除。'], tips: [] },
    { id: 'bubbles', cat: 'game', name: 'Bubble', path: '/bubbles', what: '像追星 App 的私訊：選角色，用藝人模式或粉絲模式聊天。', how: ['先選角色與模式，再開始。'], tips: [] },
    { id: 'theater', cat: 'game', name: '劇場', path: '/theater', what: '讓角色演出你設定的劇目。', how: ['先選角色，按「新增劇目」。'], tips: [] },
    { id: 'dating', cat: 'game', name: '約會（18+）', path: '/dating', what: '選場景和角色約會，聊天中累積好感度。',
      how: ['有些場景要花錢（可從錢包、或共同基金夠的話選用共同基金付）。', '約會結束會整理成一份回憶並記錄好感度。', '關係可以手動設定（包含訂婚、已婚）。'], tips: ['送禮只是往來，不會增加好感度。'] },
    { id: 'pub', cat: 'game', name: '酒館（18+）', path: '/pub', what: '和角色在酒館喝一杯。', how: ['酒都是虛擬的，用錢包的錢付。醉意會隨時間退去。'], tips: ['請適量飲酒；未滿 18 歲不會開放。'] },
    { id: 'farm', cat: 'game', name: '農場', path: '/farm', what: '種作物、養動物，賺錢包的錢。', how: ['天空會隨真實時間變化；作物分階段生長。'], tips: [] },
    { id: 'invest', cat: 'game', name: '投資模擬器', path: '/invest', what: '虛構的標的與模擬行情，用錢包的虛擬餘額買賣。', how: ['有世界事件會影響行情；台股習慣：紅漲綠跌。'], tips: ['全部是模擬，不是真的投資建議。'] },
    { id: 'drift-bottle', cat: 'game', name: '漂流瓶', path: '/drift-bottle', what: '一種命運占卜：撿起漂流瓶獲得當下的指引。', how: ['先選角色（或不指定），按「撿起漂流瓶」。'], tips: [] },
    { id: 'exchange-diary', cat: 'game', name: '交換日記', path: '/exchange-diary', what: '和角色一起寫日記，有月曆與時間軸。', how: ['選日期，右下 ＋ 寫日記；可切換 Calendar／Timeline。'], tips: [] },
    { id: 'pomodoro', cat: 'game', name: '番茄鐘', path: '/pomodoro', what: '專注計時。', how: ['設定專注與休息時間後開始。'], tips: [] },

    // ───── 錢包、購物與商店 ─────
    { id: 'kakaopay', cat: 'money', name: '支付（錢包與共同基金）', path: '/kakaopay', what: '虛擬錢包。轉帳、收款、儲值、設定餘額；錢是虛擬的。',
      how: ['共同基金：每個角色各一個。可以存入、領出、設共同目標。', '角色每週會自己存錢進去（角色設定可改金額，0 = 不存；要先建立過基金才會開始）。', '目標達成後可以「一起花掉」或「領回錢包」。'],
      tips: ['約會可以選用共同基金付款。'] },
    { id: 'payment-code', cat: 'money', name: '付款碼', path: '/payment-code', what: '產生付款用的條碼／QR 碼。', how: ['付款碼過期會自動重新產生。'], tips: [] },
    { id: 'taobao', cat: 'money', name: '購物', path: '/taobao', what: '請角色幫你挑禮物，連到真實的購物網站搜尋，要不要買由你決定。',
      how: ['「為你挑選」：選場合、預算、類別，按「請他挑」。', '每個點子有各平台的搜尋連結（蝦皮、momo、PChome、博客來、Pinkoi、Amazon、淘寶、拼多多、閒魚、煤爐）。', '可以「收下」「我買了」「加入願望清單」「不用了」；有接神秘門的「商品搜尋」會顯示真實價格。'],
      tips: ['價格預設是 AI 估計，以商店為準；不會自動購買。', '生日、紀念日、節日，角色會主動想送你禮物（卡片會出現在這裡）。', '酒類、菸品、成人用品只會提議給成年使用者，且會標示 18+。'] },
    { id: 'gift-shop', cat: 'money', name: '禮物商店', path: '/gift-shop', what: '買虛擬禮物送給角色（在聊天的「禮物」或約會裡送）。', how: ['用錢包的錢購買。'], tips: ['送禮不會增加好感度，角色可能過幾天回送你東西。'] },
    { id: 'emoji-shop', cat: 'money', name: '表情商店', path: '/emoji-shop', what: '領取或購買貼圖，聊天時可以傳。', how: ['買了之後在聊天 ＋ →「表情」使用。'], tips: [] },
    { id: 'theme-shop', cat: 'money', name: '主題商店', path: '/theme-shop', what: '購買桌布主題，套用在主畫面與鎖定畫面。', how: ['點一下購買，再點「套用」。'], tips: ['「恢復預設桌布」可以還原。'] },
    { id: 'delivery', cat: 'money', name: '外送', path: '/delivery', what: '點餐，角色可以一起吃、一起聊。', how: ['選餐廳、加入購物車、結帳（錢包付款）。'], tips: [] },
    { id: 'stay', cat: 'money', name: '宅家', path: '/stay', what: '佈置房間（家具用錢包買）、做活動恢復精力、邀請角色來家裡、每日任務。', how: ['精力太低時角色會適度關心你。'], tips: [] },

    // ───── 生活工具 ─────
    { id: 'daily-recipe', cat: 'tools', name: '每日食譜', path: '/daily-recipe', what: '每天推薦一道食譜（食材、步驟、時間與難度）。', how: ['按「換一道」換食譜；「AI 生成」可以輸入想吃什麼讓 AI 幫你想（要先設好 API）。', '喜歡的按「收藏」，會放在「我的收藏」。'], tips: [] },
    { id: 'weather', cat: 'tools', name: '天氣', path: '/weather', what: '查天氣預報；角色會依天氣提醒你。', how: ['輸入地區取得預報。'], tips: [] },
    { id: 'timetree', cat: 'tools', name: '時間樹', path: '/timetree', what: '行事曆，新增行程可以帶時間。', how: ['點日期看事件，按「新增事件」。'], tips: ['今天的行程會出現在 Android 風格的通知面板；生日、紀念日會觸發角色送禮。'] },
    { id: 'album', cat: 'tools', name: '相簿', path: '/album', what: '存放照片：上傳、聊天傳過的、照相館的作品。', how: ['右上 ＋ 從裝置上傳；可以設成桌布。'], tips: [] },
    { id: 'smart-painter', cat: 'tools', name: '照相館', path: '/smart-painter', what: '給照片套濾鏡（復古、黑白、暖色、冷色、戲劇）。', how: ['選照片 → 選濾鏡 → 儲存到相簿。'], tips: [] },
    { id: 'music', cat: 'tools', name: '音樂', path: '/music', what: '匯入歌單、播放，也可以選角色一起聽；還有 AI 旋律生成。', how: ['可匯入 Spotify／Apple Music 歌單。'], tips: [] },
    { id: 'phone', cat: 'tools', name: '電話', path: '/phone', what: '鍵盤撥號、通話紀錄、常用聯絡人、錄音。', how: [], tips: [] },
    { id: 'health', cat: 'tools', name: '健康', path: '/health', what: '記錄經期、症狀與用藥，綁定的角色會自然地關心你。', how: ['要先建立 User 面具。', '可以設定提前幾天讓角色在聊天室提醒。'], tips: ['資料只存在這台裝置。'] },
    { id: 'guzi-guide', cat: 'tools', name: '谷子圖鑑', path: '/guzi-guide', what: '收藏圖鑑：徽章、立牌、海報、吊卡等。', how: ['按「新增收藏」記錄。'], tips: [] },
    { id: 'passkey', cat: 'tools', name: 'Passkey', path: '/passkey', what: '建立與管理 App 內使用的金鑰。', how: ['金鑰只存在這台裝置上，不會上傳。'], tips: [] },
    { id: 'widget', cat: 'tools', name: '小工具', path: '/widget', what: '選擇主畫面要顯示的小工具（天氣、時鐘、行事曆、音樂、備忘錄、健康）。', how: ['點一下加入或移除，回主畫面就會看到。'], tips: [] },
    { id: 'touch', cat: 'tools', name: '輔助觸控', path: '/touch', what: '畫面上的浮動按鈕，點開有快捷動作（主畫面、返回、鎖定…）。', how: ['開啟後可拖曳，會自動吸附到左右邊。'], tips: [] },

    // ───── 外觀與進階 ─────
    { id: 'appearance', cat: 'custom', name: '外觀', path: '/appearance', what: '深色模式、主題色、字體、介面大小、桌面風格，以及不用寫程式的版面編輯。',
      how: ['桌面風格：iOS 或 Android（圓形圖示、搜尋列、App 抽屜、狀態列、導覽列、通知面板）。', '模式：淺色、深色、跟隨系統。', '主題色：選一個顏色，各個 App 的主色都會換成它（可保留警示紅色）。', '視覺編輯：選一個 App，直接點畫面上的東西改顏色、大小、圓角、背景圖，也可以前後移動元素、放上可拖曳的圖片貼紙。', '自訂 CSS：給會寫 CSS 的人，可以全域或只套用在某個 App。'],
      tips: ['主畫面長按圖示可以拖曳排序、隱藏、放進 Dock。', '圖片庫最多 24 張，上傳時會自動縮小。'] },
    { id: 'mcp-market', cat: 'custom', name: '神秘門（MCP 工具）', path: '/mcp-market', what: '讓角色在聊天時使用外部工具：天氣、翻譯、商品搜尋…。',
      how: ['選工具 → 按「生成程式碼」→ 跟著「三步驟上線」：①下載或複製程式碼 ②貼到 Cloudflare 網頁（免費、不用終端機）並設定畫面上產生的金鑰 ③貼上網址，按「測試並加入」就自動連好。', '有 App 內建的工具不需要部署：到「設定 → MCP 工具整合 → App 內建工具」開啟。'],
      tips: ['有些工具需要你自己的金鑰（例如商品搜尋要 SerpAPI），畫面會寫要新增哪些項目。', '紫微斗數這類含額外檔案的工具要用指令部署，畫面會提示。'] }
];

export const FAQ = [
    { q: '設定裡的「研究參與」是什麼？', a: '開發者為論文提供的選填功能，預設關閉。你自己同意後，才會匿名記錄「這週用過哪些 App」（只有 App 名稱，不含任何聊天、輸入或 AI 生成的內容，也不含個人資料）。未滿 18 歲看不到；隨時可以退出並刪除已送出的資料。如果設定裡沒有這一項，代表這個版本沒有開放。' },
    { q: '角色都不回覆，怎麼辦？', a: '先到「設定 → 聊天 API 串接」確認位址、金鑰和模型有填；畫面上如果有錯誤訊息，通常會寫是金鑰錯了、額度用完還是被模型拒絕。' },
    { q: '我的資料存在哪裡？會不會不見？', a: '都存在這台裝置的瀏覽器裡，沒有上傳到我們的伺服器。清除瀏覽器資料就會消失，所以請到「設定 → 備份」匯出，或開啟跨裝置同步。' },
    { q: '怎麼安裝成像 App 一樣？', a: '用瀏覽器的「加入主畫面」（iPhone：分享 → 加入主畫面；Android／Chrome：選單 → 安裝應用程式）。安裝後可以離線開啟，聊天和 AI 功能還是需要網路。' },
    { q: '為什麼有些 App 打不開（上鎖）？', a: '酒館、約會、AO3、LOFTER 等內容限 18 歲以上，依你一開始填的生日判斷，滿 18 歲當天自動開放。' },
    { q: '我想讓角色在 Discord 上聊天', a: '「設定 → Discord 整合」有全程網頁操作的部署教學；部署完會有一組存取金鑰，可以用 /auth 設定。' },
    { q: '神秘門的工具要錢嗎？', a: 'Cloudflare Workers 有免費額度，一般使用足夠。有些外部服務（例如商品搜尋的 SerpAPI）有各自的免費額度，要自己申請金鑰。' },
    { q: '畫面跑版、切換深色模式顏色怪怪的', a: '深色模式是套濾鏡，個別畫面可能不完美；可以到「外觀」切回淺色，或用視覺編輯／自訂 CSS 修正那個地方。' }
];

const norm = s => String(s ?? '').toLowerCase();

// 搜尋：名稱、用途、步驟、小提醒、常見問題都會比對；空白回傳全部。回傳 { entries, faq, quick }
export function searchHelp(query, data = { QUICK_START, ENTRIES, FAQ }) {
    const q = norm(query).trim();
    if (!q) return { quick: data.QUICK_START, entries: data.ENTRIES, faq: data.FAQ };
    const words = q.split(/\s+/);
    const hit = text => words.every(w => norm(text).includes(w));
    return {
        quick: data.QUICK_START.filter(s => hit(s.title + ' ' + s.body)),
        entries: data.ENTRIES.filter(e => hit([e.name, e.what, ...(e.how || []), ...(e.tips || [])].join(' '))),
        faq: data.FAQ.filter(f => hit(f.q + ' ' + f.a))
    };
}
