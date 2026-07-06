import { BoxCard } from './BoxCard.jsx';
import { PalletCard } from './PalletCard.jsx';
import { CatalogBoxCard } from './CatalogBoxCard.jsx';
import { CatalogPalletCard } from './CatalogPalletCard.jsx';
import { TemplateCard } from './TemplateCard.jsx';
import { LimitsCard } from './LimitsCard.jsx';
import { OrientationsCard } from './OrientationsCard.jsx';
import { AdditionalElementsCard } from './AdditionalElementsCard.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

export function Sidebar({
  config,
  onResetExample,
  onCompute,
  additionalOpenSignal,
  inputMode,
  catalog,
  onApplyTemplate,
}) {
  const { t } = useLang();
  const { state, applyPatch, setBoxField, setPalletField, setMaxStackHeight, setOrientationFlag, setAdditionalField } = config;
  const templateMode = inputMode === 'template';

  const selectCatalogBox = (item) => {
    applyPatch({
      box: {
        name: item.sku ? `${item.sku} — ${item.name}` : item.name,
        length: item.length,
        width: item.width,
        height: item.height,
        weight: item.weight,
      },
    });
  };

  const selectCatalogPallet = (item) => {
    applyPatch({
      pallet: {
        name: item.name,
        length: item.length,
        width: item.width,
        deckHeight: item.deck_height,
        loadCapacity: item.load_capacity,
      },
    });
  };

  return (
    <aside className="sidebar">
      {templateMode && catalog.error && (
        <div className="banner err" style={{ display: 'block', marginBottom: 12 }}>
          {catalog.error}
        </div>
      )}
      {templateMode && <TemplateCard templates={catalog.templates} onApply={onApplyTemplate} />}
      {templateMode ? (
        <CatalogBoxCard
          box={state.box}
          boxes={catalog.boxes}
          onSelect={selectCatalogBox}
          onWeightChange={(v) => setBoxField('weight', v)}
        />
      ) : (
        <BoxCard box={state.box} onChange={setBoxField} />
      )}
      {templateMode ? (
        <CatalogPalletCard
          pallet={state.pallet}
          pallets={catalog.pallets}
          onSelect={selectCatalogPallet}
        />
      ) : (
        <PalletCard pallet={state.pallet} onChange={setPalletField} />
      )}
      <LimitsCard maxStackHeight={state.maxStackHeight} onChange={setMaxStackHeight} />
      <OrientationsCard orientationFlags={state.orientationFlags} onChange={setOrientationFlag} />
      <AdditionalElementsCard
        additional={state.additional}
        onChange={setAdditionalField}
        openSignal={additionalOpenSignal}
      />

      <div className="row-btns">
        {!templateMode && (
          <button className="ghost" onClick={onResetExample}>
            {t('sidebar.resetExample')}
          </button>
        )}
        <button className="primary" onClick={onCompute}>
          {t('sidebar.compute')}
        </button>
      </div>
    </aside>
  );
}
