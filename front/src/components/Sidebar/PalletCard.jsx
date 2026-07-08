import { FormField } from '../common/FormField.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

export function PalletCard({ pallet, onChange, maxStackHeight, onMaxStackHeightChange }) {
  const { t } = useLang();
  return (
    <div className="card">
      <h2>{t('pallet.title')}</h2>
      <FormField label={t('pallet.name')} value={pallet.name} onChange={(v) => onChange('name', v)} />
      <div className="grid2" style={{ marginTop: 8 }}>
        <FormField label={t('pallet.length')} type="number" min={1} step={1} value={pallet.length} onChange={(v) => onChange('length', v)} />
        <FormField label={t('pallet.width')} type="number" min={1} step={1} value={pallet.width} onChange={(v) => onChange('width', v)} />
        <FormField label={t('pallet.deckHeight')} type="number" min={0} step={1} value={pallet.deckHeight} onChange={(v) => onChange('deckHeight', v)} />
        <FormField label={t('pallet.loadCapacity')} type="number" min={0} step={1} value={pallet.loadCapacity} onChange={(v) => onChange('loadCapacity', v)} />
      </div>
      <div style={{ marginTop: 8 }}>
        <FormField
          label={t('limits.maxHeight')}
          type="number"
          min={1}
          step={1}
          value={maxStackHeight}
          onChange={onMaxStackHeightChange}
        />
      </div>
    </div>
  );
}
