import { BoxCard } from './BoxCard.jsx';
import { PalletCard } from './PalletCard.jsx';
import { LimitsCard } from './LimitsCard.jsx';
import { OrientationsCard } from './OrientationsCard.jsx';
import { AdditionalElementsCard } from './AdditionalElementsCard.jsx';

export function Sidebar({ config, onResetExample, onCompute, additionalOpenSignal }) {
  const { state, setBoxField, setPalletField, setMaxStackHeight, setOrientationFlag, setAdditionalField } = config;

  return (
    <aside className="sidebar">
      <BoxCard box={state.box} onChange={setBoxField} />
      <PalletCard pallet={state.pallet} onChange={setPalletField} />
      <LimitsCard maxStackHeight={state.maxStackHeight} onChange={setMaxStackHeight} />
      <OrientationsCard orientationFlags={state.orientationFlags} onChange={setOrientationFlag} />
      <AdditionalElementsCard
        additional={state.additional}
        onChange={setAdditionalField}
        openSignal={additionalOpenSignal}
      />

      <div className="row-btns">
        <button className="ghost" onClick={onResetExample}>
          Reset example
        </button>
        <button className="primary" onClick={onCompute}>
          ▶ Compute
        </button>
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
        Engine: grid + leftover-strip heuristic (homogeneous boxes), layer stacking limited by max height and load
        capacity. Identical to the bundled Python CLI; JSON is interchangeable.
      </p>
    </aside>
  );
}
