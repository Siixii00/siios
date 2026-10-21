import Router from './router.js';
import { createElement, createIcon } from './components.js';
import { getNavItems } from './apps/registry.js';
import { applyWallpaper } from './core/wallpapers.js';
import { createWidgetsSection } from './core/widgets.js';
import { SettingsDB } from './db.js';
import { arrange, moveTo, setHidden, setDock, pageCount, normalizeLayout, MAX_DOCK } from './core/home-layout.js';

const APPS_PER_PAGE = 8;
const LAYOUT_KEY = 'home_layout';
const LONG_PRESS_MS = 550;
const DRAG_THRESHOLD = 6;

const HomeScreen = {
    apps: [],
    layout: normalizeLayout(null),
    currentPage: 0,
    totalPages: 1,
    touchStartX: 0,
    touchCurrentX: 0,
    isDragging: false,
    editing: false,
    pagesContainer: null,
    pagesWrapper: null,
    dotsContainer: null,
    dockEl: null,
    trayEl: null,
    container: null,
    drag: null,
    android: false,
    drawer: null,
    touchStartY: 0,
    touchCurrentY: 0,

    async create() {
        this.apps = (await getNavItems()).map(a => ({ ...a, id: a.label.toLowerCase().replace(/\s+/g, '-') }));
        try { this.layout = normalizeLayout(await SettingsDB.get(LAYOUT_KEY)); } catch (_) { this.layout = normalizeLayout(null); }
        this.currentPage = 0;
        this.editing = false;
        this.drawer = null;
        this.android = document.documentElement.dataset.sxUi === 'android';

        const container = createElement('div', 'home-screen' + (this.android ? ' android' : ''));
        this.container = container;

        const wallpaper = createElement('div', 'home-wallpaper');
        container.appendChild(wallpaper);
        await applyWallpaper(wallpaper, 'home');

        const content = createElement('div', 'home-content');

        if (this.android) content.appendChild(this.createGlance());

        const widgets = await createWidgetsSection();
        if (widgets) content.appendChild(widgets);

        const pagesWrapper = createElement('div', 'home-pages-wrapper');
        this.pagesWrapper = pagesWrapper;
        this.pagesContainer = createElement('div', 'home-pages');
        pagesWrapper.appendChild(this.pagesContainer);
        content.appendChild(pagesWrapper);

        this.dotsContainer = createElement('div', 'home-page-dots');
        content.appendChild(this.dotsContainer);

        // 編輯模式才會出現：隱藏的 App 放在這裡，點一下就放回主畫面
        this.trayEl = createElement('div', 'home-tray');
        content.appendChild(this.trayEl);

        // Android：Dock 上面有一條搜尋列，點下去（或在桌面往上滑）打開 App 抽屜
        if (this.android) {
            const search = createElement('button', 'home-search');
            search.append(createIcon('search', 'home-search-icon', true), createElement('span', '', { textContent: '搜尋 App' }));
            search.onclick = () => this.openDrawer(true);
            content.appendChild(search);
        }

        this.dockEl = createElement('div', 'home-dock');
        content.appendChild(this.dockEl);

        const done = createElement('button', 'home-edit-done', { textContent: '完成' });
        done.onclick = () => this.exitEdit();
        container.appendChild(done);

        container.appendChild(content);
        this.renderAll();
        this.setupSwipe(pagesWrapper);
        return container;
    },

    // ───── 畫面 ─────
    arranged() { return arrange(this.apps, this.layout, this.android ? 4 : 3); },

    // Android 桌面最上面的日期（Pixel 的「一覽」）
    createGlance() {
        const now = new Date();
        const box = createElement('div', 'home-glance');
        box.appendChild(createElement('div', 'home-glance-date', { textContent: now.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' }) }));
        return box;
    },

    // ───── Android 的 App 抽屜：所有 App（包含主畫面隱藏的）依名稱排序，可搜尋 ─────
    openDrawer(focusSearch = false) {
        if (this.drawer || this.editing) return;
        const drawer = createElement('div', 'home-drawer');
        const handle = createElement('button', 'home-drawer-handle', { title: '收起' });
        handle.onclick = () => this.closeDrawer();
        const input = createElement('input', 'home-drawer-search', { type: 'search', placeholder: '搜尋 App' });
        const list = createElement('div', 'home-drawer-grid');
        const sorted = [...this.apps].sort((a, b) => String(a.label).localeCompare(String(b.label), 'zh-Hant'));
        const draw = () => {
            const q = input.value.trim().toLowerCase();
            list.replaceChildren();
            sorted.filter(a => !q || String(a.label).toLowerCase().includes(q)).forEach(app => {
                const item = createElement('div', 'home-app-icon');
                const bg = createElement('div', 'home-app-icon-bg');
                bg.appendChild(createIcon(app.icon, 'text-white text-3xl', true));
                item.append(bg, createElement('span', 'home-app-label', { textContent: app.label }));
                item.onclick = () => { this.closeDrawer(); Router.navigate(app.path); };
                list.appendChild(item);
            });
            if (!list.children.length) list.appendChild(createElement('div', 'home-drawer-empty', { textContent: '沒有符合的 App' }));
        };
        input.oninput = draw;
        // 往下拉（在清單最上面時）收起
        let y0 = null;
        list.addEventListener('touchstart', e => { y0 = list.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
        list.addEventListener('touchend', e => { if (y0 !== null && e.changedTouches[0].clientY - y0 > 90) this.closeDrawer(); y0 = null; });
        drawer.append(handle, input, list);
        this.container.appendChild(drawer);
        this.drawer = drawer;
        draw();
        setTimeout(() => drawer.classList.add('open'), 20); // 下一個 tick 再加，才會有滑上來的動畫
        if (focusSearch) setTimeout(() => input.focus(), 250);
    },

    closeDrawer() {
        const d = this.drawer; if (!d) return;
        this.drawer = null;
        d.classList.remove('open');
        setTimeout(() => d.remove(), 250);
    },

    renderAll() {
        const { grid, hidden, dock } = this.arranged();
        this.totalPages = pageCount(grid.length, APPS_PER_PAGE);
        if (this.currentPage >= this.totalPages) this.currentPage = this.totalPages - 1;

        this.pagesContainer.replaceChildren();
        for (let p = 0; p < this.totalPages; p++) {
            const page = createElement('div', 'home-page');
            const gridEl = createElement('div', 'home-app-grid');
            grid.slice(p * APPS_PER_PAGE, (p + 1) * APPS_PER_PAGE).forEach(app => gridEl.appendChild(this.createAppIcon(app)));
            page.appendChild(gridEl);
            this.pagesContainer.appendChild(page);
        }
        this.pagesContainer.style.transition = 'none';
        this.pagesContainer.style.transform = `translateX(-${this.currentPage * 100}%)`;
        this.renderDots();

        this.dockEl.replaceChildren();
        dock.forEach(app => this.dockEl.appendChild(this.createDockIcon(app)));

        this.trayEl.replaceChildren();
        if (this.editing) {
            this.trayEl.appendChild(createElement('span', 'home-tray-label', { textContent: hidden.length ? '已隱藏（點一下放回）' : '長按拖曳可以換位置；點 ✕ 可以隱藏' }));
            hidden.forEach(app => {
                const chip = createElement('button', 'home-tray-chip', { textContent: '＋ ' + app.label });
                chip.onclick = () => this.update(l => setHidden(this.apps, l, app.path, false));
                this.trayEl.appendChild(chip);
            });
        }
        this.container.classList.toggle('editing', this.editing);
    },

    renderDots() {
        this.dotsContainer.innerHTML = '';
        for (let i = 0; i < this.totalPages; i++) {
            const dot = createElement('span', `home-page-dot${i === this.currentPage ? ' active' : ''}`);
            this.dotsContainer.appendChild(dot);
        }
    },

    goToPage(index) {
        if (index < 0 || index >= this.totalPages) return;
        this.currentPage = index;
        this.pagesContainer.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        this.pagesContainer.style.transform = `translateX(-${index * 100}%)`;
        this.renderDots();
    },

    // 改排列：存起來再重畫
    async update(fn) {
        this.layout = fn(this.layout);
        this.renderAll();
        try { await SettingsDB.set(LAYOUT_KEY, this.layout); } catch (e) { console.warn('[Home] 儲存排列失敗：', e); }
    },

    enterEdit() {
        if (this.editing) return;
        this.editing = true;
        // Dock 沒設定過時是「網格的前 3 個」：開始編輯就先固定下來，不然拖動網格順序時 Dock 會跟著變
        if (this.layout.dock === null) this.layout = { ...this.layout, dock: this.arranged().dock.map(a => a.path) };
        this.renderAll();
    },

    exitEdit() {
        this.editing = false;
        this.endDrag(false);
        this.renderAll();
    },

    // ───── 換頁（滑動）─────
    setupSwipe(wrapper) {
        const handleStart = (x, y) => {
            if (this.editing) return;
            this.isDragging = true;
            this.touchStartX = x;
            this.touchCurrentX = x;
            this.touchStartY = y;
            this.touchCurrentY = y;
            this.pagesContainer.style.transition = 'none';
        };

        const handleMove = (x, y) => {
            if (!this.isDragging) return;
            this.touchCurrentX = x;
            this.touchCurrentY = y;
            const diff = this.touchCurrentX - this.touchStartX;
            const offset = -this.currentPage * 100;
            const pxToPercent = (diff / wrapper.offsetWidth) * 100;
            this.pagesContainer.style.transform = `translateX(${offset + pxToPercent}%)`;
        };

        const handleEnd = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.pagesContainer.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

            const diff = this.touchCurrentX - this.touchStartX;
            const threshold = wrapper.offsetWidth * 0.2;
            // Android：明顯往上滑（直的比橫的多）打開 App 抽屜
            const dy = this.touchStartY - this.touchCurrentY;
            if (this.android && dy > 70 && dy > Math.abs(diff)) { this.goToPage(this.currentPage); this.openDrawer(); return; }

            if (diff < -threshold && this.currentPage < this.totalPages - 1) {
                this.goToPage(this.currentPage + 1);
            } else if (diff > threshold && this.currentPage > 0) {
                this.goToPage(this.currentPage - 1);
            } else {
                this.goToPage(this.currentPage);
            }
        };

        wrapper.addEventListener('touchstart', (e) => {
            handleStart(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        wrapper.addEventListener('touchmove', (e) => {
            handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        wrapper.addEventListener('touchend', handleEnd);

        wrapper.addEventListener('mousedown', (e) => {
            handleStart(e.clientX, e.clientY);
        });

        wrapper.addEventListener('mousemove', (e) => {
            if (this.isDragging) handleMove(e.clientX, e.clientY);
        });

        wrapper.addEventListener('mouseup', handleEnd);
        wrapper.addEventListener('mouseleave', handleEnd);
    },

    getColorForApp(name) {
        const colors = {
            'Chats': '#34C759',
            'KakaoTalk': '#34C759',
            'World Info': '#5856D6',
            'Settings': '#8E8E93',
            'Album': '#8E8E93',
            'Weather': '#5856D6',
            'Music': '#1D1B20',
            'Pomodoro': '#8E8E93',
            'Memory': '#8E8E93',
            'Stay': '#8E8E93'
        };
        return colors[name] || '#007AFF';
    },

    // ───── 圖示：點一下開啟；長按進入編輯；編輯時可以拖曳 ─────
    createAppIcon(app) {
        const iconContainer = createElement('div', 'home-app-icon');
        iconContainer.dataset.path = app.path;

        const iconBg = createElement('div', 'home-app-icon-bg');
        iconBg.appendChild(createIcon(app.icon, 'text-white text-3xl', true));
        iconContainer.appendChild(iconBg);

        const label = createElement('span', 'home-app-label', { textContent: app.label });
        iconContainer.appendChild(label);

        const x = createElement('button', 'home-icon-x', { textContent: '✕', title: '隱藏' });
        x.addEventListener('pointerdown', e => e.stopPropagation());
        x.onclick = e => { e.stopPropagation(); this.update(l => setHidden(this.apps, l, app.path, true)); };
        iconContainer.appendChild(x);

        this.wireIcon(iconContainer, app, 'grid');
        return iconContainer;
    },

    createDockIcon(app) {
        const iconContainer = createElement('div', 'home-dock-icon');
        iconContainer.dataset.path = app.path;

        const iconBg = createElement('div', 'home-dock-icon-bg');
        iconBg.appendChild(createIcon(app.icon, 'text-white text-2xl', true));
        iconContainer.appendChild(iconBg);

        this.wireIcon(iconContainer, app, 'dock');
        return iconContainer;
    },

    wireIcon(el, app, from) {
        let pressTimer = null, sx = 0, sy = 0, pressed = false;
        const cancel = () => { clearTimeout(pressTimer); pressTimer = null; };
        el.addEventListener('click', e => {
            if (this.editing || this.justDragged) { e.preventDefault(); return; }
            Router.navigate(app.path);
        });
        el.addEventListener('pointerdown', e => {
            if (e.button !== undefined && e.button > 0) return;
            sx = e.clientX; sy = e.clientY; pressed = true;
            if (this.editing) return; // 編輯中：移動超過門檻才開始拖（見下面 move）
            pressTimer = setTimeout(() => {
                pressTimer = null;
                if (!pressed) return;
                this.enterEdit();
                // 手指還按著：直接開始拖那個圖示
                const fresh = this.container.querySelector(`[data-path="${CSS.escape(app.path)}"].${from === 'dock' ? 'home-dock-icon' : 'home-app-icon'}`);
                if (fresh) this.beginDrag(fresh, app, from, sx, sy, e.pointerId);
            }, LONG_PRESS_MS);
        });
        el.addEventListener('pointermove', e => {
            if (!pressed) return;
            const dist = Math.hypot(e.clientX - sx, e.clientY - sy);
            if (!this.editing) { if (dist > DRAG_THRESHOLD) cancel(); return; }
            if (!this.drag && dist > DRAG_THRESHOLD) this.beginDrag(el, app, from, sx, sy, e.pointerId);
        });
        const release = () => { pressed = false; cancel(); };
        el.addEventListener('pointerup', release);
        el.addEventListener('pointercancel', release);
        el.addEventListener('contextmenu', e => { if (this.editing || pressTimer !== null) e.preventDefault(); });
    },

    // ───── 拖曳 ─────
    beginDrag(el, app, from, x, y, pointerId) {
        if (this.drag) return;
        const rect = el.getBoundingClientRect();
        const ghost = el.cloneNode(true);
        ghost.classList.add('home-ghost');
        Object.assign(ghost.style, { position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', margin: 0, zIndex: 50, pointerEvents: 'none' });
        (this.container.parentElement || document.body).appendChild(ghost);
        el.classList.add('home-dragging');
        this.drag = { app, from, ghost, el, offX: x - rect.left, offY: y - rect.top, target: null, edgeTimer: null, pointerId };
        try { el.setPointerCapture?.(pointerId); } catch (_) { /* 沒有也沒關係 */ }
        this.onMove = e => this.moveDrag(e);
        this.onUp = e => this.endDrag(true, e);
        window.addEventListener('pointermove', this.onMove);
        window.addEventListener('pointerup', this.onUp);
        window.addEventListener('pointercancel', this.onUp);
    },

    moveDrag(e) {
        const d = this.drag; if (!d) return;
        d.ghost.style.left = (e.clientX - d.offX) + 'px';
        d.ghost.style.top = (e.clientY - d.offY) + 'px';
        const dockRect = this.dockEl.getBoundingClientRect();
        const wrapRect = this.pagesWrapper.getBoundingClientRect();
        // 靠近左右邊緣：停一下就換頁
        const edge = e.clientX < wrapRect.left + 28 ? -1 : e.clientX > wrapRect.right - 28 ? 1 : 0;
        if (edge && !d.edgeTimer) d.edgeTimer = setTimeout(() => { d.edgeTimer = null; this.goToPage(this.currentPage + edge); }, 650);
        if (!edge && d.edgeTimer) { clearTimeout(d.edgeTimer); d.edgeTimer = null; }

        this.container.querySelectorAll('.home-drop').forEach(n => n.classList.remove('home-drop'));
        if (e.clientY >= dockRect.top - 10 && e.clientY <= dockRect.bottom + 10 && e.clientX >= dockRect.left && e.clientX <= dockRect.right) {
            const icons = [...this.dockEl.querySelectorAll('.home-dock-icon')].filter(n => n !== d.el);
            let idx = icons.findIndex(n => { const r = n.getBoundingClientRect(); return e.clientX < r.left + r.width / 2; });
            if (idx < 0) idx = icons.length;
            d.target = { kind: 'dock', index: idx };
            this.dockEl.classList.add('home-drop');
            return;
        }
        if (e.clientY >= wrapRect.top && e.clientY <= wrapRect.bottom) {
            const icons = [...this.pagesContainer.children[this.currentPage]?.querySelectorAll('.home-app-icon') || []].filter(n => n !== d.el);
            let best = null, bd = Infinity;
            for (const n of icons) { const r = n.getBoundingClientRect(); const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)); if (dist < bd) { bd = dist; best = n; } }
            const grid = this.arranged().grid;
            if (best) {
                const to = grid.findIndex(a => a.path === best.dataset.path);
                const r = best.getBoundingClientRect();
                d.target = { kind: 'grid', index: to + (e.clientX > r.left + r.width / 2 ? 1 : 0), ref: best.dataset.path };
                best.classList.add('home-drop');
            } else d.target = { kind: 'grid', index: Math.min(grid.length, (this.currentPage + 1) * APPS_PER_PAGE) };
            return;
        }
        d.target = null;
    },

    endDrag(commit, e) {
        const d = this.drag; if (!d) return;
        window.removeEventListener('pointermove', this.onMove);
        window.removeEventListener('pointerup', this.onUp);
        window.removeEventListener('pointercancel', this.onUp);
        clearTimeout(d.edgeTimer);
        d.ghost.remove(); d.el.classList.remove('home-dragging');
        this.dockEl?.classList.remove('home-drop');
        this.drag = null;
        // 拖完那一下的 click 不要當成開啟 App
        this.justDragged = true; setTimeout(() => { this.justDragged = false; }, 250);
        if (!commit || !d.target) return;
        const t = d.target, path = d.app.path;
        if (t.kind === 'dock') {
            this.update(l => setDock(this.apps, l, path, true, t.index));
        } else {
            // 從 Dock 拖出來放到網格：只是離開 Dock（網格裡本來就有）
            if (d.from === 'dock') this.update(l => setDock(this.apps, l, path, false));
            else {
                // 目標位置是「放在它前面」；自己原本在前面時，移走之後後面的會往前補一格
                const grid = this.arranged().grid;
                const from = grid.findIndex(a => a.path === path);
                const to = t.index - (from >= 0 && from < t.index ? 1 : 0);
                this.update(l => moveTo(this.apps, l, path, to));
            }
        }
    }
};

export { MAX_DOCK };
export default HomeScreen;
