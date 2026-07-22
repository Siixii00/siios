import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';

const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10]
};

const MOOD_CONFIGS = {
    calm: { tempo: 70, scale: 'pentatonic', noteDensity: 0.4, avgPitch: 62 },
    happy: { tempo: 120, scale: 'major', noteDensity: 0.7, avgPitch: 66 },
    sad: { tempo: 60, scale: 'minor', noteDensity: 0.3, avgPitch: 58 },
    energetic: { tempo: 140, scale: 'blues', noteDensity: 0.8, avgPitch: 68 },
    romantic: { tempo: 80, scale: 'major', noteDensity: 0.5, avgPitch: 64 },
    mysterious: { tempo: 90, scale: 'minor', noteDensity: 0.45, avgPitch: 60 }
};

const trackLibrary = {
    spotify: [
        { title: 'Neon Drive', artist: 'Synthia Lane', duration: '3:12', mood: 'energetic', cover: 'linear-gradient(135deg,#6f83ff,#4cd6ff)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
        { title: 'Cloud Letters', artist: 'Mika Harbor', duration: '4:01', mood: 'soft', cover: 'linear-gradient(135deg,#7e74ff,#be83ff)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
        { title: 'Pulse Bloom', artist: 'Rin Kairo', duration: '2:45', mood: 'hype', cover: 'linear-gradient(135deg,#4adfbe,#7f99ff)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' }
    ],
    apple: [
        { title: 'Moonlit Harbor', artist: 'Ari Moore', duration: '3:36', mood: 'soft', cover: 'linear-gradient(135deg,#5bb2ff,#77f3d6)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
        { title: 'Crystal Tape', artist: 'Nova Echo', duration: '3:58', mood: 'emotional', cover: 'linear-gradient(135deg,#6f7fff,#a176ff)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
        { title: 'Afterglow Sprint', artist: 'Kite Theory', duration: '2:52', mood: 'energetic', cover: 'linear-gradient(135deg,#5ec8ff,#4de3bc)', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' }
    ]
};

let playlist = [];
let currentIndex = -1;
let isPlaying = false;
let activePlatform = 'spotify';
let aiMelody = [];
let audioCtx = null;
let currentPublishTrack = null;

function formatTime(sec = 0) {
    const value = Number.isFinite(sec) ? sec : 0;
    const mins = Math.floor(value / 60);
    const secs = Math.floor(value % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

function parseJSON(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
}

function getAudioContext() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function generateMelody(bars = 4, scale = 'major', temperature = 1) {
    const scaleNotes = SCALES[scale] || SCALES.major;
    const baseNote = 60;
    const notesPerBar = 8;
    const totalNotes = bars * notesPerBar;
    const melody = [];
    let lastNote = baseNote + scaleNotes[Math.floor(scaleNotes.length / 2)];

    for (let i = 0; i < totalNotes; i++) {
        const rand = Math.random();
        if (rand < 0.15 * temperature) {
            melody.push({ pitch: null, duration: 1, time: i });
            continue;
        }
        const interval = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
        const octaveJump = Math.floor(Math.random() * 3) - 1;
        const targetNote = baseNote + (octaveJump * 12) + interval;
        const smoothFactor = 0.7 - (temperature * 0.2);
        const pitch = Math.round(lastNote * smoothFactor + targetNote * (1 - smoothFactor));
        lastNote = pitch;
        const duration = Math.random() < 0.3 ? 0.5 : 1;
        const velocity = 0.6 + Math.random() * 0.4;
        melody.push({ pitch, duration, time: i, velocity });
    }
    return melody;
}

async function playMelody(melody, tempo = 120) {
    if (!melody || melody.length === 0) return;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    const beatDuration = 60 / tempo;
    const sixteenthNote = beatDuration / 2;
    const sortedNotes = [...melody].filter(n => n.pitch).sort((a, b) => a.time - b.time);
    sortedNotes.forEach(note => {
        const startTime = note.time * sixteenthNote;
        const duration = (note.duration || 1) * sixteenthNote;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = midiToFreq(note.pitch);
        gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
        gain.gain.linearRampToValueAtTime(0.15 * (note.velocity || 0.7), ctx.currentTime + startTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration * 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    });
}

function drawPianoRoll(canvas, melody) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth || 300;
    const height = canvas.height = 120;
    ctx.fillStyle = '#060a10';
    ctx.fillRect(0, 0, width, height);
    if (!melody || melody.length === 0) {
        ctx.fillStyle = '#4a5568';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('尚未生成旋律', width / 2, height / 2);
        return;
    }
    const pitches = melody.filter(n => n.pitch).map(n => n.pitch);
    if (pitches.length === 0) return;
    const minPitch = Math.min(...pitches) - 2;
    const maxPitch = Math.max(...pitches) + 2;
    const pitchRange = maxPitch - minPitch || 1;
    const maxTime = Math.max(...melody.map(n => n.time)) + 1;
    const cellWidth = width / maxTime;
    const cellHeight = height / pitchRange;
    melody.forEach(note => {
        if (!note.pitch) return;
        const x = note.time * cellWidth;
        const y = height - (note.pitch - minPitch) * cellHeight;
        const w = (note.duration || 1) * cellWidth * 0.9;
        const h = cellHeight * 0.85;
        ctx.fillStyle = '#6366f1';
        ctx.beginPath();
        ctx.roundRect(x + 1, y - h, w - 2, h, 3);
        ctx.fill();
    });
}

async function loadPlaylistFromStorage() {
    const data = await SettingsDB.get('music_playlist');
    if (Array.isArray(data) && data.length) playlist = data;
    const platform = await SettingsDB.get('music_platform');
    if (platform) activePlatform = platform;
}

async function savePlaylist() {
    await SettingsDB.set('music_playlist', playlist);
    await SettingsDB.set('music_platform', activePlatform);
}

async function loadCharacters() {
    const chars = await CharactersDB.getAll();
    return chars.length > 0 ? chars : [
        { id: 'default-sweet', name: '暖心療癒型', personality: '溫柔、會安撫情緒' },
        { id: 'default-sharp', name: '毒舌樂評型', personality: '直接、挑剔' },
        { id: 'default-poetic', name: '詩意感性型', personality: '文藝、意象化' }
    ];
}

function pushDanmaku(container, text) {
    if (!text) return;
    const msg = document.createElement('span');
    msg.className = 'danmaku-msg';
    msg.textContent = text;
    msg.style.top = `${Math.floor(Math.random() * 66) + 6}%`;
    msg.style.animationDuration = `${Math.random() * 4 + 7}s`;
    container.appendChild(msg);
    msg.addEventListener('animationend', () => msg.remove());
}

async function renderMusic(params) {
    const container = createElement('div', 'app-container music-app');
    await loadPlaylistFromStorage();
    const characters = await loadCharacters();

    container.innerHTML = `
        <header class="ios-header music-header">
            <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
            <h1 class="menu-title">音樂</h1>
            <div class="header-actions">
                <button class="header-action" id="refresh-btn" title="重新整理"><i class="fas fa-sync-alt"></i></button>
            </div>
        </header>

        <div class="music-main">
            <div class="card import-card">
                <h2>匯入歌單</h2>
                <div class="import-row">
                    <select id="platform-select">
                        <option value="spotify" ${activePlatform === 'spotify' ? 'selected' : ''}>Spotify</option>
                        <option value="apple" ${activePlatform === 'apple' ? 'selected' : ''}>Apple Music</option>
                    </select>
                    <input type="text" id="playlist-url" placeholder="貼上歌單連結（選填）">
                    <button id="import-btn">匯入</button>
                </div>
            </div>

            <div class="card player-card">
                <h2>正在播放</h2>
                <div class="now-playing">
                    <div class="cover" id="cover-art"></div>
                    <div>
                        <h3 id="track-title">尚未播放</h3>
                        <p id="track-meta">請先匯入歌單</p>
                    </div>
                </div>
                <div class="danmaku-layer" id="danmaku-layer"></div>
                <div class="progress-wrap">
                    <span id="current-time">0:00</span>
                    <input type="range" id="progress" value="0" min="0" max="100">
                    <span id="total-time">0:00</span>
                </div>
                <div class="controls">
                    <button class="ctrl" id="prev-btn"><i class="fas fa-backward-step"></i></button>
                    <button class="ctrl play" id="play-btn"><i class="fas fa-play"></i></button>
                    <button class="ctrl" id="next-btn"><i class="fas fa-forward-step"></i></button>
                </div>
            </div>

            <div class="card queue-card">
                <div class="queue-head">
                    <h2>播放佇列</h2>
                    <span id="queue-count">${playlist.length} 首</span>
                </div>
                <ul class="playlist" id="playlist-list"></ul>
            </div>

            <div class="card companion-card">
                <h2>角色陪伴</h2>
                <div class="companion-grid">
                    <label>選擇角色
                        <select id="char-select">
                            <option value="">-- 選擇角色 --</option>
                            ${characters.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                        </select>
                    </label>
                    <label>使用者名稱
                        <input type="text" id="user-name" placeholder="你的名字">
                    </label>
                </div>
                <p class="char-desc" id="char-desc">選擇角色開始一起聽歌</p>
                <p class="listen-status" id="listen-status"></p>
            </div>

            <div class="card ai-lab-card">
                <div class="ai-lab-header">
                    <h2>AI 旋律生成</h2>
                    <span class="ai-badge">Magenta</span>
                </div>
                <div class="ai-tools-grid">
                    <div class="ai-tool">
                        <div class="ai-tool-icon"><i class="fas fa-music"></i></div>
                        <h3>生成旋律</h3>
                        <div class="ai-tool-controls">
                            <label>音階 <select id="gen-scale"><option value="major">大調</option><option value="minor">小調</option><option value="pentatonic">五聲</option></select></label>
                            <label>隨機性 <input type="range" id="gen-temp" min="0.1" max="2" step="0.1" value="1"></label>
                        </div>
                        <button class="ai-btn" id="generate-btn"><i class="fas fa-wand-magic-sparkles"></i> 生成</button>
                    </div>
                </div>
                <div class="ai-piano-roll">
                    <div class="piano-roll-header">
                        <span>鋼琴卷軸</span>
                        <div class="piano-roll-actions">
                            <button class="ai-btn-small" id="play-ai-btn"><i class="fas fa-play"></i></button>
                            <button class="ai-btn-small" id="add-to-playlist-btn"><i class="fas fa-plus"></i> 加入清單</button>
                        </div>
                    </div>
                    <canvas id="piano-roll-canvas"></canvas>
                </div>
            </div>
        </div>

        <audio id="audio-player" style="display:none"></audio>
    `;

    const audio = container.querySelector('#audio-player');
    const coverArt = container.querySelector('#cover-art');
    const trackTitle = container.querySelector('#track-title');
    const trackMeta = container.querySelector('#track-meta');
    const progressEl = container.querySelector('#progress');
    const currentTimeEl = container.querySelector('#current-time');
    const totalTimeEl = container.querySelector('#total-time');
    const playBtn = container.querySelector('#play-btn');
    const danmakuLayer = container.querySelector('#danmaku-layer');
    const playlistList = container.querySelector('#playlist-list');
    const queueCount = container.querySelector('#queue-count');
    let danmakuTimer = null;

    function updateTrackUI(track) {
        if (!track) {
            trackTitle.textContent = '尚未播放';
            trackMeta.textContent = '請先匯入歌單';
            coverArt.style.background = 'linear-gradient(135deg,#6f83ff,#52e0c8)';
            return;
        }
        trackTitle.textContent = track.title;
        trackMeta.textContent = `${track.artist} · ${track.duration}`;
        coverArt.style.background = track.cover;
    }

    function renderPlaylistUI() {
        queueCount.textContent = `${playlist.length} 首`;
        if (playlist.length === 0) {
            playlistList.innerHTML = '<li class="playlist-item"><div><div class="title">尚未匯入歌單</div></div></li>';
            return;
        }
        playlistList.innerHTML = playlist.map((track, index) => `
            <li><button class="playlist-item ${index === currentIndex ? 'active' : ''}" data-index="${index}" type="button">
                <div><div class="title">${track.title}</div><div class="meta">${track.artist} · ${track.duration}</div></div>
                <i class="fas ${index === currentIndex ? 'fa-volume-high' : 'fa-play'}"></i>
            </button></li>
        `).join('');
    }

    function stopDanmaku() {
        if (danmakuTimer) { clearInterval(danmakuTimer); danmakuTimer = null; }
    }

    function startDanmaku() {
        stopDanmaku();
        const charSelect = container.querySelector('#char-select');
        const charName = charSelect?.options[charSelect.selectedIndex]?.text || 'AI';
        pushDanmaku(danmakuLayer, `${charName}：這首歌不錯呢！`);
        danmakuTimer = setInterval(() => {
            if (!isPlaying) return;
            const comments = ['旋律很棒', '節奏感很好', '喜歡這種風格', '讓人放鬆'];
            pushDanmaku(danmakuLayer, `${charName}：${comments[Math.floor(Math.random() * comments.length)]}`);
        }, 8000);
    }

    async function loadTrack(index, autoPlay = false) {
        if (!playlist[index]) return;
        currentIndex = index;
        const track = playlist[index];
        audio.src = track.url;
        audio.load();
        updateTrackUI(track);
        renderPlaylistUI();
        if (autoPlay) {
            try {
                await audio.play();
                isPlaying = true;
                playBtn.innerHTML = '<i class="fas fa-pause"></i>';
                startDanmaku();
            } catch { pushDanmaku(danmakuLayer, '系統：請手動點擊播放'); }
        }
    }

    function togglePlay() {
        if (currentIndex < 0 && playlist.length > 0) { loadTrack(0, true); return; }
        if (audio.paused) {
            audio.play().then(() => { isPlaying = true; playBtn.innerHTML = '<i class="fas fa-pause"></i>'; startDanmaku(); }).catch(() => {});
        } else {
            audio.pause();
            isPlaying = false;
            playBtn.innerHTML = '<i class="fas fa-play"></i>';
            stopDanmaku();
        }
    }

    function playNext() {
        if (playlist.length === 0) return;
        loadTrack((currentIndex + 1) % playlist.length, true);
    }

    function playPrev() {
        if (playlist.length === 0) return;
        loadTrack((currentIndex - 1 + playlist.length) % playlist.length, true);
    }

    async function importPlaylist() {
        const platform = container.querySelector('#platform-select').value;
        activePlatform = platform;
        playlist = (trackLibrary[platform] || []).map(track => ({ ...track }));
        await savePlaylist();
        currentIndex = -1;
        isPlaying = false;
        audio.pause();
        audio.removeAttribute('src');
        progressEl.value = 0;
        currentTimeEl.textContent = '0:00';
        totalTimeEl.textContent = '0:00';
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        renderPlaylistUI();
        updateTrackUI(null);
        stopDanmaku();
        pushDanmaku(danmakuLayer, `系統：已從 ${platform === 'spotify' ? 'Spotify' : 'Apple Music'} 匯入 ${playlist.length} 首`);
        if (playlist.length > 0) loadTrack(0, false);
    }

    container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
    container.querySelector('#refresh-btn').onclick = importPlaylist;
    container.querySelector('#import-btn').onclick = importPlaylist;
    container.querySelector('#play-btn').onclick = togglePlay;
    container.querySelector('#prev-btn').onclick = playPrev;
    container.querySelector('#next-btn').onclick = playNext;

    playlistList.onclick = (e) => {
        const btn = e.target.closest('.playlist-item');
        if (!btn) return;
        const index = parseInt(btn.dataset.index, 10);
        if (index >= 0) loadTrack(index, true);
    };

    audio.onloadedmetadata = () => { totalTimeEl.textContent = formatTime(audio.duration); };
    audio.ontimeupdate = () => {
        if (!audio.duration) return;
        progressEl.value = (audio.currentTime / audio.duration) * 100;
        currentTimeEl.textContent = formatTime(audio.currentTime);
    };
    progressEl.oninput = () => { if (audio.duration) audio.currentTime = (progressEl.value / 100) * audio.duration; };
    audio.onended = playNext;

    const canvas = container.querySelector('#piano-roll-canvas');
    drawPianoRoll(canvas, []);

    container.querySelector('#generate-btn').onclick = () => {
        const scale = container.querySelector('#gen-scale').value;
        const temp = parseFloat(container.querySelector('#gen-temp').value) || 1;
        aiMelody = generateMelody(4, scale, temp);
        drawPianoRoll(canvas, aiMelody);
        currentPublishTrack = { title: `AI 生成 #${playlist.length + 1}`, artist: 'Magenta 靈感', duration: `${Math.ceil(aiMelody.length / 8)}:00`, cover: 'linear-gradient(135deg,#6366f1,#8b5cf6)', aiMelody };
        pushDanmaku(danmakuLayer, `AI：已生成 4 小節 ${scale} 旋律`);
    };

    container.querySelector('#play-ai-btn').onclick = async () => {
        if (aiMelody.length === 0) { pushDanmaku(danmakuLayer, 'AI：尚未生成旋律'); return; }
        await playMelody(aiMelody);
    };

    container.querySelector('#add-to-playlist-btn').onclick = () => {
        if (aiMelody.length === 0) { pushDanmaku(danmakuLayer, 'AI：尚未生成旋律'); return; }
        const track = { title: `AI 生成 #${playlist.length + 1}`, artist: 'Magenta 靈感', duration: `${Math.ceil(aiMelody.length / 8)}:00`, mood: 'generated', cover: 'linear-gradient(135deg,#6366f1,#8b5cf6)', url: null, aiMelody };
        playlist.push(track);
        renderPlaylistUI();
        pushDanmaku(danmakuLayer, `系統：已將 AI 旋律加入清單`);
    };

    renderPlaylistUI();
    if (playlist.length > 0) updateTrackUI(playlist[0]);

    return { element: container, cleanup: () => { stopDanmaku(); audio.pause(); } };
}

export default {
    id: 'music',
    name: '音樂',
    icon: 'music_note',
    routes: [{ path: '/music', render: renderMusic }],
    navItem: { label: '音樂', icon: 'music_note', path: '/music', showInNav: true, order: 20 },
    styles: () => import('./style.css')
};