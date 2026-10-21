import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { HealthDB, UsersDB } from '../../db.js';
import { PeriodCalculator } from '../../core/period-calculator.js';
import { askConfirm } from '../../core/dialogs.js';

const SYMPTOM_TAGS = ['經痛', '腰痠背痛', '頭痛', '疲倦', '腹脹', '情緒起伏', '食慾改變', '失眠', '胸部脹痛'];
const MOOD_TAGS = ['易怒', '低落', '焦慮', '敏感', '疲憊', '想吃東西'];
// 以前版本存的是英文標籤；載入時轉成中文，已勾選的項目才不會憑空消失
const LEGACY_TAGS = {
    'Cramps': '經痛', 'Back pain': '腰痠背痛', 'Headache': '頭痛', 'Fatigue': '疲倦', 'Bloating': '腹脹', 'Mood swings': '情緒起伏',
    'Appetite changes': '食慾改變', 'Insomnia': '失眠', 'Breast tenderness': '胸部脹痛',
    'Irritable': '易怒', 'Low mood': '低落', 'Anxious': '焦慮', 'Sensitive': '敏感', 'Tired': '疲憊', 'Cravings': '想吃東西'
};
const normalizeTags = list => (list || []).map(t => LEGACY_TAGS[t] || t);

const DEFAULT_REMINDER = { reminder_in_chat: true, reminder_days_before: 3, default_cycle_length: 28 };
const fmtDate = ts => new Date(ts).toLocaleDateString('zh-TW');

let currentUser = null;
let memoryTemplate = null;
let reminderSettings = { ...DEFAULT_REMINDER };

async function renderHealth(params) {
    const users = await UsersDB.getAll();
    currentUser = users[0];
    reminderSettings = { ...DEFAULT_REMINDER };

    if (currentUser) {
        memoryTemplate = await HealthDB.getMemoryTemplate(currentUser.id);
        const saved = await HealthDB.getPeriodSettings(currentUser.id);
        if (saved) reminderSettings = { ...DEFAULT_REMINDER, ...saved };
    }

    const container = createElement('div', 'app-container');

    container.innerHTML = `
        <header class="ios-header">
            <button class="ios-back-btn">
                <span class="material-symbols-outlined">chevron_left</span> 返回
            </button>
            <h1>健康管理</h1>
        </header>

        <div class="health-content">
            <section class="health-section">
                <h2>健康記憶</h2>
                <p class="section-desc">記錄你的狀況，綁定你的聊天室裡的角色會依自己的個性自然地關心你。</p>

                <div class="memory-card">
                    <h3>經期症狀</h3>
                    <div class="tag-container" id="symptom-tags"></div>
                </div>

                <div class="memory-card">
                    <h3>情緒變化</h3>
                    <div class="tag-container" id="mood-tags"></div>
                </div>

                <button class="save-btn" id="save-memory">儲存健康記憶</button>
            </section>

            <section class="health-section">
                <h2>經期紀錄</h2>
                <div class="period-calendar" id="period-calendar"></div>

                <button class="add-btn" id="add-period">新增經期紀錄</button>
            </section>

            <section class="health-section">
                <h2>聊天室提醒</h2>
                <p class="section-desc">依你的紀錄預測下次經期，快到時讓角色在聊天室裡自然地提醒、關心你。</p>
                <div class="form-group">
                    <label><input type="checkbox" id="remind-toggle"> 讓角色在聊天室提前關心</label>
                </div>
                <div class="form-group">
                    <label>提前幾天</label>
                    <input type="number" id="remind-days" min="1" max="14">
                </div>
                <div class="form-group">
                    <label>平均週期天數（紀錄不足時使用）</label>
                    <input type="number" id="cycle-len" min="21" max="45">
                </div>
                <button class="save-btn" id="save-reminder">儲存提醒設定</button>
            </section>

            <section class="health-section">
                <h2>用藥紀錄</h2>
                <div class="medication-list" id="medication-list">
                    <p class="empty-msg">尚無用藥紀錄</p>
                </div>
                <button class="add-btn" id="add-medication">新增用藥</button>
            </section>
        </div>
    `;

    const backBtn = container.querySelector('.ios-back-btn');
    backBtn.onclick = () => Router.back();

    renderSymptomTags(container);
    renderMoodTags(container);
    renderPeriodCalendar(container);
    renderMedicationList(container);

    const remindToggle = container.querySelector('#remind-toggle');
    const remindDays = container.querySelector('#remind-days');
    const cycleLen = container.querySelector('#cycle-len');
    remindToggle.checked = reminderSettings.reminder_in_chat !== false;
    remindDays.value = reminderSettings.reminder_days_before;
    cycleLen.value = reminderSettings.default_cycle_length;

    container.querySelector('#save-reminder').onclick = async () => {
        if (!currentUser) {
            createToast('請先建立使用者面具', 'error');
            return;
        }
        const days = Math.min(14, Math.max(1, parseInt(remindDays.value, 10) || DEFAULT_REMINDER.reminder_days_before));
        const cycle = Math.min(45, Math.max(21, parseInt(cycleLen.value, 10) || DEFAULT_REMINDER.default_cycle_length));
        reminderSettings = await HealthDB.savePeriodSettings({
            user_id: currentUser.id,
            reminder_in_chat: remindToggle.checked,
            reminder_days_before: days,
            default_cycle_length: cycle
        });
        remindDays.value = days;
        cycleLen.value = cycle;
        renderPeriodCalendar(container);
        createToast('提醒設定已儲存');
    };

    container.querySelector('#save-memory').onclick = async () => {
        if (!currentUser) {
            createToast('請先建立使用者面具', 'error');
            return;
        }

        const symptoms = [];
        container.querySelectorAll('#symptom-tags .tag.active').forEach(tag => {
            symptoms.push(tag.textContent);
        });

        const moods = [];
        container.querySelectorAll('#mood-tags .tag.active').forEach(tag => {
            moods.push(tag.textContent);
        });

        await HealthDB.saveMemoryTemplate({
            user_id: currentUser.id,
            period_symptoms: symptoms,
            period_mood_changes: moods
        });

        memoryTemplate = await HealthDB.getMemoryTemplate(currentUser.id);
        createToast('健康記憶已儲存');
    };

    const requireUser = fn => () => {
        if (!currentUser) {
            createToast('請先建立使用者面具', 'error');
            return;
        }
        fn(container);
    };
    container.querySelector('#add-period').onclick = requireUser(showAddPeriodDialog);
    container.querySelector('#add-medication').onclick = requireUser(showAddMedicationDialog);

    return { element: container, cleanup: null };
}

