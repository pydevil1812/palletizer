export function ThreeDView({ active, hostRef, autorotate, onToggleAutorotate, onResetView }) {
  return (
    <div className={`view${active ? ' active' : ''}`}>
      <div className="viewbar">
        <span className="hint">drag to rotate · scroll to zoom · right-drag to pan</span>
        <span className="spacer" style={{ flex: 1 }}></span>
        <button
          className="ghost"
          style={{ fontSize: 12, padding: '5px 8px', borderColor: autorotate ? '#36c08a' : '' }}
          onClick={onToggleAutorotate}
        >
          ⟳ Auto-rotate
        </button>
        <button className="ghost" style={{ fontSize: 12, padding: '5px 8px' }} onClick={onResetView}>
          Reset view
        </button>
      </div>
      <div id="view3d" ref={hostRef}></div>
    </div>
  );
}
