import { useRef, useState } from 'react';
import { PalletConfig } from '../domain/PalletConfig.js';
import { ConfigSerializer } from '../domain/ConfigSerializer.js';
import { EXAMPLE_CONFIG_JSON } from '../domain/ExampleConfig.js';

// Derived from EXAMPLE_CONFIG_JSON so it stays a single source of truth —
// editing that file changes both the initial form state and "Reset example".
const DEFAULT_STATE = ConfigSerializer.fromImportedJSON(EXAMPLE_CONFIG_JSON);

function mergePatch(prev, patch) {
  return {
    box: { ...prev.box, ...(patch.box || {}) },
    pallet: { ...prev.pallet, ...(patch.pallet || {}) },
    maxStackHeight: patch.maxStackHeight != null ? patch.maxStackHeight : prev.maxStackHeight,
    orientationFlags: { ...prev.orientationFlags, ...(patch.orientationFlags || {}) },
    additional: { ...prev.additional, ...(patch.additional || {}) },
    packingMode: patch.packingMode != null ? patch.packingMode : prev.packingMode,
  };
}

/**
 * Owns the sidebar form state and exposes field setters plus import/export
 * helpers. Keeps a ref mirror of state so callers (e.g. "load JSON, then
 * immediately compute with the new values") can get the merged result
 * synchronously instead of waiting for a re-render.
 */
export function usePalletConfig() {
  const [state, setState] = useState(DEFAULT_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const apply = (patch) => {
    const next = mergePatch(stateRef.current, patch);
    stateRef.current = next;
    setState(next);
    return next;
  };

  const setBoxField = (field, value) => apply({ box: { [field]: value } });
  const setPalletField = (field, value) => apply({ pallet: { [field]: value } });
  const setMaxStackHeight = (value) => apply({ maxStackHeight: value });
  const setOrientationFlag = (field, value) => apply({ orientationFlags: { [field]: value } });
  const setAdditionalField = (field, value) => apply({ additional: { [field]: value } });
  const setPackingMode = (value) => apply({ packingMode: value });

  const loadExample = () => apply(ConfigSerializer.fromImportedJSON(EXAMPLE_CONFIG_JSON));
  const loadFromJSON = (json) => apply(ConfigSerializer.fromImportedJSON(json));

  const toPalletConfig = (source = stateRef.current) => new PalletConfig(source);

  return {
    state,
    applyPatch: apply,
    setBoxField,
    setPalletField,
    setMaxStackHeight,
    setOrientationFlag,
    setAdditionalField,
    setPackingMode,
    loadExample,
    loadFromJSON,
    toPalletConfig,
  };
}
