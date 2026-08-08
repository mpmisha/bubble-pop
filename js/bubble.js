// Draws a glossy, beveled candy bubble — the spherical cousin of the block
// bevel language (dark rim body, raised face, top gloss, corner highlight).
import { css, adjustBrightness, lightened } from './color.js';

// Draw a bubble centered at (cx, cy) with radius r using the given rgba color.
function drawBubble(ctx, cx, cy, r, color, opts = {}) {
  const alpha = opts.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Soft contact shadow so bubbles read as raised spheres.
  if (opts.shadow !== false) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.22;
    ctx.fillStyle = 'rgba(10, 12, 30, 1)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.16, r * 0.94, r * 0.94, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Dark rim body (the bevel base).
  const rim = adjustBrightness(color, 0.62);
  ctx.fillStyle = css(rim);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Raised spherical face: radial gradient from a lit top-left to a deeper
  // bottom-right, giving the candy-sphere volume.
  const face = r * 0.9;
  const lightX = cx - r * 0.32;
  const lightY = cy - r * 0.36;
  const grad = ctx.createRadialGradient(
    lightX, lightY, r * 0.08,
    cx, cy, face,
  );
  grad.addColorStop(0, css(lightened(color, 0.42)));
  grad.addColorStop(0.5, css(color));
  grad.addColorStop(1, css(adjustBrightness(color, 0.78)));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, face, 0, Math.PI * 2);
  ctx.fill();

  // Top gloss crescent.
  ctx.save();
  ctx.globalAlpha = alpha * 0.5;
  const gloss = ctx.createLinearGradient(cx, cy - face, cx, cy);
  gloss.addColorStop(0, css(lightened(color, 0.7)));
  gloss.addColorStop(1, css({ ...lightened(color, 0.7), a: 0 }));
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.28, face * 0.7, face * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Bright corner highlight (the little candy sparkle dot).
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  ctx.fillStyle = css(lightened(color, 0.85));
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.34, cy - r * 0.4, r * 0.2, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// Draw a faint empty grid slot (used sparingly for the ceiling guide).
function drawEmptySlot(ctx, cx, cy, r) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export { drawBubble, drawEmptySlot };
