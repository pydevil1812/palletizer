import { useEffect, useRef } from 'react';
import { FormField } from '../common/FormField.jsx';
import { CheckboxField } from '../common/CheckboxField.jsx';

/**
 * `openSignal` increments whenever a config import (Load JSON / Reset example)
 * enables additional elements, mirroring the original app's behavior of
 * auto-expanding this <details> panel on import — manual checkbox toggles
 * never force it open or closed.
 */
export function AdditionalElementsCard({ additional, onChange, openSignal }) {
  const detailsRef = useRef(null);

  useEffect(() => {
    if (openSignal && detailsRef.current) detailsRef.current.open = true;
  }, [openSignal]);

  return (
    <details className="card" id="addCard" ref={detailsRef}>
      <summary>Additional elements (optional)</summary>
      <div style={{ marginTop: 10 }}>
        <CheckboxField
          checked={additional.enabled}
          onChange={(v) => onChange('enabled', v)}
          label="Enable additional elements"
          hint="spacers, corner posts, stretch film — placeholder feature, expandable later"
        />
        <CheckboxField
          checked={additional.useSpacers}
          onChange={(v) => onChange('useSpacers', v)}
          label="Spacer sheets between layers"
        />
        <div className="grid2">
          <FormField
            label="Spacer thickness (mm)"
            type="number"
            min={0}
            step={0.5}
            value={additional.spacerThicknessMm}
            onChange={(v) => onChange('spacerThicknessMm', v)}
          />
          <FormField
            label="Spacer weight (kg)"
            type="number"
            min={0}
            step={0.1}
            value={additional.spacerWeightKg}
            onChange={(v) => onChange('spacerWeightKg', v)}
          />
        </div>
        <CheckboxField
          checked={additional.useCornerPosts}
          onChange={(v) => onChange('useCornerPosts', v)}
          label="Corner posts"
          style={{ marginTop: 6 }}
        />
        <FormField
          label="Corner posts total weight (kg)"
          type="number"
          min={0}
          step={0.1}
          value={additional.cornerPostWeightKg}
          onChange={(v) => onChange('cornerPostWeightKg', v)}
        />
        <CheckboxField
          checked={additional.useFilm}
          onChange={(v) => onChange('useFilm', v)}
          label="Stretch film"
          style={{ marginTop: 6 }}
        />
        <FormField
          label="Film weight (kg)"
          type="number"
          min={0}
          step={0.1}
          value={additional.filmWeightKg}
          onChange={(v) => onChange('filmWeightKg', v)}
        />
      </div>
    </details>
  );
}
