import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';

const ratingMap = {
    G: 'General Audiences',
    T: 'Teen & Up',
    M: 'Mature',
    E: 'Explicit',
    NR: 'Not Rated'
};

const worldSettings = [
    { title: 'ABO 設定', desc: 'Alpha/Beta/Omega 三種第二性別，基於信息素與生理本能的階級社會。包含標記、發情期、成結等機制。', tags: ['ABO', '世界觀'] },
    { title: '哨兵嚮導', desc: '感官極端敏銳的哨兵與精神力量強大的嚮導。包含精神體、精神圖景、結合等設定。', tags: ['哨兵嚮導', '世界觀'] },
    { title: '哈利波特', desc: '隱藏在現代倫敦之下的魔法世界。霍格華茲學院制、魔杖、血統歧視與黑魔法防禦。', tags: ['HP', '魔法校園'] },
    { title: '日式高中校園', desc: '青春曖昧的校園生活。學長姐制度、社團活動、文化祭、屋頂告白。', tags: ['校園', '青春'] },
    { title: '美國大學生活', desc: '兄弟會姊妹會文化、派對、校園運動賽事、宿舍生活與獨立探索。', tags: ['大學', '美式'] },
    { title: '辦公室職場', desc: '權力等級與禁止戀愛的辦公室。上下級關係、茶水間八卦、加班與秘密戀情。', tags: ['職場', '辦公室'] },
    { title: '韓國 Idol', desc: '華麗舞臺背後的殘酷。練習生制度、戀愛禁令、宿舍生活與私生飯困擾。', tags: ['K-Pop', '偶像'] },
    { title: '現代搖滾樂團', desc: '叛逆與夢想的音樂世界。地下Live House、巡迴旅程、成員間的羈絆與矛盾。', tags: ['樂團', '搖滾'] },
    { title: '歐洲中世紀宮廷', desc: '繁文縟節下的權力鬥爭。貴族等級、政治聯姻、舞會密謀與騎士精神。', tags: ['中世紀', '宮廷'] },
    { title: '靈魂伴侶設定', desc: '每個人出生時就註定有一個完美的另一半。色盲模式、文字標記、傷痕共享、倒計時等表現形式。', tags: ['Soulmate', '宿命'] },
    { title: '花吐症', desc: '單戀時肺部會生長出花朵，隨咳嗽吐出花瓣。唯有對方的愛能治癒，或手術移除但失去愛意。', tags: ['花吐症', '虐心'] },
    { title: '賽博龐克', desc: '高科技但腐敗的未來世界。義體改造、神經連接、企業高層與底層傭兵的階級對立。', tags: ['賽博龐克', '科幻'] },
    { title: '無限流', desc: '被拉入神秘副本，必須遵守特定規則才能生存。生存壓力下的信任與依賴。', tags: ['無限流', '生存'] },
    { title: '荒島求生', desc: '文明毀滅後的世界或受困無人地帶。物資匱乏、高度依賴、在絕望中建立小小樂園。', tags: ['末世', '求生'] },
    { title: '修仙世界', desc: '修煉成仙的奇幻世界。宗門、靈根、渡劫、師徒關係與千年羈絆。', tags: ['修仙', '仙俠'] },
    { title: '武林江湖', desc: '俠義與恩怨的武俠世界。門派紛紛爭、絕世武功、復仇與救贖。', tags: ['武俠', '江湖'] }
];

