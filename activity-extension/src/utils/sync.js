import { ActivityStorage } from '../utils/storage.js';
import { PrivacyFilter } from '../utils/privacy-filter.js';
import { CloudSync } from '../utils/cloud-sync.js';

const MAX_ACTIVITIES = 1000;

// 把本機累積的活動，合併進 PWA 使用的加密 GitHub Gist（跟 PWA「跨裝置同步」是同一份資料）。
// 需要在擴充功能設定填 GitHub Token、Gist ID、加密金鑰（都從 PWA 的「設定 → 跨裝置同步」複製）。
class ActivitySync {
  static isConfigured(settings) {
    return !!(settings?.github_token && settings?.gist_id && settings?.encryption_key);
  }

  // 合併（以 id 去重，同一個 id 取較新的），最新的在前，最多保留 MAX_ACTIVITIES 筆
  static merge(remote, local) {
    const byId = new Map();
    for (const a of [...remote, ...local]) {
      if (!a || !a.id) continue;
      const existing = byId.get(a.id);
      if (!existing || (a.timestamp || 0) >= (existing.timestamp || 0)) byId.set(a.id, a);
    }
    return Array.from(byId.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, MAX_ACTIVITIES);
  }

  static async sync() {
    const settings = await ActivityStorage.getSettings();

    if (!settings.enabled || !this.isConfigured(settings)) {
      return { success: false, error: '尚未設定 GitHub Token、Gist ID 與加密金鑰' };
    }

    const activities = await ActivityStorage.getActivities();

    if (activities.length === 0) {
      return { success: true, synced: 0 };
    }

    const filtered = activities.map(activity => PrivacyFilter.filter(activity, settings.privacy_level));

    try {
      const remote = await CloudSync.downloadFromGitHub(settings.github_token, settings.gist_id, settings.encryption_key);
      const merged = this.merge(remote.activities || [], filtered);
      await CloudSync.uploadToGitHub(merged, settings.github_token, settings.gist_id, settings.encryption_key);
      await ActivityStorage.clearActivities();
      return { success: true, synced: activities.length, total: merged.length };
    } catch (error) {
      console.error('[ActivitySync] Sync failed:', error);
      return { success: false, error: error.message };
    }
  }
}

export { ActivitySync };
