import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { compressImage } from '../../utils/image.js';
import { escapeHtml, debounce } from '../../utils/html.js';

const MOOD_OPTIONS = [
  { id: 'sunny', label: '晴朗', icon: '🌤️' },
  { id: 'rainy', label: '雨露', icon: '🌧️' },
  { id: 'starry', label: '星夜', icon: '🌙' },
  { id: 'cozy', label: '暖被', icon: '🫖' },
  { id: 'wild', label: '冒險', icon: '🧭' }
];

const PROFILE_COLORS = [
  '#0075de', '#d6b6f6', '#ff64c8', '#dd5b00',
  '#2a9d99', '#1aae39', '#62aef0', '#e65100'
];

const DEFAULT_PROFILES = [
  { id: 'writer_1', name: '小多', color: '#0075de' },
  { id: 'writer_2', name: '阿嗨', color: '#d6b6f6' }
];

let profiles = [];
let entries = [];
let activeWriterId = 'writer_1';
let currentMonth = new Date();
let selectedDate = null;
let viewMode = 'calendar';
let replyToId = null;
let docListeners = [];

const debouncedSaveEntries = debounce(async () => { await SettingsDB.set('diary_entries', entries); }, 300);
const debouncedSaveProfiles = debounce(async () => { await SettingsDB.set('diary_profiles', profiles); }, 300);

async function loadData() {
  const [p, e, w] = await Promise.all([
    SettingsDB.get('diary_profiles'),
    SettingsDB.get('diary_entries'),
    SettingsDB.get('diary_active_writer')
  ]);
  profiles = p || [...DEFAULT_PROFILES];
  entries = e || [];
  activeWriterId = w || profiles[0]?.id || 'writer_1';
}

async function saveProfiles() { await SettingsDB.set('diary_profiles', profiles); }
async function saveEntries() { await SettingsDB.set('diary_entries', entries); }
async function saveActiveWriter() { await SettingsDB.set('diary_active_writer', activeWriterId); }

function getActiveWriter() { return profiles.find(p => p.id === activeWriterId) || profiles[0]; }

function getEntriesForDate(dateStr) {
  return entries.filter(e => e.date === dateStr && !e.replyTo);
}

function getRepliesForEntry(entryId) {
  return entries.filter(e => e.replyTo === entryId);
}

