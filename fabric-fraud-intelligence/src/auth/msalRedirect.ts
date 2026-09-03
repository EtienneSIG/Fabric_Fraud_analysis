import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

// MSAL v5 delivers BOTH the plain popup and the relay-child response over a same-origin
// BroadcastChannel (waitForBridgeResponse / waitForPopupRelayResponse), so this redirect target must
// ALWAYS broadcast — gating it (e.g. by window.name) leaves the main frame waiting → 60s timeout → mock.
void broadcastResponseToMainFrame();