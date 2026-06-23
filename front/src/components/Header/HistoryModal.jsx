import { useEffect } from 'react';
import { fmt } from '../../utils/format.js';

export function HistoryModal({
  open,
  entries,
  loading,
  error,
  selectedId,
  onSelect,
  onRemoveOne,
  onClearAll,
  onOpenSelected,
  onClose,
  onRefresh,
  isAdmin,
}) {
  useEffect(() => {
    if (open) onRefresh();
  }, [open, onRefresh]);

  if (!open) return null;

  const handleClearAll = () => {
    if (window.confirm('Delete the entire query history? This cannot be undone.')) onClearAll();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box history-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" title="Close" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <h2>Query history</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>
          Click a row to select it, then Open to reload its parameters.
        </p>

        {error && (
          <div className="banner err" style={{ display: 'block' }}>
            {error}
          </div>
        )}

        <div className="history-list">
          {loading && <p className="muted">Loading…</p>}
          {!loading && entries.length === 0 && !error && <p className="muted">No saved queries yet.</p>}
          {!loading && entries.length > 0 && (
            <table className="boxes history-table">
              <thead>
                <tr>
                  <th className="l">Date</th>
                  <th className="l">User</th>
                  <th className="l">Label</th>
                  <th>Boxes</th>
                  <th>Layers</th>
                  <th>Fill</th>
                  <th>Height</th>
                  <th>Weight</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === selectedId ? 'selected' : ''}
                    onClick={() => onSelect(row.id)}
                  >
                    <td className="l">{row.created_at}</td>
                    <td className="l">{row.username || '–'}</td>
                    <td className="l">{row.label}</td>
                    <td>{fmt(row.total_boxes)}</td>
                    <td>{fmt(row.layers)}</td>
                    <td>{fmt(row.fill_pct, 0)}%</td>
                    <td>{fmt(row.height_mm, 0)}</td>
                    <td>{fmt(row.weight_kg, 0)}</td>
                    {isAdmin && (
                      <td>
                        <button
                          className="ghost row-delete"
                          title="Delete this entry"
                          aria-label="Delete this entry"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveOne(row.id);
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="history-actions">
          {isAdmin && (
            <button className="ghost" onClick={handleClearAll}>
              Delete history
            </button>
          )}
          <button className="primary" disabled={selectedId == null} onClick={onOpenSelected}>
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
