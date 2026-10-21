const PLATFORMS = [
  { id: 'twitter', name: 'Twitter/X', color: '#1DA1F2', enabled: true },
  { id: 'instagram', name: 'Instagram', color: '#E1306C', enabled: true },
  { id: 'facebook', name: 'Facebook', color: '#1877F2', enabled: true },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', enabled: true },
  { id: 'discord', name: 'Discord', color: '#5865F2', enabled: false },
  { id: 'tiktok', name: 'TikTok', color: '#000000', enabled: false }
];

document.addEventListener('DOMContentLoaded', async () => {
  const tokenInput = document.getElementById('github-token');
  const gistInput = document.getElementById('gist-id');
  const keyInput = document.getElementById('encryption-key');
  const syncIntervalSelect = document.getElementById('sync-interval');
  const privacyLevelSelect = document.getElementById('privacy-level');
  const retentionDaysSelect = document.getElementById('retention-days');
  const platformsContainer = document.getElementById('platforms-container');
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-btn');

  // Load current settings
  const result = await chrome.storage.local.get('siios_settings');
  const settings = result.siios_settings || {};

  // Populate platform toggles
  PLATFORMS.forEach(platform => {
    const row = document.createElement('div');
    row.className = 'toggle-row';

    const info = document.createElement('div');
    info.className = 'toggle-info';
    info.innerHTML = `
      <h3 style="display: flex; align-items: center; gap: 8px;">
        <span style="width: 12px; height: 12px; background: ${platform.color}; border-radius: 50%;"></span>
        ${platform.name}
      </h3>
    `;

    const toggle = document.createElement('div');
    toggle.className = 'toggle';
    toggle.dataset.platform = platform.id;

    if (settings.platforms?.[platform.id]?.enabled !== false) {
      toggle.classList.add('active');
    }

    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
    });

    row.appendChild(info);
    row.appendChild(toggle);
    platformsContainer.appendChild(row);
  });

  // Populate current settings
  if (settings.github_token) tokenInput.value = settings.github_token;
  if (settings.gist_id) gistInput.value = settings.gist_id;
  if (settings.encryption_key) keyInput.value = settings.encryption_key;
  if (settings.sync_interval) {
    syncIntervalSelect.value = settings.sync_interval;
  }
  if (settings.privacy_level) {
    privacyLevelSelect.value = settings.privacy_level;
  }
  if (settings.retention_days) {
    retentionDaysSelect.value = settings.retention_days;
  }

  // Save button
  saveBtn.addEventListener('click', async () => {
    const githubToken = tokenInput.value.trim();
    const gistId = gistInput.value.trim().replace(/^.*\//, ''); // 允許貼整個 gist 網址
    const encryptionKey = keyInput.value.trim();

    if (!githubToken || !gistId || !encryptionKey) {
      alert('請填寫 GitHub Token、Gist ID 與加密金鑰');
      return;
    }

    const platforms = {};
    document.querySelectorAll('.toggle[data-platform]').forEach(toggle => {
      platforms[toggle.dataset.platform] = {
        enabled: toggle.classList.contains('active')
      };
    });

    const newSettings = {
      enabled: settings.enabled || false,
      github_token: githubToken,
      gist_id: gistId,
      encryption_key: encryptionKey,
      sync_interval: parseInt(syncIntervalSelect.value),
      privacy_level: privacyLevelSelect.value,
      retention_days: parseInt(retentionDaysSelect.value),
      platforms
    };

    await chrome.storage.local.set({ siios_settings: newSettings });

    // Notify background
    chrome.runtime.sendMessage({
      type: 'SETTINGS_CHANGED',
      data: newSettings
    });

    alert('設定已保存');
    window.close();
  });

  // Cancel button
  cancelBtn.addEventListener('click', () => {
    window.close();
  });
});