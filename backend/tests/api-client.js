function createApiClient(baseUrl) {
  let token = null;

  return {
    async login(email, password) {
      const response = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (response.ok) token = body.result?.token;
      return { response, body };
    },
    async request(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      if (token) headers.authorization = `Bearer ${token}`;
      if (options.body && typeof options.body !== 'string') {
        headers['content-type'] = 'application/json';
        options.body = JSON.stringify(options.body);
      }
      return fetch(`${baseUrl}${path}`, { ...options, headers });
    },
  };
}

module.exports = { createApiClient };
