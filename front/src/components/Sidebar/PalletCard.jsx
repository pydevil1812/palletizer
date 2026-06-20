import { FormField } from '../common/FormField.jsx';

export function PalletCard({ pallet, onChange }) {
  return (
    <div className="card">
      <h2>Pallet</h2>
      <FormField label="Name" value={pallet.name} onChange={(v) => onChange('name', v)} />
      <div className="grid2" style={{ marginTop: 8 }}>
        <FormField label="Length (mm)" type="number" min={1} step={1} value={pallet.length} onChange={(v) => onChange('length', v)} />
        <FormField label="Width (mm)" type="number" min={1} step={1} value={pallet.width} onChange={(v) => onChange('width', v)} />
        <FormField label="Deck height (mm)" type="number" min={0} step={1} value={pallet.deckHeight} onChange={(v) => onChange('deckHeight', v)} />
        <FormField label="Load capacity (kg)" type="number" min={0} step={1} value={pallet.loadCapacity} onChange={(v) => onChange('loadCapacity', v)} />
      </div>
    </div>
  );
}
