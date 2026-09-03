import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge';

// Only the popup-relay child (embedded iframe path) must broadcast its response over the
// BroadcastChannel. A plain popup (standalone tab) lets MSAL read the response from this window's URL
// directly — broadcasting would clear the URL and close the window before MSAL reads it → mock.
if (window.name === 'msalPopupRelayChild') {
  void broadcastResponseToMainFrame();
}