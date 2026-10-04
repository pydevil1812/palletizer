import { BoxCard } from './BoxCard.jsx';
import { PalletCard } from './PalletCard.jsx';
import { LimitsCard } from './LimitsCard.jsx';
import { OrientationsCard } from './OrientationsCard.jsx';
import { AdditionalElementsCard } from './AdditionalElementsCard.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

export function Sidebar({ config, onResetExample, onCompute, additionalOpenSignal }) {
  const { t } = useLang();
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
          {t('sidebar.resetExample')}
        </button>
        <button className="primary" onClick={onCompute}>
          {t('sidebar.compute')}
        </button>
      </div>
    </aside>
  );
}
