import { FormField } from '../common/FormField.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

export function LimitsCard({ maxStackHeight, onChange }) {
  const { t } = useLang();
  return (
    <div className="card">
      <h2>{t('limits.title')}</h2>
      <FormField
        label={t('limits.maxHeight')}
        type="number"
        min={1}
        step={1}
        value={maxStackHeight}
        onChange={onChange}
      />
    </div>
  );
}
