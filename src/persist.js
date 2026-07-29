/**
 * Small localStorage helpers.
 *
 * Google's OAuth flow navigates the browser away and back, which wipes React
 * state — without persistence a member would land back on the splash screen
 * after signing in. Wrapped in try/catch because private-mode browsers throw
 * on localStorage access.
 */
export const readFlag = key => {
  try { return localStorage.getItem(key); } catch { return null; }
};

export const writeFlag = (key, value) => {
  try { localStorage.setItem(key, value); } catch { /* non-fatal */ }
};

export const readJSON = key => {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
};

export const writeJSON = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* non-fatal */ }
};
