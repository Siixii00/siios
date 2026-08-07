?import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';

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
    { id: 'nhentai', label: 'nhentai', icon: 'NH', query: 'nhentai ¦P¤H»x º©µe', title: 'nhentai ¦P¤H»x' },
    { id: 'av.com', label: 'av.com', icon: 'AV', query: 'av.com ¦¨¤H¼v¤ù', title: 'av.com ¼v¤ù' },
    { id: 'dreams', label: 'dreams', icon: 'DR', query: 'dreams ¹Ú¹Ò ¤Û·Q', title: 'dreams ¤Û·Q¥@¬É' }
];

const USER_INTEREST_SITES = [
    { id: 'user-interest-0', label: '¬°§A±ÀÂË', icon: '±À', type: 'recommend' },
    { id: 'user-interest-1', label: '¼öªù¤º®e', icon: '¼ö', type: 'trending' },
    { id: 'user-interest-2', label: '·sÂA¨Æ', icon: '·s', type: 'fresh' },
    { id: 'user-interest-3', label: '½ì¨ıµo²{', icon: '½ì', type: 'fun' }
];

const ADULT_EXPLICIT_KEYWORDS = ['¦¨¦~', '¤¤¦~', '¤j¨û', '©j©j', '¤H©d', '¦¨¼ô', '±¡¼¤', '¦¨¤H', '18+', 'AV', '±¡¦â', '¤Ø«×', '¼¤±æ', '©ñÁa', '¿E±¡'];

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
        console.error('ä¿å?Chrome?¸æ?å¤±æ?:', e);
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
        list.innerHTML = '`<div class=`'`chrome-wb-empty`'`>å°šæœª?°å??¸ç±¤</div>`';
        return;
    }

    list.innerHTML = filtered.map((b, i) => `
        <div class='bookmark-item' data-index='${i}'>
            <div class='left'>
                <i class='fas fa-globe'></i>
                <span>${escapeHTML(b.name)}</span>
            </div>
            <div class='bookmark-actions'>
                <button class='icon-btn sm bookmark-open' data-url='${escapeHTML(b.url)}' title='?‹å?'>
                    <i class='fas fa-external-link-alt'></i>
                </button>
                <button class='icon-btn sm bookmark-delete' data-index='${i}' title='?ªé™¤'>
                    <i class='fas fa-trash'></i>
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
        createToast('è«‹è¼¸?¥ç¶²ç«™å?ç¨±å?ç¶²å?', 'error');
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
        list.innerHTML = '`<div class=`'`status`'`>©|µLÂsÄı°O¿ı</div>`';
        return;
    }

    list.innerHTML = historyEntries.map(entry => `
        <div class='history-item' data-id='${entry.id}'>
            <div class='history-item-icon'>
                <i class='fas fa-search'></i>
            </div>
            <div class='history-item-content'>
                <div class='title'>${escapeHTML(entry.title)}</div>
                <div class='meta'>${entry.site ? `[${entry.site}] ` : ''}${entry.time}</div>
            </div>
            <div class='history-item-arrow'>
                <i class='fas fa-chevron-right'></i>
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
            <div class='page-loading'>
                <div class='loading-spinner'></div>
                <span>æ­?œ¨è¼‰å…¥?é¢...</span>
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
        contentEl.innerHTML = '`<div class=`'`page-error`'`>¥¼°»´ú¨ì API °t¸m¡A½Ğ¥ı¦b±±¨î¤¤¤ß³]©w¡C</div>`';
        return;
    }

    const isAdult = entry?.incognito;
    const adultLevel = entry?.adultLevel || 'suggestive';
    const charName = entry?.charName || '¨¤¦â';

    const char = charProfiles.find(c => c.name === charName);
    const charId = char?.id || null;

    const context = await buildAppContext({ characterId: charId });
    const baseSystemPrompt = context.systemPrompt;

    const adultPrompt = isAdult
        ? `

§A¬O¤@­Ó¼ÒÀÀ¦¨¤H¤º®e­¶­±¥Í¦¨¾¹¡A½Ğ¥ÎÁcÅé¤¤¤å¿é¥X±ø²z¤À©úªº¤º®e¡A¼ÒÀÀ¯u¹êºô­¶ªº¼Ë¦¡¡C${adultLevel === 'explicit' ? '¥i¨Ï¥ÎÅS°©´y­z¡C' : '¥i¥H±a±¡¼¤ª^³ò¦ıÁ×§K¹L«×ÅS°©¡C'}`
        : `

§A¬O¤@­Ó¼ÒÀÀºô­¶¤º®e¥Í¦¨¾¹¡A½Ğ¥ÎÁcÅé¤¤¤å¿é¥X±ø²z¤À©úªº¤º®e¡A¼ÒÀÀ¯u¹êºô­¶ªº¼Ë¦¡¡C`;

    const systemPrompt = baseSystemPrompt + adultPrompt;

    const userPrompt = `¥H¡u${entry.query}¡v¬°¥DÃD¡A¥Í¦¨¤@¬q¼ÒÀÀºô­¶¤º®e¡C½Ğ¼ÒÀÀ¯u¹ê·j´Mµ²ªG­¶­±¡A¥]§t¡G
1. ­¶­±¼ĞÃD
2. Â²µu´y­z
3. 3-5 ­Ó¬ÛÃö³sµ²©Î¬q¸¨`;

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
        const content = data?.choices?.[0]?.message?.content || '¥Í¦¨¤º®e¥¢±Ñ¡C';

        contentEl.innerHTML = `
            <div class='page-result'>
                <div class='page-result-content'>${content.replace(/\n/g, '<br>')}</div>
            </div>
        `;
    } catch (err) {
        contentEl.innerHTML = `<div class='page-error'>³s½u¥¢±Ñ¡G${err.message}</div>`;
    }
}

