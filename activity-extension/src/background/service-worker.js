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

function startAutoSync(interval) {
  stopAutoSync();
  
  syncInterval = setInterval(async () => {
    const result = await ActivitySync.sync();
    
    if (result.success && result.synced > 0) {
      chrome.action.setBadgeText({ text: '' });
    }
  }, interval);
}

function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}