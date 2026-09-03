// Blank MSAL popup redirect target. With a standard popup, MSAL reads the auth response from this
// popup's URL in the main window and closes it — this page must NOT run the redirect bridge (that
// spawned a second window and lost the response, falling back to mock).
export {};