import { ActivityStorage } from '../utils/storage.js';
import { ActivitySync } from '../utils/sync.js';
import { PrivacyFilter } from '../utils/privacy-filter.js';

let syncInterval = null;

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Service Worker] Extension installed');
  
  const settings = await ActivityStorage.getSettings();
  
  if (settings.enabled) {
    startAutoSync(settings.sync_interval);
  }
});

// 瀏覽器重新啟動時 onInstalled 不會觸發：啟動時也要依設定恢復自動同步
chrome.runtime.onStartup.addListener(async () => {
  const settings = await ActivityStorage.getSettings();
  if (settings.enabled) startAutoSync(settings.sync_interval);
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes.siios_settings) {
    const newSettings = changes.siios_settings.newValue;
    
    if (newSettings.enabled) {
      startAutoSync(newSettings.sync_interval);
    } else {
      stopAutoSync();
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTIVITY_DETECTED') {
    handleActivityDetected(message.data, sender.tab);
    return true;
  }
  
  if (message.type === 'SYNC_NOW') {
    ActivitySync.sync().then(sendResponse);
    return true;
  }
  
  if (message.type === 'GET_ACTIVITIES') {
    ActivityStorage.getActivities().then(activities => {
      sendResponse({ activities });
    });
    return true;
  }
});

async function handleActivityDetected(activityData, tab) {
  const settings = await ActivityStorage.getSettings();
  
  if (!PrivacyFilter.shouldRecord(activityData.platform, activityData.activity_type, settings)) {
    return;
  }

  const activity = {
    ...activityData,
    url: tab?.url || '',
    page_title: tab?.title || ''
  };

  await ActivityStorage.addActivity(activity);
  
  chrome.action.setBadgeText({ text: '●' });
  chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
}

const SYNC_ALARM = 'siios-auto-sync';

// MV3 的 service worker 閒置約 30 秒就會被關掉，setInterval 的計時器跟著消失，自動同步幾乎不會發生；
// 改用 chrome.alarms（到時間會喚醒 service worker）。alarms 最短 1 分鐘；interval 是毫秒
function startAutoSync(interval) {
  stopAutoSync();
  chrome.alarms.create(SYNC_ALARM, { periodInMinutes: Math.max(1, Math.round((interval || 300000) / 60000)) });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== SYNC_ALARM) return;
  const result = await ActivitySync.sync();
  if (result.success && result.synced > 0) {
    chrome.action.setBadgeText({ text: '' });
  }
});

function stopAutoSync() {
  chrome.alarms.clear(SYNC_ALARM);
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}