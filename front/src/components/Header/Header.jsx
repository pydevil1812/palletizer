import { useEffect, useRef, useState } from 'react';
import { SettingsPopover } from './SettingsPopover.jsx';
import { useLang } from '../../i18n/LangContext.jsx';

export function Header({
  onLoad,
  onSave,
  onCompute,
  onExportPdf,
  onExportXlsx,
  onPrint,
  onOpenHistory,
  theme,
  onToggleTheme,
  inputMode,
  onChangeInputMode,
  onSaveTemplate,
  isComputing,
  username,
  isAdmin,
  onLogout,
  onOpenAdmin,
}) {
  const { t } = useLang();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onDocMouseDown = (e) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [settingsOpen]);

  return (
    <header className="app">
      <div className="settingsAnchor" ref={anchorRef}>
        <button
          className="ghost iconbtn"
          title={t('header.settingsTitle')}
          aria-label={t('header.settingsTitle')}
          onClick={() => setSettingsOpen((o) => !o)}
        >
          ⚙
        </button>
        {settingsOpen && (
          <SettingsPopover
            onLoad={(json) => {
              onLoad(json);
              setSettingsOpen(false);
            }}
            onSave={onSave}
            onExportPdf={onExportPdf}
            onExportXlsx={onExportXlsx}
            onPrint={onPrint}
            onOpenHistory={() => {
              setSettingsOpen(false);
              onOpenHistory();
            }}
            theme={theme}
            onToggleTheme={onToggleTheme}
            inputMode={inputMode}
            onChangeInputMode={onChangeInputMode}
            isAdmin={isAdmin}
            onSaveTemplate={onSaveTemplate}
          />
        )}
      </div>
      <h1>📦 {t('header.title')}</h1>
      <span className="sub">{t('header.subtitle')}</span>
      <span className="spacer"></span>
      <div className="header-user">
        <span className="header-username muted">{username}</span>
        {isAdmin && (
          <button className="ghost" onClick={onOpenAdmin} title={t('header.adminTitle')}>
            {t('header.admin')}
          </button>
        )}
        <button className="ghost" onClick={onLogout} title={t('header.signOutTitle')}>
          {t('header.signOut')}
        </button>
      </div>
      <button
        className="primary"
        title={t('header.computeTitle')}
        onClick={onCompute}
        disabled={isComputing}
      >
        {isComputing ? t('header.computing') : t('header.compute')}
      </button>
    </header>
  );
}
