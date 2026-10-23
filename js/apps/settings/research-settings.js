import { createElement, createIOSNavBar, createToast } from '../../components.js';
import { askConfirm } from '../../core/dialogs.js';
import { getState, previewPayload, enable, disable } from '../../core/research.js';
import { TRACKED_APPS } from '../../core/research-core.js';

// 研究參與（選填）：說明收集什麼、不收集什麼，讓使用者自己決定要不要參加，隨時可以退出並刪除資料。
const line = (text, cls = '') => createElement('p', `text-sm leading-relaxed ${cls}`, { textContent: text });

function card(title, children) {
    const c = createElement('div', 'bg-white rounded-xl shadow-sm p-4 space-y-2');
    c.appendChild(createElement('div', 'font-semibold', { textContent: title }));
    children.forEach(ch => c.appendChild(ch));
    return c;
}

function bullets(items) {
    const ul = createElement('ul', 'text-sm leading-relaxed list-disc pl-5 space-y-1');
    items.forEach(t => ul.appendChild(createElement('li', '', { textContent: t })));
    return ul;
}

async function renderResearchSettings() {
    const container = createElement('div', 'app-container');
    const header = createIOSNavBar({ title: '研究參與（選填）', backPath: '/settings' });
    container.appendChild(header);
    const main = createElement('main', 'p-4 space-y-4');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    container.appendChild(main);

    const draw = async () => {
        main.innerHTML = '';
        const st = await getState();
        if (!st.available) {
            main.appendChild(card('目前不開放', [line('這項研究目前沒有開放，或你的年齡尚未符合參加條件（需年滿 18 歲）。不會收集任何資料。', 'text-ios-muted')]));
            return;
        }

        main.appendChild(card('這是什麼？', [
            line('開發者正在做一份研究論文，想了解大家「這週用過哪些 App」。參加完全自願，不參加不會有任何差別，也隨時可以退出。')
        ]));
        main.appendChild(card('會收集', [bullets([
            '一組隨機產生的匿名編號（和你的名字、帳號、裝置都無關）',
            '「第幾週」（例如 2026-W43），沒有日期、沒有時間點',
            '這週你用過的 App 名稱清單（只有「有／沒有用過」，沒有次數、沒有停留時間）'
        ])]));
        main.appendChild(card('絕對不會收集', [bullets([
            '你的聊天、輸入的文字、角色資料、AI 生成的任何內容',
            '你的 API 網址與金鑰、備份、記憶、照片、位置',
            '姓名、信箱，也不會儲存 IP 位址、裝置或瀏覽器資訊（網路連線本身一定會讓接收伺服器看到連線來源，這是技術上避免不了的，但程式不讀取也不儲存）',
            '成人限定的 App（酒館、約會、AO3、Lofter）和設定、通行密鑰等頁面，完全不記錄'
        ])]));

        const preview = createElement('pre', 'text-xs bg-gray-100 rounded-lg p-3 overflow-x-auto');
        const p = await previewPayload();
        preview.textContent = p ? JSON.stringify(p, null, 2)
            : '（目前還沒有資料。參加後，打開過的 App 會出現在這裡；以下是格式範例）\n' + JSON.stringify({ v: 1, pid: '匿名編號', week: '2026-W43', apps: ['chats', 'music'] }, null, 2);
        main.appendChild(card('實際會送出的資料長這樣', [
            line('每天最多送出一次，而且只有下面這四個欄位：', 'text-ios-muted'), preview,
            line(`可能出現的 App 只有固定的 ${TRACKED_APPS.length} 個名稱，其他東西送不出去。`, 'text-ios-muted')
        ]));

        if (st.enabled && st.consentCurrent) {
            main.appendChild(card('你已參加', [
                line('匿名編號：' + st.pid, 'text-xs break-all text-ios-muted'),
                line('想退出的話，可以只停止收集，或停止並請求刪除已送出的資料。', 'text-ios-muted')
            ]));
            const stop = createElement('button', 'ios-btn ios-btn-secondary w-full', { textContent: '停止參加（保留已送出的資料）' });
            stop.onclick = async () => { await disable(); createToast('已停止參加'); draw(); };
            const del = createElement('button', 'ios-btn w-full', { textContent: '停止參加並刪除我已送出的資料' });
            del.style.cssText = 'background:#dc2626;color:#fff';
            del.onclick = async () => {
                if (!await askConfirm('會請求伺服器刪除這個匿名編號已送出的全部資料，無法復原。', { title: '刪除資料', confirmLabel: '刪除' })) return;
                const r = await disable({ deleteRemote: true });
                createToast(r === 'deleted' ? '已停止參加，資料已刪除' : '已停止參加，但刪除請求失敗（可稍後再試）', r === 'deleted' ? 'success' : 'error');
                draw();
            };
            main.appendChild(stop);
            main.appendChild(del);
        } else {
            const join = createElement('button', 'ios-btn ios-btn-primary w-full', { textContent: '我了解，願意參加' });
            join.onclick = async () => {
                if (!await askConfirm('我已閱讀上面的說明，同意以匿名方式提供「每週用過哪些 App」給這份研究使用。我可以隨時退出並要求刪除資料。', { title: '參加研究', confirmLabel: '同意參加', cancelLabel: '再想想' })) return;
                try { await enable(); createToast('感謝你的參與！', 'success'); } catch (e) { createToast(e.message, 'error'); }
                draw();
            };
            main.appendChild(join);
            main.appendChild(line('不參加也完全沒關係，什麼都不用做。', 'text-center text-ios-muted'));
        }
    };
    await draw();
    return { element: container, cleanup: null };
}

export default {
    id: 'research-settings',
    name: '研究參與',
    routes: [{ path: '/settings/research', render: renderResearchSettings }]
};
