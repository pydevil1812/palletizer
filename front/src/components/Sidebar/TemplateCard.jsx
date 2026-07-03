import { useState } from 'react';
import { SelectField } from '../common/SelectField.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

/**
 * Library of saved pallet configuration templates: pick one and apply it to
 * the whole form (box, pallet, limits, orientations, additional elements).
 */
export function TemplateCard({ templates, onApply }) {
  const { t } = useLang();
  const [selectedId, setSelectedId] = useState('');

  return (
    <div className="card">
      <h2>{t('catalog.templatesTitle')}</h2>
      {templates.length === 0 ? (
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('catalog.emptyTemplates')}</p>
      ) : (
        <>
          <SelectField
            label={t('catalog.templateSelect')}
            value={selectedId}
            onChange={setSelectedId}
            placeholder={t('catalog.templatePlaceholder')}
            options={templates.map((tp) => ({ value: String(tp.id), label: tp.name }))}
          />
          <button
            className="ghost"
            style={{ marginTop: 8, width: '100%' }}
            disabled={!selectedId}
            onClick={() => onApply(Number(selectedId))}
          >
            {t('catalog.applyTemplate')}
          </button>
        </>
      )}
    </div>
  );
}
