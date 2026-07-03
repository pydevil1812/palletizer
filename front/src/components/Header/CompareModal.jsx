import { useEffect } from 'react';
import { useCompare } from '../../hooks/useCompare.js';
import { useLang } from '../../i18n/LangContext.jsx';
import { ComparePanel } from './ComparePanel.jsx';
import { CompareTable } from './CompareTable.jsx';

export function CompareModal({ open, ids, historyRows, onClose, theme }) {
  const { t } = useLang();
  const compare = useCompare();
  const idsKey = ids.join(',');

  useEffect(() => {
    if (open && ids.length) compare.load(ids, historyRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idsKey]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box compare-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" title={t('compare.close')} aria-label={t('compare.close')} onClick={onClose}>
          ✕
        </button>
        <h2>{t('compare.title')}</h2>

        <div className="compare-grid">
          {compare.items.map((item) => (
            <ComparePanel key={item.id} item={item} theme={theme} />
          ))}
        </div>

        <CompareTable items={compare.items} />
      </div>
    </div>
  );
}
