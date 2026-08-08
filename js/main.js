// Entry point: wires the DOM HUD/overlays to the canvas GameScene.
import { GameScene } from './game.js';
import { SettingsStore } from './storage.js';

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
  settingsBest.textContent = `Best score: ${scene.visibleBestScore}`;
  toggleSound.classList.toggle('on', SettingsStore.isSoundEnabled);
  toggleHaptics.classList.toggle('on', SettingsStore.areHapticsEnabled);
  toggleAim.classList.toggle('on', SettingsStore.showLongAimGuide);
  disarmReset();
}

function disarmReset() {
  resetArmed = false;
  if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
  resetBtn.textContent = 'Reset Best Score';
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
    resetBtn.textContent = 'Tap again to confirm';
    resetTimer = setTimeout(disarmReset, 3000);
    return;
  }
  disarmReset();
  scene.resetBestScore();
  settingsBest.textContent = 'Best score: 0';
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
// Only show Back-to-Games when launched from the hub.
backHubBtn.hidden = !hasHubParam;
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

function openGameOver({ score, bestScore, isNewBest }) {
  $('go-emoji').textContent = isNewBest ? '🎉' : '🫧';
  $('go-title').textContent = isNewBest ? 'New Best!' : 'No More Room';
  $('go-score').textContent = String(score);
  $('go-best').textContent = `👑 Best: ${bestScore}`;
  gameoverOverlay.hidden = false;
}

$('btn-play-again').addEventListener('click', () => {
  scene.sound.play('button');
  gameoverOverlay.hidden = true;
  scene.dismissOverlay();
  scene.startNewGame();
});

// ---- Service worker (offline support) ----

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
