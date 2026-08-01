import { Encryption } from './encryption.js';
import { GitHubSync } from './github-sync.js';
import { ActivityDB, ActivitySettingsDB, SettingsDB } from '../../db.js';

class CrossDeviceSync {
  constructor() {
    this.github = null;
    this.encryptionKey = null;
    this.gistId = null;
    this.deviceId = this.getOrCreateDeviceId();
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

    const activitiesFile = gist.files['activities.json'];
    
    if (!activitiesFile) {
      return { activities: [], devices: [] };
    }

    const encryptedData = JSON.parse(activitiesFile.content);
    
    if (!encryptedData.encrypted) {
      return { activities: encryptedData.activities || [], devices: [] };
    }

    const decrypted = await Encryption.decrypt(encryptedData, this.encryptionKey);
    
    const metadataFile = gist.files['metadata.json'];
    const metadata = metadataFile ? JSON.parse(metadataFile.content) : { devices: [] };

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

    return Array.from(merged.values());
  }

  async getMetadata() {
    if (!this.gistId || !this.github) {
      return { devices: [], version: 1 };
    }

    const gist = await this.github.getGist(this.gistId);
    
    if (!gist || !gist.files['metadata.json']) {
      return { devices: [], version: 1 };
    }

    return JSON.parse(gist.files['metadata.json'].content);
  }

  async disconnect() {
    if (this.gistId && this.github) {
      try {
        await this.github.deleteGist(this.gistId);
      } catch (error) {
        console.error('[CrossDeviceSync] Failed to delete gist:', error);
      }
    }

    await SettingsDB.delete('cross_device_sync');
    localStorage.removeItem('siios_encryption_key');
    
    this.github = null;
    this.encryptionKey = null;
    this.gistId = null;
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
    
    return {
      enabled: true,
      connected: validation.success,
      user: validation.user,
      gistId: settings.gist_id,
      deviceId: this.deviceId
    };
  }
}

export { CrossDeviceSync };