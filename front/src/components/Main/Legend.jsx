import { ColorService } from '../../services/ColorService.js';
import { fmt } from '../../utils/format.js';
import { useLang } from '../../i18n/LangContext.jsx';

export function Legend({ result }) {
  const { t } = useLang();
  const layers = result?.layers ?? [];
  if (!layers.length) {
    return (
      <div className="legend">
        <span className="muted">{t('legend.noLayers')}</span>
      </div>
    );
  }

  return (
    <div className="legend">
      {layers.map((l, i) => (
        <span className="sw" key={l.index}>
          <span className="box" style={{ background: ColorService.layerColor(i, layers.length) }}></span>
          L{i + 1} · {l.boxCount} · z={fmt(l.zStart)}–{fmt(l.zStart + l.dimZ)}mm
        </span>
      ))}
    </div>
  );
}
