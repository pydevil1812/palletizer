export function CheckboxField({ checked, onChange, label, hint, style }) {
  return (
    <div className="check" style={style}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="lbl">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </div>
  );
}
