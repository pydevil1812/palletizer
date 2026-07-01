import { createContext, useContext, useState } from 'react';
import { en } from './en.js';
import { ru } from './ru.js';

const translations = { en, ru };

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ru');

  const changeLang = (l) => {
    localStorage.setItem('lang', l);
    setLang(l);
  };

  const t = (key, vars = {}) => {
    const parts = key.split('.');
    let val = translations[lang];
    for (const part of parts) val = val?.[part];
    if (val === undefined) {
      let fallback = translations.en;
      for (const part of parts) fallback = fallback?.[part];
      val = fallback ?? key;
    }
    if (typeof val === 'string' && Object.keys(vars).length) {
      return val.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
    }
    return val ?? key;
  };

  return (
    <LangContext.Provider value={{ lang, setLang: changeLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