function formatDateStr(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(m)}月${parseInt(d)}日`;
}

function formatTime(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function addDocListener(event, handler) {
  document.addEventListener(event, handler);
  docListeners.push({ event, handler });
}

function cleanup() {
  docListeners.forEach(({ event, handler }) => document.removeEventListener(event, handler));
  docListeners = [];
}

function renderWriterBar(container) {
  const bar = container.querySelector('.diary-writer-bar');
  if (!bar) return;
  bar.innerHTML = profiles.map(p => `
    <button class="diary-writer-pill ${p.id === activeWriterId ? 'active' : ''}" data-writer="${p.id}">
      <span class="diary-writer-avatar" style="background:${p.color}">${escapeHtml(p.name.charAt(0))}</span>
      ${escapeHtml(p.name)}
    </button>
  `).join('');

  bar.querySelectorAll('.diary-writer-pill').forEach(btn => {
    btn.onclick = () => {
      activeWriterId = btn.dataset.writer;
      saveActiveWriter();
      renderWriterBar(container);
    };
  });
}

function renderCalendar(container) {
  const body = container.querySelector('.diary-body');
  if (!body) return;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const today = formatDateStr(new Date());
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  const entriesByDate = new Map();
  entries.forEach(e => {
    if (!entriesByDate.has(e.date)) entriesByDate.set(e.date, []);
    entriesByDate.get(e.date).push(e);
  });

  let dayCells = '';
  for (let i = 0; i < firstDay; i++) {
    const prevMonthDate = new Date(year, month, -(firstDay - i - 1));
    dayCells += `<div class="diary-calendar-day other-month" data-date="${formatDateStr(prevMonthDate)}">${prevMonthDate.getDate()}</div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const dayEntries = entriesByDate.get(dateStr) || [];
    const dots = dayEntries.length > 0
      ? `<div class="diary-day-dots">${dayEntries.slice(0, 3).map(e => {
          const writer = profiles.find(p => p.id === e.writerId);
          return `<span class="diary-day-dot" style="background:${writer?.color || '#0075de'}"></span>`;
        }).join('')}</div>`
      : '';

    dayCells += `<div class="diary-calendar-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" data-date="${dateStr}">${d}${dots}</div>`;
  }

  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    const nextDate = new Date(year, month + 1, i);
    dayCells += `<div class="diary-calendar-day other-month" data-date="${formatDateStr(nextDate)}">${i}</div>`;
  }

  body.innerHTML = `
    <div class="diary-calendar">
      <div class="diary-calendar-header">
        <div class="diary-calendar-title">${year}年 ${monthNames[month]}</div>
        <div class="diary-calendar-nav">
          <button data-dir="-1">‹</button>
          <button data-dir="1">›</button>
        </div>
      </div>
      <div class="diary-calendar-weekdays">
        <div class="diary-calendar-weekday">一</div>
        <div class="diary-calendar-weekday">二</div>
        <div class="diary-calendar-weekday">三</div>
        <div class="diary-calendar-weekday">四</div>
        <div class="diary-calendar-weekday">五</div>
        <div class="diary-calendar-weekday">六</div>
        <div class="diary-calendar-weekday">日</div>
      </div>
      <div class="diary-calendar-grid">${dayCells}</div>
    </div>
  `;

  body.querySelectorAll('.diary-calendar-nav button').forEach(btn => {
    btn.onclick = () => {
      const dir = parseInt(btn.dataset.dir);
      currentMonth = new Date(year, month + dir, 1);
      renderCalendar(container);
    };
  });

  body.querySelectorAll('.diary-calendar-day').forEach(cell => {
    cell.onclick = () => {
      const date = cell.dataset.date;
      selectedDate = date;
      renderCalendar(container);
      openDayPanel(container, date);
    };
  });
}

function renderTimeline(container) {
  const body = container.querySelector('.diary-body');
  if (!body) return;

  if (entries.length === 0) {
    body.innerHTML = `<div class="diary-empty"><span class="diary-empty-icon">📖</span>尚無日記</div>`;
    return;
  }

  const sorted = [...entries].filter(e => !e.replyTo).sort((a, b) => b.createdAt - a.createdAt);
  let html = '<div class="diary-timeline">';
  let lastDate = '';

  sorted.forEach(entry => {
    if (entry.date !== lastDate) {
      lastDate = entry.date;
      html += `<div class="diary-timeline-date">${formatDateDisplay(entry.date)}</div>`;
    }
    html += renderEntryCard(entry);

    const replies = getRepliesForEntry(entry.id);
    replies.forEach(reply => {
      html += renderEntryCard(reply, true);
    });
  });

  html += '</div>';
  body.innerHTML = html;
  bindEntryActions(container);
}

function renderEntryCard(entry, isReply = false) {
  const writer = profiles.find(p => p.id === entry.writerId);
  const mood = MOOD_OPTIONS.find(m => m.id === entry.mood);
  const borderColor = isReply && writer ? writer.color : 'transparent';
  const writerName = escapeHtml(writer?.name || '未知');
  const writerInitial = escapeHtml(writer?.name.charAt(0) || '?');

  return `
    <div class="diary-entry-card${isReply ? ' reply' : ''}" style="${isReply ? `border-left-color:${borderColor}` : ''}" data-entry-id="${entry.id}">
      <div class="diary-entry-top">
        <span class="diary-entry-avatar" style="background:${writer?.color || '#0075de'}">${writerInitial}</span>
        <div class="diary-entry-meta">
          <span class="diary-entry-writer">${writerName}</span>
          <span class="diary-entry-time">${formatTime(entry.createdAt)}</span>
        </div>
        ${mood ? `<span class="diary-entry-mood">${mood.icon}</span>` : ''}
      </div>
      <div class="diary-entry-content">${entry.content}</div>
      ${entry.images && entry.images.length > 0 ? entry.images.map(img => `<img src="${escapeHtml(img)}" alt="">`).join('') : ''}
      ${!isReply ? `
        <div class="diary-entry-actions">
          <button class="diary-entry-action" data-reply="${entry.id}">回覆</button>
          <button class="diary-entry-action" data-delete="${entry.id}">刪除</button>
        </div>
      ` : `
        <div class="diary-entry-actions">
          <button class="diary-entry-action" data-delete="${entry.id}">刪除</button>
        </div>
      `}
    </div>
  `;
}

