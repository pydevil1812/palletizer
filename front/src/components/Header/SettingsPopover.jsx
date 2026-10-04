import { useRef } from 'react';
import { useLang } from '../../i18n/LangContext.jsx';

export function SettingsPopover({ onLoad, onSave, onExportPdf, onExportXlsx, onPrint, onOpenHistory, theme, onToggleTheme }) {
  const { t, lang, setLang } = useLang();
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onLoad(JSON.parse(reader.result));
      } catch (err) {
        alert(t('settings.couldNotReadJson') + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeLangStyle = { fontWeight: 700, borderColor: 'var(--green, #36c08a)' };

  return (
    <div className="popover settings-popover">
      <div className="popover-section">
        <h3>{t('settings.configuration')}</h3>
        <button className="ghost" title={t('settings.loadJsonTitle')} onClick={() => fileInputRef.current.click()}>
          {t('settings.loadJson')}
        </button>
        <button className="ghost" title={t('settings.saveJsonTitle')} onClick={onSave}>
          {t('settings.saveJson')}
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
        <h3>{t('settings.report')}</h3>
        <button className="ghost" onClick={onExportPdf} title={t('settings.exportPdf')}>⎙ PDF</button>
        <button className="ghost" onClick={onExportXlsx} title={t('settings.exportXlsx')}>▦ Excel</button>
        <button className="ghost" onClick={onPrint} title={t('settings.print')}>🖶 {t('settings.print')}</button>
      </div>

      <div className="popover-section">
        <h3>{t('settings.history')}</h3>
        <button className="ghost" onClick={onOpenHistory}>
          {t('settings.queryHistory')}
        </button>
      </div>

      <div className="popover-section">
        <h3>{t('settings.appearance')}</h3>
        <button className="ghost" onClick={onToggleTheme}>
          {theme === 'dark' ? t('settings.lightTheme') : t('settings.darkTheme')}
        </button>
      </div>

      <div className="popover-section">
        <h3>{t('settings.language')}</h3>
        <button
          className="ghost"
          onClick={() => setLang('ru')}
          style={lang === 'ru' ? activeLangStyle : {}}
        >
          Русский
        </button>
        <button
          className="ghost"
          onClick={() => setLang('en')}
          style={lang === 'en' ? activeLangStyle : {}}
        >
          English
        </button>
      </div>
    </div>
  );
}
