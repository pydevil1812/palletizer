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

export function StatsBar({ result }) {
  const { t } = useLang();
  if (!result) return <div className="stats" />;
  const perLayer = result.boxesPerLayer;

  return (
    <div className="stats">
      <Stat k={t('stats.boxesTotal')} value={fmt(result.totalBoxes)} />
      <Stat k={t('stats.layers')} value={fmt(result.layers.length)} />
      <div className="stat">
        <div className="k">{t('stats.boxesPerLayer')}</div>
        <div className="v">
          {perLayer.length ? (
            <>
              {perLayer[0]} <small>{perLayer.join('·')}</small>
            </>
          ) : (
            '0'
          )}
        </div>
      </div>
      <Stat k={t('stats.footprintFill')} value={fmt(result.footprintFill, 1)} unit="%" />
      <Stat k={t('stats.volumeFill')} value={fmt(result.volumeFill, 1)} unit="%" />
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
      <div className="stat">
        <div className="k">{t('stats.limiting')}</div>
        <div className="v">
          <span style={{ fontSize: 13 }}>{result.limitingLabel}</span>
        </div>
      </div>
    </div>
  );
}
