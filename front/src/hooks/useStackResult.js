import { useMemo, useState, useCallback } from 'react';
import { PalletConfig } from '../domain/PalletConfig.js';
import { ConfigSerializer } from '../domain/ConfigSerializer.js';
import { ComputeApiService } from '../services/ComputeApiService.js';

/**
 * Sends a raw form-state object to the compute backend (palletizer_source's
 * Flask server — see ComputeApiService), which validates it and, if valid,
 * runs it through the Python packing engine to produce several named
 * arrangements. `result` always reflects the currently selected variant
 * (index 0, "Maximum boxes (auto)", right after a compute). On validation
 * failure or a network error the previous result/variants are left in place
 * (matching the original app, which leaves the last good layout on screen
 * behind an error banner rather than blanking it). No packing/fill/recommendation
 * math runs here — this hook only ships JSON out and stores JSON back.
 */
export function useStackResult() {
  const [variants, setVariants] = useState([]);
  const [variantIndex, setVariantIndex] = useState(0);
  const [errors, setErrors] = useState([]);
  const [isComputing, setIsComputing] = useState(false);

  const compute = useCallback(async (rawState) => {
    const exportJson = ConfigSerializer.toExportJSON(new PalletConfig(rawState));
    setIsComputing(true);
    try {
      const { variants: vs } = await ComputeApiService.compute(exportJson);
      setErrors([]);
      setVariants(vs);
      setVariantIndex(0);
      return vs;
    } catch (err) {
      setErrors(err.validationErrors ?? [err.message]);
      return null;
    } finally {
      setIsComputing(false);
    }
  }, []);

  const selectVariant = useCallback(
    (idx) => {
      if (idx >= 0 && idx < variants.length) setVariantIndex(idx);
    },
    [variants.length]
  );

  const result = useMemo(() => variants[variantIndex]?.result ?? null, [variants, variantIndex]);

  return { result, variants, variantIndex, errors, compute, selectVariant, isComputing };
}
