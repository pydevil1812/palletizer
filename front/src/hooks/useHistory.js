import { useCallback, useState } from 'react';
import { HistoryApiService } from '../services/HistoryApiService.js';

/**
 * React state wrapper around HistoryApiService. `refresh()` is not called
 * automatically on mount — the History modal triggers it when opened, so an
 * unreachable backend doesn't show an error before the user ever asks for
 * history.
 */
export function useHistory() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await HistoryApiService.list();
      setEntries(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const select = useCallback((id) => {
    setSelectedId((cur) => (cur === id ? null : id));
  }, []);

  const getConfig = useCallback(async (id) => {
    try {
      return await HistoryApiService.getConfig(id);
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  const save = useCallback(async (entry) => {
    try {
      await HistoryApiService.save(entry);
    } catch {
      // Best-effort: a missing backend shouldn't break computing a layout.
    }
  }, []);

  const removeOne = useCallback(
    async (id) => {
      try {
        await HistoryApiService.remove(id);
        setSelectedId((cur) => (cur === id ? null : cur));
        await refresh();
      } catch (err) {
        setError(err.message);
      }
    },
    [refresh]
  );

  const clearAll = useCallback(async () => {
    try {
      await HistoryApiService.clear();
      setSelectedId(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }, [refresh]);

  return { entries, loading, error, selectedId, refresh, select, save, getConfig, removeOne, clearAll };
}
