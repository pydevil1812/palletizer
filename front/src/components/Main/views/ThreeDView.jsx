import { useLang } from '../../../i18n/LangContext.jsx';

export function ThreeDView({ active, hostRef, autorotate, onToggleAutorotate, onResetView }) {
  const { t } = useLang();
  return (
    <div className={`view${active ? ' active' : ''}`}>
      <div className="viewbar">
        <span className="hint">{t('views.drag3d')}</span>
        <span className="spacer" style={{ flex: 1 }}></span>
        <button
          className="ghost"
          style={{ fontSize: 12, padding: '5px 8px', borderColor: autorotate ? '#36c08a' : '' }}
          onClick={onToggleAutorotate}
        >
          {t('views.autoRotate')}
        </button>
        <button className="ghost" style={{ fontSize: 12, padding: '5px 8px' }} onClick={onResetView}>
          {t('views.resetView')}
        </button>
      </div>
      <div id="view3d" ref={hostRef}></div>
    </div>
  );
}
