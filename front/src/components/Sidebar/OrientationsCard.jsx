import { CheckboxField } from '../common/CheckboxField.jsx';

export function OrientationsCard({ orientationFlags, onChange }) {
  return (
    <div className="card">
      <h2>Acceptable box orientations</h2>
      <CheckboxField
        checked={orientationFlags.allowRotateZ}
        onChange={(v) => onChange('allowRotateZ', v)}
        label="Rotate footprint 90° (Z axis)"
        hint="swap L↔W, box stays upright — almost always allowed"
      />
      <CheckboxField
        checked={orientationFlags.allowRotateX}
        onChange={(v) => onChange('allowRotateX', v)}
        label="Tip onto side face (X axis)"
        hint="swap W↔H"
      />
      <CheckboxField
        checked={orientationFlags.allowRotateY}
        onChange={(v) => onChange('allowRotateY', v)}
        label="Tip onto end face (Y axis)"
        hint="swap L↔H"
      />
    </div>
  );
}