function renderSymptomTags(container) {
    const tagContainer = container.querySelector('#symptom-tags');
    tagContainer.innerHTML = '';
    const selected = normalizeTags(memoryTemplate?.period_symptoms);

    SYMPTOM_TAGS.forEach(tag => {
        const el = createElement('span', 'tag' + (selected.includes(tag) ? ' active' : ''));
        el.textContent = tag;
        el.onclick = () => el.classList.toggle('active');
        tagContainer.appendChild(el);
    });
}

function renderMoodTags(container) {
    const tagContainer = container.querySelector('#mood-tags');
    tagContainer.innerHTML = '';
    const selected = normalizeTags(memoryTemplate?.period_mood_changes);

    MOOD_TAGS.forEach(tag => {
        const el = createElement('span', 'tag' + (selected.includes(tag) ? ' active' : ''));
        el.textContent = tag;
        el.onclick = () => el.classList.toggle('active');
        tagContainer.appendChild(el);
    });
}

async function renderPeriodCalendar(container) {
    const calendarEl = container.querySelector('#period-calendar');
    if (!currentUser) {
        calendarEl.innerHTML = '<p class="empty-msg">請先建立使用者面具</p>';
        return;
    }

    const periods = await HealthDB.getRecentPeriods(currentUser.id, 12);
    const prediction = await PeriodCalculator.calculateNextPeriod(currentUser.id);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    let html = '<div class="calendar-header">';
    html += '<span>' + year + ' 年 ' + (month + 1) + ' 月</span>';
    html += '</div>';
    html += '<div class="calendar-grid">';
    html += '<div class="calendar-row header"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>';

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    html += '<div class="calendar-row">';
    for (let i = 0; i < firstDay; i++) {
        html += '<span class="empty"></span>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const timestamp = date.getTime();
        let classes = '';

        const isPeriod = periods.some(p => {
            const start = p.start_date;
            const end = p.end_date || start + 5 * 24 * 60 * 60 * 1000;
            return timestamp >= start && timestamp <= end;
        });

        if (isPeriod) classes = 'period';

        if (prediction && prediction.days_until >= 0) {
            const predictedDate = new Date(prediction.predicted_date);
            if (date.toDateString() === predictedDate.toDateString()) {
                classes = 'predicted';
            }
        }

        html += '<span class="' + classes + '">' + day + '</span>';

        if ((day + firstDay) % 7 === 0 && day < daysInMonth) {
            html += '</div><div class="calendar-row">';
        }
    }

    html += '</div></div>';

    html += '<div class="calendar-legend">';
    html += '<span><span class="legend-dot period"></span> 經期</span>';
    html += '<span><span class="legend-dot predicted"></span> 預測</span>';
    html += '</div>';

    if (prediction) {
        const text = prediction.days_until > 0 ? '下次經期：約 ' + prediction.days_until + ' 天後'
            : prediction.days_until === 0 ? '下次經期：預計就是今天'
                : '已超過預計日 ' + Math.abs(prediction.days_until) + ' 天';
        html += '<div class="prediction-info">' + text + '</div>';
    } else {
        html += '<div class="prediction-info">新增一筆經期紀錄後，就能預測下次經期</div>';
    }

    calendarEl.innerHTML = html;

    if (periods.length > 0) {
        const list = createElement('div', 'period-list');
        periods.forEach(p => {
            const row = createElement('div', 'medication-item');
            const info = createElement('div', 'med-info');
            info.append(
                createElement('span', 'med-name', { textContent: fmtDate(p.start_date) + (p.end_date ? ' – ' + fmtDate(p.end_date) : '') }),
                createElement('span', 'med-dosage', { textContent: p.notes || '' })
            );
            const del = createElement('button', 'delete-btn', { textContent: '刪除' });
            del.onclick = async () => {
                if (!await askConfirm('要刪除這筆經期紀錄嗎？')) return;
                await HealthDB.delete(p.id);
                renderPeriodCalendar(container);
                createToast('經期紀錄已刪除');
            };
            row.append(info, del);
            list.appendChild(row);
        });
        calendarEl.appendChild(list);
    }
}

