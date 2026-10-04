import { useLang } from '../../i18n/LangContext.jsx';

export function RecommendationsBar({ count, active, onClick }) {
  const { t } = useLang();
  return (
    <button type="button" className={`recsbar${active ? ' active' : ''}`} onClick={onClick}>
      {active ? (
        t('recommendations.backToParams')
      ) : (
        <>
          {t('recommendations.toggle')}
          {count > 0 && <span className="reccount">{count}</span>}
        </>
      )}
    </button>
  );
}
