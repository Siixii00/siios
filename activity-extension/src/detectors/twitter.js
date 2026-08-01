class TwitterDetector {
  constructor() {
    this.platform = 'twitter';
    this.lastActivityTime = 0;
    this.minInterval = 1000;
    this.init();
  }

  init() {
    console.log('[Twitter Detector] Initialized');
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
    }).catch(err => {
      console.error('[Twitter Detector] Failed to send activity:', err);
    });
  }
}

// Initialize detector
const detector = new TwitterDetector();