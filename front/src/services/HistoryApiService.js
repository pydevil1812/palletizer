import { authHeaders } from './AuthService.js';

const BASE = '/api/history';

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    throw new Error('Could not reach the history server. Is it running? (' + err.message + ')');
  }
  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).error || '';
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(`History request failed (${res.status})${detail ? ': ' + detail : ''}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export class HistoryApiService {
  static list() {
    return request(BASE);
  }

  static getConfig(id) {
    return request(`${BASE}/${id}`).then((r) => r.config);
  }

  static save({ config, summary, label, variant }) {
    return request(BASE, {
      method: 'POST',
      body: JSON.stringify({ config, summary, label, variant }),
    }).then((r) => r.id);
  }

  static remove(id) {
    return request(`${BASE}/${id}`, { method: 'DELETE' });
  }

  static clear() {
    return request(BASE, { method: 'DELETE' });
  }
}
