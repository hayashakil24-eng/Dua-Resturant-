import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from './en.json'
import ur from './ur.json'

// Lightweight built-in i18n (no external dependency). `t('a.b.c')` resolves a
// dot-path from the active language's dictionary, falling back to English and
// then to the key itself — so strings not yet translated (phased rollout) still
// render in English instead of breaking.
const DICTS = { en, ur }
const RTL_LANGS = new Set(['ur'])

const resolve = (dict, path) =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict)

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'en')
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr'

  // Reflect language + direction on <html> so CSS (RTL flip, Urdu font) and
  // logical Tailwind utilities (ps-/pe-/ms-/me-/start-/end-) apply globally.
  useEffect(() => {
    const el = document.documentElement
    el.setAttribute('lang', lang)
    el.setAttribute('dir', dir)
    localStorage.setItem('lang', lang)
  }, [lang, dir])

  // Persist synchronously (not just in the effect) so non-hook readers like the
  // number/date formatters in utils/format.js see the new language on the very
  // next render instead of a frame late.
  const persist = (l) => {
    try {
      localStorage.setItem('lang', l)
    } catch {
      /* ignore (private mode / SSR) */
    }
    return l
  }
  const setLang = useCallback((l) => setLangState(persist(l in DICTS ? l : 'en')), [])
  const toggleLang = useCallback(() => setLangState((l) => persist(l === 'ur' ? 'en' : 'ur')), [])

  const t = useCallback(
    (key, fallback) => resolve(DICTS[lang], key) ?? resolve(DICTS.en, key) ?? fallback ?? key,
    [lang],
  )

  const value = useMemo(() => ({ lang, dir, setLang, toggleLang, t }), [lang, dir, setLang, toggleLang, t])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used within LanguageProvider')
  return ctx
}

// Convenience hook for components that only need the translator.
export const useT = () => useLang().t
