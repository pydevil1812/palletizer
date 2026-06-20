import { fmt } from '../../utils/format.js';

function Stat({ k, value, unit }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">
        {value} {unit && <small>{unit}</small>}
      </div>
    </div>
  );
}

export function StatsBar({ result }) {
  if (!result) return <div className="stats" />;
  const perLayer = result.boxesPerLayer;

  return (
    <div className="stats">
      <Stat k="Boxes total" value={fmt(result.totalBoxes)} />
      <Stat k="Layers" value={fmt(result.layers.length)} />
      <div className="stat">
        <div className="k">Boxes / layer</div>
        <div className="v">
          {perLayer.length ? (
            <>
              {perLayer[0]} <small>{perLayer.join('·')}</small>
            </>
          ) : (
            '0'
          )}
        </div>
      </div>
      <Stat k="Footprint fill" value={fmt(result.footprintFill, 1)} unit="%" />
      <Stat k="Volume fill" value={fmt(result.volumeFill, 1)} unit="%" />
      <Stat k="Total height" value={fmt(result.totalHeight)} unit="mm" />
      <div className="stat">
        <div className="k">Gross weight</div>
        <div className="v">
          {fmt(result.grossWeight, 1)} <small>kg</small>
          {result.accessoriesWeight > 0 && (
            <>
              {' '}
              <small>incl. {fmt(result.accessoriesWeight, 1)} film/posts</small>
            </>
          )}
        </div>
      </div>
      <Stat k="Capacity used" value={fmt(result.weightUtil, 0)} unit="%" />
      <div className="stat">
        <div className="k">Limiting</div>
        <div className="v">
          <span style={{ fontSize: 13 }}>{result.limitingLabel}</span>
        </div>
      </div>
    </div>
  );
}
