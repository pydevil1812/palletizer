const TABS = [
  { view: '3d', label: '3D' },
  { view: 'top', label: 'Top' },
  { view: 'side', label: 'Side' },
  { view: 'table', label: 'Table' },
];

export function Toolbar({ activeTab, onTabChange, onExportPdf, onExportXlsx, onPrint, libWarning }) {
  return (
    <>
      <div className="toolbar">
        <div className="tabs">
          {TABS.map((t) => (
            <button key={t.view} className={activeTab === t.view ? 'active' : ''} onClick={() => onTabChange(t.view)}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="spacer"></span>
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
      <div className="libwarn" style={{ display: libWarning ? 'block' : 'none' }}>
        {libWarning}
      </div>
    </>
  );
}
