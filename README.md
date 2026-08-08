# Bubble Pop 🫧

A calm, kid-friendly **bubble shooter** for the
[Playground](https://mpmisha.github.io/playground/) hub. Aim with your fingertip,
fire a bubble upward, and pop groups of **3 or more** matching colors. Bubbles that
lose their grip on the ceiling drift away. Relaxed, endless, and made for smaller kids.

**Play:** https://mpmisha.github.io/bubble-pop/

## Calm by design
- **No timers, no countdown, no scary game-over.** There is *no descending ceiling* —
  missed shots simply settle and stack at your own pace.
- Clear the whole board and it celebrates softly, then refills fresh bubbles.
- If the stack ever grows down to the shooter it ends gently — *"No more room 🫧 —
  Play Again"* — never a harsh loss.
- Big bubbles, forgiving aim with a long dotted guide, gentle mutable sound.
- Only 6 candy colors so matching is easy for little hands.

## Install (Add to Home Screen)
Open the play URL on a phone, then use your browser's **Share → Add to Home Screen**.
It installs as a standalone, offline app (portrait).

## Run locally
```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Regenerate the app icon
```bash
python3 tools/generate_icon.py   # writes icons/icon-1024/512/192/180.png
```

## Structure
- `index.html` / `styles.css` — shell + shared Playground UI kit
- `js/game.js` — the bubble-shooter engine (aim, fire, snap, pop, drop)
- `js/board.js` — offset-hex grid + cluster / ceiling-connectivity logic
- `js/bubble.js` — glossy candy-sphere rendering
- `js/skins.js` / `js/color.js` — on-brand Candy palette + color helpers
- `js/audio.js` — Web Audio sound + haptics (nothing loaded from disk)
- `js/storage.js` — settings, best score, saved game (localStorage)
- `service-worker.js` / `manifest.webmanifest` — installable + offline

Part of the Playground collection — one calm design system, no ads, no accounts,
no tracking, works offline.
