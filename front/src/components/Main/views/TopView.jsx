import { fmt } from '../../../utils/format.js';
import { useLang } from '../../../i18n/LangContext.jsx';

export function TopView({ active, result, layerIndex, onLayerIndexChange, canvasRef, info }) {
  const { t } = useLang();
  const layers = result?.layers ?? [];

  return (
    <div className={`view2d${active ? ' active' : ''}`}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <label className="muted" style={{ fontSize: 12 }}>
          {t('views.layer')}
        </label>
        <select value={layerIndex} onChange={(e) => onLayerIndexChange(parseInt(e.target.value, 10))}>
          {layers.map((l, i) => (
            <option key={l.index} value={i}>
              {t('views.layerOption', { n: i + 1, count: l.boxCount })}
            </option>
          ))}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>
          {info
            ? t('views.layerInfo', {
                count: info.boxCount,
                orientation: info.orientation,
                z: fmt(info.zStart),
              })
            : ''}
        </span>
      </div>
      <canvas ref={canvasRef} width="900" height="640"></canvas>
    </div>
  );
}
