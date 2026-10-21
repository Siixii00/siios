// 嵌入（embedding）客戶端：OpenAI 相容的 /v1/embeddings。
// 失敗一律回傳 null／空陣列（記憶系統會退回關鍵字搜尋），最後一次的錯誤放在 lastError 供設定頁顯示。
class EmbeddingClient {
  constructor(settings = {}) {
    this.embeddingUrl = EmbeddingClient.normalizeBaseUrl(settings.embedding_url || settings.api_url);
    this.model = settings.embedding_model || 'text-embedding-3-small';
    this.dimensions = settings.embedding_dimensions || null;
    this.apiKey = settings.embedding_api_key || settings.api_key || null;
    this.lastError = null;
    this.failures = 0;
    this.pausedUntil = 0;
  }

  // 只整理空白與結尾的斜線；實際要呼叫的路徑由 _endpoint() 決定
  static normalizeBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  // 使用者可能貼：服務根網址（補 /v1/embeddings）、…/v1（補 /embeddings）、或完整的 …/embeddings（例如 Gemini 的
  // https://generativelanguage.googleapis.com/v1beta/openai/embeddings，原樣使用）
  _endpoint() {
    const u = this.embeddingUrl;
    if (/\/embeddings$/i.test(u)) return u;
    if (/\/v1$/i.test(u)) return u + '/embeddings';
    return u + '/v1/embeddings';
  }

  _getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  // dimensions 參數只有 OpenAI 的 text-embedding-3 系列支援；其他模型（ada-002、bge、各家代理）收到可能直接回 400
  _supportsDimensions() {
    return !!this.dimensions && /text-embedding-3/i.test(this.model);
  }

  _buildBody(input, withDimensions = this._supportsDimensions()) {
    const body = { model: this.model, input };
    if (withDimensions) {
      body.dimensions = this.dimensions;
    }
    return body;
  }

  async _request(input) {
    if (!this.embeddingUrl) throw new Error('沒有設定嵌入模型網址');
    let response = await fetch(this._endpoint(), { method: 'POST', headers: this._getHeaders(), body: JSON.stringify(this._buildBody(input)) });
    if (response.status === 400 && this._supportsDimensions()) {
      // 這個服務不接受 dimensions：之後都不帶，並重送一次
      this.dimensions = null;
      response = await fetch(this._endpoint(), { method: 'POST', headers: this._getHeaders(), body: JSON.stringify(this._buildBody(input, false)) });
    }
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error(json?.error?.message || `HTTP ${response.status}`);
    if (!Array.isArray(json?.data) || !json.data.length || !Array.isArray(json.data[0].embedding)) throw new Error('回應裡沒有 embedding 資料（網址或模型名稱可能不對）');
    return json.data;
  }

  // 連續失敗 3 次就暫停 5 分鐘，避免每則訊息都打一次一定會失敗的請求
  async _guarded(fn, fallback) {
    if (Date.now() < this.pausedUntil) return fallback;
    try {
      const out = await fn();
      this.failures = 0;
      this.lastError = null;
      return out;
    } catch (error) {
      this.lastError = error.message;
      if (++this.failures >= 3) { this.pausedUntil = Date.now() + 5 * 60 * 1000; this.failures = 0; }
      return fallback;
    }
  }

  async getEmbedding(text) {
    return this._guarded(async () => (await this._request(text))[0].embedding, null);
  }

  async getEmbeddings(texts) {
    return this._guarded(async () => (await this._request(texts)).map((item) => item.embedding), []);
  }

  async calculateSimilarity(vec1, vec2) {
    try {
      if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
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

  // 設定頁的「測試嵌入模型」：不經過失敗暫停，回傳向量維度與耗時
  async testConnection() {
    this.pausedUntil = 0;
    const started = Date.now();
    try {
      const data = await this._request('測試');
      return { success: true, message: `連線成功：${this.model}，向量 ${data[0].embedding.length} 維，${Date.now() - started} 毫秒`, dimensions: data[0].embedding.length };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

function createEmbeddingClient(settings) {
  return new EmbeddingClient(settings);
}

export { EmbeddingClient, createEmbeddingClient };
