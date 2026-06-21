import { useEffect, useRef, useState } from 'react';
import { fmt } from '../../utils/format.js';

/**
 * "Options" button in the header, next to Compute. Opens a dropdown of the
 * arrangements VariantBuilder produced for the current config; picking one
 * re-renders every view/stat (they all derive from stack.result, which
 * tracks the selected variant).
 */
export function VariantPicker({ variants, variantIndex, onSelect }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  if (!variants || variants.length <= 1) return null;

  return (
    <div className="variant-fab-anchor" ref={anchorRef}>
      <button
        className="ghost"
        title="Choose a pallet arrangement"
        aria-label="Choose a pallet arrangement"
        onClick={() => setOpen((o) => !o)}
      >
        ▦ Options
      </button>
      {open && (
        <div className="variant-dropdown">
          <h3>
            Arrangement {variantIndex + 1}/{variants.length}
          </h3>
          {variants.map((v, i) => (
            <button
              key={v.name}
              className={`variant-card${i === variantIndex ? ' active' : ''}`}
              onClick={() => {
                onSelect(i);
                setOpen(false);
              }}
            >
              <div className="variant-card-name">{v.name}</div>
              <div className="variant-card-desc muted">{v.description}</div>
              <div className="variant-card-stats muted">
                {fmt(v.result.totalBoxes)} boxes · {fmt(v.result.layers.length)} layers · vol fill{' '}
                {fmt(v.result.volumeFill, 0)}% · {fmt(v.result.totalHeight, 0)} mm
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
