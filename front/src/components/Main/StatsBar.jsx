import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fmt } from '../../utils/format.js';
import { useLang } from '../../i18n/LangContext.jsx';

function Stat({ k, value, unit }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">
        {value} {unit && <small>{unit}</small>}
      </div>
    </div>
  );
}

function BoxesTotalStat({ result, t }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const dropdownRef = useRef(null);
  const perLayer = result.boxesPerLayer;

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, minWidth: rect.width });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onDocMouseDown = (e) => {
      if (
        anchorRef.current &&
        !anchorRef.current.contains(e.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(e.target))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className="stat" ref={anchorRef}>
      <button
        type="button"
        className="stat-dropdown-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="k">
          {t('stats.boxesTotal')} <span className={`stat-caret${open ? ' open' : ''}`}>▾</span>
        </div>
        <div className="v">{fmt(result.totalBoxes)}</div>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            className="stat-dropdown"
            ref={dropdownRef}
            style={{ top: pos.top, left: pos.left, minWidth: pos.minWidth }}
          >
            <div className="stat-dropdown-row">
              <span className="k">{t('stats.layers')}</span>
              <span className="v">{fmt(result.layers.length)}</span>
            </div>
            <div className="stat-dropdown-row">
              <span className="k">{t('stats.boxesPerLayer')}</span>
              <span className="v">
                {perLayer.length ? (
                  <>
                    {perLayer[0]} <small>{perLayer.join('·')}</small>
                  </>
                ) : (
                  '0'
                )}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function StatsBar({ result }) {
  const { t } = useLang();
  if (!result) return <div className="stats" />;

  return (
    <div className="stats">
      <BoxesTotalStat result={result} t={t} />
      <Stat k={t('stats.totalHeight')} value={fmt(result.totalHeight)} unit="mm" />
      <div className="stat">
        <div className="k">{t('stats.grossWeight')}</div>
        <div className="v">
          {fmt(result.grossWeight, 1)} <small>kg</small>
          {result.accessoriesWeight > 0 && (
            <>
              {' '}
              <small>{t('stats.inclAccessories', { n: fmt(result.accessoriesWeight, 1) })}</small>
            </>
          )}
        </div>
      </div>
      <Stat k={t('stats.capacityUsed')} value={fmt(result.weightUtil, 0)} unit="%" />
      <Stat k={t('stats.footprintFill')} value={fmt(result.footprintFill, 1)} unit="%" />
      <Stat k={t('stats.volumeFill')} value={fmt(result.volumeFill, 1)} unit="%" />
      <div className="stat">
        <div className="k">{t('stats.limiting')}</div>
        <div className="v">
          <span style={{ fontSize: 13 }}>{t(`stats.limitingReasons.${result.limiting}`)}</span>
        </div>
      </div>
    </div>
  );
}
