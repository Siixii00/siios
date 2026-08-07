class EmbeddingClient {
  constructor(settings = {}) {
    this.embeddingUrl = settings.embedding_url || settings.api_url;
    this.model = settings.embedding_model || 'text-embedding-3-small';
    this.dimensions = settings.embedding_dimensions || null;
    this.apiKey = settings.embedding_api_key || settings.api_key || null;
  }

  _getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  _buildBody(input) {
    const body = { model: this.model, input };
    if (this.dimensions) {
      body.dimensions = this.dimensions;
    }
    return body;
  }

  async getEmbedding(text) {
    try {
      const response = await fetch(`${this.embeddingUrl}/v1/embeddings`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(this._buildBody(text)),
      });
      const json = await response.json();
      return json.data[0].embedding;
    } catch (error) {
      return null;
    }
  }

  async getEmbeddings(texts) {
    try {
      const response = await fetch(`${this.embeddingUrl}/v1/embeddings`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(this._buildBody(texts)),
      });
      const json = await response.json();
      return json.data.map((item) => item.embedding);
    } catch (error) {
      return [];
    }
  }

  async calculateSimilarity(vec1, vec2) {
    try {
      let dot = 0;
      let mag1 = 0;
      let mag2 = 0;
      for (let i = 0; i < vec1.length; i++) {
        dot += vec1[i] * vec2[i];
        mag1 += vec1[i] * vec1[i];
        mag2 += vec2[i] * vec2[i];
      }
      const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
      if (magnitude === 0) return 0;
      return dot / magnitude;
    } catch (error) {
      return 0;
    }
  }

  async findSimilar(queryVector, vectors, threshold = 0.7) {
    try {
      const results = [];
      for (const item of vectors) {
        const similarity = await this.calculateSimilarity(queryVector, item.vector);
        if (similarity >= threshold) {
          results.push({ id: item.id, similarity, metadata: item.metadata || {} });
        }
      }
      results.sort((a, b) => b.similarity - a.similarity);
      return results;
    } catch (error) {
      return [];
    }
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.embeddingUrl}/v1/embeddings`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(this._buildBody('test')),
      });
      if (response.ok) {
        return { success: true, message: 'Connection successful' };
      }
      return { success: false, message: `HTTP ${response.status}: ${response.statusText}` };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

function createEmbeddingClient(settings) {
  return new EmbeddingClient(settings);
}

export { EmbeddingClient, createEmbeddingClient };