function bindEntryActions(container) {
  container.querySelectorAll('[data-reply]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      replyToId = btn.dataset.reply;
      openEditor(container, null, replyToId);
    };
  });

  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.delete;
      entries = entries.filter(e => e.id !== id && e.replyTo !== id);
      await saveEntries();
      refreshView(container);
    };
  });
}

function openDayPanel(container, dateStr) {
  let panel = container.querySelector('.diary-day-panel');
  if (!panel) {
    panel = createElement('div', 'diary-day-panel');
    container.appendChild(panel);
  }

  const dayEntries = getEntriesForDate(dateStr);
  const allDayEntries = [];
  dayEntries.forEach(e => {
    allDayEntries.push(e);
    allDayEntries.push(...getRepliesForEntry(e.id));
  });

  panel.innerHTML = `
    <div class="diary-day-panel-handle"></div>
    <div class="diary-day-panel-header">
      <span class="diary-day-panel-title">${formatDateDisplay(dateStr)}</span>
      <button class="diary-day-panel-close">✕</button>
    </div>
    <div class="diary-day-panel-body">
      ${allDayEntries.length > 0
        ? allDayEntries.map(e => renderEntryCard(e, !!e.replyTo)).join('')
        : '<div class="diary-day-panel-empty">這天還沒有日記</div>'
      }
    </div>
  `;

  requestAnimationFrame(() => panel.classList.add('open'));

  panel.querySelector('.diary-day-panel-close').onclick = () => {
    panel.classList.remove('open');
    selectedDate = null;
    if (viewMode === 'calendar') renderCalendar(container);
  };

  bindEntryActions(container);
}

function closeDayPanel(container) {
  const panel = container.querySelector('.diary-day-panel');
  if (panel) panel.classList.remove('open');
  selectedDate = null;
}

function openEditor(container, dateStr, replyTo = null) {
  const writer = getActiveWriter();
  const targetDate = dateStr || selectedDate || formatDateStr(new Date());
  const replyEntry = replyTo ? entries.find(e => e.id === replyTo) : null;
  const replyWriterName = replyEntry ? escapeHtml(profiles.find(p => p.id === replyEntry.writerId)?.name || '') : '';

  let overlay = container.querySelector('.diary-editor-overlay');
  if (overlay) overlay.remove();

  overlay = createElement('div', 'diary-editor-overlay');
  overlay.innerHTML = `
    <div class="diary-editor">
      <div class="diary-editor-header">
        <button class="diary-editor-cancel">取消</button>
        <button class="diary-editor-save">儲存</button>
      </div>
      <div class="diary-editor-body">
        <div class="diary-editor-writer">
          <span class="diary-writer-avatar" style="background:${writer.color}">${escapeHtml(writer.name.charAt(0))}</span>
          <span class="diary-editor-writer-name">${escapeHtml(writer.name)}</span>
          ${replyEntry ? `<span style="color:var(--nt-ink-faint);font-size:12px;margin-left:8px">回覆 ${replyWriterName}</span>` : ''}
        </div>
        <div class="diary-mood-pills">
          ${MOOD_OPTIONS.map(m => `
            <button class="diary-mood-pill" data-mood="${m.id}">
              <span class="diary-mood-pill-icon">${m.icon}</span>${m.label}
            </button>
          `).join('')}
        </div>
        <textarea class="diary-editor-textarea" placeholder="寫下今天的心情..."></textarea>
        <div class="diary-image-preview-area"></div>
      </div>
      <div class="diary-editor-toolbar">
        <button class="diary-toolbar-btn" data-format="bold" title="粗體"><b>B</b></button>
        <button class="diary-toolbar-btn" data-format="italic" title="斜體"><i>I</i></button>
        <button class="diary-toolbar-btn" data-format="strike" title="刪除線"><s>S</s></button>
        <button class="diary-toolbar-btn" data-format="image" title="圖片">🖼</button>
      </div>
    </div>
  `;

  container.appendChild(overlay);

  let activeMood = 'sunny';
  let pendingImages = [];

  overlay.querySelectorAll('.diary-mood-pill').forEach(btn => {
    btn.onclick = () => {
      activeMood = btn.dataset.mood;
      overlay.querySelectorAll('.diary-mood-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });

  const textarea = overlay.querySelector('.diary-editor-textarea');

  overlay.querySelectorAll('.diary-toolbar-btn').forEach(btn => {
    btn.onclick = () => {
      const fmt = btn.dataset.format;
      if (fmt === 'image') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const base64 = await compressImage(file);
          if (base64) {
            pendingImages.push(base64);
            renderImagePreviews(overlay, pendingImages);
          }
        };
        input.click();
      } else {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end);
        const wrap = fmt === 'bold' ? '**' : fmt === 'italic' ? '*' : '~~';
        textarea.value = text.substring(0, start) + wrap + selected + wrap + text.substring(end);
        textarea.focus();
        textarea.setSelectionRange(start + wrap.length, end + wrap.length);
      }
    };
  });

  overlay.querySelector('.diary-editor-cancel').onclick = () => {
    overlay.remove();
    if (replyTo) replyToId = null;
  };

  overlay.querySelector('.diary-editor-save').onclick = async () => {
    const content = textarea.value.trim();
    if (!content && pendingImages.length === 0) return;

    const entry = {
      id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      date: targetDate,
      writerId: activeWriterId,
      mood: activeMood,
      content: formatContent(content),
      images: pendingImages,
      replyTo: replyTo || null,
      createdAt: Date.now()
    };

    entries.push(entry);
    await saveEntries();
    overlay.remove();
    if (replyTo) replyToId = null;
    refreshView(container);
    if (selectedDate) openDayPanel(container, selectedDate);
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (replyTo) replyToId = null;
    }
  };
}

