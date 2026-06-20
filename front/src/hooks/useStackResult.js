import { useMemo, useState, useCallback } from 'react';
import { PalletConfig } from '../domain/PalletConfig.js';
import { PalletizerEngine } from '../domain/PalletizerEngine.js';
import { ConfigValidator } from '../domain/ConfigValidator.js';

/**
 * Validates a raw form-state object and, if valid, runs it through the
 * PalletizerEngine. On validation failure the previous result is left in
 * place (matching the original app, which leaves the last good layout on
 * screen behind an error banner rather than blanking it).
 */
export function useStackResult() {
  const engine = useMemo(() => new PalletizerEngine(), []);
  const validator = useMemo(() => new ConfigValidator(), []);
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);

  const compute = useCallback(
    (rawState) => {
      const config = new PalletConfig(rawState);
      const errs = validator.validate(config);
      if (errs.length) {
        setErrors(errs);
        return null;
      }
      setErrors([]);
      const res = engine.stackLayers(config);
      setResult(res);
      return res;
    },
    [engine, validator]
  );

  return { result, errors, compute };
}
