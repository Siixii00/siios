class FacebookDetector {
  constructor() {
    this.platform = 'facebook';
    this.lastActivityTime = 0;
    this.minInterval = 1000;
    this.init();
  }

  init() {
    console.log('[Facebook Detector] Initialized');
    this.observeDOM();
    this.attachClickListeners();
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
      if (this.isElement(node, '[data-pagelet="FeedSection"]') ||
          this.isElement(node, '[data-ad-preview="message"]')) {
        this.recordActivity('view', 'post');
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
    const likeButton = target.closest('[data-testid="UFI2ReactionLink"]') ||
                       target.closest('[aria-label*="讚"]') ||
                       target.closest('[aria-label*="Like"]');
    if (likeButton) {
      this.recordActivity('like', 'post');
      return;
    }

    // Comment button
    const commentButton = target.closest('[data-testid="UFI2CommentLink"]') ||
                          target.closest('[aria-label*="留言"]') ||
                          target.closest('[aria-label*="Comment"]');
    if (commentButton) {
      this.recordActivity('comment', 'post');
      return;
    }

    // Share button
    const shareButton = target.closest('[data-testid="UFI2ShareLink"]') ||
                        target.closest('[aria-label*="分享"]') ||
                        target.closest('[aria-label*="Share"]');
    if (shareButton) {
      this.recordActivity('share', 'post');
      return;
    }

    // Friend request
    const friendButton = target.closest('[aria-label*="好友"]') ||
                         target.closest('[aria-label*="Friend"]');
    if (friendButton) {
      this.recordActivity('connect', 'friend');
      return;
    }

    // Join group
    const joinButton = target.closest('[aria-label*="加入"]') ||
                       target.closest('[aria-label*="Join"]');
    if (joinButton && window.location.pathname.includes('/groups/')) {
      this.recordActivity('join', 'group');
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
    const postContent = document.querySelector('[data-ad-preview="message"]');
    if (postContent) {
      return postContent.textContent.trim().substring(0, 100);
    }
    return document.title;
  }

  sendToBackground(activity) {
    chrome.runtime.sendMessage({
      type: 'ACTIVITY_DETECTED',
      data: activity
    }).catch(err => {
      console.error('[Facebook Detector] Failed to send activity:', err);
    });
  }
}

// Initialize detector
const detector = new FacebookDetector();