import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';

const ALBUM_KEY = 'sx_album_images';

let allImages = [];
let currentTab = 'all';
let viewerIndex = -1;

const SOURCE_ICONS = {
    uploaded: 'upload',
    chat: 'chat',
    painter: 'palette'
};

const SOURCE_LABELS = {
    uploaded: '上傳',
    chat: '聊天',
    painter: '照相館'
};

async function loadImages() {
    try {
        const data = await SettingsDB.get(ALBUM_KEY);
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

async function saveImages(images) {
    await SettingsDB.set(ALBUM_KEY, images.slice(0, 200));
}

async function addImage(dataUrl, source) {
    if (!dataUrl) return null;
    const record = {
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        url: dataUrl,
        source: source || 'uploaded',
        createdAt: new Date().toISOString()
    };
    allImages.unshift(record);
    await saveImages(allImages);
    return record;
}

async function deleteImage(id) {
    allImages = allImages.filter(img => img.id !== id);
    await saveImages(allImages);
}

function getFilteredImages() {
    if (currentTab === 'all') return allImages;
    return allImages.filter(img => img.source === currentTab);
}

function switchTab(tab, container) {
    currentTab = tab;
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    renderGallery(container);
}

function renderGallery(container) {
    const grid = container.querySelector('#gallery-grid');
    const empty = container.querySelector('#empty-state');
    if (!grid || !empty) return;

    const filtered = getFilteredImages();

    if (filtered.length === 0) {
        grid.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }

    grid.classList.remove('hidden');
    empty.classList.add('hidden');

    grid.innerHTML = filtered.map((img) => {
        const icon = SOURCE_ICONS[img.source] || 'image';
        const label = SOURCE_LABELS[img.source] || img.source;
        return `<div class="gallery-item" data-id="${img.id}">
            <img src="${img.url}" loading="lazy" alt="">
            <span class="source-badge"><i class="fas fa-${icon}"></i> ${label}</span>
        </div>`;
    }).join('');

    grid.querySelectorAll('.gallery-item').forEach(item => {
        item.onclick = () => openViewer(item.dataset.id, container);
    });
}

function openViewer(id, container) {
    const filtered = getFilteredImages();
    const idx = filtered.findIndex(img => img.id === id);
    if (idx < 0) return;
    viewerIndex = idx;
    const img = filtered[idx];
    const viewer = container.querySelector('#image-viewer');
    const viewerImg = container.querySelector('#viewer-img');
    if (!viewer || !viewerImg) return;
    viewerImg.src = img.url;
    viewer.classList.remove('hidden');
}

function closeViewer(container) {
    const viewer = container.querySelector('#image-viewer');
    if (viewer) viewer.classList.add('hidden');
    viewerIndex = -1;
}

function getCurrentViewerImage() {
    const filtered = getFilteredImages();
    if (viewerIndex < 0 || viewerIndex >= filtered.length) return null;
    return filtered[viewerIndex];
}

async function setAsWallpaper() {
    const img = getCurrentViewerImage();
    if (!img) return;
    await SettingsDB.set('wallpaper_url', img.url);
    createToast('已設為桌布', 'success');
}

async function setAsLockscreen() {
    const img = getCurrentViewerImage();
    if (!img) return;
    await SettingsDB.set('lockscreen_url', img.url);
    createToast('已設為鎖屏', 'success');
}

async function deleteCurrentImage(container) {
    const img = getCurrentViewerImage();
    if (!img) return;
    if (!confirm('確定要刪除這張照片嗎？')) return;
    await deleteImage(img.id);
    closeViewer(container);
    renderGallery(container);
}

function openImagePicker(container) {
    const input = container.querySelector('#device-upload');
    if (input) input.click();
}

async function handleDeviceUpload(event, container) {
    const files = event.target.files;
    if (!files || !files.length) return;
    
    for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            await addImage(e.target.result, 'uploaded');
            renderGallery(container);
        };
        reader.readAsDataURL(file);
    }
    
    if (event.target) event.target.value = '';
}

async function renderAlbum(params) {
    const container = createElement('div', 'app-container album-app');
    
    allImages = await loadImages();
    
    container.innerHTML = `
        <header class="ios-header">
            <button class="ios-back-btn">
                <i class="fas fa-chevron-left"></i> 返回
            </button>
            <h1 class="menu-title">相簿</h1>
            <div class="header-actions">
                <button class="header-action" id="upload-btn" title="新增照片">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        </header>

        <div class="tab-bar">
            <button class="tab-btn active" data-tab="all">全部</button>
            <button class="tab-btn" data-tab="uploaded">上傳</button>
            <button class="tab-btn" data-tab="chat">聊天</button>
            <button class="tab-btn" data-tab="painter">照相館</button>
        </div>

        <div class="gallery-wrapper">
            <div class="gallery-grid" id="gallery-grid"></div>
            <div class="empty-state hidden" id="empty-state">
                <i class="fas fa-images"></i>
                <p>尚無照片</p>
                <p class="empty-hint">點擊右上角 + 從裝置上傳</p>
            </div>
        </div>

        <input type="file" id="device-upload" hidden accept="image/*" multiple>

        <div class="image-viewer hidden" id="image-viewer">
            <div class="viewer-backdrop"></div>
            <img id="viewer-img" src="" alt="">
            <div class="viewer-actions">
                <button class="viewer-btn" id="set-wallpaper-btn">
                    <i class="fas fa-image"></i><span>桌布</span>
                </button>
                <button class="viewer-btn" id="set-lockscreen-btn">
                    <i class="fas fa-lock"></i><span>鎖屏</span>
                </button>
                <button class="viewer-btn viewer-btn-danger" id="delete-btn">
                    <i class="fas fa-trash"></i><span>刪除</span>
                </button>
            </div>
        </div>
    `;

    const backBtn = container.querySelector('.ios-back-btn');
    backBtn.onclick = () => Router.navigate('/');

    const uploadBtn = container.querySelector('#upload-btn');
    uploadBtn.onclick = () => openImagePicker(container);

    const fileInput = container.querySelector('#device-upload');
    fileInput.onchange = (e) => handleDeviceUpload(e, container);

    const tabBtns = container.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.onclick = () => switchTab(btn.dataset.tab, container);
    });

    const viewerBackdrop = container.querySelector('.viewer-backdrop');
    viewerBackdrop.onclick = () => closeViewer(container);

    const wallpaperBtn = container.querySelector('#set-wallpaper-btn');
    wallpaperBtn.onclick = async (e) => {
        e.stopPropagation();
        await setAsWallpaper();
    };

    const lockscreenBtn = container.querySelector('#set-lockscreen-btn');
    lockscreenBtn.onclick = async (e) => {
        e.stopPropagation();
        await setAsLockscreen();
    };

    const deleteBtn = container.querySelector('#delete-btn');
    deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        await deleteCurrentImage(container);
    };

    renderGallery(container);

    return { element: container, cleanup: null };
}

export default {
    id: 'album',
    name: '相簿',
    icon: 'photo_library',
    routes: [{ path: '/album', render: renderAlbum }],
    navItem: { label: '相簿', icon: 'photo_library', path: '/album', showInNav: true, order: 10 },
    styles: () => import('./style.css')
};