import { ActivityStorage } from '../utils/storage.js';
import { PrivacyFilter } from '../utils/privacy-filter.js';

class ActivitySync {
  static async sync() {
    const settings = await ActivityStorage.getSettings();
    
    if (!settings.enabled || !settings.pwa_url) {
      return { success: false, error: 'Not configured' };
    }

    const activities = await ActivityStorage.getActivities();
    
    if (activities.length === 0) {
      return { success: true, synced: 0 };
    }

    const filteredActivities = activities.map(activity => 
      PrivacyFilter.filter(activity, settings.privacy_level)
    );

    try {
      const response = await fetch(`${settings.pwa_url}/api/activities/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activities: filteredActivities,
          source: 'extension',
          device: this.getDeviceInfo()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        await ActivityStorage.clearActivities();
        return { success: true, synced: activities.length };
      }

      return { success: false, error: result.error };
    } catch (error) {
      console.error('[ActivitySync] Sync failed:', error);
      return { success: false, error: error.message };
    }
  }

  static getDeviceInfo() {
    return {
      type: 'browser',
      platform: navigator.platform,
      userAgent: navigator.userAgent.substring(0, 100)
    };
  }
}

export { ActivitySync };