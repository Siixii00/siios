import { createElement, createIcon } from './components.js';

const LockScreen = {
    element: null,
    onUnlock: null,
    touchStartY: 0,
    currentY: 0,
    isDragging: false,
    
    create(options = {}) {
        this.onUnlock = options.onUnlock;
        
        const container = createElement('div', 'lock-screen');
        
        const wallpaper = createElement('div', 'lock-wallpaper');
        container.appendChild(wallpaper);
        
        const content = createElement('div', 'lock-content');
        
        const timeContainer = createElement('div', 'lock-time-container');
        const timeEl = createElement('span', 'lock-time');
        const dateEl = createElement('span', 'lock-date');
        timeContainer.appendChild(timeEl);
        timeContainer.appendChild(dateEl);
        content.appendChild(timeContainer);
        
        const notchSpacer = createElement('div', 'lock-notch-spacer');
        content.appendChild(notchSpacer);
        
        const unlockHint = createElement('div', 'lock-unlock-hint');
        unlockHint.appendChild(createIcon('keyboard_arrow_up', 'text-white/80 text-2xl'));
        const unlockText = createElement('span', 'text-white/80 text-sm', { textContent: '向上滑動以解鎖' });
        unlockHint.appendChild(unlockText);
        content.appendChild(unlockHint);
        
        const swipeArea = createElement('div', 'lock-swipe-area');
        content.appendChild(swipeArea);
        
        container.appendChild(content);
        
        this.element = container;
        this.timeEl = timeEl;
        this.dateEl = dateEl;
        
        this.startTimeUpdate();
        this.setupSwipeGestures(swipeArea, container);
        
        return container;
    },
    
    startTimeUpdate() {
        const updateTime = () => {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            this.timeEl.textContent = `${hours}:${minutes}`;
            
            const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            const month = now.getMonth() + 1;
            const date = now.getDate();
            const weekday = weekdays[now.getDay()];
            this.dateEl.textContent = `${month}月${date}日 ${weekday}`;
        };
        
        updateTime();
        this.timeInterval = setInterval(updateTime, 1000);
    },
    
    setupSwipeGestures(area, container) {
        const handleStart = (y) => {
            this.isDragging = true;
            this.touchStartY = y;
            container.style.transition = 'none';
        };
        
        const handleMove = (y) => {
            if (!this.isDragging) return;
            
            this.currentY = y;
            const diff = this.touchStartY - y;
            
            if (diff > 0) {
                container.style.transform = `translateY(-${Math.min(diff, window.innerHeight)}px)`;
                container.style.opacity = Math.max(0, 1 - diff / (window.innerHeight * 0.5));
            }
        };
        
        const handleEnd = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            
            container.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease';
            
            const diff = this.touchStartY - this.currentY;
            
            if (diff > window.innerHeight * 0.25) {
                container.style.transform = `translateY(-${window.innerHeight}px)`;
                container.style.opacity = '0';
                
                setTimeout(() => {
                    if (this.onUnlock) {
                        this.onUnlock();
                    }
                }, 400);
            } else {
                container.style.transform = 'translateY(0)';
                container.style.opacity = '1';
            }
        };
        
        area.addEventListener('touchstart', (e) => {
            handleStart(e.touches[0].clientY);
        }, { passive: true });
        
        area.addEventListener('touchmove', (e) => {
            handleMove(e.touches[0].clientY);
        }, { passive: true });
        
        area.addEventListener('touchend', handleEnd);
        
        area.addEventListener('mousedown', (e) => {
            handleStart(e.clientY);
        });
        
        area.addEventListener('mousemove', (e) => {
            handleMove(e.clientY);
        });
        
        area.addEventListener('mouseup', handleEnd);
        area.addEventListener('mouseleave', handleEnd);
    },
    
    destroy() {
        if (this.timeInterval) {
            clearInterval(this.timeInterval);
        }
    }
};

export default LockScreen;