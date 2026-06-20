import { FormField } from '../common/FormField.jsx';

export function LimitsCard({ maxStackHeight, onChange }) {
  return (
    <div className="card">
      <h2>Limits</h2>
      <FormField
        label="Max assembled height incl. deck (mm)"
        type="number"
        min={1}
        step={1}
        value={maxStackHeight}
        onChange={onChange}
      />
    </div>
  );
}
