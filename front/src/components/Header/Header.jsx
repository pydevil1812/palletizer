import { useEffect, useRef, useState } from 'react';
import { SettingsPopover } from './SettingsPopover.jsx';
import { useLang } from '../../i18n/LangContext.jsx';
import e2d from '../../styles/e2d.svg';

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onDocMouseDown = (e) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [settingsOpen]);

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const onDocMouseDown = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [userMenuOpen]);

  return (
    <header className="app">
      <div className="settingsAnchor" ref={anchorRef}>

        <button
          className="ghost iconbtn"
          title={t('header.settingsTitle')}
          aria-label={t('header.settingsTitle')}
          onClick={() => setSettingsOpen((o) => !o)}
        >
        <img src={e2d} alt="Описание изображения"/>

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
      {/* <h1>📦 </h1> */}
      <h1>{t('header.title')}</h1>
      <span className="sub">{t('header.subtitle')}</span>
      <span className="spacer"></span>
      <div className="header-user settingsAnchor" ref={userMenuRef}>
        <button
          className="ghost header-username-btn"
          onClick={() => setUserMenuOpen((o) => !o)}
          title={username}
        >
          <span className="header-username">{username}</span>
          <span className="header-username-caret">▾</span>
        </button>
        {userMenuOpen && (
          <div className="popover user-popover">
            {isAdmin && (
              <button
                className="ghost"
                onClick={() => {
                  setUserMenuOpen(false);
                  onOpenAdmin();
                }}
                title={t('header.adminTitle')}
              >
                {t('header.admin')}
              </button>
            )}
            <button
              className="ghost"
              onClick={() => {
                setUserMenuOpen(false);
                onLogout();
              }}
              title={t('header.signOutTitle')}
            >
              {t('header.signOut')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
