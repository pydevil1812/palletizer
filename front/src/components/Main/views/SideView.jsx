export function SideView({ active, axis, onAxisChange, canvasRef }) {
  return (
    <div className={`view2d${active ? ' active' : ''}`}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <label className="muted" style={{ fontSize: 12 }}>
          Elevation:
        </label>
        <select value={axis} onChange={(e) => onAxisChange(e.target.value)}>
          <option value="length">Front (along length)</option>
          <option value="width">Side (along width)</option>
        </select>
      </div>
      <canvas ref={canvasRef} width="900" height="640"></canvas>
    </div>
  );
}
