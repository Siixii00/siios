class GitHubSync {
  constructor(token) {
    this.token = token;
    this.baseUrl = 'https://api.github.com';
  }

  async createGist(description, files) {
    const response = await fetch(`${this.baseUrl}/gists`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        description,
        public: false,
        files
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GitHub API error: ${error.message}`);
    }

    const data = await response.json();
    return data;
  }

  async updateGist(gistId, files) {
    const response = await fetch(`${this.baseUrl}/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${this.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        files
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GitHub API error: ${error.message}`);
    }

    const data = await response.json();
    return data;
  }

  async getGist(gistId) {
    const response = await fetch(`${this.baseUrl}/gists/${gistId}`, {
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.json();
      throw new Error(`GitHub API error: ${error.message}`);
    }

    const data = await response.json();
    return data;
  }

  async deleteGist(gistId) {
    const response = await fetch(`${this.baseUrl}/gists/${gistId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok && response.status !== 204) {
      const error = await response.json();
      throw new Error(`GitHub API error: ${error.message}`);
    }

    return true;
  }

  async listGists() {
    const response = await fetch(`${this.baseUrl}/gists`, {
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GitHub API error: ${error.message}`);
    }

    const data = await response.json();
    return data;
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        return { success: false, error: 'Invalid token' };
      }

      const user = await response.json();
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async validateToken(token) {
    const github = new GitHubSync(token);
    return await github.testConnection();
  }
}

export { GitHubSync };