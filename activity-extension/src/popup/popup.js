document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggle');
  const statusCard = document.getElementById('status-card');
  const statusTitle = document.getElementById('status-title');
  const statusDesc = document.getElementById('status-desc');
  const statusText = document.getElementById('status-text');
  const pendingCount = document.getElementById('pending-count');
  const todayCount = document.getElementById('today-count');
  const syncBtn = document.getElementById('sync-btn');
  const clearBtn = document.getElementById('clear-btn');
  const settingsLink = document.getElementById('settings-link');

  // Load current settings
  const result = await chrome.storage.local.get(['siios_settings', 'siios_activities']);
  const settings = result.siios_settings || {};
  const activities = result.siios_activities || [];

  updateUI(settings, activities);

  // Toggle handler
  toggle.addEventListener('click', async () => {
    const newEnabled = !settings.enabled;
    
    const updatedSettings = {
      ...settings,
      enabled: newEnabled
    };

    await chrome.storage.local.set({ siios_settings: updatedSettings });
    
    settings.enabled = newEnabled;
    updateUI(settings, activities);

    // Notify background
    chrome.runtime.sendMessage({
      type: 'SETTINGS_CHANGED',
      data: updatedSettings
    });
  });

  // Sync button
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.textContent = '同步中...';

    const result = await chrome.runtime.sendMessage({ type: 'SYNC_NOW' });

    if (result.success) {
      syncBtn.textContent = `已同步 ${result.synced} 筆`;
      pendingCount.textContent = '0';
    } else {
      syncBtn.textContent = `同步失敗`;
    }

    setTimeout(() => {
      syncBtn.disabled = false;
      syncBtn.textContent = '立即同步';
    }, 2000);
  });

  // Clear button
  clearBtn.addEventListener('click', async () => {
    if (confirm('確定要清除所有本地活動記錄？')) {
      await chrome.storage.local.set({ siios_activities: [] });
      pendingCount.textContent = '0';
    }
  });

  // Settings link
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('src/options/options.html'));
    }
  });

  function updateUI(settings, activities) {
    if (settings.enabled) {
      toggle.classList.add('active');
      statusCard.classList.remove('disabled');
      statusCard.classList.add('enabled');
      statusTitle.textContent = '已啟用';
      statusDesc.textContent = '活動正在記錄中';
      statusText.textContent = '活動同步已啟用';
      syncBtn.disabled = !settings.pwa_url;
    } else {
      toggle.classList.remove('active');
      statusCard.classList.remove('enabled');
      statusCard.classList.add('disabled');
      statusTitle.textContent = '未啟用';
      statusDesc.textContent = '前往設定啟用活動同步';
      statusText.textContent = '活動同步已停用';
      syncBtn.disabled = true;
    }

    const pending = activities.length;
    pendingCount.textContent = pending;

    const today = new Date().toDateString();
    const todayActivities = activities.filter(a => 
      new Date(a.timestamp).toDateString() === today
    );
    todayCount.textContent = todayActivities.length;
  }
});