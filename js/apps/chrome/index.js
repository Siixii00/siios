import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';

const BOOKMARKS_KEY = 'chrome_bookmarks';
const HISTORY_KEY = 'chrome_history';
const USER_PROFILE_KEY = 'chrome_user_profile';
const WORLDBOOKS_KEY = 'chrome_worldbooks';

let charProfiles = [];
let historyEntries = [];
let chromeUserProfiles = [];
let chromeWorldbookMounts = [];
let bookmarks = [];
let currentMode = 'normal';
let currentView = 'home';
let currentCharIndex = 0;

const INCOGNITO_SITES = [
    { id: 'nhentai', label: 'nhentai', icon: 'NH', query: 'nhentai ?犖隤?瞍怎', title: 'nhentai ?犖隤? },
    { id: 'av.com', label: 'av.com', icon: 'AV', query: 'av.com ?犖敶梁?', title: 'av.com 敶梁?' },
    { id: 'dreams', label: 'dreams', icon: 'DR', query: 'dreams 憭Ｗ? 撟餅', title: 'dreams 撟餅銝?' }
];

const USER_INTEREST_SITES = [
    { id: 'user-interest-0', label: '?箔??刻', icon: '??, type: 'recommend' },
    { id: 'user-interest-1', label: '?梢??批捆', icon: '??, type: 'trending' },
    { id: 'user-interest-2', label: '?圈悅鈭?, icon: '??, type: 'fresh' },
    { id: 'user-interest-3', label: '頞??潛', icon: '頞?, type: 'fun' }
];

const ADULT_EXPLICIT_KEYWORDS = ['?僑', '銝剖僑', '憭批?', '憪?', '鈭箏氖', '??', '?', '?犖', '18+', 'AV', '?', '撠箏漲', '?暹?', '?曄萵', '瞈??];

function escapeHTML(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function loadChromeData() {
    try {
        const [bmkData, histData, userProfile, worldbooks] = await Promise.all([
            SettingsDB.get(BOOKMARKS_KEY),
            SettingsDB.get(HISTORY_KEY),
            SettingsDB.get(USER_PROFILE_KEY),
            SettingsDB.get(WORLDBOOKS_KEY)
        ]);
        bookmarks = Array.isArray(bmkData) ? bmkData : [];
        historyEntries = Array.isArray(histData) ? histData : [];
        chromeUserProfiles = userProfile || [];
        chromeWorldbookMounts = Array.isArray(worldbooks) ? worldbooks : [];
    } catch {
        bookmarks = [];
        historyEntries = [];
        chromeUserProfiles = [];
        chromeWorldbookMounts = [];
    }
}

async function saveChromeData() {
    try {
        await Promise.all([
            SettingsDB.set(BOOKMARKS_KEY, bookmarks),
            SettingsDB.set(HISTORY_KEY, historyEntries),
            SettingsDB.set(USER_PROFILE_KEY, chromeUserProfiles),
            SettingsDB.set(WORLDBOOKS_KEY, chromeWorldbookMounts)
        ]);
    } catch (e) {
        console.error('靽?Chrome?豢?憭望?:', e);
    }
}

async function loadCharProfiles() {
    try {
        const chars = await SettingsDB.get('characters');
        charProfiles = Array.isArray(chars) ? chars : [];
    } catch {
        charProfiles = [];
    }
}

async function loadWorldbookMounts() {
    try {
        const mounts = await SettingsDB.get('worldbook_mounts');
        chromeWorldbookMounts = Array.isArray(mounts) ? mounts : [];
    } catch {
        chromeWorldbookMounts = [];
    }
}

async function getApiConfig() {
    const settings = await APIClient.getSettings();
    if (!settings.api_url || !settings.api_key) {
        return null;
    }
    return {
        url: settings.api_url,
        key: settings.api_key,
        model: settings.model || 'gpt-3.5-turbo'
    };
}

async function getUserConfig() {
    const settings = await APIClient.getSettings();
    return {
        name: settings.sx_user_name || 'User',
        personality: settings.sx_user_personality || '',
        background: settings.sx_user_background || ''
    };
}

function isIncognito() {
    return currentMode === 'incognito';
}

function getAdultLevel(char) {
    if (!isIncognito()) return 'none';
    const persona = `${char?.name || ''} ${char?.personality || ''} ${char?.background || ''}`.toLowerCase();
    const explicit = ADULT_EXPLICIT_KEYWORDS.some(key => persona.includes(key.toLowerCase()));
    return explicit ? 'explicit' : 'suggestive';
}

function renderBookmarks(container) {
    const list = container.querySelector('#bookmark-list');
    const searchInput = container.querySelector('#bookmark-search');
    if (!list) return;

    const searchTerm = searchInput?.value?.toLowerCase() || '';
    const filtered = bookmarks.filter(b =>
        b.name.toLowerCase().includes(searchTerm) ||
        b.url.toLowerCase().includes(searchTerm)
    );

    if (filtered.length === 0) {
        list.innerHTML = '<div class="chrome-wb-empty">撠?啣??貊惜</div>';
        return;
    }

    list.innerHTML = filtered.map((b, i) => `
        <div class="bookmark-item" data-index="${i}">
            <div class="left">
                <i class="fas fa-globe"></i>
                <span>${escapeHTML(b.name)}</span>
            </div>
            <div class="bookmark-actions">
                <button class="icon-btn sm bookmark-open" data-url="${escapeHTML(b.url)}" title="??">
                    <i class="fas fa-external-link-alt"></i>
                </button>
                <button class="icon-btn sm bookmark-delete" data-index="${i}" title="?芷">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.bookmark-open').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const url = btn.dataset.url;
            if (url) window.open(url, '_blank');
        };
    });

    list.querySelectorAll('.bookmark-delete').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            if (!isNaN(index)) {
                bookmarks.splice(index, 1);
                saveChromeData();
                renderBookmarks(container);
            }
        };
    });
}

function openBookmarkModal(container) {
    const modal = container.querySelector('#bookmark-modal');
    if (modal) modal.hidden = false;
}

function closeBookmarkModal(container) {
    const modal = container.querySelector('#bookmark-modal');
    const nameInput = container.querySelector('#bookmark-name');
    const urlInput = container.querySelector('#bookmark-url');
    if (modal) modal.hidden = true;
    if (nameInput) nameInput.value = '';
    if (urlInput) urlInput.value = '';
}

function saveBookmark(container) {
    const nameInput = container.querySelector('#bookmark-name');
    const urlInput = container.querySelector('#bookmark-url');
    const name = nameInput?.value?.trim();
    const url = urlInput?.value?.trim();

    if (!name || !url) {
        createToast('隢撓?亦雯蝡?蝔勗?蝬脣?', 'error');
        return;
    }

    bookmarks.push({
        name,
        url,
        createdAt: Date.now()
    });

    saveChromeData();
    closeBookmarkModal(container);
    renderBookmarks(container);
}

function renderHistoryList(container) {
    const list = container.querySelector('#history-list');
    if (!list) return;

    if (historyEntries.length === 0) {
        list.innerHTML = '<div class="status">撠??蝝??/div>';
        return;
    }

    list.innerHTML = historyEntries.map(entry => `
        <div class="history-item" data-id="${entry.id}">
            <div class="history-item-icon">
                <i class="fas fa-search"></i>
            </div>
            <div class="history-item-content">
                <div class="title">${escapeHTML(entry.title)}</div>
                <div class="meta">${entry.site ? `[${entry.site}] ` : ''}${entry.time}</div>
            </div>
            <div class="history-item-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `).join('');

    list.querySelectorAll('.history-item').forEach(item => {
        item.onclick = () => {
            const entry = historyEntries.find(e => e.id === item.dataset.id);
            if (entry) openHistoryDetail(entry, container);
        };
    });
}

function openHistoryDetail(entry, container) {
    const queryEl = container.querySelector('#detail-search-query');
    const timeEl = container.querySelector('#detail-time');
    const summaryEl = container.querySelector('#detail-summary');
    const contentEl = container.querySelector('#detail-page-content');

    if (queryEl) queryEl.textContent = entry.query;
    if (timeEl) timeEl.textContent = entry.time;
    if (summaryEl) summaryEl.textContent = entry.summary;
    if (contentEl) {
        contentEl.innerHTML = `
            <div class="page-loading">
                <div class="loading-spinner"></div>
                <span>甇?頛?...</span>
            </div>
        `;
    }

    switchView('history-detail', container);
    fetchDetailContent(entry, container);
}

async function fetchDetailContent(entry, container) {
    const contentEl = container.querySelector('#detail-page-content');
    if (!contentEl) return;

    const settings = await APIClient.getSettings();
    if (!settings.api_url || !settings.api_key) {
        contentEl.innerHTML = '<div class="page-error">未偵測到 API 配置，請先在控制中心設定。</div>';
        return;
    }

    const isAdult = entry?.incognito;
    const adultLevel = entry?.adultLevel || 'suggestive';
    const charName = entry?.charName || '角色';

    const char = charProfiles.find(c => c.name === charName);
    const charId = char?.id || null;

    const context = await buildAppContext({ characterId: charId });
    const baseSystemPrompt = context.systemPrompt;

    const adultPrompt = isAdult
        ? `

你是一個模擬成人內容頁面生成器，請用繁體中文輸出條理分明的內容，模擬真實網頁的樣式。${adultLevel === 'explicit' ? '可使用露骨描述。' : '可以帶情慾氛圍但避免過度露骨。'}`
        : `

你是一個模擬網頁內容生成器，請用繁體中文輸出條理分明的內容，模擬真實網頁的樣式。`;

    const systemPrompt = baseSystemPrompt + adultPrompt;

    const userPrompt = `以「${entry.query}」為主題，生成一段模擬網頁內容。請模擬真實搜尋結果頁面，包含：
1. 頁面標題
2. 簡短描述
3. 3-5 個相關連結或段落`;

    try {
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7
            })
        });
        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '生成內容失敗。';

        contentEl.innerHTML = `
            <div class="page-result">
                <div class="page-result-content">${content.replace(/\n/g, '<br>')}</div>
            </div>
        `;
    } catch (err) {
        contentEl.innerHTML = `<div class="page-error">連線失敗：${err.message}</div>`;
    }
}

async function generateHistoryForChar(index, container) {
    const char = charProfiles[Number(index)];
    const historyList = container.querySelector('#history-list');
    const panelTitle = container.querySelector('.history-panel .panel-title');

    if (!char) {
        if (historyList) historyList.innerHTML = '<div class="status">尚無角色資料</div>';
        return;
    }

    const charName = char.name || '角色';
    const charId = char.id || null;

    if (panelTitle) {
        panelTitle.textContent = `${charName} 的瀏覽紀錄`;
    }

    if (historyList) historyList.innerHTML = '<div class="status">正在生成瀏覽紀錄...</div>';

    const settings = await APIClient.getSettings();
    if (!settings.api_url || !settings.api_key) {
        generateFallbackHistory(char, charName, '', '', container);
        return;
    }

    const adultLevel = getAdultLevel(char);

    const context = await buildAppContext({ characterId: charId });
    const baseSystemPrompt = context.systemPrompt;

    const systemPrompt = baseSystemPrompt + `

模式：無痕模式（成人向，等級：${adultLevel}）

你是一個模擬瀏覽器搜尋紀錄生成器。請根據角色的設定，生成符合該角色在無痕模式下會感興趣的成人向內容。

重要規則：
1. 搜尋內容必須符合角色的興趣和個性
2. 內容應該是角色在私密模式下會瀏覽的成人向內容
3. 可以從三個網站類型來源：nhentai（同人誌）、av.com（影片）、dreams（幻想）
4. 根據角色性格決定內容的露骨程度

請用繁體中文輸出 JSON 陣列格式，每個項目包含：
- query: 搜尋關鍵字
- title: 標題
- summary: 簡短描述（為什麼角色會搜尋這個，以角色視角描述）
- site: 網站來源（nhentai / av.com / dreams）
- time: 時間

請生成 5-8 個搜尋紀錄，直接輸出 JSON 陣列。`;

    try {
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `請為${charName}生成無痕模式下的瀏覽紀錄。` }
                ],
                temperature: 0.8
            })
        });

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '';

        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            historyEntries = parsed.map((item, i) => ({
                id: `history_${Date.now()}_${i}`,
                title: item.title || `${item.query} 相關`,
                query: item.query,
                time: item.time || `${i + 1} 小時前`,
                summary: item.summary || `瀏覽了「${item.query}」`,
                site: item.site || 'nhentai',
                incognito: true,
                adultLevel,
                charName
            }));
            saveChromeData();
            renderHistoryList(container);
        } else {
            generateFallbackHistory(char, charName, '', '', container);
        }
    } catch (err) {
        console.error('生成搜尋紀錄失敗:', err);
        generateFallbackHistory(char, charName, '', '', container);
    }
}

