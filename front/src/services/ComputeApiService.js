import { apiFetch } from './AuthService.js';

const URL = '/api/compute';

export class ComputeApiService {
  static async compute(exportJson) {
    let res;
    try {
      res = await apiFetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exportJson),
      });
    } catch (err) {
      const e = new Error('Network error');
      e.validationErrors = [{ code: 'network', params: { detail: err.message } }];
      throw e;
    }

    let body = null;
    try {
      body = await res.json();
    } catch {
      /* ignore non-JSON bodies */
    }

    if (res.status === 400 && body?.errors) {
      const err = new Error('Validation failed');
      err.validationErrors = body.errors;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`Compute request failed (${res.status})`);
      err.validationErrors = [{ code: 'requestFailed', params: { status: res.status } }];
      throw err;
    }
    return body;
  }
}
