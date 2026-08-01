class CloudSync {
  static async encrypt(data, keyBase64) {
    const keyData = this.base64ToArrayBuffer(keyBase64);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      'AES-GCM',
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );
    
    return {
      encrypted: true,
      iv: this.arrayBufferToBase64(iv),
      data: this.arrayBufferToBase64(encrypted)
    };
  }

  static async decrypt(encryptedObj, keyBase64) {
    const keyData = this.base64ToArrayBuffer(keyBase64);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      'AES-GCM',
      false,
      ['decrypt']
    );
    
    const iv = this.base64ToArrayBuffer(encryptedObj.iv);
    const data = this.base64ToArrayBuffer(encryptedObj.data);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    return JSON.parse(new TextDecoder().decode(decrypted));
  }

  static arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  static base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  static async uploadToGitHub(activities, token, gistId, encryptionKey) {
    const encrypted = await this.encrypt({
      activities,
      uploaded_at: Date.now()
    }, encryptionKey);

    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        files: {
          'activities.json': {
            content: JSON.stringify(encrypted)
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    return await response.json();
  }

  static async downloadFromGitHub(token, gistId, encryptionKey) {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { activities: [] };
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const gist = await response.json();
    const content = JSON.parse(gist.files['activities.json'].content);

    if (!content.encrypted) {
      return { activities: content.activities || [] };
    }

    const decrypted = await this.decrypt(content, encryptionKey);
    return { activities: decrypted.activities || [] };
  }
}

export { CloudSync };