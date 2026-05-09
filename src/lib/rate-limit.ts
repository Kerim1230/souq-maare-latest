const SUBMIT_COOLDOWN_MS = 3000;
let _lastSubmitTime = 0;

export function canSubmit(): boolean {
  if (typeof window === 'undefined') return false;
  const now = Date.now();
  if (now - _lastSubmitTime < SUBMIT_COOLDOWN_MS) return false;
  _lastSubmitTime = now;
  return true;
}

export function checkSubmitCooldown(): number {
  if (typeof window === 'undefined') return 0;
  const elapsed = Date.now() - _lastSubmitTime;
  return Math.max(0, SUBMIT_COOLDOWN_MS - elapsed);
}
