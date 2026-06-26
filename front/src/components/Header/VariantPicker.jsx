import { useEffect, useRef, useState } from 'react';
import { fmt } from '../../utils/format.js';
import { useLang } from '../../i18n/LangContext.jsx';

export function VariantPicker({ variants, variantIndex, onSelect }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  if (!variants || variants.length <= 1) return null;

  return (
    <div className="variant-fab-anchor" ref={anchorRef}>
      <button
        className="ghost"
        title={t('variants.optionsTitle')}
        aria-label={t('variants.optionsTitle')}
        onClick={() => setOpen((o) => !o)}
      >
        {t('variants.options')}
      </button>
      {open && (
        <div className="variant-dropdown">
          <h3>
            {t('variants.arrangement', { current: variantIndex + 1, total: variants.length })}
          </h3>
          {variants.map((v, i) => (
            <button
              key={v.name}
              className={`variant-card${i === variantIndex ? ' active' : ''}`}
              onClick={() => {
                onSelect(i);
                setOpen(false);
              }}
            >
              <div className="variant-card-name">{v.name}</div>
              <div className="variant-card-desc muted">{v.description}</div>
              <div className="variant-card-stats muted">
                {t('variants.stats', {
                  boxes: fmt(v.result.totalBoxes),
                  layers: fmt(v.result.layers.length),
                  fill: fmt(v.result.volumeFill, 0),
                  height: fmt(v.result.totalHeight, 0),
                })}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