async function generateHistoryForChar(index, container) {
    const char = charProfiles[Number(index)];
    const historyList = container.querySelector('#history-list');
    const panelTitle = container.querySelector('.history-panel .panel-title');

    if (!char) {
        if (historyList) historyList.innerHTML = '`<div class=`'`status`'`>©|µL¨¤¦â¸ê®Æ</div>`';
        return;
    }

    const charName = char.name || '¨¤¦â';
    const charId = char.id || null;

    if (panelTitle) {
        panelTitle.textContent = `${charName} ªºÂsÄı¬ö¿ı`;
    }

    if (historyList) historyList.innerHTML = '`<div class=`'`status`'`>¥¿¦b¥Í¦¨ÂsÄı¬ö¿ı...</div>`';

    const settings = await APIClient.getSettings();
    if (!settings.api_url || !settings.api_key) {
        generateFallbackHistory(char, charName, '', '', container);
        return;
    }

    const adultLevel = getAdultLevel(char);

    const context = await buildAppContext({ characterId: charId });
    const baseSystemPrompt = context.systemPrompt;

    const systemPrompt = baseSystemPrompt + `

¼Ò¦¡¡GµL²ª¼Ò¦¡¡]¦¨¤H¦V¡Aµ¥¯Å¡G${adultLevel}¡^

§A¬O¤@­Ó¼ÒÀÀÂsÄı¾¹·j´M¬ö¿ı¥Í¦¨¾¹¡C½Ğ®Ú¾Ú¨¤¦âªº³]©w¡A¥Í¦¨²Å¦X¸Ó¨¤¦â¦bµL²ª¼Ò¦¡¤U·|·P¿³½ìªº¦¨¤H¦V¤º®e¡C

­«­n³W«h¡G
1. ·j´M¤º®e¥²¶·²Å¦X¨¤¦âªº¿³½ì©M­Ó©Ê
2. ¤º®eÀ³¸Ó¬O¨¤¦â¦b¨p±K¼Ò¦¡¤U·|ÂsÄıªº¦¨¤H¦V¤º®e
3. ¥i¥H±q¤T­Óºô¯¸Ãş«¬¨Ó·½¡Gnhentai¡]¦P¤H»x¡^¡Bav.com¡]¼v¤ù¡^¡Bdreams¡]¤Û·Q¡^
4. ®Ú¾Ú¨¤¦â©Ê®æ¨M©w¤º®eªºÅS°©µ{«×

½Ğ¥ÎÁcÅé¤¤¤å¿é¥X JSON °}¦C®æ¦¡¡A¨C­Ó¶µ¥Ø¥]§t¡G
- query: ·j´MÃöÁä¦r
- title: ¼ĞÃD
- summary: Â²µu´y­z¡]¬°¤°»ò¨¤¦â·|·j´M³o­Ó¡A¥H¨¤¦âµø¨¤´y­z¡^
- site: ºô¯¸¨Ó·½¡]nhentai / av.com / dreams¡^
- time: ®É¶¡

½Ğ¥Í¦¨ 5-8 ­Ó·j´M¬ö¿ı¡Aª½±µ¿é¥X JSON °}¦C¡C`;

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
                    { role: 'user', content: `½Ğ¬°${charName}¥Í¦¨µL²ª¼Ò¦¡¤UªºÂsÄı¬ö¿ı¡C` }
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
                title: item.title || `${item.query} ¬ÛÃö`,
                query: item.query,
                time: item.time || `${i + 1} ¤p®É«e`,
                summary: item.summary || `ÂsÄı¤F¡u${item.query}¡v`,
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
        console.error('¥Í¦¨·j´M¬ö¿ı¥¢±Ñ:', err);
        generateFallbackHistory(char, charName, '', '', container);
    }
}

