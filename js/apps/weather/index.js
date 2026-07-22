import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';

const CACHE_TTL = 10 * 60 * 1000;

const PINYIN_MAP = {
    '台': 'tai', '臺': 'tai', '北': 'bei', '新': 'xin', '桃': 'tao', '園': 'yuan',
    '中': 'zhong', '南': 'nan', '高': 'gao', '雄': 'xiong', '基': 'ji', '隆': 'long',
    '竹': 'zhu', '嘉': 'jia', '義': 'yi', '宜': 'yi', '蘭': 'lan', '花': 'hua',
    '蓮': 'lian', '東': 'dong', '屏': 'ping', '投': 'tou', '彰': 'zhang', '化': 'hua',
    '雲': 'yun', '林': 'lin', '苗': 'miao', '栗': 'li', '澎': 'peng', '湖': 'hu',
    '金': 'jin', '門': 'men', '馬': 'ma', '祖': 'zu', '香': 'xiang', '港': 'gang',
    '澳': 'ao', '上': 'shang', '海': 'hai', '京': 'jing', '廣': 'guang',
    '州': 'zhou', '深': 'shen', '圳': 'zhen', '杭': 'hang', '成': 'cheng', '都': 'du',
    '重': 'chong', '慶': 'qing', '武': 'wu', '漢': 'han', '西': 'xi', '安': 'an',
    '蘇': 'su', '津': 'jin', '青': 'qing', '島': 'dao', '大': 'da', '連': 'lian',
    '廈': 'xia', '福': 'fu', '建': 'jian', '長': 'chang', '沙': 'sha',
    '鄭': 'zheng', '阪': 'ban', '名': 'ming', '古': 'gu', '屋': 'wu', '札': 'zha',
    '幌': 'huang', '岡': 'gang', '沖': 'chong', '繩': 'sheng', '首': 'shou', '爾': 'er',
    '釜': 'fu', '山': 'shan', '濟': 'ji', '加': 'jia', '坡': 'po', '曼': 'man',
    '谷': 'gu', '吉': 'ji', '隆': 'long', '雅': 'ya', '達': 'da', '尼': 'ni',
    '拉': 'la', '河': 'he', '內': 'nei', '胡': 'hu', '志': 'zhi', '明': 'ming',
    '市': 'shi', '紐': 'niu', '約': 'yue', '洛': 'luo', '杉': 'shan', '磯': 'ji',
    '舊': 'jiu', '芝': 'zhi', '哥': 'ge', '休': 'xiu', '士': 'shi', '頓': 'dun',
    '邁': 'mai', '阿': 'a', '密': 'mi', '波': 'bo', '斯': 'si', '維': 'wei',
    '倫': 'lun', '敦': 'dun', '巴': 'ba', '黎': 'li', '柏': 'bai', '羅': 'luo',
    '馬': 'ma', '德': 'de', '里': 'li', '姆': 'mu', '特': 'te', '丹': 'dan',
    '雪': 'xue', '梨': 'li', '墨': 'mo', '爾': 'er', '本': 'ben', '布': 'bu',
    '奧': 'ao', '克': 'ke', '蘭': 'lan', '溫': 'wen', '華': 'hua', '多': 'duo',
    '蒙': 'meng', '婁': 'lou', '縣': 'xian', '省': 'sheng'
};

