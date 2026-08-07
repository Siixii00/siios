import { SettingsDB } from '../db.js';

const CITY_NAME_MAP = {
    '台北': 'Taipei', '臺北': 'Taipei', '新北': 'New Taipei', '桃園': 'Taoyuan',
    '台中': 'Taichung', '臺中': 'Taichung', '台南': 'Tainan', '臺南': 'Tainan',
    '高雄': 'Kaohsiung', '基隆': 'Keelung', '新竹': 'Hsinchu', '嘉義': 'Chiayi',
    '宜蘭': 'Yilan', '花蓮': 'Hualien', '台東': 'Taitung', '臺東': 'Taitung',
    '屏東': 'Pingtung', '南投': 'Nantou', '彰化': 'Changhua', '雲林': 'Yunlin',
    '苗栗': 'Miaoli', '澎湖': 'Penghu', '金門': 'Kinmen', '馬祖': 'Matsu',
    '香港': 'Hong Kong', '澳門': 'Macau', '上海': 'Shanghai', '北京': 'Beijing',
    '廣州': 'Guangzhou', '深圳': 'Shenzhen', '東京': 'Tokyo', '大阪': 'Osaka',
    '首爾': 'Seoul', '新加坡': 'Singapore', '紐約': 'New York', '洛杉磯': 'Los Angeles',
    '倫敦': 'London', '巴黎': 'Paris', '雪梨': 'Sydney'
};

const PINYIN_MAP = {
    '台': 'tai', '臺': 'tai', '北': 'bei', '新': 'xin', '桃': 'tao', '園': 'yuan',
    '中': 'zhong', '南': 'nan', '高': 'gao', '雄': 'xiong', '基': 'ji', '隆': 'long',
    '竹': 'zhu', '嘉': 'jia', '義': 'yi', '宜': 'yi', '蘭': 'lan', '花': 'hua',
    '蓮': 'lian', '東': 'dong', '屏': 'ping', '投': 'tou', '彰': 'zhang', '化': 'hua',
    '雲': 'yun', '林': 'lin', '苗': 'miao', '栗': 'li', '澎': 'peng', '湖': 'hu',
    '金': 'jin', '門': 'men', '馬': 'ma', '祖': 'zu'
};

function chineseToPinyin(text) {
    let result = '';
    for (const char of text) {
        if (PINYIN_MAP[char]) {
            result += PINYIN_MAP[char];
        } else {
            result += char;
        }
    }
    return result;
}

function isChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text);
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
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTerm)}&count=1&language=zh-TW&format=json`;
        try {
            const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
            if (!response.ok) continue;
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const place = data.results[0];
                return {
                    name: place.name,
                    lat: place.latitude,
                    lon: place.longitude,
                    timezone: place.timezone || 'Asia/Taipei'
                };
            }
        } catch {
            continue;
        }
    }
    throw new Error('Location not found');
}

async function fetchWeatherData(lat, lon, timezone) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weathercode,wind_speed_10m&timezone=${encodeURIComponent(timezone)}`;
    try {
        const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-cache' });
        if (!response.ok) throw new Error('Weather API error');
        return response.json();
    } catch {
        throw new Error('Weather fetch failed');
    }
}

function getWeatherDescription(code) {
    const map = {
        0: 'Clear', 1: 'Partly Cloudy', 2: 'Partly Cloudy', 3: 'Overcast',
        45: 'Foggy', 48: 'Foggy', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
        61: 'Rain', 63: 'Rain', 65: 'Heavy Rain', 71: 'Snow', 73: 'Snow',
        75: 'Heavy Snow', 77: 'Sleet', 80: 'Showers', 81: 'Showers', 82: 'Heavy Showers',
        85: 'Snow Showers', 86: 'Snow Showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm'
    };
    return map[code] || 'Unknown';
}

async function buildRealWorldContext(chat) {
    if (!chat || !chat.enable_real_world_info) return null;
    
    const now = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const timeStr = now.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const dayOfWeek = days[now.getDay()];
    
    let weatherStr = '';
    
    if (chat.weather_location) {
        try {
            let weatherData = null;
            const cacheKey = `weather_cache_${chat.weather_location}`;
            const cachedRaw = await SettingsDB.get(cacheKey);
            
            const CACHE_TTL = 10 * 60 * 1000;
            if (cachedRaw) {
                const cached = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw;
                if (Date.now() - cached.timestamp < CACHE_TTL) {
                    weatherData = cached.data;
                }
            }
            
            if (!weatherData) {
                const place = await geocodeLocation(chat.weather_location);
                weatherData = await fetchWeatherData(place.lat, place.lon, place.timezone);
                await SettingsDB.set(cacheKey, {
                    timestamp: Date.now(),
                    data: weatherData
                });
            }
            
            if (weatherData && weatherData.current) {
                const current = weatherData.current;
                const temp = Math.round(current.temperature_2m);
                const humidity = Math.round(current.relative_humidity_2m);
                const desc = getWeatherDescription(current.weathercode);
                weatherStr = `\nLocation: ${chat.weather_location}\nWeather: ${desc}, ${temp}C, Humidity ${humidity}%`;
            }
        } catch (e) {
            weatherStr = `\nLocation: ${chat.weather_location}\nWeather: Data unavailable`;
        }
    }
    
    const context = `[Current Reality]\nTime: ${timeStr} (${dayOfWeek})${weatherStr}\n[/Current Reality]`;
    return context;
}

export { buildRealWorldContext, geocodeLocation, fetchWeatherData };