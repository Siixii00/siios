import Router from './router.js';

function createElement(tag, className, attrs = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    Object.entries(attrs).forEach(([key, value]) => {
        if (key === 'textContent') {
            el.textContent = value;
        } else if (key === 'innerHTML') {
            el.innerHTML = value;
        } else if (key.startsWith('data')) {
            el.dataset[key.slice(4).toLowerCase()] = value;
        } else if (key.startsWith('on')) {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
            el.setAttribute(key, value);
        }
    });
    return el;
}

function createIcon(name, className = '', filled = false) {
    const span = createElement('span', `material-symbols-outlined ${className}`.trim());
    span.textContent = name;
    if (filled) {
        span.style.fontVariationSettings = "'FILL' 1";
    }
    return span;
}

function createIOSNavBar(options) {
    const { title, largeTitle = false, backPath, rightActions = [], onBack } = options;
    
    const header = createElement('header', 'ios-nav-bar');
    const inner = createElement('div', 'ios-nav-bar-inner');
    
    if (backPath || onBack) {
        const backBtn = createElement('button', 'ios-btn', {
            onClick: () => onBack ? onBack() : Router.navigate(backPath)
        });
        const backIcon = createIcon('chevron_left');
        backBtn.appendChild(backIcon);
        backBtn.appendChild(createElement('span', '', { textContent: '返回' }));
        inner.appendChild(backBtn);
    } else {
        inner.appendChild(createElement('div', ''));
    }
    
    if (largeTitle) {
        const titleContainer = createElement('div', 'ios-nav-bar-large');
        titleContainer.style.paddingTop = 'env(safe-area-inset-top)';
        
        const h1 = createElement('h1', 'ios-large-title', { textContent: title });
        titleContainer.appendChild(inner);
        titleContainer.appendChild(h1);
        
        rightActions.forEach(action => {
            const btn = createElement('button', 'ios-btn', {
                onClick: action.onClick
            });
            if (action.icon) {
                btn.appendChild(createIcon(action.icon, action.filled));
            } else {
                btn.textContent = action.label;
            }
            inner.appendChild(btn);
        });
        
        return titleContainer;
    }
    
    const titleEl = createElement('h1', 'ios-inline-title', { textContent: title });
    inner.appendChild(titleEl);
    
    if (rightActions.length > 0) {
        rightActions.forEach(action => {
            const btn = createElement('button', 'ios-btn', {
                onClick: action.onClick
            });
            if (action.icon) {
                btn.appendChild(createIcon(action.icon, action.filled));
            } else {
                btn.textContent = action.label;
            }
            inner.appendChild(btn);
        });
    } else {
        inner.appendChild(createElement('div', ''));
    }
    
    header.style.paddingTop = 'env(safe-area-inset-top)';
    header.appendChild(inner);
    
    return header;
}

function createIOSGroupedList(sections) {
    const container = createElement('div', '');
    
    sections.forEach(section => {
        if (section.header) {
            const headerEl = createElement('div', 'ios-section-header', {
                textContent: section.header
            });
            container.appendChild(headerEl);
        }
        
        const group = createElement('div', 'ios-grouped-list shadow-sm');
        
        section.items.forEach((item, index) => {
            const cell = createElement('div', 'ios-list-cell' + (item.fullBorder ? ' ios-list-cell-full' : ''), {
                onClick: item.onClick
            });
            
            if (item.icon) {
                const iconBadge = createElement('div', `ios-icon-badge ${item.iconBg || 'bg-ios-blue'}`);
                iconBadge.appendChild(createIcon(item.icon, 'text-white text-sm', item.iconFilled));
                cell.appendChild(iconBadge);
            }
            
            const content = createElement('div', 'flex-1');
            
            if (item.label) {
                const labelEl = createElement('span', 'text-body-lg', { textContent: item.label });
                content.appendChild(labelEl);
            }
            
            cell.appendChild(content);
            
            const right = createElement('div', 'flex items-center');
            
            if (item.value !== undefined) {
                const valueEl = createElement('span', 'text-ios-muted', { textContent: item.value });
                right.appendChild(valueEl);
            }
            
            if (item.chevron) {
                right.appendChild(createIcon('chevron_right', 'text-ios-muted text-xl'));
            }
            
            if (item.toggle !== undefined) {
                const toggle = createElement('div', `ios-toggle ${item.toggle ? 'active' : ''}`);
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggle.classList.toggle('active');
                    if (item.onToggle) item.onToggle(toggle.classList.contains('active'));
                });
                right.appendChild(toggle);
            }
            
            cell.appendChild(right);
            group.appendChild(cell);
        });
        
        container.appendChild(group);
    });
    
    return container;
}

