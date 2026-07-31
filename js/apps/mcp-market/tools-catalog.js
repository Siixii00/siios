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
        id: 'delivery_order',
        category: '購物消費',
        categoryIcon: 'shopping_cart',
        name: 'order_food_delivery',
        displayName: '叫外送',
        description: '從附近餐廳叫外送，可指定餐點、地址與備註',
        useCase: '「幫你叫了炸雞，預計 30 分鐘到」',
        difficulty: 'medium',
        requires: ['外送平台 API 或第三方訂餐服務'],
        parameters: {
            type: 'object',
            properties: {
                restaurant: { type: 'string', description: '餐廳名稱' },
                items: { type: 'array', items: { type: 'string' }, description: '餐點清單' },
                address: { type: 'string', description: '送達地址' },
                note: { type: 'string', description: '備註（如：少辣、不要蔥）' },
                tip: { type: 'number', description: '小費金額' }
            },
            required: ['restaurant', 'items', 'address']
        }
    },
    {
        id: 'delivery_track',
        category: '購物消費',
        categoryIcon: 'shopping_cart',
        name: 'track_delivery',
        displayName: '追蹤外送',
        description: '查詢外送訂單的配送狀態與剩餘時間',
        useCase: '「外送員還有 8 分鐘到喔」',
        difficulty: 'easy',
        requires: ['外送平台訂單查詢 API'],
        parameters: {
            type: 'object',
            properties: {
                orderId: { type: 'string', description: '訂單編號' }
            },
            required: ['orderId']
        }
    },
    {
        id: 'delivery_search',
        category: '購物消費',
        categoryIcon: 'shopping_cart',
        name: 'search_nearby_restaurants',
        displayName: '找附近餐廳',
        description: '根據位置或口味推薦附近可外送的餐廳',
        useCase: '「這附近有三家評分不錯的拉麵」',
        difficulty: 'easy',
        requires: ['地圖/餐廳搜尋 API（如 Google Maps、Foodpanda）'],
        parameters: {
            type: 'object',
            properties: {
                location: { type: 'string', description: '地點或地址' },
                cuisine: { type: 'string', description: '料理類型（如：拉麵、壽司）' },
                radius: { type: 'number', description: '搜尋半徑（公尺）' }
            },
            required: ['location']
        }
    },
    {
        id: 'vrm_expression',
        category: '虛擬形象',
        categoryIcon: 'android',
        name: 'set_vrm_expression',
        displayName: '切換表情',
        description: '切換 VRM 模型表情（開心、生氣、驚訝、害羞、眨眼等）',
        useCase: '「你聽到了嗎？我很驚訝！」',
        difficulty: 'easy',
        requires: ['VRM 模型載入器（如 @pixiv/three-vrm）'],
        parameters: {
            type: 'object',
            properties: {
                expression: {
                    type: 'string',
                    enum: ['happy', 'angry', 'surprised', 'shy', 'blink', 'neutral', 'sad'],
                    description: '表情名稱'
                },
                intensity: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                    default: 1,
                    description: '表情強度 0-1'
                }
            },
            required: ['expression']
        }
    },
    {
        id: 'vrm_animation',
        category: '虛擬形象',
        categoryIcon: 'android',
        name: 'set_vrm_animation',
        displayName: '播放動畫',
        description: '播放 VRM 模型動畫（待機、揮手、跳舞、坐下）',
        useCase: '「我揮手跟你打招呼～」',
        difficulty: 'medium',
        requires: ['VRM 動畫混合器（AnimationMixer）'],
        parameters: {
            type: 'object',
            properties: {
                animation: {
                    type: 'string',
                    enum: ['idle', 'wave', 'dance', 'sit', 'walk', 'jump'],
                    description: '動畫名稱'
                },
                loop: { type: 'boolean', default: true },
                speed: { type: 'number', minimum: 0.1, maximum: 3, default: 1 }
            },
            required: ['animation']
        }
    },
    {
        id: 'vrm_pose',
        category: '虛擬形象',
        categoryIcon: 'android',
        name: 'set_vrm_pose',
        displayName: '控制姿勢',
        description: '控制 VRM 模型姿勢（頭部轉向、手勢、整體姿勢）',
        useCase: '「我歪頭看著你」',
        difficulty: 'medium',
        requires: ['VRM Humanoid Bone 控制'],
        parameters: {
            type: 'object',
            properties: {
                head: { type: 'string', enum: ['front', 'left', 'right', 'up', 'down', 'tilt'] },
                hand: { type: 'string', enum: ['none', 'wave', 'point', 'peace', 'thumbsup'] },
                body: { type: 'string', enum: ['stand', 'sit', 'lean'] }
            },
            required: []
        }
    },
    {
        id: 'vrm_blendshape',
        category: '虛擬形象',
        categoryIcon: 'android',
        name: 'set_vrm_blend_shape',
        displayName: '精調臉部',
        description: '精調 VRM 臉部參數（眨眼、嘴型、眉毛）',
        useCase: '「我瞇起眼睛微笑」',
        difficulty: 'easy',
        requires: ['VRM BlendShapeProxy 或 Expression API'],
        parameters: {
            type: 'object',
            properties: {
                eyeLeft: { type: 'number', minimum: 0, maximum: 1, description: '左眼閉合度' },
                eyeRight: { type: 'number', minimum: 0, maximum: 1, description: '右眼閉合度' },
                mouth: { type: 'number', minimum: 0, maximum: 1, description: '嘴巴張開度' },
                brow: { type: 'number', minimum: 0, maximum: 1, description: '眉毛高度' }
            },
            required: []
        }
    },
    {
        id: 'pet_spawn',
        category: '桌寵',
        categoryIcon: 'pets',
        name: 'spawn_desktop_pet',
        displayName: '喚出桌寵',
        description: '在畫面角落喚出一個桌寵角色，可選擇造型與大小',
        useCase: '「桌寵出現啦，陪著你工作～」',
        difficulty: 'easy',
        requires: ['WebGL / Canvas 渲染支援'],
        parameters: {
            type: 'object',
            properties: {
                character: {
                    type: 'string',
                    enum: ['cat', 'dog', 'fox', 'slime', 'custom'],
                    description: '桌寵造型'
                },
                size: {
                    type: 'string',
                    enum: ['small', 'medium', 'large'],
                    description: '桌寵大小'
                },
                position: {
                    type: 'string',
                    enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
                    description: '桌寵位置'
                }
            },
            required: ['character']
        }
    },
    {
        id: 'pet_interact',
        category: '桌寵',
        categoryIcon: 'pets',
        name: 'pet_interact',
        displayName: '互動桌寵',
        description: '與桌寵互動（摸摸、餵食、玩耍）',
        useCase: '「我摸了摸牠的頭，牠開心得搖尾巴」',
        difficulty: 'easy',
        requires: ['桌寵實例'],
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['pet', 'feed', 'play', 'scold', 'call'],
                    description: '互動動作'
                },
                item: {
                    type: 'string',
                    description: '使用的物品（如：零食、玩具）'
                }
            },
            required: ['action']
        }
    },
    {
        id: 'pet_status',
        category: '桌寵',
        categoryIcon: 'pets',
        name: 'pet_status',
        displayName: '查看桌寵狀態',
        description: '查看桌寵目前的心情、飢餓度、體力等狀態',
        useCase: '「牠看起來好像餓了...」',
        difficulty: 'easy',
        requires: ['桌寵實例'],
        parameters: {
            type: 'object',
            properties: {
                detail: { type: 'boolean', default: false }
            },
            required: []
        }
    },
    {
        id: 'pet_customize',
        category: '桌寵',
        categoryIcon: 'pets',
        name: 'pet_customize',
        displayName: '客製化桌寵',
        description: '修改桌寵的外觀、顏色、配件',
        useCase: '「幫牠換上新的蝴蝶結」',
        difficulty: 'medium',
        requires: ['桌寵實例'],
        parameters: {
            type: 'object',
            properties: {
                color: { type: 'string', description: '主要顏色（HEX）' },
                accessory: {
                    type: 'string',
                    enum: ['none', 'bow', 'hat', 'glasses', 'collar'],
                    description: '配件'
                },
                expression: {
                    type: 'string',
                    enum: ['normal', 'happy', 'sleepy', 'excited'],
                    description: '表情'
                }
            },
            required: []
        }
    },
    {
        id: 'pet_dismiss',
        category: '桌寵',
        categoryIcon: 'pets',
        name: 'pet_dismiss',
        displayName: '送走桌寵',
        description: '將桌寵從畫面中移除',
        useCase: '「好了，你先去休息吧」',
        difficulty: 'easy',
        requires: ['桌寵實例'],
        parameters: {
            type: 'object',
            properties: {
                farewell: { type: 'boolean', default: true }
            },
            required: []
        }
    },
    {
        id: 'activity_log',
        category: '活動同步',
        categoryIcon: 'sync',
        name: 'log_user_activity',
        displayName: '記錄活動',
        description: '將用戶的手機活動記錄到系統中，讓 AI 可以查詢',
        useCase: '「你剛剛在 Instagram 按了這則貼文對吧？我記下來了」',
        difficulty: 'easy',
        requires: ['無（使用專案內建 ActivityDB）'],
        parameters: {
            type: 'object',
            properties: {
                platform: {
                    type: 'string',
                    enum: ['line', 'instagram', 'twitter', 'facebook', 'youtube', 'tiktok', 'message', 'call', 'email', 'other'],
                    description: '活動平台'
                },
                activity_type: {
                    type: 'string',
                    enum: ['message', 'post', 'like', 'comment', 'share', 'view', 'call', 'email', 'notification', 'other'],
                    description: '活動類型'
                },
                title: { type: 'string', description: '活動標題' },
                content: { type: 'string', description: '活動內容描述' },
                metadata: { type: 'object', description: '額外資訊（如連結、圖片等）' }
            },
            required: ['platform', 'activity_type']
        }
    },
    {
        id: 'activity_get',
        category: '活動同步',
        categoryIcon: 'sync',
        name: 'get_user_activities',
        displayName: '查詢活動',
        description: '查詢用戶最近的活動記錄',
        useCase: '「你今天做了什麼？我看看活動記錄」',
        difficulty: 'easy',
        requires: ['無（使用專案內建 ActivityDB）'],
        parameters: {
            type: 'object',
            properties: {
                platform: { type: 'string', description: '篩選平台（選填）' },
                limit: { type: 'number', default: 10, description: '返回數量限制' },
                hours: { type: 'number', default: 24, description: '查詢時間範圍（小時）' }
            },
            required: []
        }
    },
    {
        id: 'activity_summary',
        category: '活動同步',
        categoryIcon: 'sync',
        name: 'get_activity_summary',
        displayName: '活動摘要',
        description: '獲取用戶活動統計摘要',
        useCase: '「今天你在 Instagram 上花了比較多時間呢」',
        difficulty: 'easy',
        requires: ['無（使用專案內建 ActivityDB）'],
        parameters: {
            type: 'object',
            properties: {
                hours: { type: 'number', default: 24, description: '統計時間範圍（小時）' }
            },
            required: []
        }
    },
    {
        id: 'activity_clear',
        category: '活動同步',
        categoryIcon: 'sync',
        name: 'clear_activities',
        displayName: '清除活動',
        description: '清除用戶的活動記錄',
        useCase: '「我把你的活動記錄清掉了，放心」',
        difficulty: 'easy',
        requires: ['無（使用專案內建 ActivityDB）'],
        parameters: {
            type: 'object',
            properties: {},
            required: []
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
    { id: '虛擬形象', icon: 'android', color: '#AF52DE' },
    { id: '桌寵', icon: 'pets', color: '#FF9500' },
    { id: '活動同步', icon: 'sync', color: '#5856D6' }
];