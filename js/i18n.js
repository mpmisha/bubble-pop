// Bubble Pop i18n (Playground contract v1). Self-contained — games are their
// own repos, so this mirrors the hub's i18n but ships its own strings.
// Canonical store: localStorage 'lang' ∈ {'en','he'} (shared same-origin with
// the hub and every game). English is LTR + fallback; Hebrew is RTL.

export const LANGS = ['en', 'he'];

const STRINGS = {
  en: {
    settings: 'Settings',
    sound: 'Sound',
    vibration: 'Vibration',
    longAimGuide: 'Long aim guide',
    newGame: 'New Game',
    resetBest: 'Reset Best Score',
    tapConfirm: 'Tap again to confirm',
    backToGames: 'Back to Games',
    close: 'Close',
    bestScore: 'Best score',
    noMoreRoom: 'No More Room',
    newBest: 'New Best!',
    yourScore: 'Your score',
    best: 'Best',
    playAgain: 'Play Again',
    settingsAria: 'Settings',
    roundOverAria: 'Round over',
    cleared: 'You cleared it!',
    next: 'next',
  },
  he: {
    settings: 'הגדרות',
    sound: 'צליל',
    vibration: 'רטט',
    longAimGuide: 'קו כיוון ארוך',
    newGame: 'משחק חדש',
    resetBest: 'איפוס שיא',
    tapConfirm: 'הקישו שוב לאישור',
    backToGames: 'חזרה למשחקים',
    close: 'סגירה',
    bestScore: 'שיא',
    noMoreRoom: 'אין יותר מקום',
    newBest: 'שיא חדש!',
    yourScore: 'הניקוד שלכם',
    best: 'שיא',
    playAgain: 'שחקו שוב',
    settingsAria: 'הגדרות',
    roundOverAria: 'סוף סבב',
    cleared: 'ניקיתם הכול!',
    next: 'הבא',
  },
};

export function isValidLang(code) {
  return LANGS.includes(code);
}

function detectFromNavigator() {
  const list = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || ''];
  for (const raw of list) {
    const code = String(raw).toLowerCase();
    if (code.startsWith('he') || code.startsWith('iw')) return 'he';
  }
  return 'he';
}

// Resolution order: (1) URL ?lang= if valid → also persist; (2) stored 'lang';
// (3) auto-detect. Never let auto-detect overwrite an explicit stored choice.
export function resolveLang() {
  try {
    const param = new URLSearchParams(location.search).get('lang');
    if (param && isValidLang(param)) {
      try { localStorage.setItem('lang', param); } catch { /* ignore */ }
      return param;
    }
  } catch { /* ignore */ }

  try {
    const stored = localStorage.getItem('lang');
    if (stored && isValidLang(stored)) return stored;
  } catch { /* ignore */ }

  return detectFromNavigator();
}

let currentLang = 'en';

export function getLang() { return currentLang; }

// Canvas font family — Baloo 2 has no Hebrew glyphs, so Hebrew uses Fredoka.
export function fontFamily() {
  return currentLang === 'he' ? '"Fredoka", sans-serif' : '"Baloo 2", sans-serif';
}

export function t(key) {
  const dict = STRINGS[currentLang] || STRINGS.en;
  return dict[key] != null ? dict[key] : (STRINGS.en[key] != null ? STRINGS.en[key] : key);
}

// Apply the locale to the document chrome. `persist` writes an explicit choice.
export function applyLang(code, persist = false) {
  const lang = isValidLang(code) ? code : 'en';
  currentLang = lang;
  if (persist) {
    try { localStorage.setItem('lang', lang); } catch { /* ignore */ }
  }
  const el = document.documentElement;
  el.lang = lang;
  el.dir = lang === 'he' ? 'rtl' : 'ltr';
  return lang;
}
