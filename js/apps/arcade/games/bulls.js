import { loadProgress, completeLevel, levelGridHtml, starText, totalStars } from './levels.js';
import { LEVELS, DIGITS, score, randomSecret, starsFor } from './bulls-core.js';

const GAME = 'bulls';

export async function mount(root) {
    let progress = await loadProgress(GAME);
    let level = 0, len = 3, tries = 10, secret, guess, history, finished = false, won = false, stars = 0;

    function showMenu() {
        level = 0;
        root.innerHTML = `<div class="ag-wrap">
            <p class="lv-summary">累計 ★ ${totalStars(progress)} / ${LEVELS.length * 3}</p>
            ${levelGridHtml(progress, LEVELS.length, i => LEVELS[i - 1].len + ' 位·' + LEVELS[i - 1].tries + ' 次')}
            <p class="ag-hint">猜電腦想的數字（每個數字不重複）。A＝數字和位置都對，B＝數字對但位置不對</p>
        </div>`;
    }

    function startLevel(lv) {
        level = lv; len = LEVELS[lv - 1].len; tries = LEVELS[lv - 1].tries;
        secret = randomSecret(len); guess = []; history = []; finished = false; won = false; stars = 0;
        draw();
    }

    function draw() {
        const overlay = finished ? `<div class="m3-overlay"><div class="m3-card"><h2>${won ? '🎉 猜中了！' : '😢 次數用完了'}</h2>${won ? `<p class="m3-stars">${starText(stars)}</p><p>用了 ${history.length} 次</p>` : `<p>答案是 <strong>${secret.join('')}</strong></p>`}
            <div class="m3-btns">${won && level < LEVELS.length ? '<button data-act="next">下一關</button>' : ''}<button data-act="again">${won ? '再玩一次' : '再試一次'}</button><button data-act="menu">選關</button></div></div></div>` : '';
        root.innerHTML = `
        <div class="ag-wrap" style="position:relative">
            <div class="lv-bar"><button class="ag-btn" data-act="menu">‹ 選關</button><span>第 ${level} 關 · ${len} 位數</span></div>
            <div class="ag-bar"><div><span>剩餘次數</span><strong>${tries - history.length}/${tries}</strong></div><div><span>三星</span><strong>≤ ${Math.ceil(tries * 0.6)} 次</strong></div></div>
            <div class="bl-history">${history.map(h => `<div class="bl-row"><span class="bl-code">${h.guess.join(' ')}</span><span class="bl-fb"><b>${h.a}A</b><b>${h.b}B</b></span></div>`).join('') || '<p class="ag-hint">還沒猜過，從任意一組開始吧</p>'}</div>
            <div class="bl-slots">${Array.from({ length: len }, (_, i) => `<span class="bl-slot ${guess[i] !== undefined ? 'full' : ''}">${guess[i] ?? ''}</span>`).join('')}</div>
            <div class="bl-pad">${Array.from({ length: DIGITS }, (_, d) => `<button data-d="${d}" ${guess.includes(d) ? 'disabled' : ''}>${d}</button>`).join('')}</div>
            <div class="ag-levels"><button class="ag-chip" data-act="back">⌫ 退一格</button><button class="ag-chip on" data-act="submit" ${guess.length === len ? '' : 'disabled'}>送出</button></div>
            ${overlay}
        </div>`;
    }

    async function submit() {
        if (finished || guess.length !== len) return;
        const fb = score(secret, guess);
        history.push({ guess: guess.slice(), ...fb });
        guess = [];
        if (fb.a === len) {
            finished = true; won = true; stars = starsFor(history.length, tries);
            draw();
            progress = await completeLevel(GAME, level, stars, LEVELS.length);
            return;
        }
        if (history.length >= tries) finished = true;
        draw();
    }

    root.addEventListener('click', e => {
        const d = e.target.closest('[data-d]'), lv = e.target.closest('.lv-btn'), act = e.target.closest('[data-act]')?.dataset.act;
        if (d && !d.disabled) { if (!finished && guess.length < len) { guess.push(+d.dataset.d); draw(); } }
        else if (lv && !lv.disabled) startLevel(+lv.dataset.lv);
        else if (act === 'menu') showMenu();
        else if (act === 'again') startLevel(level);
        else if (act === 'next') startLevel(level + 1);
        else if (act === 'back') { guess.pop(); draw(); }
        else if (act === 'submit') submit();
    });
    const onKey = e => {
        if (!level || finished) return;
        if (/^[0-9]$/.test(e.key) && guess.length < len && !guess.includes(+e.key)) { guess.push(+e.key); draw(); }
        else if (e.key === 'Backspace') { guess.pop(); draw(); }
        else if (e.key === 'Enter') submit();
    };
    window.addEventListener('keydown', onKey);
    showMenu();
    return () => window.removeEventListener('keydown', onKey);
}
