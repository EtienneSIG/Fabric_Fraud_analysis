import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

// The IdP child popup lands here; broadcast the raw auth response over a same-origin BroadcastChannel
// so the popup relay can relay it back to the embedded app frame (COOP-safe).
void broadcastResponseToMainFrame();