const interactionTropes = [
    { title: '重逢', desc: '多年後再次相遇，彼此都變了卻又沒變。', tags: ['重逢', '情感'] },
    { title: '誤會解開', desc: '一直以來的誤會終於解開，但似乎太遲了。', tags: ['誤會', '虐心'] },
    { title: '雨中', desc: '下雨天的偶遇，改變了兩個人的命運。', tags: ['雨', '浪漫'] },
    { title: '告白', desc: '終於鼓起勇氣說出心意。', tags: ['告白', '甜'] },
    { title: '分離', desc: '不得不分開，但約定會再見。', tags: ['分離', '約定'] },
    { title: '守護', desc: '默默守護在身邊，不求回報。', tags: ['守護', '暗戀'] },
    { title: '回憶', desc: '回憶起過去的點點滴滴。', tags: ['回憶', '過去'] },
    { title: '契約關係', desc: '因利益被迫假扮情侶或夫妻。同居生活、公眾演出，日久生情的甜蜜過程。', tags: ['假戲真做', '契約'] },
    { title: '死對頭', desc: '雙方處於完全對立的立場。針鋒相對的張力、被迫合作時的時的糾結、隱藏的吸引力。', tags: ['宿敵', '對立'] },
    { title: '嚮往平凡的怪物', desc: '非人類（AI、吸血鬼、外星人、人魚）試圖理解人類情感。跨物種的溝通障礙與笨拙溫情。', tags: ['非人類', '跨物種'] },
    { title: '身體互換', desc: '因意外或詛咒交換靈魂/身體。必須代替對方生活，發現隱藏的秘密與傷痛。', tags: ['身體互換', '靈魂'] },
    { title: '只有一張床', desc: '旅店客滿或受困避難所，只剩一個房間一張床。誰睡地板？還是擠在一起？', tags: ['被迫近距離', '一張床'] },
    { title: '狹小空間受困', desc: '電梯故障、躲避敵人的衣櫃、狹窄巷弄。必須緊貼對方，感受呼吸、心跳與體溫。', tags: ['被迫近距離', '密閉空間'] },
    { title: '取暖', desc: '暴風雪受困、掉入冰冷湖水。為了生存必須緊擁傳遞體溫，從生存本能轉化為性張力。', tags: ['被迫近距離', '生存'] },
    { title: '誰弄傷你的', desc: '一方受傷回來，另一方雖平時冷淡，看到傷口瞬間暴怒或極度心疼。包紮傷口的細膩與佔有欲。', tags: ['照顧', '保護欲'] },
    { title: '病弱照顧', desc: '發高燒、意識模糊，平時強勢的角色變得像小孩一樣依樣依賴。餵藥、擦汗、半夢半醒間的真情流露。', tags: ['照顧', '脆弱'] },
    { title: '噩夢與安撫', desc: '深夜因創傷驚醒。另一方給予擁抱、摸頭、輕聲安慰，展現只給對方的柔軟面。', tags: ['照顧', '安撫'] },
    { title: '酒後吐真言', desc: '微醺或大醉。平時不敢說的話、不敢做的親暱行為全都爆發。隔天醒來後的尷尬期。', tags: ['失控', '告白'] },
    { title: '真言劑/詛咒', desc: '被迫必須說真話，或必須進行親密舉動才能解除的詛咒。拼命忍耐但最終失敗的掙扎感。', tags: ['失控', '魔法'] },
    { title: '那個「噢」的時刻', desc: '好友或死對頭在某個平凡瞬間（如陽光下回頭一笑），突然意識到：「糟了，我愛上他了。」', tags: ['失控', '覺醒'] },
    { title: '手把手教學', desc: '教射箭、鋼琴、撞球、寫字。從背後環繞的姿勢，手掌覆蓋在手背上，耳邊的低聲指導。', tags: ['肢體張力', '教學'] },
    { title: '整理衣物', desc: '出席正式場合前，幫對方打領帶、翻領子、撥開額前碎髮。極近距離的眼神交織，呼吸交錯。', tags: ['肢體張力', '親密'] },
    { title: '身高差/體型差', desc: '拿不到高處東西、衣服太過寬大。高的一方從後方幫忙拿東西，或一方穿著另一方寬大的襯衫。', tags: ['肢體張力', '體型差'] },
    { title: '雙向暗戀', desc: '兩個人都覺得對方不喜歡自己，都在瘋狂試探。刻意避開的眼神、對他人接近的微小嫉妒。', tags: ['暗潮洶湧', '暗戀'] },
    { title: '秘密盟友', desc: '眾人面前裝作不熟或敵對，私底下卻有深厚聯繫。桌子底下的勾腳、只有兩人懂的暗號。', tags: ['暗潮洶湧', '秘密'] },
    { title: '年上年下', desc: '年齡差距帶來的權力不對等。年長者的照顧與佔有、年下者的成長與反擊。', tags: ['年齡差', '權力'] },
    { title: '師生關係', desc: '禁忌的師生之戀。知識傳承中的情感滋長，道德與慾望的掙扎。', tags: ['師生', '禁忌'] },
    { title: '青梅竹馬', desc: '從小一起長大，最了解彼此的人。但友情何時變成愛情？', tags: ['青梅竹馬', '甜'] },
    { title: '一見鍾情', desc: '第一眼就確定是那個人了。從此展開瘋狂追求或默默暗戀。', tags: ['一見鍾情', '甜'] },
    { title: '破鏡重圓', desc: '曾經分手，現在重新開始。傷痕還在，但願意再試一次。', tags: ['破鏡重圓', '虐甜'] }
];

const languageOptions = [
    { code: 'en', label: 'English' },
    { code: 'zh-Hant', label: '繁體中文' },
    { code: 'zh-Hans', label: '简体中文' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'th', label: 'ไทย' },
    { code: 'ru', label: 'Русский' }
];

const tagLimits = {
    fandom: 20,
    relationship: 30,
    characters: 50,
    additional: 60
};

const snippetLibrary = {
    fluff: [
        '{PAIRING} find themselves lingering under {SETTING}, trading soft jokes until the language barrier dissolves into laughter.',
        'In {FANDOM}, {PAIRING} write on napkins, swapping translations of their favorite lyrics before the morning rush returns.'
    ],
    angst: [
        '{PAIRING} hear the last train depart {SETTING}, each syllable of goodbye falling in a different language.',
        'The confession arrives as a voicemail where {CHAR} cycles through English, Mandarin, and shaky Japanese just to say they are sorry.'
    ],
    action: [
        '{CHAR} switches comm-channels mid-fight, barking orders in English, Korean, then Spanish as the mission in {FANDOM} spirals.',
        'Sirens paint the harbor red while {PAIRING} trade cover-fire and code words, translating strategy on the fly.'
    ],
    hurt: [
        '{PAIRING} patch wounds beside the galley sink, writing 「你還好嗎？」 next to "Are you okay?" on gauze tape.',
        '{CHAR} reads every language tag scrawled across the hospital flowers, wondering which one will finally make them stay.'
    ]
};

let state = {
    tags: { fandom: [], relationship: [], characters: [], additional: [] },
    languages: [],
    drafts: [],
    selectedTropes: [],
    selectedCharacters: [],
    selectedWorldSettings: [],
    statusTimer: null
};

function getLanguageLabel(code) {
    return languageOptions.find(item => item.code === code)?.label || code;
}

function normalizeTag(tag) {
    return tag.replace(/\s+/g, ' ').trim();
}

function applyInlineFormatting(text) {
    if (!text) return '';
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return escaped
        .replace(/==(.+?)==/g, '<mark>$1</mark>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>');
}

function formatMarkdown(text) {
    if (!text.trim()) return '';
    const lines = text.split(/\n/);
    const html = lines.map(rawLine => {
        const line = rawLine.trim();
        if (!line) return '';
        if (line.startsWith('### ')) {
            return `<h3>${applyInlineFormatting(line.slice(4))}</h3>`;
        }
        if (line.startsWith('>')) {
            return `<blockquote>${applyInlineFormatting(line.replace(/^>\s?/, ''))}</blockquote>`;
        }
        return `<p>${applyInlineFormatting(rawLine)}</p>`;
    });
    return html.join('');
}

