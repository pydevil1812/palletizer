import { FormField } from '../common/FormField.jsx';

export function BoxCard({ box, onChange }) {
  return (
    <div className="card">
      <h2>Box (carton)</h2>
      <FormField label="Name" value={box.name} onChange={(v) => onChange('name', v)} />
      <div className="grid3" style={{ marginTop: 8 }}>
        <FormField label="Length L (mm)" type="number" min={1} step={1} value={box.length} onChange={(v) => onChange('length', v)} />
        <FormField label="Width W (mm)" type="number" min={1} step={1} value={box.width} onChange={(v) => onChange('width', v)} />
        <FormField label="Height H (mm)" type="number" min={1} step={1} value={box.height} onChange={(v) => onChange('height', v)} />
      </div>
      <div style={{ marginTop: 8 }}>
        <FormField label="Gross weight (kg)" type="number" min={0} step={0.1} value={box.weight} onChange={(v) => onChange('weight', v)} />
      </div>
    </div>
  );
}
