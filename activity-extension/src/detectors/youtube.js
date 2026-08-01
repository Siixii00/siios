class YouTubeDetector {
  constructor() {
    this.platform = 'youtube';
    this.lastActivityTime = 0;
    this.minInterval = 1000;
    this.videoWatchTime = {};
    this.init();
  }

  init() {
    console.log('[YouTube Detector] Initialized');
    this.observeDOM();
    this.attachClickListeners();
    this.observeVideoPlayback();
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
    }).catch(err => {
      console.error('[YouTube Detector] Failed to send activity:', err);
    });
  }
}

// Initialize detector
const detector = new YouTubeDetector();