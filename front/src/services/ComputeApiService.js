import { authHeaders } from './AuthService.js';

const URL = '/api/compute';

export class ComputeApiService {
  static async compute(exportJson) {
    let res;
    try {
      res = await fetch(URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify(exportJson),
      });
    } catch (err) {
      throw new Error('Could not reach the compute server. Is it running? (' + err.message + ')');
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
      throw new Error(`Compute request failed (${res.status})`);
    }
    return body;
  }
}
