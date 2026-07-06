export function FormField({ label, type = 'text', value, onChange, min, step, disabled = false }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        min={min}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) : e.target.value)}
      />
    </div>
  );
}