function generateFallbackHistory(char, charName, charPersonality, charBackground, container) {
    const adultLevel = getAdultLevel(char);
    const sites = ['nhentai', 'av.com', 'dreams'];
    const topics = ['®öº©', '¤Û·Q', '¬G¨Æ', 'ÃÀ³N', '¨¤¦â', '³Ğ§@'];

    historyEntries = topics.slice(0, 6).map((topic, i) => {
        const site = sites[i % 3];
        return {
            id: `history_${Date.now()}_${i}`,
            title: `${topic} ¬ÛÃö¤º®e`,
            query: `${topic} ${site}`,
            time: `${i + 1} ¤p®É«e`,
            summary: `${charName}¦b${site}ÂsÄı¤F${topic}¬ÛÃö¤º®e`,
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
        createToast('½Ğ¥ı³]©w API ¤~¯à¥Í¦¨¤º®e', 'error');
        return;
    }

    switchView('history', container);
    const historyList = container.querySelector('#history-list');
    if (historyList) historyList.innerHTML = '`<div class=`'`status`'`>¥¿¦b¸ü¤J¤º®e...</div>`';

    const context = await buildAppContext({});
    const baseSystemPrompt = context.systemPrompt;

    const typePrompts = {
        recommend: `®Ú¾Ú¥Î¤áªº¿³½ì©M­Ó©Ê¡A±ÀÂË¥L­Ì¥i¯à·P¿³½ìªº¤º®e`,
        trending: `¥Í¦¨¥Ø«e¼öªùªº¸ÜÃD©MÁÍ¶Õ¤º®e`,
        fresh: `¥Í¦¨·s¿o¡B¦³½ì¡B­è¥X²{ªº·sÂA¨Æ`,
        fun: `¥Í¦¨½ì¨ı¡B®T¼Ö©Êªºµo²{©M¤º®e`
    };

    const systemPrompt = baseSystemPrompt + `

¤º®eÃş«¬¡G${typePrompts[site.type] || typePrompts.recommend}

§A¬O¤@­Ó¼ÒÀÀÂsÄı¾¹¤º®e¥Í¦¨¾¹¡C½Ğ®Ú¾Ú¥Î¤áªº³]©w¡A¥Í¦¨²Å¦X¸Ó¥Î¤á·|·P¿³½ìªº¤º®e¡C

­«­n³W«h¡G
1. ¤º®e¥²¶·²Å¦X¥Î¤áªº¿³½ì©M­Ó©Ê
2. ¤º®eÀ³¸Ó¦h¼Ë¤Æ¡A¥]§t¤£¦P»â°ì
3. ¨C­Ó¶µ¥Ø³£­n¦³¼ĞÃD©MÂ²µu´y­z
4. ¥i¥H¥]§t·s»D¡B®T¼Ö¡Bª¾ÃÑ¡B¥Í¬¡µ¥¤£¦PÃş«¬

½Ğ¥ÎÁcÅé¤¤¤å¿é¥X JSON °}¦C®æ¦¡¡A¨C­Ó¶µ¥Ø¥]§t¡G
- title: ¤º®e¼ĞÃD
- description: Â²µu´y­z¡]¬°¤°»ò¥Î¤á·|·P¿³½ì¡^
- category: ¤ÀÃş¡]¦p¡G·s»D¡B®T¼Ö¡Bª¾ÃÑ¡B¥Í¬¡µ¥¡^

½Ğ¥Í¦¨ 4-6 ­Ó¤º®e¶µ¥Ø¡Aª½±µ¿é¥X JSON °}¦C¡A¤£­n¨ä¥L»¡©ú¡C`;

    const userPrompt = `½Ğ¬°¥Î¤á¥Í¦¨${site.label}¤º®e¡C`;

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
        const content = data?.choices?.[0]?.message?.content || '¥Í¦¨¤º®e¥¢±Ñ';

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
                <div class='incognito-content-page'>
                    <div class='incognito-site-header'>
                        <div class='site-icon'>${site.icon}</div>
                        <div class='site-title'>${site.label}</div>
                    </div>
                    <div class='interest-items'>
                        ${items.map(item => `
                            <div class='interest-item'>
                                <div class='interest-category'>${item.category || '±ÀÂË'}</div>
                                <div class='interest-title'>${escapeHTML(item.title)}</div>
                                <div class='interest-desc'>${escapeHTML(item.description)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else if (historyList) {
            historyList.innerHTML = `
                <div class='incognito-content-page'>
                    <div class='incognito-site-header'>
                        <div class='site-icon'>${site.icon}</div>
                        <div class='site-title'>${site.label}</div>
                    </div>
                    <div class='incognito-site-content'>
                        ${content.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }
    } catch (err) {
        if (historyList) historyList.innerHTML = `<div class='status error'>¸ü¤J¥¢±Ñ¡G${err.message}</div>`;
    }
}

async function openIncognitoSite(site, container) {
    if (!site) return;

    const settings = await APIClient.getSettings();
    if (!settings.api_url || !settings.api_key) {
        createToast('½Ğ¥ı³]©w API ¤~¯à¥Í¦¨¤º®e', 'error');
        return;
    }

    const char = charProfiles[currentCharIndex] || {};
    const charName = char.name || '¨¤¦â';
    const charId = char?.id || null;

    switchView('history', container);
    const historyList = container.querySelector('#history-list');
    if (historyList) historyList.innerHTML = '`<div class=`'`status`'`>¥¿¦b¸ü¤J¤º®e...</div>`';

    const adultLevel = getAdultLevel(char);

    const context = await buildAppContext({ characterId: charId });
    const baseSystemPrompt = context.systemPrompt;

    const systemPrompt = baseSystemPrompt + `

§A¬O¤@­Ó¼ÒÀÀ¦¨¤H¤º®e­¶­±¥Í¦¨¾¹¡C
¼Ò¦¡¡GµL²ª¼Ò¦¡¡]¦¨¤H¦V¡Aµ¥¯Å¡G${adultLevel}¡^

½Ğ¥ÎÁcÅé¤¤¤å¿é¥Xºô­¶¤º®e¡A¼ÒÀÀ¯u¹êºô¯¸ªº¼Ë¦¡¡A¥]§t¡G
1. ºô¯¸¼ĞÃD
2. ¤ÀÃş©Î¼ĞÅÒ
3. 3-5 ­Ó¤º®e¶µ¥Ø¡]¼ĞÃD©MÂ²µu´y­z¡^
4. ¨C­Ó¶µ¥Ø³£­n¦³¥H${charName}µø¨¤ªºµû½×©Î·P¨ü

¥i¥H±a¦³±¡¼¤ª^³ò¡A®Ú¾Ú¨¤¦â©Ê®æ¨M©wµ{«×¡C${adultLevel === 'explicit' ? '¥i¥H¨Ï¥Î¸ûÅS°©ªº´y­z¡C' : '«O«ù±¡½ì¦ı¤£¹L«×ÅS°©¡C'}`;

    const userPrompt = `½Ğ¥Í¦¨¡u${site.label}¡vºô¯¸ªº¼ÒÀÀ¤º®e¡C
·j´MÃöÁä¦r¡G${site.query}

½Ğ¼ÒÀÀ¤@­Ó¦¨¤H¦Vºô¯¸ªº­º­¶¤º®e¡A¥H${charName}ªºµø¨¤§e²{¡C${charName}¥¿¦bÂsÄı³o­Óºô¯¸¡A½Ğ®i²{${charName}ªº¤ÏÀ³©M·P¨ü¡C`;
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
        const content = data?.choices?.[0]?.message?.content || 'µLªk¸ü¤J¤º®e';

        if (historyList) {
            historyList.innerHTML = `
                <div class='incognito-content-page'>
                    <div class='incognito-site-header'>
                        <div class='site-icon'>${site.icon}</div>
                        <div class='site-title'>${site.label}</div>
                    </div>
                    <div class='incognito-site-content'>
                        ${content.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }

        // Save interaction memory
        if (charId) {
            await saveInteractionMemory({
                characterId: charId,
                sourceApp: 'chrome',
                sourceType: 'interaction',
                sourceSubtype: 'browsing',
                content: `¦bµL²ª¼Ò¦¡ÂsÄı ${site?.label || 'ºô¯¸'}`,
                metaContent: `¦b Chrome µL²ª¼Ò¦¡»P¥Î¤á¤@°_ÂsÄı¤F ${site?.label || 'ºô¯¸'}`,
                fullContent: content,
                theaterIds: [],
                isFiction: false,
                importance: 0.5
            });
        }
    } catch (err) {
        if (historyList) historyList.innerHTML = `<div class='status error'>¸ü¤J¥¢±Ñ¡G${err.message}</div>`;
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
    if (modeBtn) modeBtn.textContent = next === 'incognito' ? 'µL²ª' : '´¶³q';
    if (statusText) {
        statusText.textContent = next === 'incognito' ? '' : '¤@¯ë¼Ò¦¡¡A¤wÃö³¬µL²ª¼Ò¦¡';
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
        const summary = historyManualSummary?.value.trim() || `·j´MÃö©ó ${query} ªº¤º®e`;
        const entry = {
            id: `history_${Date.now()}_${historyEntries.length}`,
            title: `${query} ?¯ä?éº¼ï?`,
            query,
            time: '?›å?',
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
        const selectedWorldbooks = Array.from(chromeWorldbookList?.querySelectorAll('input[type='checkbox']:checked') || [])
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
        <header class='topbar'>
            <div class='top-left'>
                <button class='ghost-btn' id='home-back' title='è¿”å?'>
                    <i class='fas fa-chevron-left'></i>
                </button>
                <div class='view-toggle' id='view-toggle'>
                    <button class='active' data-view='home'>é¦–é?</button>
                    <button data-view='bookmarks'>?¸ç±¤</button>
                    <button data-view='history'>¾ú¥v</button>
                </div>
            </div>
            <div class='top-actions'>
                <button class='ghost-btn' id='mode-btn'>?¡ç?</button>
                <button class='avatar' id='profile-trigger'></button>
            </div>
        </header>

        <div class='panel' data-panel='home'>
            <div class='home-header'>
                <div class='google-mark'>Chrome</div>
            </div>

            <div class='incognito-hero' id='incognito-hero' hidden>
                <div class='incognito-badge'>
                    <i class='fas fa-user-secret'></i>
                </div>
                <div class='incognito-title'>?¡ç?æ¨¡å?</div>
            </div>

            <div class='search-card'>
                <i class='fas fa-search'></i>
                <input type='text' placeholder='·j´Mºô§}©ÎÃöÁä¦r' id='search-input'>
                <button class='icon-btn'><i class='fas fa-microphone'></i></button>
            </div>

            <div class='quick-grid' id='normal-quick-grid'>
                ${USER_INTEREST_SITES.map(site => `
                    <div class='quick-tile'>
                        <div class='tile-icon'>${site.icon}</div>
                        <div class='tile-title'>${site.label}</div>
                    </div>
                `).join('')}
            </div>

            <div class='quick-grid' id='incognito-quick-grid' hidden>
                ${INCOGNITO_SITES.map(site => `
                    <div class='quick-tile'>
                        <div class='tile-icon'>${site.icon}</div>
                        <div class='tile-title'>${site.label}</div>
                    </div>
                `).join('')}
            </div>

            <div class='status' id='status-text'>¤@¯ë¼Ò¦¡¡A¤wÃö³¬µL²ª¼Ò¦¡</div>
        </div>

        <div class='panel bookmarks-panel' data-panel='bookmarks' hidden>
            <div class='panel-header'>
                <h2 class='panel-title'>?¸ç±¤</h2>
                <button class='ghost-btn' id='add-bookmark-btn'>
                    <i class='fas fa-plus'></i> ?°å?
                </button>
            </div>
            <div class='search-row'>
                <i class='fas fa-search'></i>
                <input type='text' placeholder='?œå??¸ç±¤' id='bookmark-search'>
            </div>
            <div class='bookmark-list' id='bookmark-list'></div>
        </div>

        <div class='panel history-panel' data-panel='history' hidden>
            <div class='panel-header'>
                <h2 class='panel-title'>ÂsÄı¾ú¥v</h2>
            </div>
            <div class='history-controls'>
                <label>è§’è‰²ï¼?/label>
                <select id='char-select'>
                    ${charProfiles.map((char, i) => `
                        <option value='${i}'>${char.name || `è§’è‰² ${i + 1}`}</option>
                    `).join('') || '<option value=''>å°šæœªå»ºç?è§’è‰²</option>'}
                </select>
                <button class='ghost-btn' id='history-refresh'>
                    <i class='fas fa-sync-alt'></i>
                </button>
            </div>
            <div class='history-list' id='history-list'></div>
        </div>

        <div class='panel history-detail-panel' data-panel='history-detail' hidden>
            <div class='detail-nav'>
                <button class='back-btn' id='history-detail-back'>
                    <i class='fas fa-chevron-left'></i> è¿”å?
                </button>
            </div>
            <div class='detail-search-card'>
                <i class='fas fa-search'></i>
                <span class='detail-search-input' id='detail-search-query'></span>
            </div>
            <div class='detail-info'>
                <div class='detail-time' id='detail-time'></div>
                <div class='detail-summary' id='detail-summary'></div>
            </div>
            <div class='detail-page-content' id='detail-page-content'></div>
        </div>

        <nav class='bottombar'>
            <button class='icon-btn'><i class='fas fa-arrow-left'></i></button>
            <button class='icon-btn'><i class='fas fa-arrow-right'></i></button>
            <button class='icon-btn primary' id='new-tab-btn'>
                <i class='fas fa-plus'></i>
            </button>
            <button class='icon-btn'><i class='fas fa-layer-group'></i></button>
            <button class='icon-btn'><i class='fas fa-ellipsis-h'></i></button>
        </nav>

        <div class='history-modal' id='history-modal' hidden>
            <div class='history-modal-backdrop'></div>
            <div class='history-modal-card'>
                <div class='history-modal-header'>
                    <div class='history-modal-title'>?°å??†é?</div>
                    <button class='icon-btn' id='history-modal-close'>
                        <i class='fas fa-times'></i>
                    </button>
                </div>
                <div class='history-modal-actions'>
                    <button class='ghost-btn' id='history-generate-btn'>AI ?Ÿæ?</button>
                    <button class='ghost-btn' id='history-manual-btn'>?‹å?è¼¸å…¥</button>
                </div>
                <div class='history-manual' id='history-manual' hidden>
                    <label>?œå??œéµå­?/label>
                    <input type='text' id='history-manual-query' placeholder='è¼¸å…¥?œå??œéµå­?>
                    <label>?˜è?èªªæ?</label>
                    <textarea id='history-manual-summary' rows='2' placeholder='ç°¡çŸ­?è¿°'></textarea>
                    <button class='ghost-btn primary' id='history-manual-save'>?²å?</button>
                </div>
            </div>
        </div>

        <div class='history-modal' id='bookmark-modal' hidden>
            <div class='history-modal-backdrop'></div>
            <div class='history-modal-card'>
                <div class='history-modal-header'>
                    <div class='history-modal-title'>?°å??¸ç±¤</div>
                    <button class='icon-btn' id='bookmark-modal-close'>
                        <i class='fas fa-times'></i>
                    </button>
                </div>
                <div class='history-manual'>
                    <label>ç¶²ç??ç¨±</label>
                    <input type='text' id='bookmark-name' placeholder='ç¶²ç??ç¨±'>
                    <label>ç¶²å?</label>
                    <input type='text' id='bookmark-url' placeholder='https://example.com'>
                    <button class='ghost-btn primary' id='bookmark-save'>?²å?</button>
                </div>
            </div>
        </div>

        <div class='profile-backdrop' id='profile-backdrop' hidden></div>
        <div class='profile-drawer' id='profile-drawer'>
            <div class='profile-drawer-header'>
                <div class='profile-drawer-title'>?‹äººè¨­å?</div>
                <button class='icon-btn' id='profile-close'>
                    <i class='fas fa-times'></i>
                </button>
            </div>
            <div class='profile-drawer-body'>
                <div class='drawer-section'>
                    <div class='drawer-label'>?¸æ??¨æˆ¶</div>
                    <select class='drawer-select' id='chrome-user-select'>
                        ${chromeUserProfiles.map((user, i) => `
                            <option value='${user?.name || `User ${i + 1}`}'>${user?.name || `User ${i + 1}`}</option>
                        `).join('') || '<option value=''>å°šæœªå»ºç??¨æˆ¶</option>'}
                    </select>
                </div>
                <div class='drawer-section'>
                    <div class='drawer-label'>ä¸–ç??¸æ?è¼?/div>
                    <div class='chrome-wb-dropdown'>
                        <button class='chrome-wb-toggle'>
                            <span>?¸æ?ä¸–ç???/span>
                            <i class='fas fa-chevron-down'></i>
                        </button>
                        <div class='chrome-wb-menu' id='chrome-worldbook-list'>
                            ${chromeWorldbookMounts.map((wb, i) => `
                                <div class='chrome-wb-item'>
                                    <input type='checkbox' value='${wb?.name || `ä¸–ç???${i + 1}`}'>
                                    <span>${wb?.name || `ä¸–ç???${i + 1}`}</span>
                                </div>
                            `).join('') || '<div class='chrome-wb-empty'>å°šç„¡?¯æ?è¼‰ç?ä¸–ç???/div>'}
                        </div>
                    </div>
                </div>
                <button class='ghost-btn primary' id='profile-apply'>å¥—ç”¨è¨­å?</button>
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
