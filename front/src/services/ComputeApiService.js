/**
 * Fetch wrapper for the pallet-stacking compute backend
 * (palletizer_source/server.py, proxied at /api/compute by Vite in dev).
 * All packing/fill/recommendation math runs server-side; this just ships the
 * config out and the resulting variants back. Same error-wrapping pattern as
 * HistoryApiService.
 */
const URL = '/api/compute';

export class ComputeApiService {
  /**
   * Returns `{ variants }` on success. On a 400 (validation failure) throws
   * a ValidationError carrying the server's `errors` array so callers can
   * tell that apart from a network/server failure.
   */
  static async compute(exportJson) {
    let res;
    try {
      res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
