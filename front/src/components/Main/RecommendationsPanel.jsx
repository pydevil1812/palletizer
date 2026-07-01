import { useLang } from '../../i18n/LangContext.jsx';
import { formatRecommendation } from '../../i18n/messages.js';

export function RecommendationsPanel({ result }) {
  const { t } = useLang();
  const recs = result?.recommendations ?? null;

  return (
    <aside className="sidebar recspanel">
      <div className="card">
        <h2>{t('recommendations.title')}</h2>
        {recs === null && <p className="muted">{t('recommendations.runFirst')}</p>}
        {recs && recs.length === 0 && <p className="muted">{t('recommendations.noAdjustments')}</p>}
        {recs && recs.length > 0 && (
          <ul className="recs-ul">
            {recs.map((r, i) => (
              <li key={i}>{formatRecommendation(t, r)}</li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
