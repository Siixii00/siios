import { createElement, createToast, createKakaoBottomSheet } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { pickFile, compressImage } from './chat-media.js';

const ICONS_KEY = 'chat_custom_icons';
const MAX_ICONS = 60;
const ICON_PX = 128;

async function loadIcons() {
    const data = await SettingsDB.get(ICONS_KEY);
    return Array.isArray(data) ? data : [];
}

// ---- Icon：使用者自訂上傳的小圖 ----
export async function openIconPicker(onSend) {
    let icons = await loadIcons();
    const content = createElement('div', 'p-4 flex flex-col gap-3');
    let sheet;

    const render = () => {
        content.replaceChildren();
        const uploadBtn = createElement('button', 'px-3 py-2 rounded-lg bg-kakao-yellow text-kakao-brown text-sm font-medium', { textContent: '上傳新圖示' });
        uploadBtn.onclick = async () => {
            if (icons.length >= MAX_ICONS) {
                createToast('圖示最多 ' + MAX_ICONS + ' 個，請先刪除一些');
                return;
            }
            const file = await pickFile({ accept: 'image/*' });
            if (!file) return;
            try {
                const src = await compressImage(file, ICON_PX, 1, true);
                icons = [{ id: 'ic_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), name: (file.name || '圖示').replace(/\.[^.]+$/, ''), src }, ...icons];
                await SettingsDB.set(ICONS_KEY, icons);
                createToast('已新增圖示');
                render();
            } catch (e) {
                createToast(e.message || '新增圖示失敗', 'error');
            }
        };
        content.appendChild(uploadBtn);

        if (icons.length === 0) {
            content.appendChild(createElement('div', 'text-sm text-gray-500', { textContent: '還沒有圖示。上傳小圖後，之後就能在聊天中快速傳送。' }));
            return;
        }
        content.appendChild(createElement('div', 'text-xs text-gray-500', { textContent: '點圖示傳送，右上角 ✕ 刪除' }));
        const grid = createElement('div', 'grid grid-cols-4 gap-3');
        icons.forEach(ic => {
            const cell = createElement('div');
            cell.style.cssText = 'position:relative;aspect-ratio:1;';
            const btn = createElement('button');
            btn.style.cssText = 'width:100%;height:100%;border:1px solid #eee;border-radius:10px;background:transparent;padding:6px;cursor:pointer;';
            const img = createElement('img', '', { src: ic.src, alt: ic.name });
            img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
            btn.appendChild(img);
            btn.onclick = () => { sheet.close(); onSend({ type: 'icon', content: ic.name, meta: { src: ic.src, name: ic.name } }); };
            const del = createElement('button', '', { textContent: '✕', 'aria-label': '刪除圖示' });
            del.style.cssText = 'position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:none;background:#888;color:#fff;font-size:12px;cursor:pointer;';
            del.onclick = async () => {
                if (!confirm('刪除圖示「' + ic.name + '」？')) return;
                icons = icons.filter(x => x.id !== ic.id);
                await SettingsDB.set(ICONS_KEY, icons);
                render();
            };
            cell.append(btn, del);
            grid.appendChild(cell);
        });
        content.appendChild(grid);
    };
    render();
    sheet = createKakaoBottomSheet([], { title: 'Icon', customContent: content });
    sheet.open();
}

// ---- 分享：連結或文字 ----
export function openSharePrompt(onSend) {
    const content = createElement('div', 'p-4 flex flex-col gap-3');
    const mkInput = (placeholder, tag = 'input') => {
        const el = createElement(tag, 'ios-input', { placeholder });
        el.style.cssText = 'width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:14px;';
        return el;
    };
    const title = mkInput('標題（選填）');
    const desc = mkInput('想分享的文字（選填）', 'textarea');
    desc.rows = 3;
    const url = mkInput('連結 https://…（選填）');
    url.type = 'url';
    const err = createElement('div', 'text-xs');
    err.style.color = '#d33';
    const send = createElement('button', 'px-4 py-2 rounded-lg bg-kakao-yellow text-kakao-brown font-medium', { textContent: '分享' });
    content.append(title, desc, url, err, send);

    let sheet;
    send.onclick = () => {
        const t = title.value.trim();
        const d = desc.value.trim();
        const u = url.value.trim();
        if (!t && !d && !u) {
            err.textContent = '請至少填寫標題、文字或連結其中一項';
            return;
        }
        if (u && !/^https?:\/\/\S+$/i.test(u)) {
            err.textContent = '連結必須以 http:// 或 https:// 開頭';
            return;
        }
        sheet.close();
        onSend({ type: 'card', content: t || d || u, meta: { title: t || (d ? '' : u), desc: d, url: u } });
    };
    sheet = createKakaoBottomSheet([], { title: '分享', customContent: content });
    sheet.open();
}

// ---- 地圖：搜尋地點後傳送位置（OpenStreetMap Nominatim，免費、不需金鑰） ----
export function openPlaceSearch(onSend) {
    const content = createElement('div', 'p-4 flex flex-col gap-3');
    const row = createElement('div', 'flex gap-2');
    const input = createElement('input', 'ios-input', { placeholder: '輸入地點或地址', type: 'search' });
    input.style.cssText = 'flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;';
    const searchBtn = createElement('button', 'px-3 py-2 rounded-lg bg-kakao-yellow text-kakao-brown text-sm font-medium', { textContent: '搜尋' });
    row.append(input, searchBtn);
    const status = createElement('div', 'text-xs text-gray-500', { textContent: '搜尋結果來自 OpenStreetMap，需要網路連線' });
    const list = createElement('div', 'flex flex-col gap-2');
    content.append(row, status, list);

    let sheet;
    let busy = false;
    const search = async () => {
        const q = input.value.trim();
        if (!q || busy) return;
        busy = true;
        status.textContent = '搜尋中…';
        list.replaceChildren();
        try {
            const res = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=zh-TW&q=' + encodeURIComponent(q));
            if (!res.ok) throw new Error('搜尋服務回應錯誤（' + res.status + '）');
            const results = await res.json();
            if (!results.length) {
                status.textContent = '找不到「' + q + '」，換個關鍵字試試';
                return;
            }
            status.textContent = '點選要傳送的地點';
            results.forEach(r => {
                const label = (r.name || r.display_name.split(',')[0]).trim();
                const btn = createElement('button', 'text-left px-3 py-2 rounded-lg');
                btn.style.cssText = 'border:1px solid #eee;background:transparent;cursor:pointer;text-align:left;';
                btn.appendChild(createElement('div', 'text-sm font-medium', { textContent: label }));
                btn.appendChild(createElement('div', 'text-xs text-gray-500', { textContent: r.display_name }));
                btn.onclick = () => {
                    sheet.close();
                    onSend({ type: 'location', content: label, meta: { lat: parseFloat(r.lat), lng: parseFloat(r.lon), label } });
                };
                list.appendChild(btn);
            });
        } catch (e) {
            status.textContent = '搜尋失敗：' + (e.message || '網路錯誤') + '。請檢查網路後重試';
        } finally {
            busy = false;
        }
    };
    searchBtn.onclick = search;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

    sheet = createKakaoBottomSheet([], { title: '地圖', customContent: content });
    sheet.open();
}