function createIOSSearchBar(onSearch) {
    const searchBar = createElement('div', 'ios-search-bar');
    searchBar.appendChild(createIcon('search', 'text-ios-muted'));
    
    const input = createElement('input', '', {
        type: 'text',
        placeholder: '搜尋'
    });
    input.addEventListener('input', (e) => {
        if (onSearch) onSearch(e.target.value);
    });
    searchBar.appendChild(input);
    
    return searchBar;
}

function createIOSSegmentedControl(segments, onChange, activeIndex = 0) {
    const control = createElement('div', 'ios-segmented-control');
    
    segments.forEach((segment, index) => {
        const seg = createElement('div', `ios-segment ${index === activeIndex ? 'active' : ''}`, {
            textContent: segment,
            onClick: () => {
                control.querySelectorAll('.ios-segment').forEach(s => s.classList.remove('active'));
                seg.classList.add('active');
                if (onChange) onChange(index, segment);
            }
        });
        control.appendChild(seg);
    });
    
    return control;
}

function createIOSToggle(checked, onChange) {
    const toggle = createElement('div', `ios-toggle ${checked ? 'active' : ''}`);
    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        if (onChange) onChange(toggle.classList.contains('active'));
    });
    return toggle;
}

function createIOSSlider(min, max, step, value, onChange) {
    const container = createElement('div', 'w-full');
    
    const slider = createElement('input', 'ios-slider', {
        type: 'range',
        min: min.toString(),
        max: max.toString(),
        step: step.toString(),
        value: value.toString()
    });
    
    const display = createElement('div', 'text-right text-ios-muted text-sm mt-1', {
        textContent: value.toString()
    });
    
    slider.addEventListener('input', (e) => {
        display.textContent = e.target.value;
        if (onChange) onChange(parseFloat(e.target.value));
    });
    
    container.appendChild(slider);
    container.appendChild(display);
    
    return { container, slider, display };
}

function createKakaoBottomNav(tabs, activeTab, onTabChange) {
    const nav = createElement('nav', 'kakao-bottom-nav');
    
    tabs.forEach((tab, index) => {
        const item = createElement('a', `kakao-bottom-nav-item ${index === activeTab ? 'active' : ''}`, {
            href: tab.path,
            onClick: (e) => {
                e.preventDefault();
                if (onTabChange) onTabChange(index, tab);
                Router.navigate(tab.path);
            }
        });
        item.appendChild(createIcon(tab.icon, '', index === activeTab));
        nav.appendChild(item);
    });
    
    return nav;
}

function createKakaoFAB(onClick) {
    const fab = createElement('button', 'kakao-fab', {
        onClick
    });
    fab.appendChild(createIcon('add_comment', 'text-kakao-brown text-2xl'));
    return fab;
}

