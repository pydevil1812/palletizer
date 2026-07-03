import { useCallback, useEffect, useState } from 'react';
import { CatalogApiService } from '../services/CatalogApiService.js';

/**
 * Loads the box/pallet/template catalogs used by template mode. Refreshes on
 * demand (e.g. when switching into template mode) so admin edits show up
 * without a page reload.
 */
export function useCatalog(enabled) {
  const [pallets, setPallets] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [p, b, t] = await Promise.all([
        CatalogApiService.listPallets(),
        CatalogApiService.listBoxes(),
        CatalogApiService.listTemplates(),
      ]);
      setPallets(p);
      setBoxes(b);
      setTemplates(t);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return { pallets, boxes, templates, error, refresh };
}
