// Result of an on-demand connectivity probe against a live backend service.
//   live        — backend reachable AND the real service answered
//   mock        — backend reachable but it fell back to deterministic mock (credential ineffective)
//   unreachable — network/error: no backend or the call failed
//   off         — feature not configured (mock mode / no backend URL)
export type ProbeState = 'live' | 'mock' | 'unreachable' | 'off';

/** Probe outcome plus a short technical detail (mode + latency, or the error message). */
export interface ProbeResult {
  state: ProbeState;
  detail?: string;
}
