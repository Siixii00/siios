import { SettingsDB } from '../db.js';
import { ageOf as ageOfBirth, isAdultOn, unlockDateOf, fmtDate, toBirthString } from './age-core.js';

export { fmtDate, toBirthString };

// 年齡確認：第一次開啟時詢問生日（只存在這台裝置）。未滿 18 歲時鎖住不適合的內容，
// 判斷是用「今天的日期」即時計算，所以滿 18 歲當天會自動解鎖。
const KEY = 'user_birthdate';

// app id → 顯示名稱；'gacha' 是街機廳裡的抽卡模擬
export const RESTRICTED = { pub: '酒館', ao3: 'AO3', lofter: 'Lofter', dating: '約會', gacha: '抽卡模擬' };

let birth = null; // 'YYYY-MM-DD'

export async function loadBirthdate() {
    const v = await SettingsDB.get(KEY);
    birth = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    return birth;
}
export const hasBirthdate = () => !!birth;
export const getBirthdate = () => birth;

export const ageOf = (b = birth, now = new Date()) => ageOfBirth(b, now);
export const isAdult = (now = new Date()) => isAdultOn(birth, now);
export const unlockDate = () => unlockDateOf(birth);
export const isRestricted = id => id in RESTRICTED && !isAdult();

// 未滿 18 歲不能自己改生日（否則鎖就形同虛設）；成年後可以更正
export async function saveBirthdate(str) {
    if (birth && !isAdult()) throw new Error('未滿 18 歲時無法修改生日');
    await SettingsDB.set(KEY, str);
    birth = str;
}

// 給 AI 的額外提示：使用者未成年時，所有 AI 互動都要避開成人內容
export function minorSafetyPrompt() {
    if (isAdult()) return '';
    return '【使用者年齡保護】使用者是未成年（' + ageOf() + ' 歲）。無論角色設定或劇情如何，都不得出現性、裸露、性暗示、血腥暴力細節、飲酒或使用毒品的鼓勵、賭博誘導等不適合未成年的內容；遇到相關話題要婉轉轉移，保持友善健康的互動。';
}

export function lockedPageElement(name) {
    const el = document.createElement('div');
    el.className = 'app-container';
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:32px;text-align:center;gap:12px;background:#f5f5f7;color:#1c1c1e;';
    const when = unlockDate();
    el.innerHTML = `<div style="font-size:56px">🔒</div><h2 style="margin:0">${name}尚未開放</h2>
        <p style="margin:0;color:#6b6b70;line-height:1.6">這項內容僅限 18 歲以上使用。<br>${when ? '你將在 <strong>' + fmtDate(when) + '</strong> 滿 18 歲時自動解鎖。' : ''}</p>
        <button style="margin-top:12px;padding:12px 28px;border:none;border-radius:100px;background:#1c1c1e;color:#fff;font-weight:700;font-size:15px;cursor:pointer">返回</button>`;
    el.querySelector('button').onclick = () => { window.location.hash = '/home'; };
    return el;
}

function pickerHtml(y0) {
    const years = []; for (let y = y0; y >= y0 - 100; y--) years.push(y);
    const sel = (id, label, opts) => `<label style="flex:1;display:flex;flex-direction:column;gap:4px;font-size:12px;color:#6b6b70">${label}<select id="${id}" style="padding:12px 8px;border:1px solid #d1d1d6;border-radius:12px;font-size:16px;background:#fff;color:#1c1c1e">${opts}</select></label>`;
    return `<div style="display:flex;gap:8px;width:100%">
        ${sel('ag-y', '年', '<option value="">—</option>' + years.map(y => `<option value="${y}">${y}</option>`).join(''))}
        ${sel('ag-m', '月', '<option value="">—</option>' + Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join(''))}
        ${sel('ag-d', '日', '<option value="">—</option>' + Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join(''))}
    </div>`;
}

// 第一次開啟時顯示的全螢幕確認畫面，填完才會關閉
export function showAgeGate() {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.id = 'age-gate';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#f5f5f7;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif;';
        overlay.innerHTML = `<div style="max-width:380px;width:100%;display:flex;flex-direction:column;gap:16px;align-items:center;text-align:center;color:#1c1c1e">
            <div style="font-size:52px">🎂</div>
            <h2 style="margin:0">先確認一下年齡</h2>
            <p style="margin:0;color:#6b6b70;line-height:1.6;font-size:14px">為了提供適合你的內容，請選擇你的出生日期。資料只會存在這台裝置上。<br>未滿 18 歲時，部分內容會先鎖起來，等你滿 18 歲當天就會自動開放。</p>
            ${pickerHtml(new Date().getFullYear())}
            <p id="ag-err" style="margin:0;color:#d33;font-size:13px;min-height:1.2em"></p>
            <button id="ag-ok" style="width:100%;padding:14px;border:none;border-radius:100px;background:#1c1c1e;color:#fff;font-weight:700;font-size:16px;cursor:pointer">確認</button>
        </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('#ag-ok').onclick = async () => {
            const err = overlay.querySelector('#ag-err');
            const [y, m, d] = ['ag-y', 'ag-m', 'ag-d'].map(id => parseInt(overlay.querySelector('#' + id).value, 10));
            if (!y || !m || !d) { err.textContent = '請選擇完整的年、月、日'; return; }
            try {
                await saveBirthdate(toBirthString(y, m, d));
            } catch (e) { err.textContent = e.message; return; }
            overlay.remove();
            resolve();
        };
    });
}
