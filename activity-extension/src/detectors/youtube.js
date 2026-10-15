class YouTubeDetector {
  constructor() {
     this.platform = 'youtube';
     this.lastActivityTime = 0;
     this.minInterval = 1000;
     this.videoWatchTime = {};
     this.queueKey = 'youtube_activity_queue';
     this.queue = [];
     this.maxQueueSize = 100; // 最大隊列大小，防止存儲過大
     this.init();
     this.initQueue();
   }

  init() {
    console.log('[YouTube Detector] Initialized');
    this.observeDOM();
    this.attachClickListeners();
    this.observeVideoPlayback();
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
      console.error('[YouTube Detector] Failed to init queue:', error);
      this.queue = [];
    }
  }

  async addToQueue(activity) {
    // 如果隊列已滿，移除最舊的項目
    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
      console.warn('[YouTube Detector] Queue full, removed oldest item');
    }
    
    const activityWithFlag = { ...activity, _fromQueue: true };
    this.queue.push(activityWithFlag);
    try {
      await chrome.storage.local.set({ [this.queueKey]: this.queue });
    } catch (error) {
      console.error('[YouTube Detector] Failed to add to queue:', error);
    }
  }

  async removeFromQueue(activityToRemove) {
    this.queue = this.queue.filter(activity => 
      !(activity.id === activityToRemove.id && activity._fromQueue)
    );
    try {
      await chrome.storage.local.set({ [this.queueKey]: this.queue });
    } catch (error) {
      console.error('[YouTube Detector] Failed to remove from queue:', error);
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
        console.warn('[YouTube Detector] Queue item retry failed:', err);
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

      // Check for video page
      if (window.location.pathname.includes('/watch')) {
        this.recordActivity('view', 'video');
      }

      // Check for shorts
      if (window.location.pathname.includes('/shorts')) {
        this.recordActivity('view', 'short');
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
    const likeButton = target.closest('like-button-view-model') ||
                       target.closest('ytd-toggle-button-renderer');
    if (likeButton) {
      const isLiked = likeButton.getAttribute('aria-pressed') === 'true';
      if (isLiked) {
        this.recordActivity('like', 'video');
        return;
      }
    }

    // Subscribe button
    const subscribeButton = target.closest('ytd-subscribe-button-renderer') ||
                             target.closest('yt-button-shape-view-model');
    if (subscribeButton) {
      const isSubscribed = subscribeButton.textContent.includes('訂閱') ||
                           subscribeButton.textContent.includes('Subscribe');
      if (isSubscribed) {
        this.recordActivity('subscribe', 'channel');
        return;
      }
    }

    // Share button
    const shareButton = target.closest('yt-button-view-model')?.querySelector('[aria-label*="分享"]');
    if (shareButton) {
      this.recordActivity('share', 'video');
      return;
    }

    // Comment submission
    const commentBox = target.closest('#contenteditable-root');
    if (commentBox) {
      const submitButton = target.closest('#submit-button') ||
                           target.closest('yt-button-renderer');
      if (submitButton) {
        this.recordActivity('comment', 'video');
        return;
      }
    }

    // Video thumbnail click
    if (target.closest('a#thumbnail') || 
        target.closest('ytd-rich-item-renderer')) {
      // Will be recorded in handleMutations when video page loads
      return;
    }

    // Search
    const searchInput = document.querySelector('input#search');
    if (searchInput && event.key === 'Enter' && searchInput.value.trim()) {
      this.recordActivity('search', 'video', {
        query: searchInput.value.trim()
      });
      return;
    }
  }

  observeVideoPlayback() {
    const checkInterval = setInterval(() => {
      const video = document.querySelector('video');
      
      if (video && window.location.pathname.includes('/watch')) {
        const videoId = this.getVideoId();
        
        if (videoId && !this.videoWatchTime[videoId]) {
          this.videoWatchTime[videoId] = {
            startTime: Date.now(),
            duration: 0
          };
        }

        if (videoId && this.videoWatchTime[videoId]) {
          this.videoWatchTime[videoId].duration += 5;

          // Record when watched for more than 30 seconds
          if (this.videoWatchTime[videoId].duration >= 30 && 
              this.videoWatchTime[videoId].duration % 30 === 0) {
            this.recordActivity('watch', 'video', {
              duration: this.videoWatchTime[videoId].duration
            });
          }
        }
      }
    }, 5000);
  }

  getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
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
      title: this.getVideoTitle(),
      metadata: {
        ...metadata,
        url: window.location.href,
        video_id: this.getVideoId()
      }
    };

    this.sendToBackground(activity);
  }

  getVideoTitle() {
    const titleElement = document.querySelector('h1.ytd-watch-metadata yt-formatted-string') ||
                         document.querySelector('h1.title') ||
                         document.querySelector('title');
    return titleElement?.textContent?.trim() || '';
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
      console.error('[YouTube Detector] Failed to send activity:', err);
      // 發送失敗時加入隊列（如果尚未在隊列中）
      if (!activity._fromQueue) {
        this.addToQueue(activity);
      }
    });
  }
}

// Initialize detector
const detector = new YouTubeDetector();