import { useEffect, useRef, useState } from 'react';
import { SettingsPopover } from './SettingsPopover.jsx';
import { VariantPicker } from './VariantPicker.jsx';

export function Header({
  onLoad,
  onSave,
  onCompute,
  onExportPdf,
  onExportXlsx,
  onPrint,
  onOpenHistory,
  theme,
  onToggleTheme,
  variants,
  variantIndex,
  onSelectVariant,
  isComputing,
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onDocMouseDown = (e) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [settingsOpen]);

  return (
    <header className="app">
      <div className="settingsAnchor" ref={anchorRef}>
        <button
          className="ghost iconbtn"
          title="Settings"
          aria-label="Settings"
          onClick={() => setSettingsOpen((o) => !o)}
        >
          ⚙
        </button>
        {settingsOpen && (
          <SettingsPopover
            onLoad={(json) => {
              onLoad(json);
              setSettingsOpen(false);
            }}
            onSave={onSave}
            onExportPdf={onExportPdf}
            onExportXlsx={onExportXlsx}
            onPrint={onPrint}
            onOpenHistory={() => {
              setSettingsOpen(false);
              onOpenHistory();
            }}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
        )}
      </div>
      <h1>📦 Pallet Stacking Studio</h1>
      <span className="sub">box → pallet layout · rotatable 3D · exportable report</span>
      <span className="spacer"></span>
      <VariantPicker variants={variants} variantIndex={variantIndex} onSelect={onSelectVariant} />
      <button
        className="primary"
        title="Recalculate the stacking layout"
        onClick={onCompute}
        disabled={isComputing}
      >
        {isComputing ? '… Computing' : '▶ Compute'}
      </button>
    </header>
  );
}