const CITY_NAME_MAP = {
    '台北': 'Taipei', '臺北': 'Taipei', '新北': 'New Taipei', '桃園': 'Taoyuan',
    '台中': 'Taichung', '臺中': 'Taichung', '台南': 'Tainan', '臺南': 'Tainan',
    '高雄': 'Kaohsiung', '基隆': 'Keelung', '新竹': 'Hsinchu', '嘉義': 'Chiayi',
    '宜蘭': 'Yilan', '花蓮': 'Hualien', '台東': 'Taitung', '臺東': 'Taitung',
    '屏東': 'Pingtung', '南投': 'Nantou', '彰化': 'Changhua', '雲林': 'Yunlin',
    '苗栗': 'Miaoli', '澎湖': 'Penghu', '金門': 'Kinmen', '馬祖': 'Matsu',
    '香港': 'Hong Kong', '澳門': 'Macau', '上海': 'Shanghai', '北京': 'Beijing',
    '廣州': 'Guangzhou', '深圳': 'Shenzhen', '杭州': 'Hangzhou', '南京': 'Nanjing',
    '成都': 'Chengdu', '重慶': 'Chongqing', '武漢': 'Wuhan', '西安': "Xi'an",
    '蘇州': 'Suzhou', '天津': 'Tianjin', '青島': 'Qingdao', '大連': 'Dalian',
    '廈門': 'Xiamen', '福州': 'Fuzhou', '長沙': 'Changsha', '鄭州': 'Zhengzhou',
    '東京': 'Tokyo', '大阪': 'Osaka', '京都': 'Kyoto', '名古屋': 'Nagoya',
    '札幌': 'Sapporo', '福岡': 'Fukuoka', '沖繩': 'Okinawa', '首爾': 'Seoul',
    '釜山': 'Busan', '濟州': 'Jeju', '新加坡': 'Singapore', '曼谷': 'Bangkok',
    '吉隆坡': 'Kuala Lumpur', '雅加達': 'Jakarta', '馬尼拉': 'Manila',
    '河內': 'Hanoi', '胡志明市': 'Ho Chi Minh City', '紐約': 'New York',
    '洛杉磯': 'Los Angeles', '舊金山': 'San Francisco', '西雅圖': 'Seattle',
    '芝加哥': 'Chicago', '休士頓': 'Houston', '邁阿密': 'Miami', '波士頓': 'Boston',
    '拉斯維加斯': 'Las Vegas', '倫敦': 'London', '巴黎': 'Paris', '柏林': 'Berlin',
    '羅馬': 'Rome', '馬德里': 'Madrid', '阿姆斯特丹': 'Amsterdam', '雪梨': 'Sydney',
    '墨爾本': 'Melbourne', '布里斯本': 'Brisbane', '奧克蘭': 'Auckland',
    '溫哥華': 'Vancouver', '多倫多': 'Toronto', '蒙特婁': 'Montreal'
};

const WEATHER_REMINDERS = {
    hot: [
        '今天好熱，出門記得防曬喔！',
        '天氣炎熱，多喝水別中暑了～',
        '高溫警報！待在涼爽的地方比較好',
        '太陽很大，出門要帶傘或帽子喔'
    ],
    cold: [
        '今天好冷，出門記得多穿點！',
        '天氣冷冷的，別感冒了喔～',
        '低溫來襲！圍巾手套準備好',
        '好冷呀～來杯熱飲暖暖身子吧'
    ],
    rain: [
        '今天會下雨，出門記得帶傘！',
        '雨天出門要小心路滑喔～',
        '下雨了，別淋濕了！',
        '天氣濕濕的，注意別著涼'
    ],
    sunny: [
        '天氣不錯呢！適合出門走走～',
        '陽光普照，心情也跟著好起來了',
        '今天天氣很棒，有什麼計畫嗎？',
        '好天氣！適合出去曬曬太陽'
    ],
    cloudy: [
        '多雲的天氣，說變就變呢',
        '陰陰的天，可能要下雨喔',
        '雲有點多，但還是挺舒適的',
        '多雲時陰，出門帶件外套吧'
    ],
    storm: [
        '雷雨天來了！盡量別出門喔',
        '外面在打雷，待在室內比較安全',
        '天氣惡劣，注意安全！',
        '雷聲隆隆，別害怕，我陪著你'
    ],
    snow: [
        '下雪了！好浪漫～',
        '雪天路滑，走路要小心喔',
        '白茫茫一片，好漂亮！',
        '下雪天氣，保暖最重要'
    ],
    nice: [
        '今天天氣剛剛好，很舒適呢',
        '氣溫適中，很適合出門喔',
        '天氣宜人，心情也變好了～',
        '這種天氣最舒服了'
    ]
};

let currentWeatherData = null;
let currentPlaceName = null;
let currentChar = null;

function chineseToPinyin(text) {
    let result = '';
    for (const char of text) {
        if (PINYIN_MAP[char]) {
            result += PINYIN_MAP[char];
        } else if (/[\u4e00-\u9fa5]/.test(char)) {
            result += char;
        } else {
            result += char;
        }
    }
    return result;
}

function isChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text);
}

function getWeatherIcon(code) {
    if (code === 0) return 'fa-sun';
    if ([1, 2].includes(code)) return 'fa-cloud-sun';
    if (code === 3) return 'fa-cloud';
    if ([45, 48].includes(code)) return 'fa-smog';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'fa-cloud-rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'fa-snowflake';
    if ([95, 96, 99].includes(code)) return 'fa-cloud-bolt';
    return 'fa-cloud';
}

