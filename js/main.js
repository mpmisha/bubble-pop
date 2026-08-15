import './telemetry.js';
// Entry point: wires the DOM HUD/overlays to the canvas GameScene.
import { GameScene } from './game.js';
import { SettingsStore } from './storage.js';
import { resolveLang, applyLang, t, isValidLang } from './i18n.js';

// Apply the platform language (shared same-origin with the hub) before wiring UI.
applyLang(resolveLang());

const $ = (id) => document.getElementById(id);

const canvas = $('game');

const dom = {
  hudScore: $('hud-score'),
  hudBest: $('hud-best'),
  bestBadge: $('best-badge'),
  onPresentSettings: openSettings,
  onPresentGameOver: openGameOver,
};

const scene = new GameScene(canvas, dom);

// Gear button.
$('gear').addEventListener('click', () => {
  scene.sound.unlock();
  scene.sound.play('button');
  scene.presentSettings();
});

// ---- Settings overlay ----

const settingsOverlay = $('settings-overlay');
const settingsBest = $('settings-best');
const toggleSound = $('toggle-sound');
const toggleHaptics = $('toggle-haptics');
const toggleAim = $('toggle-aim');
const resetBtn = $('btn-reset-best');
let resetArmed = false;
let resetTimer = null;

function syncSettingsUi() {
  settingsBest.textContent = `${t('bestScore')}: ${scene.visibleBestScore}`;
  toggleSound.classList.toggle('on', SettingsStore.isSoundEnabled);
  toggleHaptics.classList.toggle('on', SettingsStore.areHapticsEnabled);
  toggleAim.classList.toggle('on', SettingsStore.showLongAimGuide);
  disarmReset();
}

function disarmReset() {
  resetArmed = false;
  if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
  resetBtn.textContent = t('resetBest');
}

function openSettings() {
  syncSettingsUi();
  settingsOverlay.hidden = false;
}

function closeSettings() {
  settingsOverlay.hidden = true;
  scene.dismissOverlay();
  disarmReset();
}

toggleSound.addEventListener('click', () => {
  SettingsStore.isSoundEnabled = !SettingsStore.isSoundEnabled;
  toggleSound.classList.toggle('on', SettingsStore.isSoundEnabled);
  scene.sound.play('button');
});

toggleHaptics.addEventListener('click', () => {
  SettingsStore.areHapticsEnabled = !SettingsStore.areHapticsEnabled;
  toggleHaptics.classList.toggle('on', SettingsStore.areHapticsEnabled);
  scene.haptics.pickUp();
});

toggleAim.addEventListener('click', () => {
  SettingsStore.showLongAimGuide = !SettingsStore.showLongAimGuide;
  toggleAim.classList.toggle('on', SettingsStore.showLongAimGuide);
  scene.sound.play('button');
});

$('btn-new-game').addEventListener('click', () => {
  scene.sound.play('button');
  closeSettings();
  scene.startNewGame();
});

// Reset requires a confirming second tap.
resetBtn.addEventListener('click', () => {
  scene.sound.play('button');
  if (!resetArmed) {
    resetArmed = true;
    resetBtn.textContent = t('tapConfirm');
    resetTimer = setTimeout(disarmReset, 3000);
    return;
  }
  disarmReset();
  scene.resetBestScore();
  settingsBest.textContent = `${t('bestScore')}: 0`;
});

$('btn-close').addEventListener('click', () => {
  scene.sound.play('button');
  closeSettings();
});

