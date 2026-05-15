const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class CrispAPI {
  constructor() {
    this.websiteId = process.env.CRISP_WEBSITE_ID;
    this.identifier = process.env.CRISP_IDENTIFIER;
    this.key = process.env.CRISP_KEY;
    this.authHeader = Buffer.from(`${this.identifier}:${this.key}`).toString('base64');
    this.baseUrl = `https://api.crisp.chat/v1/website/${this.websiteId}`;
  }

  async request(endpoint, options = {}, retries = 10) {
    const url = `${this.baseUrl}${endpoint}`;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          ...options,
          headers: {
            'Authorization': `Basic ${this.authHeader}`,
            'X-Crisp-Tier': 'plugin',
            'Content-Type': 'application/json',
            ...(options.headers || {})
          }
        });

        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000 * (attempt + 1);
          console.log(`[crisp-api] Rate limited (429). Retrying after ${waitMs}ms...`);
          await sleep(waitMs);
          continue;
        }

        if (res.status === 404) {
          // Sometimes conversations or messages are not found, return null
          return null;
        }

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Crisp API Error (${res.status}): ${text}`);
        }

        const data = await res.json();
        return data;

      } catch (err) {
        if (attempt < retries) {
          const waitMs = 2000 * Math.pow(2, attempt);
          console.log(`[crisp-api] Attempt ${attempt + 1} failed (${err.message}), retrying in ${waitMs}ms...`);
          await sleep(waitMs);
        } else {
          throw new Error(`[crisp-api] Failed after ${retries} retries: ${err.message}`);
        }
      }
    }
    throw new Error(`[crisp-api] Exhausted all ${retries} retries due to 429 Rate Limits or Quota exhaustion.`);
  }

  async listConversations(page = 1, filters = {}) {
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) queryParams.append(key, value);
    }
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const endpoint = `/conversations/${page}${queryString}`;
    
    return this.request(endpoint);
  }

  async listMessages(sessionId) {
    const endpoint = `/conversation/${sessionId}/messages`;
    return this.request(endpoint);
  }
}

module.exports = new CrispAPI();
