// Bubble Pop — a calm bubble shooter for small kids.
// Endless, relaxing popping: NO descending ceiling. Missed shots simply settle
// and stack; pop groups of 3+ to keep the board clear. If the stack ever grows
// down to the shooter it ends softly ("No more room"). Clearing the board is a
// gentle celebration that refills fresh rows.
import { Board, ROW_FACTOR } from './board.js';
import { drawBubble } from './bubble.js';
import { SkinCatalog } from './skins.js';
import { SoundPlayer, Haptics } from './audio.js';
import { SettingsStore, GameStateStore } from './storage.js';
import { t, fontFamily } from './i18n.js';

const COLS = 9;              // even rows have 9 cells, odd rows 8
const COLOR_COUNT = 6;       // limited palette so matching is easy for little kids
const INITIAL_ROWS = 5;
const SHOOT_SPEED = 1050;    // px/sec
const POP_MIN = 3;
const POINTS_POP = 10;
const POINTS_DROP = 20;

function nowSec() { return performance.now() / 1000; }

class GameScene {
  constructor(canvas, dom) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dom = dom;
    this.settings = SettingsStore;
    this.sound = new SoundPlayer(this.settings);
    this.haptics = new Haptics(this.settings);

    this.board = new Board(COLS);
    this.score = 0;
    this.bestScore = this.settings.bestScore;

    this.current = 0;   // color index in the shooter
    this.next = 0;      // upcoming color index
    this.moving = null; // {x,y,vx,vy,color} while a shot is in flight

    this.aimAngle = -Math.PI / 2; // straight up
    this.aiming = false;
    this.overlayUp = false;
    this.roundOver = false;

    this.particles = [];        // pop sparkles + falling bubbles
    this.toast = null;          // {text, until}
    this.geo = { originX: 0, originY: 0, d: 40, r: 20 };

    this._colors = this._buildColors();