// ---- Back to hub ----
// The hub can pass ?hub=<url>; otherwise fall back to the known hub site.
const HUB_URL = (() => {
  const param = new URLSearchParams(location.search).get('hub');
  if (param) { try { return new URL(param, location.href).href; } catch { /* ignore */ } }
  return 'https://mpmisha.github.io/playground/';
})();
const hasHubParam = new URLSearchParams(location.search).has('hub');
const backHubBtn = $('btn-back-hub');
const embeddedInHub = window.self !== window.top;
backHubBtn.href = HUB_URL;
// Sound/Vibration are global now — controlled from the hub. When embedded, hide
// those rows and the redundant in-panel Back button (the hub's player bar does
// the going-back). The long-aim-guide toggle is specific to this game and stays.
if (embeddedInHub) {
  toggleSound.closest('.row').hidden = true;
  toggleHaptics.closest('.row').hidden = true;
  backHubBtn.hidden = true;
} else {
  // Only show Back-to-Games when launched from the hub.
  backHubBtn.hidden = !hasHubParam;
}
backHubBtn.addEventListener('click', (e) => {
  scene.sound.play('button');
  // When embedded in the hub's in-app player, ask the hub to close us instead
  // of navigating the iframe (which would nest the hub inside the game frame).
  if (embeddedInHub) {
    e.preventDefault();
    try {
      window.parent.postMessage({ type: 'playground:back' }, new URL(HUB_URL).origin);
    } catch {
      window.parent.postMessage({ type: 'playground:back' }, '*');
    }
  }
});

settingsOverlay.querySelector('[data-dismiss="settings"]').addEventListener('click', closeSettings);

// ---- Game over overlay ----

const gameoverOverlay = $('gameover-overlay');
let lastGameOver = null;

function openGameOver(data) {
  lastGameOver = data;
  const { score, bestScore, isNewBest } = data;
  $('go-emoji').textContent = isNewBest ? '🎉' : '🫧';
  $('go-title').textContent = isNewBest ? t('newBest') : t('noMoreRoom');
  $('go-caption').textContent = t('yourScore');
  $('go-score').textContent = String(score);
  $('go-best').textContent = `👑 ${t('best')}: ${bestScore}`;
  gameoverOverlay.hidden = false;
}

$('btn-play-again').addEventListener('click', () => {
  scene.sound.play('button');
  gameoverOverlay.hidden = true;
  scene.dismissOverlay();
  scene.startNewGame();
});

// ---- Localization of static DOM chrome ----
// Called on load and whenever the platform language changes live. Canvas text
// re-localizes automatically on the next animation frame via i18n's t().
function applyDomStrings() {
  $('settings-title').textContent = t('settings');
  $('settings-panel').setAttribute('aria-label', t('settingsAria'));
  $('label-sound').textContent = t('sound');
  $('label-haptics').textContent = t('vibration');
  $('label-aim').textContent = t('longAimGuide');
  $('btn-new-game').textContent = t('newGame');
  $('btn-back-hub').textContent = t('backToGames');
  $('btn-close').textContent = t('close');
  $('gear').setAttribute('aria-label', t('settingsAria'));
  $('gameover-panel').setAttribute('aria-label', t('roundOverAria'));
  // Reset button reflects its armed/disarmed state.
  resetBtn.textContent = resetArmed ? t('tapConfirm') : t('resetBest');
  // Best-score line inside settings (visible only while the panel is open).
  settingsBest.textContent = `${t('bestScore')}: ${scene.visibleBestScore}`;
  // Re-localize the round-over overlay if it is currently shown.
  if (!gameoverOverlay.hidden && lastGameOver) openGameOver(lastGameOver);
}

applyDomStrings();

// Live language updates from the hub (same-origin postMessage only).
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const d = e.data;
  if (d && d.type === 'playground:lang' && isValidLang(d.lang)) {
    applyLang(d.lang);
    applyDomStrings();
  }
});

// ---- Service worker (offline support + reliable auto-update) ----
// The SW caches the whole shell, so without an update path an old build can
// keep running. We check for updates, promote a freshly-installed worker to
// active, and reload once it takes control so users always get the new build.
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Skip the very first install (no prior controller) — nothing to refresh.
    if (!hadController || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then((reg) => {
      reg.update().catch(() => {});

      const promote = (worker) => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      };
      // A worker already waiting from a previous check.
      if (reg.waiting && navigator.serviceWorker.controller) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      reg.addEventListener('updatefound', () => promote(reg.installing));

      // Re-check for updates when the app returns to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch(() => {});
  });
}
