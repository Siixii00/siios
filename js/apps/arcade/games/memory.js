import { loadProgress, completeLevel, levelGridHtml, starText, totalStars, loadDaily, completeDaily, dailyButtonHtml, dailyOverlayNote } from './levels.js';
import { dailySeed, dailyLevel, seededRng } from './daily.js';
import { LEVELS, cols, makeDeck, starsFor } from './memory-core.js';

const GAME = 'memory';

export async function mount(root) {
    let progress = await loadProgress(GAME);
    let todayInfo = await loadDaily(GAME), daily = false, dailyResult = null;
    let level = 0, cards, flipped, moves, matched, locked, startedAt, timerId, elapsed, finished, failed, stars;

    function showMenu() {
        clearInterval(timerId);
        root.innerHTML = `<div class="ag-wrap">
            <p class="lv-summary">累計 ★ ${totalStars(progress)} / ${LEVELS.length * 3}</p>
            ${dailyButtonHtml(todayInfo, dailyLevel(GAME, LEVELS.length))}
            ${levelGridHtml(progress, LEVELS.length, n => LEVELS[n - 1].pairs + ' 對')}
            <p class="ag-hint">在步數上限內翻完所有牌；步數越少星星越多</p>
        </div>`;
        level = 0;
    }

    function startLevel(n, isDaily = false) {
        clearInterval(timerId);
        daily = isDaily; dailyResult = null;
        level = n;
        const lv = LEVELS[n - 1];
        cards = makeDeck(lv.pairs, isDaily ? seededRng(dailySeed(GAME)) : Math.random);
        flipped = []; moves = 0; matched = new Set(); locked = false; startedAt = 0; elapsed = 0; finished = false; failed = false; stars = 0;
        draw();
    }

    function draw() {
        const lv = LEVELS[level - 1];
        const overlay = finished || failed ? `<div class="m3-overlay"><div class="m3-card"><h2>${finished ? '🎉 完成！' : '😢 步數用完了'}</h2>${finished ? `<p class="m3-stars">${starText(stars)}</p><p>${moves} 步、${elapsed} 秒</p>` : '<p>再專心記一下位置吧</p>'}
            ${dailyOverlayNote(dailyResult)}<div class="m3-btns">${finished && !daily && level < LEVELS.length ? '<button data-act="next">下一關</button>' : ''}<button data-act="again">${finished ? '再玩一次' : '再試一次'}</button><button data-act="menu">選關</button></div></div></div>` : '';
        root.innerHTML = `
        <div class="ag-wrap" style="position:relative">
            <div class="lv-bar"><button class="ag-btn" data-act="menu">‹ 選關</button><span>第 ${level} 關 · ${lv.pairs} 對</span></div>
            <div class="ag-bar"><div><span>步數</span><strong>${moves}/${lv.limit}</strong></div><div><span>時間</span><strong id="mm-time">${elapsed}s</strong></div></div>
            <div class="ag-board memory" style="grid-template-columns:repeat(${cols(lv.pairs)},1fr)">${cards.map((c, i) => {
                const open = flipped.includes(i) || matched.has(i);
                return `<button class="mm-card ${open ? 'open' : ''} ${matched.has(i) ? 'done' : ''}" data-i="${i}">${open ? c.face : '❓'}</button>`;
            }).join('')}</div>
            <p class="ag-hint">翻開兩張相同的牌就能消除</p>
            ${overlay}
        </div>`;
    }

    async function flip(i) {
        if (locked || finished || failed || flipped.includes(i) || matched.has(i)) return;
        const lv = LEVELS[level - 1];
        if (!startedAt) {
            startedAt = Date.now();
            timerId = setInterval(() => { elapsed = Math.floor((Date.now() - startedAt) / 1000); const t = root.querySelector('#mm-time'); if (t) t.textContent = elapsed + 's'; }, 500);
        }
        flipped.push(i);
        if (flipped.length < 2) return draw();
        moves++;
        const [a, b] = flipped;
        if (cards[a].face === cards[b].face) {
            matched.add(a); matched.add(b); flipped = [];
            if (matched.size === cards.length) {
                finished = true; clearInterval(timerId); elapsed = Math.floor((Date.now() - startedAt) / 1000);
                stars = starsFor(lv.pairs, moves);
                if (daily) { dailyResult = await completeDaily(GAME, stars); todayInfo = await loadDaily(GAME); } else progress = await completeLevel(GAME, level, stars, LEVELS.length);
            } else if (moves >= lv.limit) { failed = true; clearInterval(timerId); }
            return draw();
        }
        locked = true;
        if (moves >= lv.limit) { failed = true; clearInterval(timerId); }
        draw();
        setTimeout(() => { flipped = []; locked = false; if (level) draw(); }, 700);
    }

    root.addEventListener('click', e => {
        const card = e.target.closest('.mm-card'), lv = e.target.closest('.lv-btn'), act = e.target.closest('[data-act]')?.dataset.act;
        if (card) flip(+card.dataset.i);
        else if (lv && !lv.disabled) startLevel(+lv.dataset.lv);
        else if (act === 'menu') showMenu();
        else if (act === 'again') startLevel(level, daily);
        else if (act === 'daily') startLevel(dailyLevel(GAME, LEVELS.length), true);
        else if (act === 'next') startLevel(level + 1);
    });
    showMenu();
    return () => clearInterval(timerId);
}
