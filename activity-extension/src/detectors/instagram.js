class InstagramDetector {
  constructor() {
     this.platform = 'instagram';
     this.lastActivityTime = 0;
     this.minInterval = 1000;
+    this.queueKey = 'instagram_activity_queue';
+    this.queue = [];
+    this.maxQueueSize = 100; // 最大隊列大小，防止存儲過大
     this.init();
+    this.initQueue();
   }

  init() {
    console.log('[Instagram Detector] Initialized');
    this.observeDOM();
    this.attachClickListeners();
    this.observeScroll();
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
      console.error('[Instagram Detector] Failed to init queue:', error);
      this.queue = [];
    }
  }

  async addToQueue(activity) {
    // 如果隊列已滿，移除最舊的項目
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
      console.warn('[Instagram Detector] Queue full, removed oldest item');
    }
    
    const activityWithFlag = { ...activity, _fromQueue: true };
    this.queue.push(activityWithFlag);
    try {
      await chrome.storage.local.set({ [this.queueKey]: this.queue });
    } catch (error) {
      console.error('[Instagram Detector] Failed to add to queue:', error);
    }
  }

  async removeFromQueue(activityToRemove) {
    this.queue = this.queue.filter(activity => 
      !(activity.id === activityToRemove.id && activity._fromQueue)
    );
    try {
      await chrome.storage.local.set({ [this.queueKey]: this.queue });
    } catch (error) {
      console.error('[Instagram Detector] Failed to remove from queue:', error);
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
        console.warn('[Instagram Detector] Queue item retry failed:', err);
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

      // Check for post view
      if (this.isElement(node, 'article[role="presentation"]') ||
          this.isElement(node, 'article._ab6k')) {
        this.recordActivity('view', 'post');
      }

      // Check for story view
      if (this.isElement(node, '[role="dialog"]')) {
        if (window.location.pathname.includes('/stories/')) {
          this.recordActivity('view', 'story');
        }
      }

      // Check for Reels
      if (window.location.pathname.includes('/reels/') || 
          window.location.pathname.includes('/reel/')) {
        this.recordActivity('view', 'reel');
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

    // Like button (heart icon)
    const likeButton = target.closest('svg[aria-label="讚"]') || 
                       target.closest('svg[aria-label="Like"]') ||
                       target.closest('[data-testid="like-button"]');
    if (likeButton) {
      this.recordActivity('like', 'post');
      return;
    }

    // Save button (bookmark)
    const saveButton = target.closest('svg[aria-label="儲存"]') ||
                        target.closest('svg[aria-label="Save"]');
    if (saveButton) {
      this.recordActivity('save', 'post');
      return;
    }

    // Comment button
    const commentButton = target.closest('svg[aria-label="留言"]') ||
                           target.closest('svg[aria-label="Comment"]');
    if (commentButton) {
      this.recordActivity('comment', 'post');
      return;
    }

    // Share button
    const shareButton = target.closest('svg[aria-label="分享"]') ||
                         target.closest('svg[aria-label="Share"]');
    if (shareButton) {
      this.recordActivity('share', 'post');
      return;
    }

    // Send message (DM)
    const dmButton = target.closest('svg[aria-label="分享"]') ||
                     target.closest('a[href="/direct/inbox/"]');
    if (dmButton) {
      this.recordActivity('message', 'direct');
      return;
    }

    // Follow button
    const followButton = target.closest('button')?.textContent;
    if (followButton && (
        followButton.includes('追蹤') || 
        followButton.includes('Follow') ||
        followButton.includes('追蹤中') ||
        followButton.includes('Following'))) {
      this.recordActivity('follow', 'user');
      return;
    }

    // Profile picture click
    if (target.closest('img[data-testid="user-avatar"]') ||
        target.closest('img[srcset*="profile']')) {
      this.recordActivity('view', 'profile');
      return;
    }

    // Hashtag click
    if (target.closest('a[href*="/explore/tags/"]') ||
        target.closest('a[href*="/tags/"]')) {
      this.recordActivity('search', 'hashtag');
      return;
    }
  }

  observeScroll() {
    let scrollTimeout;
    
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      
      scrollTimeout = setTimeout(() => {
        this.recordActivity('scroll', 'feed');
      }, 1000);
    });
  }

  isElement(element, selector) {
    if (!element || !element.matches) return false;
    return element.matches(selector) || element.closest(selector);
  }

  recordActivity(activityType, contentType, metadata = {}) {
    this.lastActivityTime = Date.now();

    // Don't record scroll events too frequently
    if (activityType === 'scroll' && Math.random() > 0.1) {
      return;
    }

    const activity = {
      platform: this.platform,
      activity_type: activityType,
      content_type: contentType,
      title: this.getPageTitle(),
      metadata: {
        ...metadata,
        url: window.location.href,
        path: window.location.pathname
      }
    };

    this.sendToBackground(activity);
  }

  getPageTitle() {
    // Try to get post caption or username
    const caption = document.querySelector('h1, article h2');
    if (caption && caption.textContent.trim()) {
      return caption.textContent.trim().substring(0, 100);
    }

    const username = document.querySelector('header a[href^="/"]');
    if (username) {
      return `@${username.textContent.trim()}`;
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
      console.error('[Instagram Detector] Failed to send activity:', err);
      // 發送失敗時加入隊列（如果尚未在隊列中）
      if (!activity._fromQueue) {
        this.addToQueue(activity);
      }
    });
  }
}

// Initialize detector
const detector = new InstagramDetector();