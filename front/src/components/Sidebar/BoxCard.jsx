import { FormField } from '../common/FormField.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

export function BoxCard({ box, onChange }) {
  const { t } = useLang();
  return (
    <div className="card">
      <h2>{t('box.title')}</h2>
      <FormField label={t('box.name')} value={box.name} onChange={(v) => onChange('name', v)} />
      <div className="grid3" style={{ marginTop: 8 }}>
        <FormField label={t('box.length')} type="number" min={1} step={1} value={box.length} onChange={(v) => onChange('length', v)} />
        <FormField label={t('box.width')} type="number" min={1} step={1} value={box.width} onChange={(v) => onChange('width', v)} />
        <FormField label={t('box.height')} type="number" min={1} step={1} value={box.height} onChange={(v) => onChange('height', v)} />
      </div>
      <div style={{ marginTop: 8 }}>
        <FormField label={t('box.weight')} type="number" min={0} step={0.1} value={box.weight} onChange={(v) => onChange('weight', v)} />
      </div>
    </div>
  );
}
