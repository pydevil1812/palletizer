import { apiFetch } from './AuthService.js';

async function request(url, options = {}) {
  const res = await apiFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

/**
 * Admin-managed catalogs of pallet types, box/SKU definitions and reusable
 * configuration templates ("template mode" data source).
 */
export class CatalogApiService {
  // ── Read (any authenticated user) ──
  static listPallets() {
    return request('/api/catalog/pallets');
  }

  static listBoxes() {
    return request('/api/catalog/boxes');
  }

  static listTemplates() {
    return request('/api/catalog/templates');
  }

  static async getTemplateConfig(id) {
    const body = await request(`/api/catalog/templates/${id}`);
    return body.config;
  }

  // ── Modify (admin only) ──
  static createPallet(pallet) {
    return request('/api/admin/catalog/pallets', { method: 'POST', body: JSON.stringify(pallet) });
  }

  static updatePallet(id, pallet) {
    return request(`/api/admin/catalog/pallets/${id}`, { method: 'PUT', body: JSON.stringify(pallet) });
  }

  static deletePallet(id) {
    return request(`/api/admin/catalog/pallets/${id}`, { method: 'DELETE' });
  }

  static importPallets(rows, replace) {
    return request('/api/admin/catalog/pallets/import', {
      method: 'POST',
      body: JSON.stringify({ rows, replace }),
    });
  }

  static createBox(box) {
    return request('/api/admin/catalog/boxes', { method: 'POST', body: JSON.stringify(box) });
  }

  static updateBox(id, box) {
    return request(`/api/admin/catalog/boxes/${id}`, { method: 'PUT', body: JSON.stringify(box) });
  }

  static deleteBox(id) {
    return request(`/api/admin/catalog/boxes/${id}`, { method: 'DELETE' });
  }

  static importBoxes(rows, replace) {
    return request('/api/admin/catalog/boxes/import', {
      method: 'POST',
      body: JSON.stringify({ rows, replace }),
    });
  }

  static createTemplate(name, config) {
    return request('/api/admin/catalog/templates', {
      method: 'POST',
      body: JSON.stringify({ name, config }),
    });
  }

  static deleteTemplate(id) {
    return request(`/api/admin/catalog/templates/${id}`, { method: 'DELETE' });
  }
}
