import { createElement, createKakaoBottomSheet } from '../components.js';

// 取代瀏覽器的 prompt()：底部面板輸入。fields: [{ key, label, type, placeholder, required }]
// field 可帶 value（預設值）；type: 'select' 時用 options: [{ value, label }]
// 回傳 { key: value } 或使用者取消時回傳 null
export function askForm({ title, fields, submitLabel = '確定', hint }) {
    return new Promise(resolve => {
        const content = createElement('div', 'p-4 flex flex-col gap-3');
        if (hint) content.appendChild(createElement('div', 'text-xs text-gray-500', { textContent: hint }));
        const inputs = {};
        fields.forEach(f => {
            const wrap = createElement('div');
            wrap.appendChild(createElement('label', 'text-sm text-gray-500 block mb-1', { textContent: f.label }));
            let input;
            if (f.type === 'select') {
                input = createElement('select', 'ios-input');
                (f.options || []).forEach(o => input.appendChild(createElement('option', '', { value: o.value, textContent: o.label })));
            } else {
                input = createElement('input', 'ios-input', { type: f.type || 'text', placeholder: f.placeholder || '' });
                if (f.type === 'number') { input.min = '1'; input.step = '1'; input.inputMode = 'numeric'; }
            }
            if (f.value !== undefined && f.value !== null) input.value = f.value;
            input.style.cssText = 'width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:15px;';
            wrap.appendChild(input);
            inputs[f.key] = { input, field: f };
            content.appendChild(wrap);
        });
        const error = createElement('div', 'text-xs');
        error.style.color = '#d33';
        const submit = createElement('button', 'px-4 py-2 rounded-lg bg-kakao-yellow text-kakao-brown font-medium', { textContent: submitLabel });
        content.append(error, submit);

        let done = false;
        const finish = value => { if (!done) { done = true; resolve(value); } };
        const sheet = createKakaoBottomSheet([], { title, customContent: content });
        const origClose = sheet.close;
        sheet.close = () => { finish(null); origClose(); };
        sheet.overlay.addEventListener('click', () => finish(null));

        const submitNow = () => {
            const out = {};
            for (const [key, { input, field }] of Object.entries(inputs)) {
                const v = input.value.trim();
                if (field.required && !v) { error.textContent = '請填寫「' + field.label + '」'; return; }
                if (field.type === 'number' && v && !(Number(v) > 0)) { error.textContent = '「' + field.label + '」必須是大於 0 的數字'; return; }
                out[key] = field.type === 'number' ? Math.round(Number(v)) : v;
            }
            finish(out);
            origClose();
        };
        submit.onclick = submitNow;
        content.addEventListener('keydown', e => { if (e.key === 'Enter') submitNow(); });
        sheet.open();
        Object.values(inputs)[0]?.input.focus();
    });
}
