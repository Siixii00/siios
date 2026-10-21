import { Encryption } from './encryption.js';
import { GitHubSync } from './github-sync.js';
import { ActivityDB, ActivitySettingsDB, SettingsDB } from '../../db.js';

class CrossDeviceSync {
  constructor() {
    this.github = null;
    this.encryptionKey = null;
    this.gistId = null;
    this.deviceId = this.getOrCreateDeviceId();
    this.autoSyncTimer = null;
  }

  getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('siios_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('siios_device_id', deviceId);
    }
    return deviceId;
  }

  async initialize() {
    const settings = await SettingsDB.get('cross_device_sync');

    if (settings?.enabled) {
      this.github = new GitHubSync(settings.github_token);
      this.gistId = settings.gist_id;

      const encryptedKey = localStorage.getItem('siios_encryption_key');
      if (encryptedKey) {
        this.encryptionKey = encryptedKey;
      } else {
        console.warn('[CrossDeviceSync] No encryption key found');
      }
    }

    const autoSyncEnabled = await SettingsDB.get('auto_sync_enabled');
    const autoSyncInterval = await SettingsDB.get('auto_sync_interval');
    if (autoSyncEnabled && autoSyncInterval && this.github) {
      this.startAutoSync(autoSyncInterval);
    }
  }

  async setupGitHubSync(token) {
    const validation = await GitHubSync.validateToken(token);

    if (!validation.success) {
      throw new Error(`Token validation failed: ${validation.error}`);
    }

    this.github = new GitHubSync(token);

    const encryptionKey = await Encryption.generateKey();
    this.encryptionKey = encryptionKey;
    localStorage.setItem('siios_encryption_key', encryptionKey);

    const gist = await this.github.createGist('Siios Activity Sync Data', {
      'metadata.json': {
        content: JSON.stringify({
          version: 1,
          created_at: new Date().toISOString(),
          devices: [{
            id: this.deviceId,
            name: this.getDeviceName(),
            type: this.getDeviceType(),
            last_seen: Date.now()
          }]
        })
      },
      'activities.json': {
        content: JSON.stringify({
          encrypted: false,
          activities: []
        })
      }
    });

    this.gistId = gist.id;

    await SettingsDB.set('cross_device_sync', {
      enabled: true,
      github_token: token,
      gist_id: gist.id,
      user_login: validation.user.login,
      created_at: Date.now()
    });

    return {
      gistId: gist.id,
      encryptionKey: encryptionKey,
      user: validation.user
    };
  }

  // 加入另一台裝置（或瀏覽器擴充功能）已經建立的同步：需要同一組 Token、Gist ID 與加密金鑰
  async joinExisting({ token, gistId, encryptionKey }) {
    token = String(token || '').trim();
    gistId = String(gistId || '').trim().replace(/^.*\//, ''); // 允許貼整個 gist 網址
    encryptionKey = String(encryptionKey || '').trim();
    if (!token || !gistId || !encryptionKey) throw new Error('請填寫 Token、Gist ID 與加密金鑰');

    const validation = await GitHubSync.validateToken(token);
    if (!validation.success) throw new Error(`Token 驗證失敗：${validation.error}`);

    const github = new GitHubSync(token);
    const gist = await github.getGist(gistId);
    if (!gist) throw new Error('找不到這個 Gist（確認 Gist ID，且 Token 是建立它的同一個 GitHub 帳號）');
    const content = await github.readFile(gist, 'activities.json');
    if (!content) throw new Error('這個 Gist 不是 Siios 的同步資料（沒有 activities.json）');
    const data = JSON.parse(content);
    if (data.encrypted) {
      try {
        await Encryption.decrypt(data, encryptionKey);
      } catch {
        throw new Error('加密金鑰不正確，無法解開這個 Gist 的資料');
      }
    }

    this.github = github;
    this.gistId = gist.id;
    this.encryptionKey = encryptionKey;
    localStorage.setItem('siios_encryption_key', encryptionKey);

    await SettingsDB.set('cross_device_sync', {
      enabled: true,
      github_token: token,
      gist_id: gist.id,
      user_login: validation.user.login,
      joined: true, // 這個 Gist 是別的裝置建立的，停用時不能刪掉它
      created_at: Date.now()
    });
    return { gistId: gist.id, user: validation.user };
  }

  // 給使用者抄到另一台裝置／瀏覽器擴充功能用的連線資訊
  async getConnectionInfo() {
    const settings = await SettingsDB.get('cross_device_sync');
    if (!settings?.enabled) return null;
    return { gistId: settings.gist_id, encryptionKey: localStorage.getItem('siios_encryption_key') || '', user: settings.user_login, joined: !!settings.joined };
  }

  async uploadActivities(activities) {
    if (!this.github || !this.encryptionKey || !this.gistId) {
      throw new Error('Cross-device sync not initialized');
    }

    const settings = await ActivitySettingsDB.get();
    const privacyLevel = settings?.global_level || 'basic';

    const encrypted = await Encryption.encrypt({
      activities,
      device_id: this.deviceId,
      uploaded_at: Date.now()
    }, this.encryptionKey);

    const metadata = await this.getMetadata();

    const deviceIndex = metadata.devices.findIndex(d => d.id === this.deviceId);
    if (deviceIndex >= 0) {
      metadata.devices[deviceIndex].last_seen = Date.now();
      metadata.devices[deviceIndex].activity_count = activities.length;
    } else {
      metadata.devices.push({
        id: this.deviceId,
        name: this.getDeviceName(),
        type: this.getDeviceType(),
        last_seen: Date.now(),
        activity_count: activities.length
      });
    }

    await this.github.updateGist(this.gistId, {
      'activities.json': {
        content: JSON.stringify(encrypted)
      },
      'metadata.json': {
        content: JSON.stringify(metadata)
      }
    });

    return { uploaded: activities.length };
  }

  async downloadActivities() {
    if (!this.github || !this.encryptionKey || !this.gistId) {
      throw new Error('Cross-device sync not initialized');
    }

    const gist = await this.github.getGist(this.gistId);

    if (!gist) {
      throw new Error('Gist not found');
    }

    const activitiesContent = await this.github.readFile(gist, 'activities.json');

    if (!activitiesContent) {
      return { activities: [], devices: [] };
    }

    const encryptedData = JSON.parse(activitiesContent);

    if (!encryptedData.encrypted) {
      return { activities: encryptedData.activities || [], devices: [] };
    }

    const decrypted = await Encryption.decrypt(encryptedData, this.encryptionKey);

    const metadataContent = await this.github.readFile(gist, 'metadata.json');
    const metadata = metadataContent ? JSON.parse(metadataContent) : { devices: [] };

    return {
      activities: decrypted.activities || [],
      devices: metadata.devices || []
    };
  }

  async sync() {
    const localActivities = await ActivityDB.getAll(1000);

    const remote = await this.downloadActivities();
    const remoteActivities = remote.activities;

    const merged = this.mergeActivities(localActivities, remoteActivities);

    await this.uploadActivities(merged);

    for (const activity of merged) {
      const existing = await ActivityDB.getById(activity.id);
      if (!existing) {
        await ActivityDB.create(activity);
      } else if (activity.timestamp > existing.timestamp) {
        await ActivityDB.update(activity.id, activity);
      }
    }

    return {
      uploaded: localActivities.length,
      downloaded: remoteActivities.length,
      merged: merged.length
    };
  }

  mergeActivities(local, remote) {
    const merged = new Map();

    local.forEach(a => {
      merged.set(a.id, a);
    });

    remote.forEach(a => {
      const existing = merged.get(a.id);
      if (!existing || a.timestamp > existing.timestamp) {
        merged.set(a.id, a);
      }
    });

    return Array.from(merged.values()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 1000);
  }

  async getMetadata() {
    if (!this.gistId || !this.github) {
      return { devices: [], version: 1 };
    }

    const gist = await this.github.getGist(this.gistId);

    const content = gist ? await this.github.readFile(gist, 'metadata.json') : null;
    if (!content) {
      return { devices: [], version: 1 };
    }

    return JSON.parse(content);
  }

  async disconnect() {
    const saved = await SettingsDB.get('cross_device_sync');
    // 加入別台裝置建立的同步時，只解除這台的連線，雲端資料留給其他裝置繼續用
    if (this.gistId && this.github && !saved?.joined) {
      try {
        await this.github.deleteGist(this.gistId);
      } catch (error) {
        console.error('[CrossDeviceSync] Failed to delete gist:', error);
      }
    }

    await SettingsDB.delete('cross_device_sync');
    await SettingsDB.set('auto_sync_enabled', false);
    localStorage.removeItem('siios_encryption_key');

    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }

    this.github = null;
    this.encryptionKey = null;
    this.gistId = null;
  }

  async startAutoSync(intervalMinutes = 30) {
    if (!this.github) {
      throw new Error('Cross-device sync not initialized');
    }

    await SettingsDB.set('auto_sync_enabled', true);
    await SettingsDB.set('auto_sync_interval', intervalMinutes);

    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
    }

    this.autoSyncTimer = setInterval(async () => {
      try {
        await this.sync();
      } catch (e) {
        console.warn('[CrossDeviceSync] Auto-sync failed:', e);
      }
    }, intervalMinutes * 60 * 1000);

    return { success: true, interval: intervalMinutes };
  }

  async stopAutoSync() {
    await SettingsDB.set('auto_sync_enabled', false);

    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }

    return { success: true };
  }

  async isAutoSyncEnabled() {
    const enabled = await SettingsDB.get('auto_sync_enabled');
    const interval = await SettingsDB.get('auto_sync_interval');
    return { enabled: !!enabled, interval: interval || 30 };
  }

  getDeviceName() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;

    if (/Windows/.test(platform)) return 'Windows PC';
    if (/Mac/.test(platform)) return 'Mac';
    if (/Linux/.test(platform)) return 'Linux PC';
    if (/iPhone|iPad/.test(ua)) return 'iOS Device';
    if (/Android/.test(ua)) return 'Android Device';

    return 'Unknown Device';
  }

  getDeviceType() {
    const ua = navigator.userAgent;

    if (/Mobile|Android|iPhone|iPad/.test(ua)) return 'mobile';
    return 'desktop';
  }

  async getStatus() {
    const settings = await SettingsDB.get('cross_device_sync');

    if (!settings?.enabled) {
      return {
        enabled: false,
        connected: false
      };
    }

    const validation = await GitHubSync.validateToken(settings.github_token);
    const autoSync = await this.isAutoSyncEnabled();

    return {
      enabled: true,
      connected: validation.success,
      user: validation.user,
      gistId: settings.gist_id,
      deviceId: this.deviceId,
      autoSync
    };
  }
}

export { CrossDeviceSync };
// ───── 全 App 共用的同步管理器：啟動時自動連線並（依設定）定時同步 ─────
let shared = null;
export async function getSyncManager() {
  if (!shared) {
    shared = new CrossDeviceSync();
    await shared.initialize();
  }
  return shared;
}

// App 啟動後呼叫：已啟用跨裝置同步的話，馬上同步一次（10 分鐘內不重複），並依設定啟動定時同步。失敗一律靜默。
export async function startBackgroundSync() {
  try {
    const manager = await getSyncManager();
    if (!manager.github || !manager.encryptionKey || !manager.gistId) return null;
    const last = (await SettingsDB.get('cross_device_last_sync')) || 0;
    if (Date.now() - last < 10 * 60 * 1000) return null;
    await SettingsDB.set('cross_device_last_sync', Date.now());
    return await manager.sync();
  } catch (error) {
    console.warn('[CrossDeviceSync] 啟動同步失敗：', error.message);
    return null;
  }
}
