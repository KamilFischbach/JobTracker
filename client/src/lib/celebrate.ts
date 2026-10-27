import confetti from 'canvas-confetti';

const colors = ['#10b981', '#14b8a6', '#6366f1', '#a855f7', '#f59e0b'];

/** Confetti burst from both sides of the screen. Skipped if the user prefers reduced motion. */
export function celebrate() {
  const shared = {
    particleCount: 80,
    spread: 70,
    startVelocity: 55,
    colors,
    disableForReducedMotion: true,
  };
  void confetti({ ...shared, angle: 60, origin: { x: 0, y: 0.75 } });
  void confetti({ ...shared, angle: 120, origin: { x: 1, y: 0.75 } });
}