function getWeatherDescription(code) {
    const map = {
        0: '晴朗', 1: '多雲', 2: '陰晴', 3: '陰天',
        45: '有霧', 48: '濃霧', 51: '毛毛雨', 53: '細雨', 55: '小雨',
        61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪',
        75: '大雪', 77: '霰', 80: '陣雨', 81: '強陣雨', 82: '大陣雨',
        85: '陣雪', 86: '強陣雪', 95: '雷雨', 96: '雷雨冰雹', 99: '強雷雨'
    };
    return map[code] || '天氣不明';
}

function getWeatherType(data) {
    if (!data || !data.daily || !data.current) return 'nice';
    const code = data.daily.weathercode?.[0] ?? 0;
    const temp = data.current.temperature_2m;
    if ([95, 96, 99].includes(code)) return 'storm';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'rain';
    if (temp >= 30) return 'hot';
    if (temp <= 15) return 'cold';
    if ([0, 1].includes(code)) return 'sunny';
    if ([2, 3].includes(code)) return 'cloudy';
    if ([45, 48].includes(code)) return 'cloudy';
    return 'nice';
}

function generateWeatherReminder(charName, data) {
    const weatherType = getWeatherType(data);
    const reminders = WEATHER_REMINDERS[weatherType] || WEATHER_REMINDERS.nice;
    const randomIndex = Math.floor(Math.random() * reminders.length);
    return reminders[randomIndex];
}