function renderImagePreviews(overlay, images) {
  const area = overlay.querySelector('.diary-image-preview-area');
  area.innerHTML = images.map((img, i) => `
    <div class="diary-image-preview">
      <img src="${escapeHtml(img)}" alt="">
      <button class="diary-image-remove" data-idx="${i}">✕</button>
    </div>
  `).join('');

  area.querySelectorAll('.diary-image-remove').forEach(btn => {
    btn.onclick = () => {
      images.splice(parseInt(btn.dataset.idx), 1);
      renderImagePreviews(overlay, images);
    };
  });
}

function formatContent(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html
    .replace(/\*\*(.+?)\*\*/g, '\x01STRONG_START\x01$1\x01STRONG_END\x01')
    .replace(/\*(.+?)\*/g, '\x01EM_START\x01$1\x01EM_END\x01')
    .replace(/~~(.+?)~~/g, '\x01DEL_START\x01$1\x01DEL_END\x01');

  html = html
    .replace(/\x01STRONG_START\x01/g, '<strong>')
    .replace(/\x01STRONG_END\x01/g, '</strong>')
    .replace(/\x01EM_START\x01/g, '<em>')
    .replace(/\x01EM_END\x01/g, '</em>')
    .replace(/\x01DEL_START\x01/g, '<del>')
    .replace(/\x01DEL_END\x01/g, '</del>')
    .replace(/\n/g, '<br>');

  return html;
}

