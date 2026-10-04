import { useLang } from '../../../i18n/LangContext.jsx';

export function SideView({ active, axis, onAxisChange, canvasRef }) {
  const { t } = useLang();
  return (
    <div className={`view2d${active ? ' active' : ''}`}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <label className="muted" style={{ fontSize: 12 }}>
          {t('views.elevation')}
        </label>
        <select value={axis} onChange={(e) => onAxisChange(e.target.value)}>
          <option value="length">{t('views.front')}</option>
          <option value="width">{t('views.side')}</option>
        </select>
      </div>
      <canvas ref={canvasRef} width="900" height="640"></canvas>
    </div>
  );
}
