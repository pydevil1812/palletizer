import { FormField } from '../common/FormField.jsx';
import { SelectField } from '../common/SelectField.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

/**
 * Template-mode replacement for PalletCard: the pallet type is picked from
 * the admin catalog, all parameters are read-only.
 */
export function CatalogPalletCard({ pallet, pallets, onSelect }) {
  const { t } = useLang();
  const selected = pallets.find((p) => p.name === pallet.name);

  const handleSelect = (id) => {
    const item = pallets.find((p) => String(p.id) === id);
    if (item) onSelect(item);
  };

  return (
    <div className="card">
      <h2>{t('pallet.title')}</h2>
      {pallets.length === 0 ? (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('catalog.emptyPallets')}</p>
      ) : (
        <>
          <SelectField
            label={t('catalog.palletSelect')}
            value={selected ? String(selected.id) : ''}
            onChange={handleSelect}
            placeholder={t('catalog.palletPlaceholder')}
            options={pallets.map((p) => ({ value: String(p.id), label: p.name }))}
          />
          <div className="grid2" style={{ marginTop: 8 }}>
            <FormField label={t('pallet.length')} type="number" value={pallet.length} onChange={() => {}} disabled />
            <FormField label={t('pallet.width')} type="number" value={pallet.width} onChange={() => {}} disabled />
            <FormField label={t('pallet.deckHeight')} type="number" value={pallet.deckHeight} onChange={() => {}} disabled />
            <FormField label={t('pallet.loadCapacity')} type="number" value={pallet.loadCapacity} onChange={() => {}} disabled />
          </div>
        </>
      )}
    </div>
  );
}
