import { useEffect } from 'react';
import { fmt } from '../../utils/format.js';
import { useLang } from '../../i18n/LangContext.jsx';

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
  compareIds,
  onToggleCompare,
  onOpenCompare,
}) {
  const { t } = useLang();

  useEffect(() => {
    if (open) onRefresh();
  }, [open, onRefresh]);

  if (!open) return null;

  const handleClearAll = () => {
    if (window.confirm(t('history.confirmDeleteAll'))) onClearAll();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box history-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" title={t('history.close')} aria-label={t('history.close')} onClick={onClose}>
          ✕
        </button>
        <h2>{t('history.title')}</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: -4 }}>
          {t('history.hint')}
        </p>

        {error && (
          <div className="banner err" style={{ display: 'block' }}>
            {error}
          </div>
        )}

        <div className="history-list">
          {loading && <p className="muted">{t('history.loading')}</p>}
          {!loading && entries.length === 0 && !error && <p className="muted">{t('history.empty')}</p>}
          {!loading && entries.length > 0 && (
            <table className="boxes history-table">
              <thead>
                <tr>
                  <th title={t('history.colCompare')}></th>
                  <th className="l">{t('history.colDate')}</th>
                  <th className="l">{t('history.colUser')}</th>
                  <th className="l">{t('history.colLabel')}</th>
                  <th>{t('history.colBoxes')}</th>
                  <th>{t('history.colLayers')}</th>
                  <th>{t('history.colFill')}</th>
                  <th>{t('history.colHeight')}</th>
                  <th>{t('history.colWeight')}</th>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        title={t('history.colCompare')}
                        checked={compareIds.includes(row.id)}
                        disabled={!compareIds.includes(row.id) && compareIds.length >= 3}
                        onChange={() => onToggleCompare(row.id)}
                      />
                    </td>
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
                          title={t('history.deleteEntry')}
                          aria-label={t('history.deleteEntry')}
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
              {t('history.deleteHistory')}
            </button>
          )}
          <button className="primary" disabled={compareIds.length < 2} onClick={onOpenCompare}>
            {t('compare.openButton', { n: compareIds.length })}
          </button>
          <button className="primary" disabled={selectedId == null} onClick={onOpenSelected}>
            {t('history.open')}
          </button>
        </div>
      </div>
    </div>
  );
}
