import { useCallback, useState } from 'react';
import { HistoryApiService } from '../services/HistoryApiService.js';
import { ComputeApiService } from '../services/ComputeApiService.js';

function findRow(historyRows, id) {
  return historyRows.find((r) => r.id === id) || null;
}

/**
 * Loads N history entries (by id) in parallel and computes each one's
 * full StackingResult independently, for side-by-side comparison.
 * Each item settles on its own — one failing id doesn't block the rest.
 */
export function useCompare() {
  const [items, setItems] = useState([]);

  const load = useCallback(async (ids, historyRows) => {
    setItems(
      ids.map((id) => {
        const row = findRow(historyRows, id);
        return {
          id,
          status: 'loading',
          label: row?.label ?? '',
          createdAt: row?.created_at ?? '',
          config: null,
          result: null,
          error: null,
        };
      })
    );

    await Promise.allSettled(
      ids.map(async (id) => {
        try {
          const cfg = await HistoryApiService.getConfig(id);
          if (!cfg) throw new Error('not found');
          const body = await ComputeApiService.compute(cfg);
          const result = body?.variants?.[0]?.result ?? null;
          setItems((cur) =>
            cur.map((it) => (it.id === id ? { ...it, status: 'ok', config: cfg, result } : it))
          );
        } catch (err) {
          setItems((cur) =>
            cur.map((it) => (it.id === id ? { ...it, status: 'error', error: err.message } : it))
          );
        }
      })
    );
  }, []);

  const reset = useCallback(() => setItems([]), []);

  return { items, load, reset };
}
