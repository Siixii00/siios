class TwitterDetector {
  constructor() {
     this.platform = 'twitter';
     this.lastActivityTime = 0;
     this.minInterval = 1000;
+    this.queueKey = 'twitter_activity_queue';
+    this.queue = [];
+    this.maxQueueSize = 100; // 最大隊列大小，防止存儲過大
     this.init();
+    this.initQueue();
   }

  init() {
    console.log('[Twitter Detector] Initialized');
    this.observeDOM();
    this.attachClickListeners();
    // 設置定時器來定期處理隊列
    this.queueInterval = setInterval(() => {
      this.processQueue();
    }, 30000); // 每30秒處理一次隊列
  }

  async initQueue() {
    try {
      const result = await chrome.storage.local.get(this.queueKey);
      this.queue = result[this.queueKey] || [];
      // 處理隊列中未成功發送的訊息
      if (this.queue.length > 0) {
        await this.processQueue();
      }
    } catch (error) {
      console.error('[Twitter Detector] Failed to init queue:', error);
      this.queue = [];
    }
  }

  async addToQueue(activity) {
    // 如果隊列已滿，移除最舊的項目
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
      console.warn('[Twitter Detector] Queue full, removed oldest item');
    }
    
    const activityWithFlag = { ...activity, _fromQueue: true };
    this.queue.push(activityWithFlag);
    try {
      await chrome.storage.local.set({ [this.queueKey]: this.queue });
    } catch (error) {
      console.error('[Twitter Detector] Failed to add to queue:', error);
    }
  }

  async removeFromQueue(activityToRemove) {
    this.queue = this.queue.filter(activity => 
      !(activity.id === activityToRemove.id && activity._fromQueue)
    );
    try {
      await chrome.storage.local.set({ [this.queueKey]: this.queue });
    } catch (error) {
      console.error('[Twitter Detector] Failed to remove from queue:', error);
    }
  }

  async processQueue() {
    if (this.queue.length === 0) return;
    
    // 複製隊列以避免在處理過程中修改原隊列引發的問題
    const queueCopy = [...this.queue];
    for (const activity of queueCopy) {
      try {
        await chrome.runtime.sendMessage({
          type: 'ACTIVITY_DETECTED',
          data: activity
        });
        // 成功發送則移除隊列項目
        await this.removeFromQueue(activity);
        // 發送成功後暫停一下，避免過於頻繁地發送訊息
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        // 發送失敗則保留在隊列中等待下次重試
        console.warn('[Twitter Detector] Queue item retry failed:', err);
        // 繼續處理隊列中的其他項目
        continue;
      }
    }
  }

  observeDOM() {
    const observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  handleMutations(mutations) {
    const now = Date.now();
    if (now - this.lastActivityTime < this.minInterval) {
      return;
    }

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        this.checkForNewContent(mutation.addedNodes);
      }
    }
  }

  checkForNewContent(nodes) {
    nodes.forEach(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      // Check for tweet view
      if (this.isElement(node, 'article[data-testid="tweet"]')) {
        this.recordActivity('view', 'tweet');
      }

      // Check for timeline load
      if (this.isElement(node, '[data-testid="primaryColumn"]')) {
        this.recordActivity('view', 'timeline');
      }
    });
  }

  attachClickListeners() {
    document.addEventListener('click', (e) => {
      this.handleClick(e);
    }, true);
  }

  handleClick(event) {
    const target = event.target;
    const now = Date.now();
    
    if (now - this.lastActivityTime < this.minInterval) {
      return;
    }

    // Like button
    if (this.isElement(target, '[data-testid="like"]') || 
        this.isElement(target, '[data-testid="unlike"]')) {
      this.recordActivity('like', 'tweet');
      return;
    }

    // Retweet button
    if (this.isElement(target, '[data-testid="retweet"]') ||
        this.isElement(target, '[data-testid="unretweet"]')) {
      this.recordActivity('retweet', 'tweet');
      return;
    }

    // Reply button
    if (this.isElement(target, '[data-testid="reply"]')) {
      this.recordActivity('comment', 'tweet');
      return;
    }

    // Share button
    if (this.isElement(target, '[data-testid="share"]')) {
      this.recordActivity('share', 'tweet');
      return;
    }

    // Tweet submission
    if (this.isElement(target, '[data-testid="tweetButtonInline"]') ||
        this.isElement(target, '[data-testid="tweetButton"]')) {
      this.recordActivity('post', 'tweet');
      return;
    }

    // Profile click
    if (this.isElement(target, '[data-testid="UserAvatar"]') ||
        this.isElement(target, '[data-testid="UserName"]')) {
      this.recordActivity('view', 'profile');
      return;
    }

    // Hashtag click
    if (target.closest('a[href^="/hashtag/"]')) {
      this.recordActivity('search', 'hashtag');
      return;
    }
  }

  isElement(element, selector) {
    if (!element || !element.matches) return false;
    return element.matches(selector) || element.closest(selector);
  }

  recordActivity(activityType, contentType, metadata = {}) {
    this.lastActivityTime = Date.now();

    const activity = {
      platform: this.platform,
      activity_type: activityType,
      content_type: contentType,
      title: this.getPageTitle(),
      metadata: {
        ...metadata,
        url: window.location.href
      }
    };

    this.sendToBackground(activity);
  }

  getPageTitle() {
    const tweetElement = document.querySelector('article[data-testid="tweet"]');
    if (tweetElement) {
      const textContent = tweetElement.textContent.trim();
      return textContent.substring(0, 100);
    }
    return document.title;
  }

  sendToBackground(activity) {
    chrome.runtime.sendMessage({
      type: 'ACTIVITY_DETECTED',
      data: activity
    })
    .then(() => {
      // 成功發送後，如果這個訊息來自隊列，則移除它
      if (activity._fromQueue) {
        this.removeFromQueue(activity);
      }
    })
    .catch(err => {
      console.error('[Twitter Detector] Failed to send activity:', err);
      // 發送失敗時加入隊列（如果尚未在隊列中）
      if (!activity._fromQueue) {
        this.addToQueue(activity);
      }
    });
  }
}

// Initialize detector
const detector = new TwitterDetector();