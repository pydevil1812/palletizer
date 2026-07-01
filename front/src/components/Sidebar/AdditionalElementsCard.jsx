import { useEffect, useRef } from 'react';
import { FormField } from '../common/FormField.jsx';
import { CheckboxField } from '../common/CheckboxField.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

export function AdditionalElementsCard({ additional, onChange, openSignal }) {
  const { t } = useLang();
  const detailsRef = useRef(null);

  useEffect(() => {
    if (openSignal && detailsRef.current) detailsRef.current.open = true;
  }, [openSignal]);

  return (
    <details className="card" id="addCard" ref={detailsRef}>
      <summary>{t('additional.title')}</summary>
      <div style={{ marginTop: 10 }}>
        <CheckboxField
          checked={additional.enabled}
          onChange={(v) => onChange('enabled', v)}
          label={t('additional.enable')}
          hint={t('additional.enableHint')}
        />
        <CheckboxField
          checked={additional.useSpacers}
          onChange={(v) => onChange('useSpacers', v)}
          label={t('additional.useSpacers')}
        />
        <div className="grid2">
          <FormField
            label={t('additional.spacerThickness')}
            type="number"
            min={0}
            step={0.5}
            value={additional.spacerThicknessMm}
            onChange={(v) => onChange('spacerThicknessMm', v)}
          />
          <FormField
            label={t('additional.spacerWeight')}
            type="number"
            min={0}
            step={0.1}
            value={additional.spacerWeightKg}
            onChange={(v) => onChange('spacerWeightKg', v)}
          />
        </div>
        <CheckboxField
          checked={additional.useCornerPosts}
          onChange={(v) => onChange('useCornerPosts', v)}
          label={t('additional.useCornerPosts')}
          style={{ marginTop: 6 }}
        />
        <FormField
          label={t('additional.cornerPostWeight')}
          type="number"
          min={0}
          step={0.1}
          value={additional.cornerPostWeightKg}
          onChange={(v) => onChange('cornerPostWeightKg', v)}
        />
        <CheckboxField
          checked={additional.useFilm}
          onChange={(v) => onChange('useFilm', v)}
          label={t('additional.useFilm')}
          style={{ marginTop: 6 }}
        />
        <FormField
          label={t('additional.filmWeight')}
          type="number"
          min={0}
          step={0.1}
          value={additional.filmWeightKg}
          onChange={(v) => onChange('filmWeightKg', v)}
        />
      </div>
    </details>
  );
}
