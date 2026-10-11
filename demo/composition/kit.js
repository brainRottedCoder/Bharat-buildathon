/** Three easings only. Everything else composes from these. */
export function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

export function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

export function easeOutBack(t) {
  const c = 1.70158;
  const x = t - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

/** Snap onto the frame. Opacity is binary — never a fade. */
export function stamp(local, start, dur = 0.18) {
  const u = clamp01((local - start) / dur);
  if (u <= 0) return { opacity: 0, transform: 'translateY(28px) scale(0.72)', pointerEvents: 'none' };
  const s = 1.16 - 0.16 * easeOutBack(u);
  const y = (1 - easeOutExpo(u)) * 22;
  return { opacity: 1, transform: `translateY(${y}px) scale(${s})` };
}

export function slide(local, start, dur = 0.28, from = 48) {
  const u = clamp01((local - start) / dur);
  if (u <= 0) return { opacity: 0, transform: `translateX(${from}px)` };
  return { opacity: 1, transform: `translateX(${(1 - easeOutExpo(u)) * from}px)` };
}

export function squash(local, at, dur = 0.16) {
  const u = clamp01((local - at) / dur);
  if (u <= 0 || u >= 1) return { transform: 'scale(1)' };
  const s = u < 0.45 ? 1 - 0.08 * (u / 0.45) : 0.92 + 0.08 * easeOutBack((u - 0.45) / 0.55);
  return { transform: `scale(${s})` };
}
