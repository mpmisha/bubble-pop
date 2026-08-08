// Player settings + best-score + saved-game persistence via localStorage.
// Self-contained for Bubble Pop (no cross-module dependency).

const KEYS = {
  sound: 'soundEnabled',
  haptics: 'hapticsEnabled',
  aimGuide: 'bp_aimGuide',
  best: 'bp_bestScore',
  savedGame: 'bp_savedGame',
};

function readBool(key, fallback) {
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  return v === 'true';
}

const SettingsStore = {
  get isSoundEnabled() {
    return readBool(KEYS.sound, true);
  },
  set isSoundEnabled(value) {
    localStorage.setItem(KEYS.sound, value ? 'true' : 'false');
  },
  get areHapticsEnabled() {
    return readBool(KEYS.haptics, true);
  },
  set areHapticsEnabled(value) {
    localStorage.setItem(KEYS.haptics, value ? 'true' : 'false');
  },
  // A long aim guide helps little kids; on by default.
  get showLongAimGuide() {
    return readBool(KEYS.aimGuide, true);
  },
  set showLongAimGuide(value) {
    localStorage.setItem(KEYS.aimGuide, value ? 'true' : 'false');
  },
  get bestScore() {
    const stored = parseInt(localStorage.getItem(KEYS.best) || '0', 10);
    return Number.isFinite(stored) ? stored : 0;
  },
  set bestScore(value) {
    localStorage.setItem(KEYS.best, String(Math.max(0, Math.floor(value))));
  },
};

const GameStateStore = {
  save(snapshot) {
    try {
      localStorage.setItem(KEYS.savedGame, JSON.stringify(snapshot));
    } catch (_) {
      // Storage may be unavailable/evicted; the game still plays fine.
    }
  },
  loadSnapshot() {
    const raw = localStorage.getItem(KEYS.savedGame);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  },
  clear() {
    localStorage.removeItem(KEYS.savedGame);
  },
};

export { SettingsStore, GameStateStore };
