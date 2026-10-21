// 主畫面的排列：App 圖示的順序、隱藏哪些、Dock 放哪些。純函式（可在 node 測試）；畫面與拖曳在 homescreen.js。
// 資料只記 App 的路徑（path）：之後新增或移除 App 時，新的會排在最後，不見的自動略過。
export const MAX_DOCK = 4;
export const DEFAULT_DOCK = 3;

const uniq = list => [...new Set(list)];
const strs = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.length > 0 && x.length < 100) : []);

export function normalizeLayout(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    return { order: uniq(strs(r.order)), hidden: uniq(strs(r.hidden)), dock: Array.isArray(r.dock) ? uniq(strs(r.dock)).slice(0, MAX_DOCK) : null };
}

// items：[{ path, ... }]（registry 給的 App 清單）。回傳 { grid, hidden, dock }
export function arrange(items, rawLayout) {
    const layout = normalizeLayout(rawLayout);
    const byPath = new Map(items.map(i => [i.path, i]));
    const ordered = [];
    for (const p of layout.order) if (byPath.has(p)) ordered.push(byPath.get(p));
    for (const i of items) if (!layout.order.includes(i.path)) ordered.push(i);
    const hiddenSet = new Set(layout.hidden);
    const grid = ordered.filter(i => !hiddenSet.has(i.path));
    const hidden = ordered.filter(i => hiddenSet.has(i.path));
    // dock 沒設定過：沿用原本的行為（前 3 個）；設定過就照設定（不見的 App 略過）
    const dock = layout.dock === null ? grid.slice(0, DEFAULT_DOCK) : layout.dock.map(p => byPath.get(p)).filter(Boolean);
    return { grid, hidden, dock };
}

// 把 path 移到 grid 的第 toIndex 個位置（toIndex 是目前畫面上看得到的圖示順序）。回傳新的 layout
export function moveTo(items, rawLayout, path, toIndex) {
    const layout = normalizeLayout(rawLayout);
    const { grid, hidden } = arrange(items, layout);
    const from = grid.findIndex(i => i.path === path);
    if (from < 0) return layout;
    const paths = grid.map(i => i.path);
    paths.splice(from, 1);
    paths.splice(Math.max(0, Math.min(paths.length, toIndex)), 0, path);
    return { ...layout, order: [...paths, ...hidden.map(i => i.path)] };
}

export function setHidden(items, rawLayout, path, hide) {
    const layout = normalizeLayout(rawLayout);
    if (!items.some(i => i.path === path)) return layout;
    const hidden = hide ? uniq([...layout.hidden, path]) : layout.hidden.filter(p => p !== path);
    // 隱藏的 App 也要離開 Dock；還原時放回網格最後面
    const dock = layout.dock && hide ? layout.dock.filter(p => p !== path) : layout.dock;
    if (hide) return { ...layout, hidden, dock };
    // 還原：放到網格最後面（先把目前的完整順序寫下來，路徑才會真的排最後）
    const now = arrange(items, layout);
    const order = [...now.grid, ...now.hidden].map(i => i.path).filter(p => p !== path);
    return { ...layout, hidden, dock, order: [...order, path] };
}

// 把 App 加進／移出 Dock。第一次動 Dock 時先把目前預設的 Dock 展開成明確的清單。at：加入的位置（預設最後）
export function setDock(items, rawLayout, path, on, at = null) {
    const layout = normalizeLayout(rawLayout);
    const current = arrange(items, layout).dock.map(i => i.path);
    let dock = current.filter(p => p !== path);
    if (on) {
        if (!items.some(i => i.path === path) || layout.hidden.includes(path)) return { ...layout, dock: current };
        dock.splice(at === null ? dock.length : Math.max(0, Math.min(dock.length, at)), 0, path);
        if (dock.length > MAX_DOCK) dock = dock.slice(0, MAX_DOCK); // 滿了：最後一個擠出去
    }
    return { ...layout, dock };
}

export const pageCount = (n, perPage) => Math.max(1, Math.ceil(n / perPage));
export const isCustomized = raw => { const l = normalizeLayout(raw); return !!(l.order.length || l.hidden.length || l.dock); };
