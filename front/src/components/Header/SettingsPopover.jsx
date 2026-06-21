import { useRef } from 'react';

export function SettingsPopover({ onLoad, onSave, onExportPdf, onExportXlsx, onPrint, onOpenHistory, theme, onToggleTheme }) {
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
    <div className="popover settings-popover">
      <div className="popover-section">
        <h3>Configuration</h3>
        <button className="ghost" title="Load a saved JSON configuration" onClick={() => fileInputRef.current.click()}>
          ⤓ Load JSON
        </button>
        <button className="ghost" title="Save current inputs as JSON" onClick={onSave}>
          ⤒ Save JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      <div className="popover-section">
        <h3>Report</h3>
        <button className="ghost" onClick={onExportPdf}>
          ⎙ PDF
        </button>
        <button className="ghost" onClick={onExportXlsx}>
          ▦ Excel
        </button>
        <button className="ghost" onClick={onPrint}>
          🖶 Print
        </button>
      </div>

      <div className="popover-section">
        <h3>History</h3>
        <button className="ghost" onClick={onOpenHistory}>
          🕘 Query history
        </button>
      </div>

      <div className="popover-section">
        <h3>Appearance</h3>
        <button className="ghost" onClick={onToggleTheme}>
          {theme === 'dark' ? '☀ Light theme' : '🌙 Dark theme'}
        </button>
      </div>
    </div>
  );
}