function createKakaoChatCell(chat, onClick) {
    const cell = createElement('div', 'kakao-chat-cell', { onClick });
    
    const avatarMargin = createElement('div', 'kakao-avatar-margin');
    const avatarContainer = createElement('div', 'relative');
    const avatar = createElement('img', 'kakao-avatar', {
        src: chat.character_avatar || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23E5E5EA"/><text x="50" y="60" text-anchor="middle" font-size="40" fill="%238E8E93">AI</text></svg>',
        alt: chat.character_name
    });
    avatarContainer.appendChild(avatar);
    
    if (chat.online) {
        const dot = createElement('div', 'kakao-online-dot');
        avatarContainer.appendChild(dot);
    }
    
    avatarMargin.appendChild(avatarContainer);
    cell.appendChild(avatarMargin);
    
    const content = createElement('div', 'kakao-chat-cell-content');
    
    const topRow = createElement('div', 'kakao-chat-cell-top');
    topRow.appendChild(createElement('span', 'kakao-chat-cell-name', { textContent: chat.character_name }));
    topRow.appendChild(createElement('span', 'kakao-chat-cell-time', { textContent: formatTime(chat.last_updated) }));
    content.appendChild(topRow);
    
    const bottomRow = createElement('div', 'kakao-chat-cell-bottom');
    bottomRow.appendChild(createElement('span', 'kakao-chat-cell-msg', { textContent: chat.last_message || '開始新對話' }));
    
    if (chat.unread > 0) {
        const badge = createElement('span', 'kakao-unread-badge', { textContent: chat.unread.toString() });
        bottomRow.appendChild(badge);
    }
    
    content.appendChild(bottomRow);
    cell.appendChild(content);
    
    return cell;
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '剛剛';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
    if (diff < 86400000) return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    if (diff < 604800000) return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function createKakaoBubble(role, content, avatar, name) {
    const row = createElement('div', `kakao-message-row ${role}`);
    
    if (role === 'ai' || role === 'assistant') {
        if (avatar) {
            const avatarEl = createElement('img', 'kakao-message-avatar', {
                src: avatar,
                alt: name || 'AI'
            });
            row.appendChild(avatarEl);
        }
        
        const messageContent = createElement('div', 'kakao-message-content');
        if (name) {
            messageContent.appendChild(createElement('span', 'kakao-message-name has-name', { textContent: name }));
        }
        
        const bubble = createElement('div', 'kakao-bubble-left');
        bubble.appendChild(createElement('span', 'kakao-bubble-text', { textContent: content }));
        messageContent.appendChild(bubble);
        row.appendChild(messageContent);
    } else {
        const bubble = createElement('div', 'kakao-bubble-right');
        bubble.appendChild(createElement('span', 'kakao-bubble-text', { textContent: content }));
        row.appendChild(bubble);
    }
    
    return row;
}

function createToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = createElement('div', `toast ${type}`, { textContent: message });
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function createEmptyState(icon, title, text, action) {
    const container = createElement('div', 'empty-state');
    container.appendChild(createIcon(icon, 'empty-state-icon'));
    container.appendChild(createElement('h3', 'empty-state-title', { textContent: title }));
    container.appendChild(createElement('p', 'empty-state-text', { textContent: text }));
    
    if (action) {
        const btn = createElement('button', 'ios-btn ios-btn-primary mt-4', {
            textContent: action.label,
            onClick: action.onClick
        });
        container.appendChild(btn);
    }
    
    return container;
}

function createKakaoBottomSheet(items, options = {}) {
    const overlay = createElement('div', 'kakao-bottom-sheet-overlay');
    const sheet = createElement('div', 'kakao-bottom-sheet');
    
    const handle = createElement('div', 'kakao-bottom-sheet-handle');
    sheet.appendChild(handle);
    
    if (options.title) {
        const title = createElement('div', 'kakao-bottom-sheet-title', { textContent: options.title });
        sheet.appendChild(title);
    }
    
    if (options.customContent) {
        sheet.appendChild(options.customContent);
    } else {
        const grid = createElement('div', 'kakao-bottom-sheet-grid');
        
        items.forEach(item => {
            const gridItem = createElement('div', 'kakao-bottom-sheet-item');
            
            if (!item.icon && !item.label) {
                gridItem.style.visibility = 'hidden';
                grid.appendChild(gridItem);
                return;
            }
            
            gridItem.addEventListener('click', () => {
                close();
                if (item.onSelect) item.onSelect();
            });
            
            const iconWrap = createElement('div', 'kakao-bottom-sheet-item-icon');
            iconWrap.appendChild(createIcon(item.icon));
            gridItem.appendChild(iconWrap);
            
            const label = createElement('span', 'kakao-bottom-sheet-item-label', { textContent: item.label });
            gridItem.appendChild(label);
            
            grid.appendChild(gridItem);
        });
        
        sheet.appendChild(grid);
    }
    
    let isOpen = false;
    
    function open() {
        isOpen = true;
        const container = window.App?.getAppContainer() || document.getElementById('app');
        container.appendChild(overlay);
        container.appendChild(sheet);
        requestAnimationFrame(() => {
            overlay.classList.add('active');
            sheet.classList.add('active');
        });
    }
    
    function close() {
        isOpen = false;
        overlay.classList.remove('active');
        sheet.classList.remove('active');
        setTimeout(() => {
            overlay.remove();
            sheet.remove();
        }, 300);
    }
    
    overlay.addEventListener('click', close);
    
    return { open, close, overlay, sheet };
}

export {
    createElement,
    createIcon,
    createIOSNavBar,
    createIOSGroupedList,
    createIOSSearchBar,
    createIOSSegmentedControl,
    createIOSToggle,
    createIOSSlider,
    createKakaoBottomNav,
    createKakaoFAB,
    createKakaoChatCell,
    createKakaoBubble,
    createToast,
    createEmptyState,
    formatTime,
    createKakaoBottomSheet
};