async function renderMedicationList(container) {
    const listEl = container.querySelector('#medication-list');
    if (!currentUser) {
        listEl.innerHTML = '<p class="empty-msg">請先建立使用者面具</p>';
        return;
    }

    const medications = await HealthDB.getByType(currentUser.id, 'medication');

    if (medications.length === 0) {
        listEl.innerHTML = '<p class="empty-msg">尚無用藥紀錄</p>';
        return;
    }

    // 以 DOM 建立，避免把使用者輸入的藥名當成 HTML
    listEl.innerHTML = '';
    medications.forEach(med => {
        const row = createElement('div', 'medication-item');
        const info = createElement('div', 'med-info');
        info.append(createElement('span', 'med-name', { textContent: med.medication_name }), createElement('span', 'med-dosage', { textContent: med.dosage || '' }));
        const del = createElement('button', 'delete-btn', { textContent: '刪除' });
        del.onclick = async () => {
            await HealthDB.delete(med.id);
            renderMedicationList(container);
            createToast('用藥紀錄已刪除');
        };
        row.append(info, del);
        listEl.appendChild(row);
    });
}

function showAddPeriodDialog(container) {
    const dialog = createElement('div', 'dialog-overlay');
    dialog.innerHTML = `
        <div class="dialog">
            <h3>新增經期紀錄</h3>
            <div class="form-group">
                <label>開始日期</label>
                <input type="date" id="period-start">
            </div>
            <div class="form-group">
                <label>結束日期（選填）</label>
                <input type="date" id="period-end">
            </div>
            <div class="form-group">
                <label>備註</label>
                <textarea id="period-notes"></textarea>
            </div>
            <div class="dialog-btns">
                <button class="cancel-btn">取消</button>
                <button class="confirm-btn">儲存</button>
            </div>
        </div>
    `;

    dialog.querySelector('.cancel-btn').onclick = () => dialog.remove();
    dialog.querySelector('.confirm-btn').onclick = async () => {
        const start = dialog.querySelector('#period-start').value;
        const end = dialog.querySelector('#period-end').value;
        const notes = dialog.querySelector('#period-notes').value;

        if (!start) {
            createToast('請選擇開始日期', 'error');
            return;
        }
        if (end && new Date(end) < new Date(start)) {
            createToast('結束日期不能早於開始日期', 'error');
            return;
        }

        await HealthDB.createPeriod({
            user_id: currentUser.id,
            start_date: new Date(start).getTime(),
            end_date: end ? new Date(end).getTime() : null,
            notes
        });

        dialog.remove();
        renderPeriodCalendar(container);
        createToast('經期紀錄已儲存');
    };

    container.appendChild(dialog);
}

function showAddMedicationDialog(container) {
    const dialog = createElement('div', 'dialog-overlay');
    dialog.innerHTML = `
        <div class="dialog">
            <h3>新增用藥</h3>
            <div class="form-group">
                <label>藥品名稱</label>
                <input type="text" id="med-name" placeholder="例如：維他命 D">
            </div>
            <div class="form-group">
                <label>劑量</label>
                <input type="text" id="med-dosage" placeholder="例如：每天 1000 IU">
            </div>
            <div class="form-group">
                <label>備註</label>
                <textarea id="med-notes"></textarea>
            </div>
            <div class="dialog-btns">
                <button class="cancel-btn">取消</button>
                <button class="confirm-btn">儲存</button>
            </div>
        </div>
    `;

    dialog.querySelector('.cancel-btn').onclick = () => dialog.remove();
    dialog.querySelector('.confirm-btn').onclick = async () => {
        const name = dialog.querySelector('#med-name').value.trim();
        const dosage = dialog.querySelector('#med-dosage').value.trim();
        const notes = dialog.querySelector('#med-notes').value;

        if (!name) {
            createToast('請輸入藥品名稱', 'error');
            return;
        }

        await HealthDB.createMedication({
            user_id: currentUser.id,
            medication_name: name,
            dosage,
            notes
        });

        dialog.remove();
        renderMedicationList(container);
        createToast('用藥紀錄已儲存');
    };

    container.appendChild(dialog);
}

export default {
    id: 'health',
    name: '健康',
    icon: 'favorite',
    routes: [{ path: '/health', render: renderHealth }],
    navItem: { label: '健康', icon: 'favorite', path: '/health', showInNav: true, order: 30 },
    stylesPath: 'js/apps/health/style.css'
};
