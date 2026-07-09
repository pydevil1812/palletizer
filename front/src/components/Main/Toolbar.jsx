import { useLang } from '../../i18n/LangContext.jsx';

export function Toolbar({ activeTab, onTabChange, libWarning, onOpenHistory }) {
  const { t } = useLang();

  const TABS = [
    { view: '3d', label: t('toolbar.tab3d') },
    { view: 'top', label: t('toolbar.tabTop') },
    { view: 'side', label: t('toolbar.tabSide') },
    { view: 'table', label: t('toolbar.tabTable') },
  ];

  return (
    <>
      <div className="toolbar">
        <div className="tabs">
          {TABS.map((tab) => (
            <button key={tab.view} className={activeTab === tab.view ? 'active' : ''} onClick={() => onTabChange(tab.view)}>
              {tab.label}
            </button>
          ))}
        </div>
        <span className="spacer"></span>
        <div className="popover-section">
          <button className="ghost" onClick={onOpenHistory}>
            {t('settings.queryHistory')}
          </button>
        </div>
      </div>
      <div className="libwarn" style={{ display: libWarning ? 'block' : 'none' }}>
        {libWarning}
      </div>
    </>
  );
}
