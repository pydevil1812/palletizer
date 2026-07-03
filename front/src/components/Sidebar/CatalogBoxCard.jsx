import { FormField } from '../common/FormField.jsx';
import { SelectField } from '../common/SelectField.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

/**
 * Template-mode replacement for BoxCard: dimensions come from the admin
 * catalog and are read-only; only the gross weight stays editable.
 */
export function CatalogBoxCard({ box, boxes, onSelect, onWeightChange }) {
  const { t } = useLang();
  // The form stores the display label as the box name, so match on it.
  const displayLabel = (b) => (b.sku ? `${b.sku} — ${b.name}` : b.name);
  const selected = boxes.find((b) => displayLabel(b) === box.name);

  const handleSelect = (id) => {
    const item = boxes.find((b) => String(b.id) === id);
    if (item) onSelect(item);
  };

  return (
    <div className="card">
      <h2>{t('box.title')}</h2>
      {boxes.length === 0 ? (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('catalog.emptyBoxes')}</p>
      ) : (
        <>
          <SelectField
            label={t('catalog.boxSelect')}
            value={selected ? String(selected.id) : ''}
            onChange={handleSelect}
            placeholder={t('catalog.boxPlaceholder')}
            options={boxes.map((b) => ({ value: String(b.id), label: displayLabel(b) }))}
          />
          <div className="grid3" style={{ marginTop: 8 }}>
            <FormField label={t('box.length')} type="number" value={box.length} onChange={() => {}} disabled />
            <FormField label={t('box.width')} type="number" value={box.width} onChange={() => {}} disabled />
            <FormField label={t('box.height')} type="number" value={box.height} onChange={() => {}} disabled />
          </div>
          <div style={{ marginTop: 8 }}>
            <FormField
              label={t('box.weight')}
              type="number"
              min={0}
              step={0.1}
              value={box.weight}
              onChange={onWeightChange}
            />
          </div>
        </>
      )}
    </div>
  );
}
