import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB, CharactersDB, UsersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';
import { getBalance, charge, credit, formatMoney, WalletError } from '../../core/wallet.js';
import {askForm, askConfirm } from '../../core/dialogs.js';
import { fetchHeadlines, analyze, sectorBias, localDate, startOfDay } from './world-events.js';

// 投資模擬器：全部是虛構的標的與模擬行情，買賣直接用「支付」錢包的虛擬餘額，沒有任何真實金流或真實股價。
const MARKET_KEY = 'invest_market';
const HOLD_KEY = 'invest_holdings';
const TRADES_KEY = 'invest_trades';
const STATS_KEY = 'invest_stats';
const TICK_MS = 5000;        // App 開著時，每 5 秒一個行情點
const OFFLINE_TICK_MS = 30000; // 沒開 App 時，每 30 秒補一個行情點
const MAX_CATCHUP = 2000;
const EVENTS_KEY = 'invest_events';
const GAP_SHARE = 0.4; // 事件公布當下先反映 40%，其餘 60% 在當天慢慢消化
const DAY_MS = 86400000;
const HIST = 240;
const FEE_RATE = 0.001;

// vol：每個行情點的波動；base：長期價值（價格會被緩慢拉回）
// key：對應世界事件的板塊（指數基金吃整體大盤情緒）
const ASSETS = [
    { sym: 'TSMX', name: '晶芯科技', sector: '半導體', key: '半導體', base: 580, vol: 0.0025 },
    { sym: 'ETF0', name: '台灣五十 ETF', sector: '指數基金', key: '大盤', base: 140, vol: 0.0011 },
    { sym: 'BANK', name: '安穩金控', sector: '金融', key: '金融', base: 28, vol: 0.0009 },
    { sym: 'FOOD', name: '好食光', sector: '食品', key: '食品', base: 85, vol: 0.0012 },
    { sym: 'OILX', name: '海港能源', sector: '能源', key: '能源', base: 42, vol: 0.0035 },
    { sym: 'EVAU', name: '電馳車業', sector: '電動車', key: '電動車', base: 330, vol: 0.0042 },
    { sym: 'GAME', name: '星野遊戲', sector: '遊戲', key: '遊戲', base: 210, vol: 0.005 },
    { sym: 'PHAR', name: '青禾生技', sector: '生技', key: '生技', base: 66, vol: 0.0055 },
    { sym: 'METL', name: '鐵礦重工', sector: '原物料（重金屬）', key: '原物料', base: 95, vol: 0.0038 },
    { sym: 'DEFN', name: '盾牌國防', sector: '國防軍工', key: '國防', base: 120, vol: 0.003 }
];
// 某檔標的受今日世界事件影響的目標幅度：自己的板塊，加上一半的大盤情緒（指數基金吃全部）
const assetBias = (meta, bias) => (bias[meta.key] || 0) + (meta.key === '大盤' ? 0 : 0.5 * (bias['大盤'] || 0));
const NEWS = {
    up: ['財報優於預期', '獲得大型訂單', '分析師調升評等', '新產品發表受好評', '宣布擴大回購'],
    down: ['財報不如預期', '主要客戶減單', '分析師調降評等', '產品出現瑕疵召回', '高層異動引發疑慮']
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => formatMoney(Math.round(n));
const fmtPrice = n => n.toFixed(2);
const pct = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
const normal = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

function stepAsset(a, meta, drift = 0) {
    const revert = -0.0004 * Math.log(a.price / meta.base);
    let move = revert + drift + meta.vol * normal();
    let headline = null;
    if (Math.random() < 0.004) {
        const up = Math.random() < 0.5;
        move += (up ? 1 : -1) * (0.03 + Math.random() * 0.05);
        headline = { sym: meta.sym, up, text: meta.name + '：' + NEWS[up ? 'up' : 'down'][Math.floor(Math.random() * 5)], ts: Date.now() };
    }
    a.price = Math.min(meta.base * 5, Math.max(meta.base * 0.2, Math.max(1, a.price * Math.exp(move))));
    return headline;
}

function newMarket() {
    const assets = {};
    ASSETS.forEach(m => { assets[m.sym] = { price: m.base, hist: [m.base] }; });
    return { ts: Date.now(), assets, news: [] };
}

async function loadMarket(bias) {
    let market = await SettingsDB.get(MARKET_KEY);
    if (!market || !market.assets) market = newMarket();
    ASSETS.forEach(m => { if (!market.assets[m.sym]) market.assets[m.sym] = { price: m.base, hist: [m.base] }; });
    // 補上離線期間錯過的行情；今天零點之後的行情點才套用今日事件的影響
    const missed = Math.min(MAX_CATCHUP, Math.floor((Date.now() - market.ts) / OFFLINE_TICK_MS));
    const dayStart = startOfDay();
    for (let i = 0; i < missed; i++) advance(market, OFFLINE_TICK_MS, market.ts + (i + 1) * OFFLINE_TICK_MS >= dayStart ? bias : null);
    if (missed) market.ts = Date.now();
    return market;
}

// dtMs：這個行情點代表多久；bias：今日世界事件的目標漲跌幅，會在一天內慢慢反映（沒有 bias 就是純隨機）
function advance(market, dtMs = TICK_MS, bias = null) {
    ASSETS.forEach(meta => {
        const a = market.assets[meta.sym] || (market.assets[meta.sym] = { price: meta.base, hist: [meta.base] });
        const drift = bias ? Math.log(1 + (1 - GAP_SHARE) * assetBias(meta, bias)) * dtMs / DAY_MS : 0;
        const h = stepAsset(a, meta, drift);
        a.hist.push(a.price);
        if (a.hist.length > HIST) a.hist.shift();
        if (h) { market.news.unshift(h); market.news = market.news.slice(0, 20); }
    });
}

const loadHoldings = async () => (await SettingsDB.get(HOLD_KEY)) || {};
const loadTrades = async () => (await SettingsDB.get(TRADES_KEY)) || [];
const loadStats = async () => ({ realized: 0, ...((await SettingsDB.get(STATS_KEY)) || {}) });

function spark(hist, w = 90, h = 32) {
    if (hist.length < 2) return '';
    const min = Math.min(...hist), max = Math.max(...hist), span = max - min || 1;
    const pts = hist.map((v, i) => (i / (hist.length - 1) * w).toFixed(1) + ',' + (h - 2 - (v - min) / span * (h - 4)).toFixed(1)).join(' ');
    const up = hist[hist.length - 1] >= hist[0];
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="iv-spark ${up ? 'up' : 'down'}"><polyline points="${pts}" fill="none" stroke-width="1.6"/></svg>`;
}

async function renderInvest() {
    const container = createElement('div', 'iv-app');
    let alive = true;
    let tab = 'market';
    let detail = null;
    let busy = false;
    let report = '';
    let days = ((await SettingsDB.get(EVENTS_KEY)) || {}).days || {};
    let bias = sectorBias(days);
    let world = { status: 'idle', error: '' };
    let market = await loadMarket(bias);
    await SettingsDB.set(MARKET_KEY, market);
    let holdings = await loadHoldings();
    let trades = await loadTrades();
    let stats = await loadStats();
    let cash = await getBalance();
    const user = (await UsersDB.getAll())[0] || null;

    const change = sym => { const h = market.assets[sym].hist; return (h[h.length - 1] / h[0] - 1) * 100; };
    const price = sym => market.assets[sym].price;
    const holdingValue = () => Object.entries(holdings).reduce((s, [sym, h]) => s + h.qty * price(sym), 0);
    const holdingCost = () => Object.values(holdings).reduce((s, h) => s + h.qty * h.avgCost, 0);

    function draw() {
        const scroll = container.querySelector('.iv-body')?.scrollTop || 0;
        const opened = [...container.querySelectorAll('details')].map(d => d.open);
        const total = cash + holdingValue();
        const unreal = holdingValue() - holdingCost();
        container.innerHTML = `
        <header class="iv-top"><button class="iv-icon" data-action="back">‹</button><h1>投資模擬器</h1><button class="iv-icon" data-action="reset" title="重置行情與持倉">↺</button></header>
        <section class="iv-summary">
            <div><span>總資產</span><strong>${money(total)}</strong></div>
            <div><span>現金</span><strong>${money(cash)}</strong></div>
            <div><span>未實現損益</span><strong class="${unreal >= 0 ? 'up' : 'down'}">${unreal >= 0 ? '+' : ''}${money(unreal)}</strong></div>
        </section>
        ${detail ? '' : `<nav class="iv-tabs">${[['market', '行情'], ['world', '世界'], ['hold', '持倉'], ['log', '紀錄']].map(([k, l]) => `<button data-action="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav>`}
        <main class="iv-body">${detail ? detailHtml() : tab === 'market' ? marketHtml() : tab === 'world' ? worldHtml() : tab === 'hold' ? holdHtml() : logHtml()}</main>
        <p class="iv-note">虛構標的與模擬行情，使用虛擬錢包，僅供娛樂，不構成任何投資建議。每筆手續費 0.1%。世界事件來自 Wikipedia 每日時事，對標的的影響是遊戲化的簡化。</p>`;
        container.querySelector('.iv-body').scrollTop = scroll;
        container.querySelectorAll('details').forEach((d, i) => { d.open = !!opened[i]; });
    }

    function marketHtml() {
        const news = market.news.slice(0, 3).map(n => `<div class="iv-news ${n.up ? 'up' : 'down'}">${n.up ? '▲' : '▼'} ${esc(n.text)}</div>`).join('');
        const today = days[localDate()];
        const banner = today?.events?.length ? `<button class="iv-banner" data-action="tab" data-tab="world">🌍 今天有 ${today.events.length} 則世界事件影響市場，點此查看 ›</button>` : '';
        return banner + (news ? `<div class="iv-newsbox">${news}</div>` : '') + ASSETS.map(m => {
            const c = change(m.sym), t = assetBias(m, bias);
            return `<button class="iv-row" data-action="open" data-sym="${m.sym}">
                <div class="iv-name"><strong>${m.sym}${Math.abs(t) >= 0.005 ? ` <em class="iv-tag ${t > 0 ? 'up' : 'down'}">🌍${t > 0 ? '▲' : '▼'}</em>` : ''}</strong><span>${esc(m.name)} · ${m.sector}</span></div>
                ${spark(market.assets[m.sym].hist)}
                <div class="iv-px"><strong>${fmtPrice(price(m.sym))}</strong><span class="${c >= 0 ? 'up' : 'down'}">${pct(c)}</span></div>
            </button>`;
        }).join('');
    }

    function eventCard(ev) {
        const link = /^https?:\/\//.test(ev.url || '') ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener noreferrer">閱讀來源 ↗</a>` : '';
        return `<article class="iv-event">
            <h3>${esc(ev.zh)}</h3>
            <div class="iv-chips">${ev.impacts.map(i => `<span class="iv-chip ${i.dir > 0 ? 'up' : 'down'}">${i.dir > 0 ? '▲' : '▼'} ${esc(i.sector)} ${'●'.repeat(i.strength)}</span>`).join('')}</div>
            ${ev.why ? `<p class="iv-why">${esc(ev.why)}</p>` : ''}
            ${ev.en ? `<details><summary>原始新聞</summary><p class="iv-en">${esc(ev.en)}</p>${link}</details>` : ''}
        </article>`;
    }

    function worldHtml() {
        const today = localDate(), day = days[today];
        const head = `<div class="iv-worldhead"><div><strong>${today} 世界事件</strong><span class="iv-muted">來源：Wikipedia 每日時事${day ? ' · ' + (day.source === 'ai' ? 'AI 分析' : '規則分析') : ''}</span></div><button class="iv-link" data-action="refresh-world" ${world.status === 'loading' ? 'disabled' : ''}>↻ 重新整理</button></div>`;
        if (world.status === 'loading') return head + '<div class="iv-empty"><div>🌍</div><p class="iv-muted">正在讀取今天的世界新聞並分析…</p></div>';
        if (world.status === 'error' && !day) return head + `<div class="iv-empty"><div>📡</div><p>暫時取不到新聞</p><p class="iv-muted">${esc(world.error)}</p></div>`;
        if (!day) return head + '<div class="iv-empty"><p class="iv-muted">尚未載入</p></div>';
        const note = day.source === 'rules' ? `<p class="iv-tip">${day.aiError ? 'AI 分析失敗（' + esc(day.aiError) + '），已改用關鍵字規則。' : '尚未設定 AI，目前用關鍵字規則分析（標題為英文原文）。到設定填寫 API 後按「重新整理」，就能得到中文摘要與更精準的產業判斷。'}</p>` : '';
        const sectors = Object.entries(bias).filter(([, v]) => Math.abs(v) >= 0.005).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
        const overview = sectors.length ? `<div class="iv-overview"><strong>板塊影響（含前兩天延續）</strong><div class="iv-chips">${sectors.map(([k, v]) => `<span class="iv-chip ${v > 0 ? 'up' : 'down'}">${v > 0 ? '▲' : '▼'} ${esc(k)} ${pct(v * 100)}</span>`).join('')}</div></div>` : '';
        const list = day.events.length ? day.events.map(eventCard).join('') : '<div class="iv-empty"><p class="iv-muted">今天沒有明顯影響市場的事件，行情以隨機波動為主。</p></div>';
        return head + note + overview + list;
    }

    function holdHtml() {
        const rows = Object.entries(holdings).filter(([, h]) => h.qty > 0).map(([sym, h]) => {
            const meta = ASSETS.find(m => m.sym === sym);
            const pl = (price(sym) - h.avgCost) * h.qty, plPct = (price(sym) / h.avgCost - 1) * 100;
            return `<button class="iv-row" data-action="open" data-sym="${sym}">
                <div class="iv-name"><strong>${sym}</strong><span>${esc(meta.name)} · ${h.qty} 股 · 均價 ${fmtPrice(h.avgCost)}</span></div>
                <div class="iv-px"><strong>${money(h.qty * price(sym))}</strong><span class="${pl >= 0 ? 'up' : 'down'}">${pl >= 0 ? '+' : ''}${money(pl)}（${pct(plPct)}）</span></div>
            </button>`;
        }).join('');
        return `
        <p class="iv-muted">已實現損益：<strong class="${stats.realized >= 0 ? 'up' : 'down'}">${stats.realized >= 0 ? '+' : ''}${money(stats.realized)}</strong></p>
        ${rows || '<div class="iv-empty"><div>📈</div><p>還沒有持倉</p><p class="iv-muted">到「行情」挑一檔標的買買看。</p></div>'}
        <button class="iv-primary iv-wide" data-action="review" ${busy ? 'disabled' : ''}>${busy ? '點評中…' : '請朋友點評我的投資組合'}</button>
        ${report ? `<div class="iv-report">${esc(report)}</div>` : ''}`;
    }

    function logHtml() {
        if (!trades.length) return '<div class="iv-empty"><p class="iv-muted">還沒有任何交易</p></div>';
        return trades.slice().reverse().map(t => `<div class="iv-log"><span><strong class="${t.side === 'buy' ? 'down' : 'up'}">${t.side === 'buy' ? '買入' : '賣出'}</strong> ${t.sym} × ${t.qty} @ ${fmtPrice(t.price)}</span><span class="iv-muted">${new Date(t.ts).toLocaleString('zh-TW', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>`).join('');
    }

    function detailHtml() {
        const meta = ASSETS.find(m => m.sym === detail), a = market.assets[detail], c = change(detail), h = holdings[detail];
        return `
        <button class="iv-link" data-action="close">‹ 回到列表</button>
        <h2 class="iv-title">${detail} <small>${esc(meta.name)}</small></h2>
        <div class="iv-big">${fmtPrice(a.price)} <span class="${c >= 0 ? 'up' : 'down'}">${pct(c)}</span></div>
        <div class="iv-chart">${spark(a.hist, 320, 140)}</div>
        <p class="iv-muted">${meta.sector} · 最近 ${a.hist.length} 個行情點 · 區間 ${fmtPrice(Math.min(...a.hist))} ~ ${fmtPrice(Math.max(...a.hist))}</p>
        ${relatedHtml(meta)}
        <p>${h && h.qty ? `持有 <strong>${h.qty}</strong> 股，均價 ${fmtPrice(h.avgCost)}，市值 ${money(h.qty * a.price)}` : '尚未持有'}</p>
        <div class="iv-trade"><button class="iv-buy" data-action="buy">買入</button><button class="iv-sell" data-action="sell" ${h && h.qty ? '' : 'disabled'}>賣出</button></div>`;
    }

    function relatedHtml(meta) {
        const evs = (days[localDate()]?.events || []).filter(e => e.impacts.some(i => i.sector === meta.key || i.sector === '大盤'));
        return evs.length ? `<div class="iv-related"><strong>今日影響這檔的事件</strong>${evs.map(eventCard).join('')}</div>` : '';
    }

    // 跳空：事件公布當下，先反映一部分目標漲跌幅（每天只做一次）
    function applyGap(date) {
        if (market.gapDate === date || !days[date]) return;
        market.gapDate = date;
        const todayBias = sectorBias({ [date]: days[date] });
        let moved = 0;
        ASSETS.forEach(meta => {
            const t = assetBias(meta, todayBias);
            if (!t) return;
            const a = market.assets[meta.sym];
            a.price = Math.min(meta.base * 5, Math.max(meta.base * 0.2, a.price * (1 + GAP_SHARE * t)));
            a.hist.push(a.price);
            if (a.hist.length > HIST) a.hist.shift();
            moved++;
        });
        if (moved) market.news.unshift({ sym: '', up: true, text: '今日世界事件公布，相關板塊跳空反應', ts: Date.now() });
    }

    async function loadWorld(force = false) {
        const today = localDate();
        if (!force && days[today]) { applyGap(today); return; }
        world = { status: 'loading', error: '' };
        if (alive) draw();
        try {
            const res = await analyze(await fetchHeadlines());
            days[today] = { events: res.events, source: res.source, aiError: res.aiError || '', fetchedAt: Date.now() };
            days = Object.fromEntries(Object.keys(days).sort().slice(-7).map(k => [k, days[k]]));
            bias = sectorBias(days);
            applyGap(today);
            await Promise.all([SettingsDB.set(EVENTS_KEY, { days }), SettingsDB.set(MARKET_KEY, market)]);
            world = { status: 'ok', error: '' };
        } catch (e) {
            world = { status: 'error', error: e.message };
        }
        if (alive) draw();
    }

    async function trade(side) {
        if (busy) return;
        const sym = detail, held = holdings[sym]?.qty || 0;
        const maxBuy = Math.floor(cash / (price(sym) * (1 + FEE_RATE)));
        const form = await askForm({
            title: (side === 'buy' ? '買入 ' : '賣出 ') + sym,
            hint: `現價 ${fmtPrice(price(sym))} · ${side === 'buy' ? '最多可買 ' + maxBuy + ' 股' : '持有 ' + held + ' 股'} · 手續費 0.1%`,
            fields: [{ key: 'qty', label: '股數', type: 'number', required: true, placeholder: '輸入股數' }],
            submitLabel: side === 'buy' ? '買入' : '賣出'
        });
        if (!form) return;
        const qty = form.qty;
        const p = price(sym); // 以送出當下的價格成交
        const gross = Math.round(p * qty), fee = Math.max(1, Math.round(gross * FEE_RATE));
        busy = true;
        try {
            if (side === 'buy') {
                await charge(gross + fee, `買入 ${sym} × ${qty}`, { category: 'invest' });
                const h = holdings[sym] || { qty: 0, avgCost: 0 };
                holdings[sym] = { qty: h.qty + qty, avgCost: (h.qty * h.avgCost + gross + fee) / (h.qty + qty) };
            } else {
                const h = holdings[sym];
                if (!h || h.qty < qty) throw new WalletError('持股不足（持有 ' + (h?.qty || 0) + ' 股）', 'insufficient_shares');
                await credit(Math.max(1, gross - fee), `賣出 ${sym} × ${qty}`, { category: 'invest' });
                stats.realized += gross - fee - h.avgCost * qty;
                holdings[sym] = { qty: h.qty - qty, avgCost: h.avgCost };
                if (holdings[sym].qty === 0) delete holdings[sym];
            }
            trades.push({ side, sym, qty, price: p, fee, ts: Date.now() });
            trades = trades.slice(-300);
            await Promise.all([SettingsDB.set(HOLD_KEY, holdings), SettingsDB.set(TRADES_KEY, trades), SettingsDB.set(STATS_KEY, stats)]);
            createToast((side === 'buy' ? '已買入 ' : '已賣出 ') + sym + ' × ' + qty, 'success');
        } catch (e) {
            createToast(e instanceof WalletError ? e.message : '交易失敗：' + e.message, 'error');
        } finally {
            busy = false;
            cash = await getBalance();
            if (alive) draw();
        }
    }

    async function review() {
        const list = Object.entries(holdings).filter(([, h]) => h.qty > 0);
        if (!list.length) return createToast('先買一些標的再請朋友點評', 'error');
        const characters = await CharactersDB.getAll();
        if (!characters.length) return createToast('還沒有角色可以點評', 'error');
        const s = await APIClient.getSettings();
        if (!s.api_url || !s.api_key) return createToast('請先到設定填寫 API', 'error');
        const form = await askForm({ title: '請誰來點評？', fields: [{ key: 'id', label: '朋友', type: 'select', options: characters.map(c => ({ value: c.id, label: c.name })) }], submitLabel: '請 TA 點評' });
        if (!form) return;
        busy = true; draw();
        try {
            const total = cash + holdingValue();
            const lines = list.map(([sym, h]) => `${sym} ${ASSETS.find(m => m.sym === sym).name}：${h.qty} 股，均價 ${fmtPrice(h.avgCost)}，現價 ${fmtPrice(price(sym))}（${pct((price(sym) / h.avgCost - 1) * 100)}）`).join('\n');
            const context = await buildAppContext({ characterId: form.id });
            const system = (context.systemPrompt || '') + '\n\n你是這個角色本人，用第一人稱、符合性格與說話方式，使用繁體中文。使用者在玩一個用虛擬金錢、虛構標的的投資模擬遊戲，請以朋友的口吻點評他的投資組合（3~5 句，可以調侃、鼓勵或提醒分散風險），明確把這當成遊戲，不要提供真實投資建議，不要提到自己是 AI。';
            report = await APIClient.complete([{ role: 'system', content: system }, { role: 'user', content: `我的投資組合（總資產 ${money(total)}，現金 ${money(cash)}，已實現損益 ${money(stats.realized)}）：\n${lines}\n你覺得怎麼樣？` }], { temperature: 0.9, maxTokens: 400 });
            const name = context.character?.name || '朋友';
            report = name + '：' + report;
            saveInteractionMemory({ characterId: form.id, userId: user?.id || '', sourceApp: 'invest', sourceType: 'interaction', sourceSubtype: 'social', content: `${user?.name || '使用者'}在投資模擬遊戲裡持有 ${list.map(([s2]) => s2).join('、')}，我點評了他的投資組合。`, importance: 0.3 });
        } catch (e) {
            createToast('點評失敗：' + e.message, 'error');
        } finally { busy = false; if (alive) draw(); }
    }

    async function onClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const a = btn.dataset.action;
        if (a === 'back') return Router.back();
        if (a === 'tab') { tab = btn.dataset.tab; return draw(); }
        if (a === 'open') { detail = btn.dataset.sym; return draw(); }
        if (a === 'close') { detail = null; return draw(); }
        if (a === 'buy' || a === 'sell') return trade(a);
        if (a === 'review') return review();
        if (a === 'refresh-world') return loadWorld(true);
        if (a === 'reset') {
            if (!await askConfirm('重置行情、持倉與交易紀錄？（錢包餘額不會變動，持股也不會換回現金）')) return;
            market = newMarket(); applyGap(localDate()); holdings = {}; trades = []; stats = { realized: 0 }; report = ''; detail = null;
            await Promise.all([SettingsDB.set(MARKET_KEY, market), SettingsDB.set(HOLD_KEY, holdings), SettingsDB.set(TRADES_KEY, trades), SettingsDB.set(STATS_KEY, stats)]);
            draw();
        }
    }

    let ticks = 0;
    let lastDate = localDate();
    const timer = setInterval(() => {
        if (localDate() !== lastDate) { lastDate = localDate(); loadWorld(); }
        advance(market, TICK_MS, bias);
        market.ts = Date.now();
        if (++ticks % 6 === 0) SettingsDB.set(MARKET_KEY, market);
        draw();
    }, TICK_MS);

    container.addEventListener('click', onClick);
    draw();
    loadWorld();
    return { element: container, cleanup: () => { alive = false; clearInterval(timer); SettingsDB.set(MARKET_KEY, market); } };
}

export default {
    id: 'invest',
    name: '投資模擬器',
    icon: 'show_chart',
    routes: [{ path: '/invest', render: renderInvest }],
    navItem: { label: '投資模擬器', icon: 'show_chart', path: '/invest', showInNav: true, order: 124 },
    stylesPath: 'js/apps/invest/style.css'
};
