class PrivacyFilter {
  static filter(activity, privacyLevel) {
    const filtered = { ...activity };
    
    switch (privacyLevel) {
      case 'basic':
        return this.filterBasic(filtered);
      case 'summary':
        return this.filterSummary(filtered);
      case 'detailed':
        return this.filterDetailed(filtered);
      default:
        return this.filterBasic(filtered);
    }
  }

  static filterBasic(activity) {
    return {
      platform: activity.platform,
      activity_type: activity.activity_type,
      timestamp: activity.timestamp,
      source: activity.source,
      id: activity.id,
      metadata: {
        count: 1
      }
    };
  }

  static filterSummary(activity) {
    return {
      platform: activity.platform,
      activity_type: activity.activity_type,
      timestamp: activity.timestamp,
      source: activity.source,
      id: activity.id,
      summary: {
        title: activity.title ? this.truncate(activity.title, 50) : '',
        count: activity.count || 1
      },
      metadata: activity.metadata || {}
    };
  }

  static filterDetailed(activity) {
    return {
      ...activity,
      title: activity.title ? this.truncate(activity.title, 100) : '',
      content: activity.content ? this.truncate(activity.content, 200) : ''
    };
  }

  static truncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  static shouldRecord(platform, activityType, settings) {
    if (!settings.enabled) return false;
    if (!settings.platforms[platform]?.enabled) return false;
    return true;
  }
}

export { PrivacyFilter };
