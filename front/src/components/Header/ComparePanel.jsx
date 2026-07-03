import { useCallback, useEffect, useState } from 'react';
import { useThreeScene } from '../../hooks/useThreeScene.js';
import { StatsBar } from '../Main/StatsBar.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

export function ComparePanel({ item, theme }) {
  const { t } = useLang();
  const [hostEl, setHostEl] = useState(null);
  const hostRef = useCallback((el) => setHostEl(el), []);
  const threeScene = useThreeScene(hostEl, theme);

  useEffect(() => {
    if (threeScene.ready && item.status === 'ok' && item.result) threeScene.build(item.result);
  }, [item.result, item.status, threeScene.ready, threeScene]);

  useEffect(() => {
    if (item.status !== 'ok') return undefined;
    const timer = setTimeout(() => threeScene.resize(), 30);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.status]);

  return (
    <div className="compare-panel">
      <div className="compare-panel-head">
        <span className="compare-panel-label">{item.label}</span>
        <span className="compare-panel-date">{item.createdAt}</span>
      </div>
      {item.status === 'loading' && <div className="compare-panel-loading">{t('compare.loading')}</div>}
      {item.status === 'error' && (
        <div className="banner err" style={{ display: 'block', margin: 12 }}>
          {t('compare.loadError', { detail: item.error })}
        </div>
      )}
      {item.status === 'ok' && (
        <>
          <div className="compare-panel-3d" ref={hostRef}></div>
          <StatsBar result={item.result} />
        </>
      )}
    </div>
  );
}
