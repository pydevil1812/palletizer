import { useRef } from 'react';

export function Header({ onLoad, onSave, onCompute }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onLoad(JSON.parse(reader.result));
      } catch (err) {
        alert('Could not read JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="app">
      <h1>📦 Pallet Stacking Studio</h1>
      <span className="sub">box → pallet layout · rotatable 3D · exportable report</span>
      <span className="spacer"></span>
      <button className="ghost" title="Load a saved JSON configuration" onClick={() => fileInputRef.current.click()}>
        ⤓ Load JSON
      </button>
      <button className="ghost" title="Save current inputs as JSON (compatible with the Python CLI)" onClick={onSave}>
        ⤒ Save JSON
      </button>
      <button className="primary" title="Recalculate the stacking layout" onClick={onCompute}>
        ▶ Compute
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </header>
  );
}
