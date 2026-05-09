/**
 * ⚠️ STUB FILE — Circuit Breaker
 *
 * Returns empty states. No external services to protect against.
 * Kept solely because the diagnostics endpoint (/api/diagnostics) imports from here.
 * If the diagnostics endpoint is removed, this file can be deleted.
 */

export interface CircuitState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureAt: number | null;
  nextRetryAt: number | null;
}

const states: Record<string, CircuitState> = {};

export function getAllCircuitStates(): Record<string, CircuitState> {
  return states;
}

export function getCircuitState(name: string): CircuitState {
  return states[name] ?? {
    state: 'closed',
    failures: 0,
    lastFailureAt: null,
    nextRetryAt: null,
  };
}
