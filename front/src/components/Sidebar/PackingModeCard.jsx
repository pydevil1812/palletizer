import { useLang } from '../../i18n/LangContext.jsx';

const MODES = ['standard', 'spiral'];

export function PackingModeCard({ packingMode, onChange }) {
  const { t } = useLang();
  return (
    <div className="card">
      <h2>{t('packingMode.title')}</h2>
      {MODES.map((mode) => (
        <div className="check" key={mode}>
          <input
            type="radio"
            name="packing-mode"
            checked={packingMode === mode}
            onChange={() => onChange(mode)}
          />
          <span className="lbl">
            {t(`packingMode.${mode}`)}
            <small>{t(`packingMode.${mode}Hint`)}</small>
          </span>
        </div>
      ))}
    </div>
  );
}
