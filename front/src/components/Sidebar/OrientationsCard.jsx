import { CheckboxField } from '../common/CheckboxField.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

export function OrientationsCard({ orientationFlags, onChange }) {
  const { t } = useLang();
  return (
    <div className="card">
      <h2>{t('orientations.title')}</h2>
      <CheckboxField
        checked={orientationFlags.allowRotateZ}
        onChange={(v) => onChange('allowRotateZ', v)}
        label={t('orientations.rotateZ')}
        hint={t('orientations.rotateZHint')}
      />
      <CheckboxField
        checked={orientationFlags.allowRotateX}
        onChange={(v) => onChange('allowRotateX', v)}
        label={t('orientations.rotateX')}
        hint={t('orientations.rotateXHint')}
      />
      <CheckboxField
        checked={orientationFlags.allowRotateY}
        onChange={(v) => onChange('allowRotateY', v)}
        label={t('orientations.rotateY')}
        hint={t('orientations.rotateYHint')}
      />
    </div>
  );
}