function formatDraftMeta(draft) {
    const date = new Date(draft.createdAt);
    return `${date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} ${date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
}

async function loadData() {
    const drafts = await SettingsDB.get('ao3_drafts');
    state.drafts = Array.isArray(drafts) ? drafts : [];
    
    const tropes = await SettingsDB.get('ao3_selected_tropes');
    state.selectedTropes = Array.isArray(tropes) ? tropes : [];
    
    const chars = await SettingsDB.get('ao3_selected_characters');
    state.selectedCharacters = Array.isArray(chars) ? chars : [];
}

async function saveDrafts() {
    await SettingsDB.set('ao3_drafts', state.drafts);
}

async function saveSelections() {
    await SettingsDB.set('ao3_selected_tropes', state.selectedTropes);
    await SettingsDB.set('ao3_selected_characters', state.selectedCharacters);
}

function setStatus(container, message) {
    const statusEl = container.querySelector('#composer-status');
    if (!statusEl) return;
    statusEl.textContent = message;
    clearTimeout(state.statusTimer);
    state.statusTimer = setTimeout(() => {
        if (statusEl) statusEl.textContent = '';
    }, 2000);
}

async function renderAO3(params) {
    await loadData();
    const characters = await CharactersDB.getAll();
    
    const container = createElement('div', 'app-container ao3-app');
    
    container.innerHTML = `
        <header class="ios-header ao3-header">
            <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
            <h1 class="menu-title">AO3 寫作工作室</h1>
            <div class="header-actions">
                <button class="header-action" id="ao3-menu" title="選單"><i class="fas fa-ellipsis-v"></i></button>
            </div>
            <div class="menu-dropdown hidden" id="ao3-menu-dropdown">
                <button class="menu-item" id="menu-export-txt"><i class="fas fa-file-alt"></i> 匯出為 TXT</button>
                <button class="menu-item" id="menu-export-md"><i class="fas fa-file-code"></i> 匯出為 Markdown</button>
                <button class="menu-item" id="menu-import"><i class="fas fa-file-import"></i> 匯入草稿</button>
                <button class="menu-item" id="menu-clear-form"><i class="fas fa-eraser"></i> 清空表單</button>
                <hr class="menu-divider">
                <button class="menu-item" id="menu-help"><i class="fas fa-question-circle"></i> 使用說明</button>
            </div>
        </header>

        <div class="ao3-main">
            <section class="card form-card">
                <h2>作品基本資訊</h2>
                <div class="field">
                    <label for="work-title">作品標題</label>
                    <input id="work-title" type="text" placeholder="請輸入標題 (必填)">
                </div>
                <div class="field-grid">
                    <label>
                        <span>作品分級</span>
                        <select id="work-rating">
                            <option value="G">General Audiences</option>
                            <option value="T">Teen & Up</option>
                            <option value="M">Mature</option>
                            <option value="E">Explicit</option>
                            <option value="NR">Not Rated</option>
                        </select>
                    </label>
                    <label>
                        <span>主要語言</span>
                        <select id="language-select">
                            ${languageOptions.map(l => `<option value="${l.code}">${l.label}</option>`).join('')}
                        </select>
                    </label>
                </div>
                <div class="field">
                    <label>附加語言 (可多選)</label>
                    <div class="language-grid" id="language-grid"></div>
                </div>
                <div class="field">
                    <label for="work-summary">摘要</label>
                    <textarea id="work-summary" rows="3" placeholder="用數句話描述作品內容"></textarea>
                </div>
                <div class="field">
                    <label for="work-notes">作者前言 / 備註</label>
                    <textarea id="work-notes" rows="2" placeholder="Optional: notes, warnings"></textarea>
                </div>
            </section>

            <section class="card tag-card">
                <h2>Tags</h2>
                <div class="tag-field" data-type="fandom">
                    <div class="tag-field-header">
                        <label>Fandoms</label>
                        <span>最多 20 個</span>
                    </div>
                    <div class="tag-input">
                        <div class="tag-chip-list" id="tags-fandom"></div>
                        <input type="text" placeholder="輸入後按 Enter 加入" data-tag-input="fandom">
                    </div>
                </div>
                <div class="tag-field" data-type="relationship">
                    <div class="tag-field-header">
                        <label>Relationships</label>
                        <span>Ex: Steve/Tony</span>
                    </div>
                    <div class="tag-input">
                        <div class="tag-chip-list" id="tags-relationship"></div>
                        <input type="text" placeholder="Ship、友情或羈絆" data-tag-input="relationship">
                    </div>
                </div>
                <div class="tag-field" data-type="characters">
                    <div class="tag-field-header">
                        <label>Characters</label>
                    </div>
                    <div class="tag-input">
                        <div class="tag-chip-list" id="tags-characters"></div>
                        <input type="text" placeholder="主要角色名單" data-tag-input="characters">
                    </div>
                </div>
                <div class="tag-field" data-type="additional">
                    <div class="tag-field-header">
                        <label>Additional Tags</label>
                        <span>心情、體裁、警示</span>
                    </div>
                    <div class="tag-input">
                        <div class="tag-chip-list" id="tags-additional"></div>
                        <input type="text" placeholder="如 Hurt/Comfort、Slow Burn" data-tag-input="additional">
                    </div>
                </div>
            </section>

            <section class="card inspiration-card">
                <div class="inspiration-tabs">
                    <button class="inspiration-tab active" data-tab="tropes">梗庫</button>
                    <button class="inspiration-tab" data-tab="characters">角色</button>
                    <button class="inspiration-tab" data-tab="worldsettings">世界設定</button>
                </div>
                <div class="inspiration-content">
                    <div class="inspiration-panel active" id="tropes-panel">
                        <div class="panel-header"><span>選擇互動梗來啟發創作靈感</span></div>
                        <div class="tropes-list" id="ao3-tropes-list"></div>
                    </div>
                    <div class="inspiration-panel" id="characters-panel">
                        <div class="panel-header"><span>從角色庫導入角色</span></div>
                        <div class="characters-list" id="ao3-characters-list"></div>
                    </div>
                    <div class="inspiration-panel" id="worldsettings-panel">
                        <div class="panel-header"><span>選擇世界觀設定</span></div>
                        <div class="worldsettings-list" id="ao3-worldsettings-list"></div>
                    </div>
                </div>
            </section>

            <section class="card editor-card">
                <h2>內文編輯器</h2>
                <div class="toolbar" id="format-toolbar">
                    <button type="button" data-format="bold" title="粗體">B</button>
                    <button type="button" data-format="italic" title="斜體">I</button>
                    <button type="button" data-format="highlight" title="螢光">HL</button>
                    <button type="button" data-format="blockquote" title="引言">❝</button>
                    <button type="button" data-format="heading" title="章節小標">H3</button>
                </div>
                <textarea id="work-body" rows="12" placeholder="使用 Markdown 語法：**粗體**、*斜體*、> 引言、==標記==..."></textarea>
                <div class="editor-footer">
                    <div id="body-stats">0 words · 0 chars</div>
                    <div class="generator-controls">
                        <label>氛圍
                            <select id="mood-select">
                                <option value="fluff">Fluff</option>
                                <option value="angst">Angst</option>
                                <option value="action">Action</option>
                                <option value="hurt">Hurt/Comfort</option>
                            </select>
                        </label>
                        <button type="button" id="generate-snippet">產生段落</button>
                        <button type="button" id="save-draft">儲存草稿</button>
                        <span id="composer-status" class="composer-status"></span>
                    </div>
                    <div class="ai-controls">
                        <button id="ai-generate-btn" class="ai-btn"><i class="fas fa-magic"></i> AI 生成同人文</button>
                    </div>
                </div>
            </section>

            <section class="card preview-card">
                <h2>即時預覽</h2>
                <div class="preview-header">
                    <h3 id="preview-title">未命名作品</h3>
                    <p id="preview-meta">General Audiences · English</p>
                </div>
                <p class="preview-summary" id="preview-summary">輸入摘要後會顯示於此。</p>
                <div class="preview-notes" id="preview-notes"></div>
                <div class="preview-body" id="work-preview">開始書寫或使用內容產生器，即可看到排版效果。</div>
            </section>

            <section class="card draft-card">
                <div class="draft-header">
                    <h2>我的草稿</h2>
                    <button type="button" class="ghost-btn" id="clear-drafts">清除全部</button>
                </div>
                <ul class="draft-list" id="draft-list"></ul>
            </section>
        </div>
    `;

    function renderLanguageChips() {
        const grid = container.querySelector('#language-grid');
        if (!grid) return;
        grid.innerHTML = '';
        languageOptions.forEach(option => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'language-chip' + (state.languages.includes(option.code) ? ' active' : '');
            chip.textContent = option.label;
            chip.dataset.code = option.code;
            chip.addEventListener('click', () => toggleLanguage(option.code));
            grid.appendChild(chip);
        });
    }

    function toggleLanguage(code) {
        if (state.languages.includes(code)) {
            state.languages = state.languages.filter(lang => lang !== code);
        } else {
            state.languages = [...state.languages, code];
        }
        renderLanguageChips();
        updatePreview();
    }

    function addTag(type, value) {
        const normalized = normalizeTag(value);
        if (!normalized) return;
        const current = state.tags[type];
        if (current.length >= tagLimits[type]) {
            setStatus(container, `「${type}」已達上限 (${tagLimits[type]})`);
            return;
        }
        const exists = current.some(tag => tag.toLowerCase() === normalized.toLowerCase());
        if (exists) {
            setStatus(container, '標籤已存在');
            return;
        }
        state.tags[type] = [...current, normalized];
        renderTags(type);
    }

    function removeTag(type, index) {
        state.tags[type].splice(index, 1);
        renderTags(type);
    }

    function renderTags(type) {
        const tagContainer = container.querySelector(`#tags-${type}`);
        if (!tagContainer) return;
        tagContainer.innerHTML = '';
        state.tags[type].forEach((tag, index) => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.innerHTML = `${tag}<button type="button" aria-label="移除">×</button>`;
            chip.querySelector('button')?.addEventListener('click', () => removeTag(type, index));
            tagContainer.appendChild(chip);
        });
    }

    function renderAllTags() {
        Object.keys(state.tags).forEach(renderTags);
    }

    function updatePreview() {
        const titleEl = container.querySelector('#work-title');
        const ratingEl = container.querySelector('#work-rating');
        const langEl = container.querySelector('#language-select');
        const summaryEl = container.querySelector('#work-summary');
        const notesEl = container.querySelector('#work-notes');
        const bodyEl = container.querySelector('#work-body');

        const title = titleEl?.value.trim() || '未命名作品';
        const rating = ratingMap[ratingEl?.value || 'NR'] || 'Not Rated';
        const primaryLang = getLanguageLabel(langEl?.value || 'en');
        const secondary = state.languages.filter(code => code !== langEl?.value);
        const languageMeta = secondary.length ? `${primaryLang} + ${secondary.length} 語系` : primaryLang;

        container.querySelector('#preview-title').textContent = title;
        container.querySelector('#preview-meta').textContent = `${rating} · ${languageMeta}`;
        
        const sum = summaryEl?.value.trim();
        container.querySelector('#preview-summary').textContent = sum || '輸入摘要後會顯示於此。';
        
        const notes = notesEl?.value.trim();
        const notesPreview = container.querySelector('#preview-notes');
        notesPreview.textContent = notes || '';
        notesPreview.style.display = notes ? 'block' : 'none';
        
        const body = bodyEl?.value || '';
        const html = formatMarkdown(body) || '<p>開始書寫或使用內容產生器，即可看到排版效果。</p>';
        container.querySelector('#work-preview').innerHTML = html;
    }

    function updateStats() {
        const bodyEl = container.querySelector('#work-body');
        const text = bodyEl?.value || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        container.querySelector('#body-stats').textContent = `${words} words · ${chars} chars`;
    }

    function wrapSelection(before = '', after = '', placeholder = 'text') {
        const textarea = container.querySelector('#work-body');
        if (!textarea) return;
        const start = textarea.selectionStart ?? textarea.value.length;
        const end = textarea.selectionEnd ?? start;
        const selection = textarea.value.slice(start, end) || placeholder;
        const nextValue = textarea.value.slice(0, start) + before + selection + after + textarea.value.slice(end);
        textarea.value = nextValue;
        const newCursor = start + before.length + selection.length + after.length;
        textarea.focus();
        textarea.setSelectionRange(newCursor, newCursor);
        updateStats();
        updatePreview();
    }

    function handleToolbar(action) {
        switch (action) {
            case 'bold': wrapSelection('**', '**', 'bold text'); break;
            case 'italic': wrapSelection('*', '*', 'italic text'); break;
            case 'highlight': wrapSelection('==', '==', 'highlight'); break;
            case 'blockquote': wrapSelection('\n> ', '', 'quote'); break;
            case 'heading': wrapSelection('\n### ', '\n', 'Section title'); break;
        }
    }

    function composeSnippet() {
        const moodEl = container.querySelector('#mood-select');
        const mood = moodEl?.value || 'fluff';
        const templates = snippetLibrary[mood] || snippetLibrary.fluff;
        const template = templates[Math.floor(Math.random() * templates.length)];
        const fandom = state.tags.fandom[0] || 'Original Verse';
        const relationship = state.tags.relationship[0] || 'two travelers';
        const character = state.tags.characters[0] || 'the protagonist';
        const setting = state.tags.additional[0] || 'the empty station';
        return template
            .replace('{FANDOM}', fandom)
            .replace('{PAIRING}', relationship)
            .replace('{CHAR}', character)
            .replace('{SETTING}', setting);
    }

    function generateSnippet() {
        setStatus(container, '產生段落中...');
        setTimeout(() => {
            const snippet = composeSnippet();
            const bodyEl = container.querySelector('#work-body');
            const prefix = bodyEl.value && !bodyEl.value.endsWith('\n') ? '\n\n' : '';
            bodyEl.value += `${prefix}${snippet}`;
            updateStats();
            updatePreview();
            setStatus(container, '已插入段落');
        }, 500);
    }

    function buildDraftPayload() {
        const titleEl = container.querySelector('#work-title');
        const ratingEl = container.querySelector('#work-rating');
        const langEl = container.querySelector('#language-select');
        const summaryEl = container.querySelector('#work-summary');
        const notesEl = container.querySelector('#work-notes');
        const bodyEl = container.querySelector('#work-body');

        return {
            id: `draft-${Date.now()}`,
            title: titleEl?.value.trim() || 'Untitled',
            rating: ratingEl?.value || 'NR',
            language: langEl?.value || 'en',
            languages: [...state.languages],
            summary: summaryEl?.value || '',
            notes: notesEl?.value || '',
            body: bodyEl?.value || '',
            tags: JSON.parse(JSON.stringify(state.tags)),
            createdAt: new Date().toISOString()
        };
    }

    async function saveDraft() {
        const bodyEl = container.querySelector('#work-body');
        const summaryEl = container.querySelector('#work-summary');
        const body = bodyEl?.value.trim();
        const summary = summaryEl?.value.trim();
        if (!body && !summary) {
            setStatus(container, '至少輸入內文或摘要才能儲存');
            return;
        }
        const payload = buildDraftPayload();
        state.drafts = [payload, ...state.drafts].slice(0, 12);
        await saveDrafts();
        renderDrafts();
        setStatus(container, '草稿已儲存');
    }

    function loadDraft(draft) {
        if (!draft) return;
        const titleEl = container.querySelector('#work-title');
        const ratingEl = container.querySelector('#work-rating');
        const langEl = container.querySelector('#language-select');
        const summaryEl = container.querySelector('#work-summary');
        const notesEl = container.querySelector('#work-notes');
        const bodyEl = container.querySelector('#work-body');

        if (titleEl) titleEl.value = draft.title;
        if (ratingEl) ratingEl.value = draft.rating;
        if (langEl) langEl.value = draft.language;
        state.languages = draft.languages || [];
        Object.keys(state.tags).forEach(key => {
            state.tags[key] = [...(draft.tags?.[key] || [])];
        });
        if (summaryEl) summaryEl.value = draft.summary || '';
        if (notesEl) notesEl.value = draft.notes || '';
        if (bodyEl) bodyEl.value = draft.body || '';
        renderLanguageChips();
        renderAllTags();
        updateStats();
        updatePreview();
        setStatus(container, '已載入草稿');
    }

    async function deleteDraft(id) {
        state.drafts = state.drafts.filter(draft => draft.id !== id);
        await saveDrafts();
        renderDrafts();
        setStatus(container, '草稿已刪除');
    }

    async function clearDrafts() {
        if (!state.drafts.length) {
            setStatus(container, '沒有草稿可清除');
            return;
        }
        state.drafts = [];
        await saveDrafts();
        renderDrafts();
        setStatus(container, '草稿列表已清空');
    }

    function renderDrafts() {
        const list = container.querySelector('#draft-list');
        if (!list) return;
        list.innerHTML = '';
        if (!state.drafts.length) {
            const empty = document.createElement('li');
            empty.textContent = '尚未儲存任何草稿';
            empty.style.opacity = '0.6';
            list.appendChild(empty);
            return;
        }
        state.drafts.forEach(draft => {
            const item = document.createElement('li');
            item.className = 'draft-item';
            const meta = document.createElement('div');
            meta.innerHTML = `<strong>${draft.title}</strong><div>${formatDraftMeta(draft)}</div>`;
            const actions = document.createElement('div');
            actions.className = 'draft-actions';
            const loadBtn = document.createElement('button');
            loadBtn.textContent = '載入';
            loadBtn.addEventListener('click', () => loadDraft(draft));
            const delBtn = document.createElement('button');
            delBtn.textContent = '刪除';
            delBtn.addEventListener('click', () => deleteDraft(draft.id));
            actions.append(loadBtn, delBtn);
            item.append(meta, actions);
            list.appendChild(item);
        });
    }

    function renderTropesPanel() {
        const listContainer = container.querySelector('#ao3-tropes-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        interactionTropes.forEach((trope, index) => {
            const item = document.createElement('div');
            item.className = 'trope-item' + (state.selectedTropes.includes(index) ? ' selected' : '');
            item.innerHTML = `
                <div class="trope-header">
                    <span class="trope-title">${trope.title}</span>
                    <span class="trope-tags">${trope.tags.map(t => `#${t}`).join(' ')}</span>
                </div>
                <div class="trope-desc">${trope.desc}</div>
            `;
            item.addEventListener('click', () => toggleTrope(index));
            listContainer.appendChild(item);
        });
    }

    async function toggleTrope(index) {
        if (state.selectedTropes.includes(index)) {
            state.selectedTropes = state.selectedTropes.filter(i => i !== index);
        } else {
            state.selectedTropes.push(index);
        }
        await saveSelections();
        renderTropesPanel();
    }

    function renderCharactersPanel() {
        const listContainer = container.querySelector('#ao3-characters-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (characters.length === 0) {
            listContainer.innerHTML = '<div class="empty-hint">請先在設定中添加角色</div>';
            return;
        }

        characters.forEach((char) => {
            const item = document.createElement('div');
            const isSelected = state.selectedCharacters.some(c => c.id === char.id);
            item.className = 'char-item' + (isSelected ? ' selected' : '');
            item.innerHTML = `
                <div class="char-avatar">${char.avatar ? `<img src="${char.avatar}" alt="${char.name}">` : `<span>${char.name[0]}</span>`}</div>
                <div class="char-info">
                    <div class="char-name">${char.name}</div>
                    ${char.personality ? `<div class="char-desc">${char.personality.slice(0, 50)}...</div>` : ''}
                </div>
            `;
            item.addEventListener('click', () => toggleCharacter(char));
            listContainer.appendChild(item);
        });
    }

    async function toggleCharacter(char) {
        const exists = state.selectedCharacters.find(c => c.id === char.id);
        if (exists) {
            state.selectedCharacters = state.selectedCharacters.filter(c => c.id !== char.id);
        } else {
            state.selectedCharacters.push({
                id: char.id,
                name: char.name,
                personality: char.personality,
                avatar: char.avatar
            });
        }
        await saveSelections();
        renderCharactersPanel();
        updateSelectedCharactersTags();
    }

    function updateSelectedCharactersTags() {
        state.selectedCharacters.forEach(char => {
            if (!state.tags.characters.some(t => t.toLowerCase() === char.name.toLowerCase())) {
                addTag('characters', char.name);
            }
        });
    }

    function renderWorldSettingsPanel() {
        const listContainer = container.querySelector('#ao3-worldsettings-list');
        if (!listContainer) return;
        listContainer.innerHTML = '';
        worldSettings.forEach((setting, index) => {
            const item = document.createElement('div');
            item.className = 'worldsetting-item' + (state.selectedWorldSettings.includes(index) ? ' selected' : '');
            item.innerHTML = `
                <div class="worldsetting-header">
                    <span class="worldsetting-title">${setting.title}</span>
                    <span class="worldsetting-tags">${setting.tags.map(t => `#${t}`).join(' ')}</span>
                </div>
                <div class="worldsetting-desc">${setting.desc}</div>
            `;
            item.addEventListener('click', () => toggleWorldSetting(index));
            listContainer.appendChild(item);
        });
    }

    function toggleWorldSetting(index) {
        if (state.selectedWorldSettings.includes(index)) {
            state.selectedWorldSettings = state.selectedWorldSettings.filter(i => i !== index);
        } else {
            state.selectedWorldSettings.push(index);
        }
        renderWorldSettingsPanel();
        updateWorldSettingTags();
    }

    function updateWorldSettingTags() {
        state.selectedWorldSettings.forEach(idx => {
            const setting = worldSettings[idx];
            setting.tags.forEach(tag => {
                if (!state.tags.additional.some(t => t.toLowerCase() === tag.toLowerCase())) {
                    addTag('additional', tag);
                }
            });
        });
    }

    function exportAsTxt() {
        const titleEl = container.querySelector('#work-title');
        const summaryEl = container.querySelector('#work-summary');
        const notesEl = container.querySelector('#work-notes');
        const bodyEl = container.querySelector('#work-body');

        const title = titleEl?.value || '未命名作品';
        const summary = summaryEl?.value || '';
        const notes = notesEl?.value || '';
        const body = bodyEl?.value || '';
        const tags = Object.entries(state.tags).map(([type, items]) => 
            `${type}: ${items.join(', ')}`
        ).join('\n');
        
        const content = `${title}\n${'='.repeat(title.length)}\n\nTags:\n${tags}\n\nSummary:\n${summary}\n\nNotes:\n${notes}\n\n---\n\n${body}`;
        
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        setStatus(container, '已匯出為 TXT');
        toggleMenuDropdown();
    }

    function exportAsMarkdown() {
        const titleEl = container.querySelector('#work-title');
        const ratingEl = container.querySelector('#work-rating');
        const langEl = container.querySelector('#language-select');
        const summaryEl = container.querySelector('#work-summary');
        const notesEl = container.querySelector('#work-notes');
        const bodyEl = container.querySelector('#work-body');

        const title = titleEl?.value || '未命名作品';
        const rating = ratingEl?.value || 'G';
        const lang = langEl?.value || 'en';
        const summary = summaryEl?.value || '';
        const notes = notesEl?.value || '';
        const body = bodyEl?.value || '';
        
        const fandomTags = state.tags.fandom.map(t => `[[${t}]]`).join(', ');
        const relTags = state.tags.relationship.map(t => `[[${t}]]`).join(', ');
        const charTags = state.tags.characters.map(t => `[[${t}]]`).join(', ');
        const addTags = state.tags.additional.map(t => `[[${t}]]`).join(', ');
        
        const content = `# ${title}\n\n**Rating:** ${ratingMap[rating] || rating}\n**Language:** ${getLanguageLabel(lang)}\n\n## Tags\n- **Fandoms:** ${fandomTags || 'None'}\n- **Relationships:** ${relTags || 'None'}\n- **Characters:** ${charTags || 'None'}\n- **Additional:** ${addTags || 'None'}\n\n## Summary\n${summary || '_No summary_'}\n\n## Notes\n${notes || '_No notes_'}\n\n---\n\n${body || '_No content yet_'}`;
        
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.md`;
        a.click();
        URL.revokeObjectURL(url);
        
        setStatus(container, '已匯出為 Markdown');
        toggleMenuDropdown();
    }

    function importDraft() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.md,.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const titleEl = container.querySelector('#work-title');
                const summaryEl = container.querySelector('#work-summary');
                const notesEl = container.querySelector('#work-notes');
                const bodyEl = container.querySelector('#work-body');
                
                if (file.name.endsWith('.json')) {
                    const data = JSON.parse(text);
                    if (data.title && titleEl) titleEl.value = data.title;
                    if (data.summary && summaryEl) summaryEl.value = data.summary;
                    if (data.notes && notesEl) notesEl.value = data.notes;
                    if (data.body && bodyEl) bodyEl.value = data.body;
                    if (data.tags) {
                        Object.keys(data.tags).forEach(type => {
                            state.tags[type] = data.tags[type];
                        });
                        renderAllTags();
                    }
                } else {
                    if (bodyEl) bodyEl.value = text;
                }
                
                updatePreview();
                setStatus(container, '已匯入草稿');
            } catch (err) {
                setStatus(container, '匯入失敗: ' + err.message);
            }
            
            toggleMenuDropdown();
        };
        
        input.click();
    }

    function clearForm() {
        if (confirm('確定要清空所有欄位嗎？')) {
            const titleEl = container.querySelector('#work-title');
            const summaryEl = container.querySelector('#work-summary');
            const notesEl = container.querySelector('#work-notes');
            const bodyEl = container.querySelector('#work-body');

            if (titleEl) titleEl.value = '';
            if (summaryEl) summaryEl.value = '';
            if (notesEl) notesEl.value = '';
            if (bodyEl) bodyEl.value = '';
            state.tags = { fandom: [], relationship: [], characters: [], additional: [] };
            state.languages = [];
            renderAllTags();
            renderLanguageChips();
            updatePreview();
            setStatus(container, '已清空表單');
        }
        toggleMenuDropdown();
    }

    function showHelp() {
        alert(`AO3 行動寫作工作室使用說明：

1. 填寫作品標題、分級和語言
2. 使用標籤欄位加入 Fandom、CP、角色等
3. 在編輯器中撰寫正文（支援 Markdown）
4. 使用「產生段落」獲得靈感
5. 儲存草稿避免遺失
6. 完成後可匯出為 TXT 或 Markdown

快捷鍵：
- Ctrl/Cmd + S：儲存草稿
- Ctrl/Cmd + B：粗體
- Ctrl/Cmd + I：斜體`);
        toggleMenuDropdown();
    }

    function toggleMenuDropdown() {
        const dropdown = container.querySelector('#ao3-menu-dropdown');
        if (dropdown) dropdown.classList.toggle('hidden');
    }

    function bindTagInputs() {
        container.querySelectorAll('[data-tag-input]').forEach(input => {
            input.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                const type = input.dataset.tagInput;
                addTag(type, input.value);
                input.value = '';
            });
        });
    }

    function bindInspirationTabs() {
        container.querySelectorAll('.inspiration-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                container.querySelectorAll('.inspiration-tab').forEach(t => t.classList.remove('active'));
                container.querySelectorAll('.inspiration-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const panelId = tab.dataset.tab + '-panel';
                container.querySelector(`#${panelId}`)?.classList.add('active');
            });
        });
    }

    async function generateAIContent() {
        const bodyEl = container.querySelector('#work-body');
        const titleEl = container.querySelector('#work-title');
        const langEl = container.querySelector('#language-select');

        const selectedLang = langEl?.value || 'zh-Hant';
        const langNames = {
            'en': 'English', 'zh-Hant': '繁體中文', 'zh-Hans': '简体中文',
            'ja': '日本語', 'ko': '한국어', 'es': 'Español',
            'fr': 'Français', 'de': 'Deutsch', 'th': 'ไทย', 'ru': 'Русский'
        };
        const langName = langNames[selectedLang] || '繁體中文';
        
        const fandom = state.tags.fandom.join(', ') || '未指定';
        const relationship = state.tags.relationship.join(', ') || '未指定';
        const characters = state.tags.characters.join(', ') || '未指定';

        const tropeInfo = state.selectedTropes.map(idx => {
            const trope = interactionTropes[idx];
            return trope ? `${trope.title}: ${trope.desc}` : '';
        }).filter(Boolean).join('\n');

        const worldSettingInfo = state.selectedWorldSettings.map(idx => {
            const setting = worldSettings[idx];
            return setting ? `${setting.title}: ${setting.desc}` : '';
        }).filter(Boolean).join('\n');

        const selectedCharsInfo = state.selectedCharacters.map(c => 
            `${c.name}: ${c.personality || ''}`
        ).join('\n');

        const systemPrompt = `你是一位專業的同人文作家，擅長根據角色設定和使用者背景創作符合人物性格的同人文。
請使用 ${langName} 撰寫。
輸出格式為 JSON: {"title": "標題", "content": "正文內容", "tags": ["標籤1", "標籤2"]}`;

        let prompt = `Fandom: ${fandom}\nCP: ${relationship}\n角色: ${characters}\n`;
        if (tropeInfo) prompt += `\n選擇的梗:\n${tropeInfo}\n`;
        if (worldSettingInfo) prompt += `\n世界設定:\n${worldSettingInfo}\n`;
        if (selectedCharsInfo) prompt += `\n參與角色:\n${selectedCharsInfo}\n`;
        prompt += `\n請生成一篇同人文，要求：
1. 符合角色性格
2. 自然融入設定
3. 字數約 500-1000 字
4. 包含標題和正文
輸出 JSON 格式。`;

        setStatus(container, 'AI 生成中...');
        
        try {
            const settings = await SettingsDB.getAll();
            const apiUrl = settings.api_url;
            const apiKey = settings.api_key;
            const model = settings.model || 'gpt-3.5-turbo';

            if (!apiUrl) {
                setStatus(container, '請先設定 API');
                return;
            }

            const endpoint = apiUrl.endsWith('/chat/completions') 
                ? apiUrl 
                : `${apiUrl.replace(/\/$/, '')}/chat/completions`;

            const headers = { 'Content-Type': 'application/json' };
            if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.85,
                    max_tokens: 4000
                })
            });

            if (!response.ok) {
                throw new Error(`API 錯誤 (${response.status})`);
            }

            const data = await response.json();
            const result = data.choices?.[0]?.message?.content || '';

            let parsed = null;
            try {
                parsed = JSON.parse(result);
            } catch {
                const match = result.match(/\{[\s\S]*\}/);
                if (match) parsed = JSON.parse(match[0]);
            }

            if (parsed && parsed.content) {
                if (titleEl) titleEl.value = parsed.title || 'AI 生成的同人文';
                if (bodyEl) bodyEl.value = parsed.content;
                
                if (parsed.tags && Array.isArray(parsed.tags)) {
                    parsed.tags.forEach(tag => {
                        if (!state.tags.additional.includes(tag)) {
                            state.tags.additional.push(tag);
                        }
                    });
                    renderAllTags();
                }
                
                updatePreview();
                setStatus(container, '已生成同人文內容');
            } else {
                setStatus(container, '生成失敗，請稍後重試');
            }
        } catch (err) {
            setStatus(container, `生成失敗: ${err.message}`);
        }
    }

    container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
    container.querySelector('#ao3-menu').onclick = toggleMenuDropdown;
    container.querySelector('#menu-export-txt').onclick = exportAsTxt;
    container.querySelector('#menu-export-md').onclick = exportAsMarkdown;
    container.querySelector('#menu-import').onclick = importDraft;
    container.querySelector('#menu-clear-form').onclick = clearForm;
    container.querySelector('#menu-help').onclick = showHelp;
    container.querySelector('#generate-snippet').onclick = generateSnippet;
    container.querySelector('#save-draft').onclick = saveDraft;
    container.querySelector('#clear-drafts').onclick = clearDrafts;
    container.querySelector('#ai-generate-btn').onclick = generateAIContent;

    container.querySelector('#work-title').oninput = updatePreview;
    container.querySelector('#work-summary').oninput = updatePreview;
    container.querySelector('#work-notes').oninput = updatePreview;
    container.querySelector('#work-body').oninput = () => { updateStats(); updatePreview(); };
    container.querySelector('#work-rating').onchange = updatePreview;
    container.querySelector('#language-select').onchange = updatePreview;

    container.querySelector('#format-toolbar').onclick = (e) => {
        const btn = e.target.closest('button[data-format]');
        if (!btn) return;
        handleToolbar(btn.dataset.format);
    };

    document.addEventListener('click', (e) => {
        const dropdown = container.querySelector('#ao3-menu-dropdown');
        const menuBtn = container.querySelector('#ao3-menu');
        if (dropdown && !dropdown.contains(e.target) && !menuBtn?.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    bindTagInputs();
    bindInspirationTabs();
    renderLanguageChips();
    renderAllTags();
    renderDrafts();
    renderTropesPanel();
    renderCharactersPanel();
    renderWorldSettingsPanel();
    updateStats();
    updatePreview();

    return { element: container, cleanup: () => {} };
}

export default {
    id: 'ao3',
    name: 'AO3',
    icon: 'create',
    routes: [{ path: '/ao3', render: renderAO3 }],
    navItem: { label: 'AO3', icon: 'create', path: '/ao3', showInNav: true, order: 30 },
    styles: () => import('./style.css')
};
