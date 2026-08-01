const STORAGE_KEY = 'siios_activities';
const SETTINGS_KEY = 'siios_settings';

class ActivityStorage {
  static async getActivities() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return result[STORAGE_KEY] || [];
  }

  static async addActivity(activity) {
    const activities = await this.getActivities();
    activities.push({
      ...activity,
      id: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      source: 'extension'
    });
    
    // Keep only last 1000 activities locally
    if (activities.length > 1000) {
      activities.splice(0, activities.length - 1000);
    }
    
    await chrome.storage.local.set({ [STORAGE_KEY]: activities });
    return activities;
  }

  static async clearActivities() {
    await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  }

  static async getSettings() {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return result[SETTINGS_KEY] || {
      enabled: false,
      pwa_url: '',
      sync_interval: 300000, // 5 minutes
      platforms: {},
      privacy_level: 'basic',
      retention_days: 30
    };
  }

  static async updateSettings(settings) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  }
}

export { ActivityStorage };