    this._bindInput();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._resize(), 200));

    if (!this._restore()) this.startNewGame(false);

    this._last = nowSec();
    requestAnimationFrame((t) => this._frame(t));
  }

  _buildColors() {
    // Use the on-brand Candy palette (first COLOR_COUNT entries).
    const pal = SkinCatalog.blockPalettes[0].colors;
    return pal.slice(0, COLOR_COUNT).map((c) => ({ ...c }));
  }

  colorAt(i) {
    return this._colors[((i % COLOR_COUNT) + COLOR_COUNT) % COLOR_COUNT];
  }

  // ---- Layout ----------------------------------------------------------

  _readSafeInsets() {
    const probe = document.getElementById('safe-probe');
    if (!probe) return { top: 0, bottom: 0 };
    const cs = getComputedStyle(probe);
    return {
      top: parseFloat(cs.paddingTop) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
    };
  }

  _resize() {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.cssW = cssW;
    this.cssH = cssH;
    const safe = this._readSafeInsets();

    const side = 6;
    const boardWidth = cssW - side * 2;
    const d = boardWidth / COLS;
    const r = d / 2;
    const topInset = safe.top + 66; // clear the HUD
    this.geo = { originX: side, originY: topInset, d, r };

    this.shooterX = cssW / 2;
    this.shooterY = cssH - safe.bottom - r - 30;
    this.dangerY = this.shooterY - r * 2.6;

    this.leftBound = this.geo.originX + r;
    this.rightBound = cssW - side - r;
  }

  // ---- New game / restore ---------------------------------------------

  startNewGame(playSound = true) {
    this.board.clear();
    for (let row = 0; row < INITIAL_ROWS; row++) {
      this.board.ensureRow(row);
      const cols = this.board.colsInRow(row);
      for (let c = 0; c < cols; c++) {
        this.board.set(row, c, Math.floor(Math.random() * COLOR_COUNT));
      }
    }
    this.score = 0;
    this.moving = null;
    this.particles = [];
    this.roundOver = false;
    this.toast = null;
    this.current = this._pickShooterColor();
    this.next = this._pickShooterColor();
    if (playSound) this.sound.play('button');
    this._updateHud();
    this._save();
  }

  _restore() {
    const snap = GameStateStore.loadSnapshot();
    if (!snap || !snap.grid) return false;
    const b = Board.fromJSON({ cols: COLS, grid: snap.grid });
    if (!b) return false;
    this.board = b;
    this.score = snap.score || 0;
    this.current = snap.current ?? this._pickShooterColor();
    this.next = snap.next ?? this._pickShooterColor();
    this.roundOver = false;
    this._updateHud();
    return true;
  }

  _save() {
    GameStateStore.save({
      grid: this.board.grid,
      score: this.score,
      current: this.current,
      next: this.next,
    });
  }

  // Pick a color that still exists on the board so the game stays winnable.
  _pickShooterColor() {
    const present = [...this.board.presentColors()];
    if (present.length === 0) {
      return Math.floor(Math.random() * COLOR_COUNT);
    }
    return present[Math.floor(Math.random() * present.length)];
  }

  // ---- Input -----------------------------------------------------------

  _bindInput() {
    const c = this.canvas;
    const pos = (e) => {
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX, y: t.clientY };
    };
    const onDown = (e) => {
      if (this.overlayUp || this.roundOver || this.moving) return;
      e.preventDefault();
      this.sound.unlock();
      this.aiming = true;
      this._aimTo(pos(e));
    };
    const onMove = (e) => {
      if (!this.aiming) return;
      e.preventDefault();
      this._aimTo(pos(e));
    };
    const onUp = (e) => {
      if (!this.aiming) return;
      e.preventDefault();
      this.aiming = false;
      this._fire();
    };
    c.addEventListener('touchstart', onDown, { passive: false });
    c.addEventListener('touchmove', onMove, { passive: false });
    c.addEventListener('touchend', onUp, { passive: false });
    c.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  _aimTo(p) {
    let dx = p.x - this.shooterX;
    let dy = p.y - this.shooterY;
    if (dy > -8) dy = -8; // never aim downward — keep it pointing up
    let ang = Math.atan2(dy, dx);
    // Clamp to a friendly upward cone (~10deg from each wall).
    const minA = -Math.PI + 0.18;
    const maxA = -0.18;
    if (ang < minA) ang = minA;
    if (ang > maxA) ang = maxA;
    this.aimAngle = ang;
  }

  _fire() {
    if (this.moving || this.roundOver) return;
    this.moving = {
      x: this.shooterX,
      y: this.shooterY,
      vx: Math.cos(this.aimAngle) * SHOOT_SPEED,
      vy: Math.sin(this.aimAngle) * SHOOT_SPEED,
      color: this.current,
    };
    this.sound.play('pickUp');
    this.haptics.pickUp();
  }

  // ---- Overlays --------------------------------------------------------

  presentSettings() { this.overlayUp = true; this.dom.onPresentSettings(); }
  dismissOverlay() { this.overlayUp = false; }

  resetBestScore() {
    this.bestScore = 0;
    this.settings.bestScore = 0;
    this._updateHud();
  }

  get visibleBestScore() { return this.bestScore; }

  // ---- Simulation ------------------------------------------------------

  _frame(tMs) {
    const t = tMs / 1000;
    let dt = t - this._last;
    this._last = t;
    if (dt > 0.05) dt = 0.05; // clamp after tab switches

    if (this.moving) this._advanceShot(dt);
    this._updateParticles(dt);
    if (this.toast && t > this.toast.until) this.toast = null;

    this._render();
    requestAnimationFrame((tt) => this._frame(tt));
  }

  _advanceShot(dt) {
    const m = this.moving;
    const r = this.geo.r;
    // Sub-step to avoid tunneling through tightly packed bubbles.
    const dist = SHOOT_SPEED * dt;
    const steps = Math.max(1, Math.ceil(dist / (r * 0.4)));
    const sub = dt / steps;
    for (let i = 0; i < steps; i++) {
      m.x += m.vx * sub;
      m.y += m.vy * sub;
      // Wall bounce.
      if (m.x < this.leftBound) { m.x = this.leftBound; m.vx = Math.abs(m.vx); this.sound.play('button'); }
      else if (m.x > this.rightBound) { m.x = this.rightBound; m.vx = -Math.abs(m.vx); this.sound.play('button'); }
      // Ceiling.
      if (m.y - r <= this.geo.originY + r) {
        this._settle(m.x, this.geo.originY + r, m.color);
        return;
      }
      // Collision with a settled bubble.
      if (this._hitsBubble(m.x, m.y)) {
        this._settle(m.x, m.y, m.color);
        return;
      }
    }
  }

  _hitsBubble(x, y) {
    const { d } = this.geo;
    const thresh = d * 0.9;
    const b = this.board;
    for (let row = 0; row < b.grid.length; row++) {
      for (let col = 0; col < b.grid[row].length; col++) {
        if (b.get(row, col) === null) continue;
        const cc = b.cellCenter(row, col, this.geo);
        const dx = cc.x - x;
        const dy = cc.y - y;
        if (dx * dx + dy * dy < thresh * thresh) return true;
      }
    }
    return false;
  }

  _settle(x, y, color) {
    this.moving = null;
    const cell = this._snapCell(x, y);
    if (!cell) { // extremely unlikely; treat as soft miss
      this.current = this.next;
      this.next = this._pickShooterColor();
      return;
    }
    this.board.set(cell.row, cell.col, color);
    this.sound.play('place');
    this.haptics.place();

    // Pop same-color cluster of 3+.
    const cluster = this.board.colorCluster(cell.row, cell.col);
    let popped = 0;
    if (cluster.length >= POP_MIN) {
      for (const [r, c] of cluster) {
        const cc = this.board.cellCenter(r, c, this.geo);
        this._spawnPop(cc.x, cc.y, this.board.get(r, c));
        this.board.set(r, c, null);
      }
      popped = cluster.length;
      this.score += popped * POINTS_POP;
      this.sound.play(popped >= 5 ? 'clearCombo' : 'clearSingle');
      this.haptics.clearLines();
    }

    // Drop floaters no longer attached to the ceiling.
    if (popped > 0) {
      const floaters = this.board.floatingCells();
      for (const [r, c] of floaters) {
        const cc = this.board.cellCenter(r, c, this.geo);
        this._spawnFall(cc.x, cc.y, this.board.get(r, c));
        this.board.set(r, c, null);
      }
      if (floaters.length) {
        this.score += floaters.length * POINTS_DROP;
      }
    }

    // Advance shooter.
    this.current = this.next;
    this.next = this._pickShooterColor();

    this._updateHud();

    // Cleared the whole board → gentle celebration + refill.
    if (this.board.isEmpty()) {
      this._celebrateClear();
    } else if (this._reachedDanger()) {
      this._endRound();
    }
    this._save();
  }

  // Find the empty, attachable grid cell whose center is nearest (x,y).
  _snapCell(x, y) {
    const base = this.board.pixelToCell(x, y, this.geo);
    this.board.ensureRow(base.row + 1);
    let best = null;
    let bestDist = Infinity;
    for (let row = Math.max(0, base.row - 1); row <= base.row + 1; row++) {
      this.board.ensureRow(row);
      const cols = this.board.colsInRow(row);
      for (let col = 0; col < cols; col++) {
        if (this.board.get(row, col) !== null) continue;
        // Attachable if on the ceiling or adjacent to an existing bubble.
        const attach = row === 0 || this.board.neighbors(row, col)
          .some(([nr, nc]) => this.board.get(nr, nc) !== null);
        if (!attach) continue;
        const cc = this.board.cellCenter(row, col, this.geo);
        const dd = (cc.x - x) ** 2 + (cc.y - y) ** 2;
        if (dd < bestDist) { bestDist = dd; best = { row, col }; }
      }
    }
    if (best) return best;
    // Fallback: force the base cell.
    if (this.board.get(base.row, base.col) === null) return base;
    return null;
  }

  _reachedDanger() {
    const b = this.board;
    for (let row = 0; row < b.grid.length; row++) {
      for (let col = 0; col < b.grid[row].length; col++) {
        if (b.get(row, col) === null) continue;
        const cc = b.cellCenter(row, col, this.geo);
        if (cc.y + this.geo.r >= this.dangerY) return true;
      }
    }
    return false;
  }

  _celebrateClear() {
    this.sound.play('levelUp');
    this.haptics.clearLines();
    this.toast = { key: 'cleared', until: nowSec() + 1.6 };
    // Refill fresh rows so play continues, relaxed and endless.
    setTimeout(() => {
      if (this.roundOver) return;
      for (let row = 0; row < INITIAL_ROWS; row++) {
        this.board.ensureRow(row);
        const cols = this.board.colsInRow(row);
        for (let c = 0; c < cols; c++) {
          this.board.set(row, c, Math.floor(Math.random() * COLOR_COUNT));
        }
      }
      this.current = this._pickShooterColor();
      this.next = this._pickShooterColor();
      this._save();
    }, 900);
  }

  _endRound() {
    this.roundOver = true;
    this.sound.play('gameOver');
    this.haptics.gameOver();
    const isNewBest = this.score > this.bestScore;
    if (isNewBest) {
      this.bestScore = this.score;
      this.settings.bestScore = this.score;
    }
    GameStateStore.clear();
    this._updateHud();
    this.overlayUp = true;
    this.dom.onPresentGameOver({
      score: this.score,
      bestScore: this.bestScore,
      isNewBest,
    });
  }

  _updateHud() {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.settings.bestScore = this.score;
    }
    this.dom.hudScore.textContent = String(this.score);
    this.dom.hudBest.textContent = String(this.bestScore);
  }

  // ---- Particles -------------------------------------------------------

  _spawnPop(x, y, color) {
    this.particles.push({ kind: 'pop', x, y, color, t: 0, dur: 0.34, r: this.geo.r });
    const sparks = 5;
    for (let i = 0; i < sparks; i++) {
      const a = (Math.PI * 2 * i) / sparks + Math.random() * 0.4;
      const sp = 90 + Math.random() * 90;
      this.particles.push({
        kind: 'spark', x, y, color,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        t: 0, dur: 0.45, r: this.geo.r * 0.16,
      });
    }
  }

  _spawnFall(x, y, color) {
    this.particles.push({
      kind: 'fall', x, y, color,
      vx: (Math.random() - 0.5) * 60, vy: 40 + Math.random() * 40,
      t: 0, dur: 1.4, r: this.geo.r,
    });
  }

  _updateParticles(dt) {
    const g = 900;
    for (const p of this.particles) {
      p.t += dt;
      if (p.kind === 'spark') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += g * 0.5 * dt; }
      else if (p.kind === 'fall') { p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    }
    this.particles = this.particles.filter((p) => p.t < p.dur && p.y < this.cssH + 80);
  }

  // ---- Render ----------------------------------------------------------

  _render() {
    const ctx = this.ctx;
    const { cssW, cssH } = this;
    // Twilight background gradient.
    const bg = ctx.createLinearGradient(0, 0, 0, cssH);
    bg.addColorStop(0, 'rgb(92,120,219)');
    bg.addColorStop(1, 'rgb(56,66,153)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);

    // Faint ceiling bar so the "top" reads clearly.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(this.geo.originX, this.geo.originY - this.geo.r - 6, cssW - this.geo.originX * 2, 4);

    // Settled bubbles.
    const b = this.board;
    for (let row = 0; row < b.grid.length; row++) {
      for (let col = 0; col < b.grid[row].length; col++) {
        const ci = b.get(row, col);
        if (ci === null) continue;
        const cc = b.cellCenter(row, col, this.geo);
        drawBubble(ctx, cc.x, cc.y, this.geo.r * 0.98, this.colorAt(ci));
      }
    }

    // Falling + popping particles.
    this._renderParticles();

    // Aim guide.
    if (!this.moving && !this.overlayUp && !this.roundOver) this._renderAim();

    // Moving bubble.
    if (this.moving) {
      drawBubble(ctx, this.moving.x, this.moving.y, this.geo.r * 0.98, this.colorAt(this.moving.color));
    }

    // Shooter + next.
    this._renderShooter();

    // Toast.
    if (this.toast) this._renderToast();
  }

  _renderParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const k = 1 - p.t / p.dur;
      if (p.kind === 'pop') {
        const scale = 1 + (1 - k) * 0.5;
        drawBubble(ctx, p.x, p.y, this.geo.r * 0.98 * scale, this.colorAt(p.color), { alpha: Math.max(0, k), shadow: false });
      } else if (p.kind === 'spark') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, k);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'fall') {
        drawBubble(ctx, p.x, p.y, this.geo.r * 0.98, this.colorAt(p.color), { alpha: Math.max(0, Math.min(1, k * 1.6)), shadow: false });
      }
    }
  }

  _renderAim() {
    const ctx = this.ctx;
    const r = this.geo.r;
    const long = this.settings.showLongAimGuide;
    // Predict path with wall bounces.
    let x = this.shooterX;
    let y = this.shooterY;
    let vx = Math.cos(this.aimAngle);
    let vy = Math.sin(this.aimAngle);
    const maxLen = long ? this.cssH * 1.4 : r * 3.2;
    const stepLen = r * 0.5;
    let travelled = 0;
    let bounces = 0;
    const pts = [{ x, y }];
    while (travelled < maxLen && bounces <= 3) {
      x += vx * stepLen;
      y += vy * stepLen;
      travelled += stepLen;
      if (x < this.leftBound) { x = this.leftBound; vx = Math.abs(vx); bounces++; }
      else if (x > this.rightBound) { x = this.rightBound; vx = -Math.abs(vx); bounces++; }
      if (y - r <= this.geo.originY + r) { pts.push({ x, y }); break; }
      if (this._hitsBubble(x, y)) { pts.push({ x, y }); break; }
      pts.push({ x, y });
    }

    ctx.save();
    ctx.setLineDash([2, r * 0.5]);
    ctx.lineWidth = Math.max(3, r * 0.18);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();

    // Target ghost at the predicted landing.
    const end = pts[pts.length - 1];
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawBubble(ctx, end.x, end.y, r * 0.9, this.colorAt(this.current), { shadow: false, alpha: 0.45 });
    ctx.restore();
  }

  _renderShooter() {
    const ctx = this.ctx;
    const r = this.geo.r;
    // Next bubble to the side, smaller.
    const nx = this.shooterX + r * 3.1;
    const ny = this.shooterY + r * 0.2;
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawBubble(ctx, nx, ny, r * 0.62, this.colorAt(this.next), { shadow: false });
    ctx.restore();
    ctx.save();
    ctx.font = `600 ${Math.round(r * 0.5)}px ${fontFamily()}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(t('next'), nx, ny + r * 0.95);
    ctx.restore();

    // Current bubble in the shooter (hide while a shot is flying).
    if (!this.moving) {
      // A little base plate under the shooter.
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.ellipse(this.shooterX, this.shooterY + r * 0.9, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawBubble(ctx, this.shooterX, this.shooterY, r, this.colorAt(this.current));
    }
  }

  _renderToast() {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(this.geo.r * 0.95)}px ${fontFamily()}`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 8;
    ctx.fillText(`${t(this.toast.key)} 🎉`, this.cssW / 2, this.cssH * 0.42);
    ctx.restore();
  }
}

export { GameScene };
