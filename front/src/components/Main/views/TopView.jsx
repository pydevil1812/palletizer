import { fmt } from '../../../utils/format.js';

export function TopView({ active, result, layerIndex, onLayerIndexChange, canvasRef, info }) {
  const layers = result?.layers ?? [];

  return (
    <div className={`view2d${active ? ' active' : ''}`}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <label className="muted" style={{ fontSize: 12 }}>
          Layer:
        </label>
        <select value={layerIndex} onChange={(e) => onLayerIndexChange(parseInt(e.target.value, 10))}>
          {layers.map((l, i) => (
            <option key={l.index} value={i}>
              Layer {i + 1} ({l.boxCount} boxes)
            </option>
          ))}
        </select>
        <span className="muted" style={{ fontSize: 12 }}>
          {info ? `${info.boxCount} boxes · orientation ${info.orientation} · z = ${fmt(info.zStart)} mm` : ''}
        </span>
      </div>
      <canvas ref={canvasRef} width="900" height="640"></canvas>
    </div>
  );
}