function generateFallbackHistory(char, charName, charPersonality, charBackground, container) {
    const adultLevel = getAdultLevel(char);
    const sites = ['nhentai', 'av.com', 'dreams'];
    const topics = ['瘚芣憤', '撟餅', '??', '??', '閫', '?萎?'];

    historyEntries = topics.slice(0, 6).map((topic, i) => {
        const site = sites[i % 3];
        return {
            id: `history_${Date.now()}_${i}`,
            title: `${topic} ?賊??批捆`,
            query: `${topic} ${site}`,
            time: `${i + 1} 撠??,
            summary: `${charName}??{site}?汗鈭?{topic}?賊??批捆`,
            site,
            incognito: true,
            adultLevel,
            charName
        };
    });

    saveChromeData();
    renderHistoryList(container);
}

async function openUserInterestSite(site, container) {
    if (!site) return;

    const settings = await APIClient.getSettings();
    if (!settings.api_url || !settings.api_key) {
        createToast('請先設定 API 才能生成內容', 'error');
        return;
    }

    switchView('history', container);
    const historyList = container.querySelector('#history-list');
    if (historyList) historyList.innerHTML = '<div class="status">正在載入內容...</div>';

    const context = await buildAppContext({});
    const baseSystemPrompt = context.systemPrompt;

    const typePrompts = {
        recommend: `根據用戶的興趣和個性，推薦他們可能感興趣的內容`,
        trending: `生成目前熱門的話題和趨勢內容`,
        fresh: `生成新穎、有趣、剛出現的新鮮事`,
        fun: `生成趣味、娛樂性的發現和內容`
    };

    const systemPrompt = baseSystemPrompt + `

內容類型：${typePrompts[site.type] || typePrompts.recommend}

你是一個模擬瀏覽器內容生成器。請根據用戶的設定，生成符合該用戶會感興趣的內容。

重要規則：
1. 內容必須符合用戶的興趣和個性
2. 內容應該多樣化，包含不同領域
3. 每個項目都要有標題和簡短描述
4. 可以包含新聞、娛樂、知識、生活等不同類型

請用繁體中文輸出 JSON 陣列格式，每個項目包含：
- title: 內容標題
- description: 簡短描述（為什麼用戶會感興趣）
- category: 分類（如：新聞、娛樂、知識、生活等）

請生成 4-6 個內容項目，直接輸出 JSON 陣列，不要其他說明。`;

    const userPrompt = `請為用戶生成${site.label}內容。`;

    try {
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.9
            })
        });

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '生成內容失敗';

        const jsonMatch = content.match(/\[[\s\S]*\]/);
        let items = [];

        if (jsonMatch) {
            try {
                items = JSON.parse(jsonMatch[0]);
            } catch (e) {
                items = [];
            }
        }

        if (items.length > 0 && historyList) {
            historyList.innerHTML = `
                <div class="incognito-content-page">
                    <div class="incognito-site-header">
                        <div class="site-icon">${site.icon}</div>
                        <div class="site-title">${site.label}</div>
                    </div>
                    <div class="interest-items">
                        ${items.map(item => `
                            <div class="interest-item">
                                <div class="interest-category">${item.category || '推薦'}</div>
                                <div class="interest-title">${escapeHTML(item.title)}</div>
                                <div class="interest-desc">${escapeHTML(item.description)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (historyList) {
            historyList.innerHTML = `
                <div class="incognito-content-page">
                    <div class="incognito-site-header">
                        <div class="site-icon">${site.icon}</div>
                        <div class="site-title">${site.label}</div>
                    </div>
                    <div class="incognito-site-content">
                        ${content.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }
    } catch (err) {
        if (historyList) historyList.innerHTML = `<div class="status error">載入失敗：${err.message}</div>`;
    }
}

async function openIncognitoSite(site, container) {
    if (!site) return;

    const settings = await APIClient.getSettings();
    if (!settings.api_url || !settings.api_key) {
        createToast('隢?閮剖? API ????批捆', 'error');
        return;
    }

    const char = charProfiles[currentCharIndex] || {};
    const charName = char.name || '閫';
    const charPersonality = char.personality || '';

    switchView('history', container);
    const historyList = container.querySelector('#history-list');
    if (historyList) historyList.innerHTML = '<div class="status">甇?頛?批捆...</div>';

    const adultLevel = getAdultLevel(char);

    const systemPrompt = `雿迤?冽瞍?{charName}嚗?隞?{charName}??閫???靘?餈啜?
雿銝?芋?祆?鈭箏摰寥??Ｙ?????脣改?${charPersonality}

隢蝜?銝剜?頛詨蝬脤??批捆嚗芋?祉?撖衣雯蝡?璅??嚗??恬?
1. 蝬脩?璅?
2. ????蝐?
3. 3-5 ?摰寥??殷?璅??陛?剜?餈堆?
4. 瘥??桅閬?隞?{charName}閬???隢???

?臭誑撣嗆??瘞?嚗???脫扳瘙箏?蝔漲??{adultLevel === 'explicit' ? '?臭誑雿輻頛撉函??膩?? : '靽??閎雿??漲?脤爸??}`;

    const userPrompt = `隢???{site.label}?雯蝡?璅⊥?批捆??
???摮?${site.query}

隢芋?砌???鈭箏?蝬脩????摰對?隞?{charName}??閫??整?{charName}甇??汗?雯蝡?隢???{charName}???????;

    try {
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.9
            })
        });

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '???批捆憭望?';

        if (historyList) {
            historyList.innerHTML = `
                <div class="incognito-content-page">
                    <div class="incognito-site-header">
                        <div class="site-icon">${site.icon}</div>
                        <div class="site-title">${site.label}</div>
                    </div>
                    <div class="incognito-site-content">
                        ${content.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }
    } catch (err) {
        if (historyList) historyList.innerHTML = `<div class="status error">頛憭望?嚗?{err.message}</div>`;
    }
}

function switchView(view, container) {
    currentView = view;
    const panels = container.querySelectorAll('.panel');
    panels.forEach(panel => {
        const match = panel.dataset.panel === view;
        panel.hidden = !match;
        panel.style.display = match ? 'block' : 'none';
    });

    const viewToggle = container.querySelector('#view-toggle');
    if (viewToggle) {
        viewToggle.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
    }
}

function toggleMode(container) {
    const next = currentMode === 'normal' ? 'incognito' : 'normal';
    currentMode = next;

    const appEl = container.querySelector('.chrome-mobile');
    const modeBtn = container.querySelector('#mode-btn');
    const statusText = container.querySelector('#status-text');
    const hero = container.querySelector('#incognito-hero');
    const normalGrid = container.querySelector('#normal-quick-grid');
    const incognitoGrid = container.querySelector('#incognito-quick-grid');

    if (appEl) appEl.dataset.mode = next;
    if (modeBtn) modeBtn.textContent = next === 'incognito' ? '銝?? : '?∠?';
    if (statusText) {
        statusText.textContent = next === 'incognito' ? '' : '銝?祆芋撘???撌脤??';
        statusText.hidden = next === 'incognito';
    }
    if (hero) hero.hidden = next !== 'incognito';
    if (normalGrid) normalGrid.hidden = next === 'incognito';
    if (incognitoGrid) incognitoGrid.hidden = next !== 'incognito';

    bindQuickTileEvents(container);
}

function bindQuickTileEvents(container) {
    const normalGrid = container.querySelector('#normal-quick-grid');
    const incognitoGrid = container.querySelector('#incognito-quick-grid');

    if (!isIncognito()) {
        const normalTiles = normalGrid?.querySelectorAll('.quick-tile');
        normalTiles?.forEach((tile, index) => {
            tile.onclick = () => {
                const site = USER_INTEREST_SITES[index];
                if (site) openUserInterestSite(site, container);
            };
        });
    } else {
        const incognitoTiles = incognitoGrid?.querySelectorAll('.quick-tile');
        incognitoTiles?.forEach((tile, index) => {
            tile.onclick = () => {
                const site = INCOGNITO_SITES[index];
                if (site) openIncognitoSite(site, container);
            };
        });
    }
}

function bindEvents(container) {
    const viewToggle = container.querySelector('#view-toggle');
    viewToggle?.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => switchView(btn.dataset.view, container);
    });

    const modeBtn = container.querySelector('#mode-btn');
    modeBtn?.addEventListener('click', () => toggleMode(container));

    const homeBack = container.querySelector('#home-back');
    homeBack?.addEventListener('click', () => {
        Router.back();
    });

    const historyRefresh = container.querySelector('#history-refresh');
    historyRefresh?.addEventListener('click', () => {
        if (isIncognito()) {
            generateHistoryForChar(currentCharIndex, container);
        }
    });

    const charSelect = container.querySelector('#char-select');
    charSelect?.addEventListener('change', () => {
        currentCharIndex = Number(charSelect.value) || 0;
        if (isIncognito()) {
            generateHistoryForChar(currentCharIndex, container);
        }
    });

    const newTabBtn = container.querySelector('#new-tab-btn');
    const historyModal = container.querySelector('#history-modal');
    const historyManual = container.querySelector('#history-manual');

    newTabBtn?.addEventListener('click', () => {
        if (isIncognito()) return;
        if (historyModal) {
            historyModal.hidden = false;
            if (historyManual) historyManual.hidden = true;
        }
    });

    const historyModalClose = container.querySelector('#history-modal-close');
    const historyModalBackdrop = container.querySelector('.history-modal-backdrop');

    historyModalClose?.addEventListener('click', () => {
        if (historyModal) historyModal.hidden = true;
    });

    historyModalBackdrop?.addEventListener('click', () => {
        if (historyModal) historyModal.hidden = true;
    });

    const historyGenerateBtn = container.querySelector('#history-generate-btn');
    historyGenerateBtn?.addEventListener('click', () => {
        if (isIncognito()) {
            generateHistoryForChar(currentCharIndex, container);
        }
        if (historyModal) historyModal.hidden = true;
    });

    const historyManualBtn = container.querySelector('#history-manual-btn');
    historyManualBtn?.addEventListener('click', () => {
        if (historyManual) historyManual.hidden = false;
    });

    const historyManualSave = container.querySelector('#history-manual-save');
    const historyManualQuery = container.querySelector('#history-manual-query');
    const historyManualSummary = container.querySelector('#history-manual-summary');

    historyManualSave?.addEventListener('click', async () => {
        const query = historyManualQuery?.value.trim();
        if (!query) return;
        const summary = historyManualSummary?.value.trim() || `??鈭?{query}???閮;
        const entry = {
            id: `history_${Date.now()}_${historyEntries.length}`,
            title: `${query} ?臭?暻潘?`,
            query,
            time: '??',
            summary,
            incognito: false,
            adultLevel: 'none'
        };
        historyEntries.unshift(entry);
        renderHistoryList(container);
        await saveChromeData();
        if (historyModal) historyModal.hidden = true;
        if (historyManualQuery) historyManualQuery.value = '';
        if (historyManualSummary) historyManualSummary.value = '';
    });

    const profileTrigger = container.querySelector('#profile-trigger');
    const profileDrawer = container.querySelector('#profile-drawer');
    const profileBackdrop = container.querySelector('#profile-backdrop');

    profileTrigger?.addEventListener('click', () => {
        if (profileDrawer) profileDrawer.classList.add('open');
        if (profileBackdrop) profileBackdrop.hidden = false;
    });

    const profileClose = container.querySelector('#profile-close');
    profileClose?.addEventListener('click', () => {
        if (profileDrawer) profileDrawer.classList.remove('open');
        if (profileBackdrop) profileBackdrop.hidden = true;
    });

    profileBackdrop?.addEventListener('click', () => {
        if (profileDrawer) profileDrawer.classList.remove('open');
        if (profileBackdrop) profileBackdrop.hidden = true;
    });

    const profileApply = container.querySelector('#profile-apply');
    const chromeUserSelect = container.querySelector('#chrome-user-select');
    const chromeWorldbookList = container.querySelector('#chrome-worldbook-list');

    profileApply?.addEventListener('click', async () => {
        if (chromeUserSelect) {
            await SettingsDB.set('chrome_user_profile', chromeUserSelect.value || '');
        }
        const selectedWorldbooks = Array.from(chromeWorldbookList?.querySelectorAll('input[type="checkbox"]:checked') || [])
            .map(input => input.value);
        await SettingsDB.set('chrome_worldbooks', JSON.stringify(selectedWorldbooks));
        if (profileDrawer) profileDrawer.classList.remove('open');
        if (profileBackdrop) profileBackdrop.hidden = true;
    });

    const addBookmarkBtn = container.querySelector('#add-bookmark-btn');
    addBookmarkBtn?.addEventListener('click', () => openBookmarkModal(container));

    const bookmarkModalClose = container.querySelector('#bookmark-modal-close');
    bookmarkModalClose?.addEventListener('click', () => closeBookmarkModal(container));

    const bookmarkModalBackdrop = container.querySelector('#bookmark-modal .history-modal-backdrop');
    bookmarkModalBackdrop?.addEventListener('click', () => closeBookmarkModal(container));

    const bookmarkSaveBtn = container.querySelector('#bookmark-save');
    bookmarkSaveBtn?.addEventListener('click', () => saveBookmark(container));

    const bookmarkSearch = container.querySelector('#bookmark-search');
    bookmarkSearch?.addEventListener('input', () => renderBookmarks(container));

    const detailBack = container.querySelector('#history-detail-back');
    detailBack?.addEventListener('click', () => switchView('history', container));
}

async function renderChrome(params) {
    const container = createElement('div', 'chrome-mobile');
    container.dataset.mode = currentMode;
    container.dataset.view = currentView;

    await Promise.all([
        loadChromeData(),
        loadCharProfiles(),
        loadWorldbookMounts()
    ]);

    container.innerHTML = `
        <header class="topbar">
            <div class="top-left">
                <button class="ghost-btn" id="home-back" title="餈?">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="view-toggle" id="view-toggle">
                    <button class="active" data-view="home">擐?</button>
                    <button data-view="bookmarks">?貊惜</button>
                    <button data-view="history">蝝??/button>
                </div>
            </div>
            <div class="top-actions">
                <button class="ghost-btn" id="mode-btn">?∠?</button>
                <button class="avatar" id="profile-trigger"></button>
            </div>
        </header>

        <div class="panel" data-panel="home">
            <div class="home-header">
                <div class="google-mark">Chrome</div>
            </div>

            <div class="incognito-hero" id="incognito-hero" hidden>
                <div class="incognito-badge">
                    <i class="fas fa-user-secret"></i>
                </div>
                <div class="incognito-title">?∠?璅∪?</div>
            </div>

            <div class="search-card">
                <i class="fas fa-search"></i>
                <input type="text" placeholder="???撓?亦雯?" id="search-input">
                <button class="icon-btn"><i class="fas fa-microphone"></i></button>
            </div>

            <div class="quick-grid" id="normal-quick-grid">
                ${USER_INTEREST_SITES.map(site => `
                    <div class="quick-tile">
                        <div class="tile-icon">${site.icon}</div>
                        <div class="tile-title">${site.label}</div>
                    </div>
                `).join('')}
            </div>

            <div class="quick-grid" id="incognito-quick-grid" hidden>
                ${INCOGNITO_SITES.map(site => `
                    <div class="quick-tile">
                        <div class="tile-icon">${site.icon}</div>
                        <div class="tile-title">${site.label}</div>
                    </div>
                `).join('')}
            </div>

            <div class="status" id="status-text">銝?祆芋撘???撌脤??</div>
        </div>

        <div class="panel bookmarks-panel" data-panel="bookmarks" hidden>
            <div class="panel-header">
                <h2 class="panel-title">?貊惜</h2>
                <button class="ghost-btn" id="add-bookmark-btn">
                    <i class="fas fa-plus"></i> ?啣?
                </button>
            </div>
            <div class="search-row">
                <i class="fas fa-search"></i>
                <input type="text" placeholder="???貊惜" id="bookmark-search">
            </div>
            <div class="bookmark-list" id="bookmark-list"></div>
        </div>

        <div class="panel history-panel" data-panel="history" hidden>
            <div class="panel-header">
                <h2 class="panel-title">?汗蝝??/h2>
            </div>
            <div class="history-controls">
                <label>閫嚗?/label>
                <select id="char-select">
                    ${charProfiles.map((char, i) => `
                        <option value="${i}">${char.name || `閫 ${i + 1}`}</option>
                    `).join('') || '<option value="">撠撱箇?閫</option>'}
                </select>
                <button class="ghost-btn" id="history-refresh">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
            <div class="history-list" id="history-list"></div>
        </div>

        <div class="panel history-detail-panel" data-panel="history-detail" hidden>
            <div class="detail-nav">
                <button class="back-btn" id="history-detail-back">
                    <i class="fas fa-chevron-left"></i> 餈?
                </button>
            </div>
            <div class="detail-search-card">
                <i class="fas fa-search"></i>
                <span class="detail-search-input" id="detail-search-query"></span>
            </div>
            <div class="detail-info">
                <div class="detail-time" id="detail-time"></div>
                <div class="detail-summary" id="detail-summary"></div>
            </div>
            <div class="detail-page-content" id="detail-page-content"></div>
        </div>

        <nav class="bottombar">
            <button class="icon-btn"><i class="fas fa-arrow-left"></i></button>
            <button class="icon-btn"><i class="fas fa-arrow-right"></i></button>
            <button class="icon-btn primary" id="new-tab-btn">
                <i class="fas fa-plus"></i>
            </button>
            <button class="icon-btn"><i class="fas fa-layer-group"></i></button>
            <button class="icon-btn"><i class="fas fa-ellipsis-h"></i></button>
        </nav>

        <div class="history-modal" id="history-modal" hidden>
            <div class="history-modal-backdrop"></div>
            <div class="history-modal-card">
                <div class="history-modal-header">
                    <div class="history-modal-title">?啣???</div>
                    <button class="icon-btn" id="history-modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="history-modal-actions">
                    <button class="ghost-btn" id="history-generate-btn">AI ??</button>
                    <button class="ghost-btn" id="history-manual-btn">??頛詨</button>
                </div>
                <div class="history-manual" id="history-manual" hidden>
                    <label>???摮?/label>
                    <input type="text" id="history-manual-query" placeholder="頛詨???摮?>
                    <label>??隤芣?</label>
                    <textarea id="history-manual-summary" rows="2" placeholder="蝪∠?膩"></textarea>
                    <button class="ghost-btn primary" id="history-manual-save">?脣?</button>
                </div>
            </div>
        </div>

        <div class="history-modal" id="bookmark-modal" hidden>
            <div class="history-modal-backdrop"></div>
            <div class="history-modal-card">
                <div class="history-modal-header">
                    <div class="history-modal-title">?啣??貊惜</div>
                    <button class="icon-btn" id="bookmark-modal-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="history-manual">
                    <label>蝬脩??迂</label>
                    <input type="text" id="bookmark-name" placeholder="蝬脩??迂">
                    <label>蝬脣?</label>
                    <input type="text" id="bookmark-url" placeholder="https://example.com">
                    <button class="ghost-btn primary" id="bookmark-save">?脣?</button>
                </div>
            </div>
        </div>

        <div class="profile-backdrop" id="profile-backdrop" hidden></div>
        <div class="profile-drawer" id="profile-drawer">
            <div class="profile-drawer-header">
                <div class="profile-drawer-title">?犖閮剖?</div>
                <button class="icon-btn" id="profile-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="profile-drawer-body">
                <div class="drawer-section">
                    <div class="drawer-label">?豢??冽</div>
                    <select class="drawer-select" id="chrome-user-select">
                        ${chromeUserProfiles.map((user, i) => `
                            <option value="${user?.name || `User ${i + 1}`}">${user?.name || `User ${i + 1}`}</option>
                        `).join('') || '<option value="">撠撱箇??冽</option>'}
                    </select>
                </div>
                <div class="drawer-section">
                    <div class="drawer-label">銝??豢?頛?/div>
                    <div class="chrome-wb-dropdown">
                        <button class="chrome-wb-toggle">
                            <span>?豢?銝???/span>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="chrome-wb-menu" id="chrome-worldbook-list">
                            ${chromeWorldbookMounts.map((wb, i) => `
                                <div class="chrome-wb-item">
                                    <input type="checkbox" value="${wb?.name || `銝???${i + 1}`}">
                                    <span>${wb?.name || `銝???${i + 1}`}</span>
                                </div>
                            `).join('') || '<div class="chrome-wb-empty">撠?舀?頛?銝???/div>'}
                        </div>
                    </div>
                </div>
                <button class="ghost-btn primary" id="profile-apply">憟閮剖?</button>
            </div>
        </div>
    `;

    bindEvents(container);
    renderBookmarks(container);

    if (historyEntries.length > 0) {
        renderHistoryList(container);
    }

    bindQuickTileEvents(container);

    return { element: container, cleanup: null };
}

export default {
    id: 'chrome',
    name: 'Chrome',
    icon: 'public',
    routes: [{ path: '/chrome', render: renderChrome }],
    navItem: { label: 'Chrome', icon: 'public', path: '/chrome', showInNav: true, order: 15 },
    stylesPath: 'js/apps/chrome/style.css'
};