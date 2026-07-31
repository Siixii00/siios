export const TOOLS_CATALOG = [
    {
        id: 'daily_weather',
        category: '日常生活',
        categoryIcon: 'wb_sunny',
        name: 'get_weather',
        displayName: '天氣查詢',
        description: '查詢指定城市的天氣資訊，讓角色可以根據天氣給出貼心建議',
        useCase: '「明天台北會下雨嗎？記得帶傘喔」',
        difficulty: 'easy',
        requires: ['天氣 API Key（如 OpenWeatherMap）'],
        parameters: {
            type: 'object',
            properties: {
                city: { type: 'string', description: '城市名稱（中文或英文）' },
                unit: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' }
            },
            required: ['city']
        }
    },
    {
        id: 'daily_reminder',
        category: '日常生活',
        categoryIcon: 'wb_sunny',
        name: 'set_reminder',
        displayName: '設定提醒',
        description: '設定定時提醒，角色可以幫使用者記住重要事項',
        useCase: '「好，我晚上 8 點提醒你吃藥」',
        difficulty: 'medium',
        requires: ['推播服務或本地通知 API'],
        parameters: {
            type: 'object',
            properties: {
                message: { type: 'string', description: '提醒內容' },
                time: { type: 'string', description: '提醒時間（ISO 格式）' },
                repeat: { type: 'boolean', default: false }
            },
            required: ['message', 'time']
        }
    },
    {
        id: 'daily_recipe',
        category: '日常生活',
        categoryIcon: 'wb_sunny',
        name: 'search_recipe',
        displayName: '食譜搜尋',
        description: '搜尋料理食譜，角色可以根據使用者喜好推薦',
        useCase: '「你想吃咖哩？我幫你找個簡單的做法」',
        difficulty: 'easy',
        requires: ['食譜 API（如 Spoonacular）'],
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '搜尋關鍵字' },
                cuisine: { type: 'string', description: '料理類型（如：chinese, japanese）' },
                limit: { type: 'number', default: 5 }
            },
            required: ['query']
        }
    },
    {
        id: 'shop_sanitary_pads',
        category: '購物消費',
        categoryIcon: 'shopping_cart',
        name: 'purchase_sanitary_pads',
        displayName: '購買衛生棉',
        description: '讓 AI 角色以自己的身分幫使用者購買衛生棉',
        useCase: '「已經幫你下單了，2 天後送到」',
        difficulty: 'medium',
        requires: ['購物平台 API（如 momo、pchome）或自建訂單系統'],
        parameters: {
            type: 'object',
            properties: {
                brand: { type: 'string', enum: ['好自在', '靠得住', '蘇菲', '康乃馨', '其他'] },
                type: { type: 'string', enum: ['日用', '夜用', '護墊', '量多型'] },
                quantity: { type: 'number', default: 1 }
            },
            required: []
        }
    },
    {
        id: 'shop_food',
        category: '購物消費',
        categoryIcon: 'shopping_cart',
        name: 'order_food',
        displayName: '訂餐',
        description: '幫使用者訂購餐點，支援常見外送平台',
        useCase: '「想吃麥當勞？我幫你點套餐」',
        difficulty: 'hard',
        requires: ['外送平台 API（如 UberEats、foodpanda）'],
        parameters: {
            type: 'object',
            properties: {
                restaurant: { type: 'string', description: '餐廳名稱' },
                items: { type: 'array', items: { type: 'string' }, description: '餐點清單' },
                address: { type: 'string', description: '送達地址' }
            },
            required: ['restaurant', 'items']
        }
    },
    {
        id: 'shop_product_search',
        category: '購物消費',
        categoryIcon: 'shopping_cart',
        name: 'search_product',
        displayName: '商品搜尋',
        description: '搜尋並比價商品資訊',
        useCase: '「這款面膜現在特價中...」',
        difficulty: 'easy',
        requires: ['購物平台 API 或爬蟲'],
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '商品名稱或關鍵字' },
                maxPrice: { type: 'number', description: '最高價格' },
                sortBy: { type: 'string', enum: ['price', 'rating', 'relevance'] }
            },
            required: ['query']
        }
    },
    {
        id: 'health_period_log',
        category: '健康管理',
        categoryIcon: 'favorite',
        name: 'log_period_symptom',
        displayName: '記錄生理期症狀',
        description: '記錄使用者的生理期症狀，整合到 HealthDB',
        useCase: '「你今天肚子痛嗎？我幫你記下來」',
        difficulty: 'easy',
        requires: ['無（使用專案內建 HealthDB）'],
        parameters: {
            type: 'object',
            properties: {
                symptom: { type: 'string', enum: ['頭痛', '腹痛', '腰痠', '情緒低落', '食慾改變', '疲勞'] },
                severity: { type: 'number', minimum: 1, maximum: 5, description: '嚴重程度 1-5' },
                notes: { type: 'string', description: '備註' }
            },
            required: ['symptom']
        }
    },
    {
        id: 'health_mood_track',
        category: '健康管理',
        categoryIcon: 'favorite',
        name: 'track_mood',
        displayName: '心情追蹤',
        description: '追蹤並記錄使用者的心情狀態',
        useCase: '「你今天心情好像不太好...」',
        difficulty: 'easy',
        requires: ['無（本地儲存）'],
        parameters: {
            type: 'object',
            properties: {
                mood: { type: 'string', enum: ['開心', '平靜', '焦慮', '難過', '憤怒', '疲憊'] },
                reason: { type: 'string', description: '原因（選填）' },
                intensity: { type: 'number', minimum: 1, maximum: 5 }
            },
            required: ['mood']
        }
    },
    {
        id: 'health_medication',
        category: '健康管理',
        categoryIcon: 'favorite',
        name: 'log_medication',
        displayName: '用藥記錄',
        description: '記錄使用者的用藥情況',
        useCase: '「你今天還沒吃藥喔」',
        difficulty: 'easy',
        requires: ['無（使用專案內建 HealthDB）'],
        parameters: {
            type: 'object',
            properties: {
                medication: { type: 'string', description: '藥物名稱' },
                dosage: { type: 'string', description: '劑量' },
                taken: { type: 'boolean', default: true }
            },
            required: ['medication']
        }
    },
    {
        id: 'social_calendar',
        category: '社交通訊',
        categoryIcon: 'event',
        name: 'create_event',
        displayName: '建立行事曆',
        description: '幫使用者在行事曆建立事件',
        useCase: '「週六的約會已經幫你記下來了」',
        difficulty: 'medium',
        requires: ['Google Calendar API 或其他行事曆服務'],
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: '事件標題' },
                datetime: { type: 'string', description: '日期時間（ISO 格式）' },
                location: { type: 'string', description: '地點' },
                notes: { type: 'string', description: '備註' }
            },
            required: ['title', 'datetime']
        }
    },
    {
        id: 'social_email',
        category: '社交通訊',
        categoryIcon: 'event',
        name: 'send_email',
        displayName: '發送郵件',
        description: '幫使用者發送電子郵件',
        useCase: '「幫你把這封信寄出去了」',
        difficulty: 'medium',
        requires: ['Email 服務（如 Resend、SendGrid）'],
        parameters: {
            type: 'object',
            properties: {
                to: { type: 'string', description: '收件人 Email' },
                subject: { type: 'string', description: '主旨' },
                body: { type: 'string', description: '內容' }
            },
            required: ['to', 'subject', 'body']
        }
    },
    {
        id: 'smart_light',
        category: '智慧家居',
        categoryIcon: 'home',
        name: 'control_light',
        displayName: '控制燈光',
        description: '控制智慧燈具的開關與亮度',
        useCase: '「天黑了，幫你開燈」',
        difficulty: 'medium',
        requires: ['智慧家居平台 API（如 Philips Hue、Google Home）'],
        parameters: {
            type: 'object',
            properties: {
                room: { type: 'string', enum: ['客廳', '臥室', '廚房', '浴室', '陽台'] },
                action: { type: 'string', enum: ['on', 'off', 'dim'] },
                brightness: { type: 'number', minimum: 1, maximum: 100 }
            },
            required: ['room', 'action']
        }
    },
    {
        id: 'smart_ac',
        category: '智慧家居',
        categoryIcon: 'home',
        name: 'adjust_ac',
        displayName: '調整冷氣',
        description: '控制智慧空調的溫度與模式',
        useCase: '「房間有點冷，幫你調高 2 度」',
        difficulty: 'medium',
        requires: ['智慧家居平台 API'],
        parameters: {
            type: 'object',
            properties: {
                room: { type: 'string' },
                temperature: { type: 'number', minimum: 16, maximum: 30 },
                mode: { type: 'string', enum: ['cool', 'heat', 'auto', 'fan'] }
            },
            required: ['room']
        }
    },
    {
        id: 'smart_music',
        category: '智慧家居',
        categoryIcon: 'home',
        name: 'play_music',
        displayName: '播放音樂',
        description: '控制音樂播放設備',
        useCase: '「想聽什麼？我幫你放」',
        difficulty: 'easy',
        requires: ['Spotify API 或其他音樂服務'],
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '歌曲名稱或關鍵字' },
                action: { type: 'string', enum: ['play', 'pause', 'next', 'volume'] },
                volume: { type: 'number', minimum: 0, maximum: 100 }
            },
            required: ['action']
        }
    },
    {
        id: 'entertainment_music_search',
        category: '娛樂興趣',
        categoryIcon: 'music_note',
        name: 'search_music',
        displayName: '音樂搜尋',
        description: '搜尋歌曲、專輯或藝人資訊',
        useCase: '「這首歌不錯，幫你加入播放清單」',
        difficulty: 'easy',
        requires: ['Spotify API、Apple Music API 或 KKBOX API'],
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '搜尋關鍵字' },
                type: { type: 'string', enum: ['track', 'album', 'artist'], default: 'track' },
                limit: { type: 'number', default: 10 }
            },
            required: ['query']
        }
    },
    {
        id: 'entertainment_anime',
        category: '娛樂興趣',
        categoryIcon: 'music_note',
        name: 'search_anime',
        displayName: '動漫搜尋',
        description: '搜尋動漫資訊與新番推薦',
        useCase: '「這季新番有這些...」',
        difficulty: 'easy',
        requires: ['AniList API 或 MyAnimeList API'],
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '動漫名稱' },
                season: { type: 'string', description: '季度（如：2024-spring）' },
                status: { type: 'string', enum: ['airing', 'finished', 'upcoming'] }
            },
            required: []
        }
    },
    {
        id: 'entertainment_game_price',
        category: '娛樂興趣',
        categoryIcon: 'music_note',
        name: 'check_game_price',
        displayName: '遊戲價格查詢',
        description: '查詢 Steam、Switch 等平台的遊戲價格',
        useCase: '「Steam 特價中，你要買嗎？」',
        difficulty: 'medium',
        requires: ['CheapShark API（免費）'],
        parameters: {
            type: 'object',
            properties: {
                game: { type: 'string', description: '遊戲名稱' },
                platform: { type: 'string', enum: ['steam', 'switch', 'ps', 'xbox'] }
            },
            required: ['game']
        }
    },
    {
        id: 'work_translate',
        category: '學習工作',
        categoryIcon: 'school',
        name: 'translate',
        displayName: '翻譯',
        description: '翻譯文字到指定語言',
        useCase: '「這句日文的意思是...」',
        difficulty: 'easy',
        requires: ['Google Translate API 或 DeepL API'],
        parameters: {
            type: 'object',
            properties: {
                text: { type: 'string', description: '要翻譯的文字' },
                targetLang: { type: 'string', description: '目標語言（如：ja, en, zh-TW）' }
            },
            required: ['text', 'targetLang']
        }
    },
    {
        id: 'work_wiki',
        category: '學習工作',
        categoryIcon: 'school',
        name: 'search_wiki',
        displayName: '維基查詢',
        description: '搜尋維基百科資訊',
        useCase: '「關於這個的資料是...」',
        difficulty: 'easy',
        requires: ['無（MediaWiki API 免費）'],
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '搜尋關鍵字' },
                lang: { type: 'string', default: 'zh', description: '語言代碼' }
            },
            required: ['query']
        }
    },
    {
        id: 'work_notion',
        category: '學習工作',
        categoryIcon: 'school',
        name: 'create_notion_page',
        displayName: '建立 Notion 頁面',
        description: '在 Notion 中建立筆記頁面',
        useCase: '「幫你記在 Notion 了」',
        difficulty: 'medium',
        requires: ['Notion API Token 和 Database ID'],
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: '頁面標題' },
                content: { type: 'string', description: '頁面內容' },
                tags: { type: 'array', items: { type: 'string' } }
            },
            required: ['title']
        }
    },
    {
        id: 'finance_stock',
        category: '金融理財',
        categoryIcon: 'trending_up',
        name: 'check_stock',
        displayName: '股價查詢',
        description: '查詢即時股價資訊',
        useCase: '「台積電今天漲了 2%」',
        difficulty: 'easy',
        requires: ['股市 API（如 Yahoo Finance、Alpha Vantage）'],
        parameters: {
            type: 'object',
            properties: {
                symbol: { type: 'string', description: '股票代碼（如：2330.TW）' },
                market: { type: 'string', enum: ['tw', 'us', 'jp'], default: 'tw' }
            },
            required: ['symbol']
        }
    },
    {
        id: 'finance_crypto',
        category: '金融理財',
        categoryIcon: 'trending_up',
        name: 'check_crypto',
        displayName: '幣價查詢',
        description: '查詢加密貨幣價格',
        useCase: '「比特幣現在是...」',
        difficulty: 'easy',
        requires: ['CoinGecko API（免費）或 Binance API'],
        parameters: {
            type: 'object',
            properties: {
                coin: { type: 'string', description: '幣種（如：bitcoin, ethereum）' },
                currency: { type: 'string', default: 'twd' }
            },
            required: ['coin']
        }
    },
    {
        id: 'finance_expense',
        category: '金融理財',
        categoryIcon: 'trending_up',
        name: 'track_expense',
        displayName: '記帳',
        description: '記錄消費支出',
        useCase: '「午餐花了 120 元，幫你記下來」',
        difficulty: 'easy',
        requires: ['無（本地儲存）或記帳服務 API'],
        parameters: {
            type: 'object',
            properties: {
                amount: { type: 'number', description: '金額' },
                category: { type: 'string', enum: ['餐食', '交通', '購物', '娛樂', '其他'] },
                note: { type: 'string', description: '備註' }
            },
            required: ['amount', 'category']
        }
    },
    {
        id: 'memory_save',
        category: '角色專用',
        categoryIcon: 'psychology',
        name: 'save_important_memory',
        displayName: '儲存重要記憶',
        description: '讓角色主動儲存重要對話內容到記憶系統',
        useCase: '「你的生日是 5/20 對吧？我記下來了」',
        difficulty: 'easy',
        requires: ['無（使用專案內建 MemoryDB）'],
        parameters: {
            type: 'object',
            properties: {
                content: { type: 'string', description: '記憶內容' },
                category: { type: 'string', enum: ['約會', '喜好', '重要事件', '健康', '祕密', '一般'] },
                importance: { type: 'number', minimum: 0, maximum: 1, default: 0.8 }
            },
            required: ['content']
        }
    },
    {
        id: 'memory_retrieve',
        category: '角色專用',
        categoryIcon: 'psychology',
        name: 'retrieve_memory',
        displayName: '檢索記憶',
        description: '根據關鍵字搜尋相關記憶',
        useCase: '「你之前說過喜歡吃咖哩對吧？」',
        difficulty: 'easy',
        requires: ['無（使用專案內建 MemoryDB）'],
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '搜尋關鍵字' },
                limit: { type: 'number', default: 5 }
            },
            required: ['query']
        }
    }
];

export const CATEGORIES = [
    { id: '日常生活', icon: 'wb_sunny', color: '#FF9500' },
    { id: '購物消費', icon: 'shopping_cart', color: '#FF3B30' },
    { id: '健康管理', icon: 'favorite', color: '#FF2D55' },
    { id: '社交通訊', icon: 'event', color: '#5856D6' },
    { id: '智慧家居', icon: 'home', color: '#007AFF' },
    { id: '娛樂興趣', icon: 'music_note', color: '#AF52DE' },
    { id: '學習工作', icon: 'school', color: '#34C759' },
    { id: '金融理財', icon: 'trending_up', color: '#00C7BE' },
    { id: '角色專用', icon: 'psychology', color: '#FF9500' }
];