function openProfileModal(container) {
  let modal = container.querySelector('.diary-profile-modal');
  if (modal) modal.remove();

  modal = createElement('div', 'diary-profile-modal');
  modal.innerHTML = `
    <div class="diary-profile-card">
      <h3>管理寫手</h3>
      <div class="diary-profile-list">
        ${profiles.map((p, i) => `
          <div class="diary-profile-item" data-idx="${i}">
            <span class="diary-writer-avatar" style="background:${p.color}">${escapeHtml(p.name.charAt(0))}</span>
            <input class="diary-profile-input" value="${escapeHtml(p.name)}" data-field="name" data-idx="${i}">
            <div class="diary-color-picker">
              ${PROFILE_COLORS.map(c => `<span class="diary-color-swatch${c === p.color ? ' active' : ''}" style="background:${c}" data-color="${c}" data-idx="${i}"></span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="diary-profile-actions">
        <button class="diary-profile-btn secondary" id="diary-add-profile">+ 新增寫手</button>
        <button class="diary-profile-btn primary" id="diary-save-profiles">完成</button>
      </div>
    </div>
  `;

  container.appendChild(modal);

  modal.querySelectorAll('.diary-profile-input').forEach(input => {
    input.oninput = () => {
      const idx = parseInt(input.dataset.idx);
      profiles[idx].name = input.value;
    };
  });

  modal.querySelectorAll('.diary-color-swatch').forEach(swatch => {
    swatch.onclick = () => {
      const idx = parseInt(swatch.dataset.idx);
      const color = swatch.dataset.color;
      profiles[idx].color = color;
      modal.querySelectorAll(`.diary-color-swatch[data-idx="${idx}"]`).forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      const avatar = modal.querySelector(`.diary-profile-item[data-idx="${idx}"] .diary-writer-avatar`);
      if (avatar) {
        avatar.style.background = color;
        avatar.textContent = profiles[idx].name.charAt(0);
      }
    };
  });

  modal.querySelector('#diary-add-profile').onclick = () => {
    if (profiles.length >= 5) return;
    const newId = 'writer_' + Date.now();
    profiles.push({ id: newId, name: '寫手' + (profiles.length + 1), color: PROFILE_COLORS[profiles.length % PROFILE_COLORS.length] });
    openProfileModal(container);
  };

  modal.querySelector('#diary-save-profiles').onclick = async () => {
    const removedIds = profiles.filter(p => !p.name.trim()).map(p => p.id);
    const defaultWriterId = profiles.find(p => p.name.trim())?.id;
    if (defaultWriterId) {
      entries.forEach(e => {
        if (removedIds.includes(e.writerId)) e.writerId = defaultWriterId;
      });
    }
    profiles = profiles.filter(p => p.name.trim());
    if (profiles.length === 0) profiles = [...DEFAULT_PROFILES];
    if (!profiles.find(p => p.id === activeWriterId)) {
      activeWriterId = profiles[0].id;
      await saveActiveWriter();
    }
    await saveProfiles();
    await saveEntries();
    modal.remove();
    renderWriterBar(container);
  };

  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}

function refreshView(container) {
  if (viewMode === 'calendar') {
    renderCalendar(container);
  } else {
    renderTimeline(container);
  }
}

async function renderExchangeDiary(params) {
  await loadData();
  cleanup();

  const container = createElement('div', 'app-container diary-app');

  container.innerHTML = `
    <nav class="diary-nav">
      <button class="diary-nav-back"><i class="fas fa-chevron-left"></i> 返回</button>
      <span class="diary-nav-title">交換日記</span>
      <button class="diary-nav-action" id="diary-settings">⚙</button>
    </nav>
    <div class="diary-writer-bar"></div>
    <div class="diary-segmented">
      <button class="diary-segmented-btn active" data-view="calendar">Calendar</button>
      <button class="diary-segmented-btn" data-view="timeline">Timeline</button>
    </div>
    <div class="diary-body"></div>
    <button class="diary-fab">+</button>
  `;

  container.querySelector('.diary-nav-back').onclick = () => Router.back();

  container.querySelector('#diary-settings').onclick = () => openProfileModal(container);

  renderWriterBar(container);

  container.querySelectorAll('.diary-segmented-btn').forEach(btn => {
    btn.onclick = () => {
      viewMode = btn.dataset.view;
      container.querySelectorAll('.diary-segmented-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      closeDayPanel(container);
      refreshView(container);
    };
  });

  renderCalendar(container);

  container.querySelector('.diary-fab').onclick = () => {
    openEditor(container);
  };

  return { element: container, cleanup };
}

export default {
  id: 'exchange-diary',
  name: '交換日記',
  icon: 'book',
  routes: [{ path: '/exchange-diary', render: renderExchangeDiary }],
  navItem: { label: '交換日記', icon: 'book', path: '/exchange-diary', showInNav: true, order: 111 },
  stylesPath: 'js/apps/exchange-diary/style.css'
};
