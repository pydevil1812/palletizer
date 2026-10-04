import { useRef, useState } from 'react';
import { PalletConfig } from '../domain/PalletConfig.js';
import { ConfigSerializer } from '../domain/ConfigSerializer.js';
import { EXAMPLE_CONFIG_JSON } from '../domain/ExampleConfig.js';

// Mirrors the hardcoded default input values from the original markup exactly
// (additional elements start disabled — only "Reset example" enables them).
const DEFAULT_STATE = {
  box: { name: 'Carton A', length: 400, width: 300, height: 250, weight: 8.5 },
  pallet: { name: 'EUR pallet (1200x800)', length: 1200, width: 800, deckHeight: 150, loadCapacity: 700 },
  maxStackHeight: 1800,
  orientationFlags: { allowRotateX: false, allowRotateY: false, allowRotateZ: true },
  additional: {
    enabled: false,
    useSpacers: false,
    spacerThicknessMm: 5,
    spacerWeightKg: 0.3,
    useCornerPosts: false,
    cornerPostWeightKg: 0,
    useFilm: false,
    filmWeightKg: 1.2,
  },
};

function mergePatch(prev, patch) {
  return {
    box: { ...prev.box, ...(patch.box || {}) },
    pallet: { ...prev.pallet, ...(patch.pallet || {}) },
    maxStackHeight: patch.maxStackHeight != null ? patch.maxStackHeight : prev.maxStackHeight,
    orientationFlags: { ...prev.orientationFlags, ...(patch.orientationFlags || {}) },
    additional: { ...prev.additional, ...(patch.additional || {}) },
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

  const loadExample = () => apply(ConfigSerializer.fromImportedJSON(EXAMPLE_CONFIG_JSON));
  const loadFromJSON = (json) => apply(ConfigSerializer.fromImportedJSON(json));

  const toPalletConfig = (source = stateRef.current) => new PalletConfig(source);

  return {
    state,
    setBoxField,
    setPalletField,
    setMaxStackHeight,
    setOrientationFlag,
    setAdditionalField,
    loadExample,
    loadFromJSON,
    toPalletConfig,
  };
}