async function geocodeLocation(query) {
    let searchTerms = [query];
    if (CITY_NAME_MAP[query]) {
        searchTerms.push(CITY_NAME_MAP[query]);
    }
    if (isChinese(query)) {
        const pinyin = chineseToPinyin(query);
        if (pinyin !== query) {
            searchTerms.push(pinyin);
            const capitalized = pinyin.charAt(0).toUpperCase() + pinyin.slice(1);
            searchTerms.push(capitalized);
        }
    }
    searchTerms = [...new Set(searchTerms)];
    for (const searchTerm of searchTerms) {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=5&language=zh-TW&format=json`;
        let response;
        try {
            response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
        } catch (fetchError) {
            continue;
        }
        if (!response.ok) continue;
        const data = await response.json();
        if (data.results && data.results.length > 0) {
            const place = data.results[0];
            return {
                name: `${place.name}${place.admin1 ? `, ${place.admin1}` : ''}${place.country ? `, ${place.country}` : ''}`,
                lat: place.latitude,
                lon: place.longitude,
                timezone: place.timezone
            };
        }
    }
    throw new Error('找不到此地區，請嘗試輸入英文城市名（如 Taipei、Tokyo）');
}

async function fetchWeatherData(lat, lon, timezone) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=${encodeURIComponent(timezone)}`;
    let response;
    try {
        response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
    } catch (fetchError) {
        throw new Error('網路連線失敗，請檢查網路狀態');
    }
    if (!response.ok) {
        throw new Error(`天氣資料取得失敗 (HTTP ${response.status})`);
    }
    return response.json();
}

function formatUpdateTime(timestamp) {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

async function getCachedWeather(location) {
    try {
        const raw = await SettingsDB.get('weather_cache');
        if (!raw) return null;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed.location !== location) return null;
        if (Date.now() - parsed.timestamp > CACHE_TTL) return null;
        return parsed.data;
    } catch {
        return null;
    }
}

async function cacheWeatherData(location, data) {
    await SettingsDB.set('weather_cache', {
        location,
        timestamp: Date.now(),
        data
    });
}

async function loadCharacter() {
    try {
        const chars = await CharactersDB.getAll();
        if (Array.isArray(chars) && chars.length > 0) {
            const firstChar = chars.find(c => c.name && c.name !== '預設用戶') || chars[0];
            return firstChar;
        }
    } catch {}
    return null;
}

function setLoadingState(container, message) {
    const currentDesc = container.querySelector('#current-desc');
    const dailyForecast = container.querySelector('#daily-forecast');
    const weeklyForecast = container.querySelector('#weekly-forecast');
    if (currentDesc) currentDesc.textContent = message;
    if (dailyForecast) dailyForecast.innerHTML = `<div class="empty-state">${message}</div>`;
    if (weeklyForecast) weeklyForecast.innerHTML = `<div class="empty-state">${message}</div>`;
}

function renderCurrent(placeName, data, container) {
    const current = data.current;
    if (!current) return;
    
    currentWeatherData = data;
    currentPlaceName = placeName;

    const locationDisplay = container.querySelector('#location-display');
    const updateTime = container.querySelector('#update-time');
    const currentTemp = container.querySelector('#current-temp');
    const currentDesc = container.querySelector('#current-desc');
    const currentWind = container.querySelector('#current-wind');
    const currentHumidity = container.querySelector('#current-humidity');
    const currentPrecip = container.querySelector('#current-precip');
    
    if (locationDisplay) locationDisplay.textContent = placeName;
    if (updateTime) updateTime.textContent = `更新 ${formatUpdateTime(Date.now())}`;
    if (currentTemp) currentTemp.textContent = `${Math.round(current.temperature_2m)}°`;
    if (currentDesc) {
        const dailyCode = data.daily?.weathercode?.[0] ?? 0;
        currentDesc.textContent = getWeatherDescription(dailyCode);
    }
    if (currentWind) currentWind.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    if (currentHumidity) currentHumidity.textContent = `${Math.round(current.relative_humidity_2m)}%`;
    if (currentPrecip) currentPrecip.textContent = `${Math.round(current.precipitation)} mm`;
    
    updateCharReminder(container);
}

function renderDailyForecast(data, container) {
    const daily = data.daily;
    const dailyForecast = container.querySelector('#daily-forecast');
    if (!daily || !dailyForecast) return;

    dailyForecast.innerHTML = daily.time.slice(0, 4).map((time, index) => {
        const date = new Date(time);
        const dayLabel = date.toLocaleDateString('zh-TW', { weekday: 'short' });
        const icon = getWeatherIcon(daily.weathercode[index]);
        const range = `${Math.round(daily.temperature_2m_min[index])}° / ${Math.round(daily.temperature_2m_max[index])}°`;
        return `
            <div class="forecast-card">
                <div class="day">${dayLabel}</div>
                <div class="icon"><i class="fas ${icon}"></i></div>
                <div class="range">${range}</div>
            </div>
        `;
    }).join('');
}

function renderWeeklyForecast(data, container) {
    const daily = data.daily;
    const weeklyForecast = container.querySelector('#weekly-forecast');
    if (!daily || !weeklyForecast) return;

    weeklyForecast.innerHTML = daily.time.map((time, index) => {
        const date = new Date(time);
        const dayLabel = date.toLocaleDateString('zh-TW', { weekday: 'short', month: 'numeric', day: 'numeric' });
        const range = `${Math.round(daily.temperature_2m_min[index])}° / ${Math.round(daily.temperature_2m_max[index])}°`;
        const precip = daily.precipitation_probability_max?.[index];
        const precipText = precip !== undefined ? `降雨 ${precip}%` : '降雨 --';
        const icon = getWeatherIcon(daily.weathercode[index]);
        return `
            <div class="week-item">
                <div class="week-day">${dayLabel}</div>
                <div class="week-range"><i class="fas ${icon}"></i> ${range}</div>
                <div class="week-precip">${precipText}</div>
            </div>
        `;
    }).join('');
}

function updateCharReminder(container) {
    const charNote = container.querySelector('#char-note');
    if (!charNote) return;
    
    if (currentWeatherData) {
        const charName = currentChar?.name || '';
        const reminder = generateWeatherReminder(charName, currentWeatherData);
        charNote.textContent = reminder;
    } else {
        charNote.textContent = '查詢天氣後，這裡會顯示天氣提醒';
    }
}

function renderCharacterSection(container) {
    const charAvatar = container.querySelector('#char-avatar');
    const charName = container.querySelector('#char-name');
    const charPlaceholder = container.querySelector('#char-placeholder');
    
    if (!currentChar) {
        if (charName) charName.textContent = '尚未設定角色';
        if (charAvatar) charAvatar.textContent = '?';
        if (charPlaceholder) charPlaceholder.style.display = 'block';
        return;
    }
    
    if (charName) charName.textContent = currentChar.name || '未命名角色';
    if (charAvatar) {
        if (currentChar.avatar) {
            charAvatar.innerHTML = `<img src="${currentChar.avatar}" alt="${currentChar.name}" />`;
            charAvatar.classList.add('image');
        } else {
            charAvatar.textContent = currentChar.name?.charAt(0) || '?';
        }
    }
    if (charPlaceholder) charPlaceholder.style.display = 'none';
}

async function refreshWeather(locationName, container) {
    if (!locationName) return;
    setLoadingState(container, '讀取天氣中...');

    try {
        const cached = await getCachedWeather(locationName);
        if (cached) {
            renderCurrent(cached.placeName, cached.data, container);
            renderDailyForecast(cached.data, container);
            renderWeeklyForecast(cached.data, container);
            return;
        }

        const place = await geocodeLocation(locationName);
        const weatherData = await fetchWeatherData(place.lat, place.lon, place.timezone || 'Asia/Taipei');
        const payload = { placeName: place.name, data: weatherData };
        await cacheWeatherData(locationName, payload);
        renderCurrent(payload.placeName, payload.data, container);
        renderDailyForecast(payload.data, container);
        renderWeeklyForecast(payload.data, container);
    } catch (e) {
        console.error('[Weather] 錯誤:', e);
        const errorMsg = e.message || '找不到天氣資料';
        setLoadingState(container, errorMsg);
        const currentDesc = container.querySelector('#current-desc');
        if (currentDesc) currentDesc.textContent = errorMsg;
    }
}

async function renderWeather(params) {
    const container = createElement('div', 'app-container weather-app');
    
    currentChar = await loadCharacter();
    const storedLocation = await SettingsDB.get('weather_location');
    
    container.innerHTML = `
        <header class="ios-header">
            <button class="ios-back-btn">
                <i class="fas fa-chevron-left"></i> 返回
            </button>
            <h1 class="menu-title">天氣</h1>
        </header>

        <div class="page">
            <div class="weather-panel">
                <div class="location-row">
                    <input type="text" id="location-input" placeholder="輸入城市名稱..." value="${storedLocation || ''}">
                    <button class="primary-btn" id="search-btn">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
                <div class="status-row">
                    <span id="location-display">尚未設定地點</span>
                    <span id="update-time"></span>
                </div>
                <div class="current-card">
                    <div class="current-main">
                        <span class="temp" id="current-temp">--°</span>
                        <span class="desc" id="current-desc">請輸入地區取得預報</span>
                    </div>
                    <div class="current-meta">
                        <span><i class="fas fa-wind"></i><span id="current-wind">-- km/h</span></span>
                        <span><i class="fas fa-tint"></i><span id="current-humidity">--%</span></span>
                        <span><i class="fas fa-cloud-rain"></i><span id="current-precip">-- mm</span></span>
                    </div>
                </div>
            </div>

            <div class="forecast-section">
                <h2>近期預報</h2>
                <div class="forecast-grid" id="daily-forecast">
                    <div class="empty-state">請輸入地區取得預報</div>
                </div>
            </div>

            <div class="forecast-section">
                <h2>一週天氣</h2>
                <div class="forecast-list" id="weekly-forecast">
                    <div class="empty-state">請輸入地區取得預報</div>
                </div>
            </div>

            <div class="char-section">
                <div class="char-card">
                    <div class="char-avatar" id="char-avatar">?</div>
                    <div class="char-info">
                        <div class="char-name" id="char-name">尚未設定角色</div>
                        <div id="char-note">查詢天氣後，這裡會顯示天氣提醒</div>
                    </div>
                </div>
                <div class="char-placeholder" id="char-placeholder" style="display: none;">
                    前往設定新增角色，即可獲得個人化天氣提醒
                </div>
            </div>
        </div>
    `;

    const backBtn = container.querySelector('.ios-back-btn');
    backBtn.onclick = () => Router.navigate('/');

    const searchBtn = container.querySelector('#search-btn');
    const locationInput = container.querySelector('#location-input');
    
    const doSearch = async () => {
        const value = locationInput.value.trim();
        if (!value) {
            setLoadingState(container, '請輸入地區名稱');
            return;
        }
        await SettingsDB.set('weather_location', value);
        await refreshWeather(value, container);
    };
    
    searchBtn.onclick = doSearch;
    locationInput.onkeydown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            doSearch();
        }
    };

    renderCharacterSection(container);
    
    if (storedLocation) {
        refreshWeather(storedLocation, container);
    }

    return { element: container, cleanup: null };
}

export default {
    id: 'weather',
    name: '天氣',
    icon: 'cloud',
    routes: [{ path: '/weather', render: renderWeather }],
    navItem: { label: '天氣', icon: 'cloud', path: '/weather', showInNav: true, order: 30 },
    styles: () => import('./style.css')
};