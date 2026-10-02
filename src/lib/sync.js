/**
 * Cloud sync module for personnel data.
 *
 * Uses a Netlify Function backed by Netlify Blobs so every device
 * that opens the same site URL sees the same personnel list.
 *
 * If the API is unreachable (local dev, network down) the caller
 * should fall back to localStorage — the module itself never throws.
 */

const API_PATH = '/api/personnel';
const DEFAULT_WORKSPACE = 'default';
const POLL_INTERVAL_MS = 30_000;

let cachedWorkspace = null;

/**
 * Read the workspace id from the URL hash, e.g. #workspace=my-id.
 * Falls back to the default workspace.
 */
export function getWorkspaceId() {
  if (cachedWorkspace) return cachedWorkspace;
  try {
    const hash = globalThis.location?.hash || '';
    const match = hash.match(/workspace=([^&/]+)/);
    cachedWorkspace = match ? decodeURIComponent(match[1]) : DEFAULT_WORKSPACE;
  } catch {
    cachedWorkspace = DEFAULT_WORKSPACE;
  }
  return cachedWorkspace;
}

export function setWorkspaceId(id) {
  cachedWorkspace = id || DEFAULT_WORKSPACE;
  try {
    const url = new URL(globalThis.location.href);
    url.hash = `workspace=${cachedWorkspace}`;
    globalThis.history.replaceState(null, '', url);
  } catch { /* ignore */ }
}

/**
 * Fetch personnel from the cloud API.
 * Returns the array on success, or `null` if the request failed.
 */
export async function fetchPersonnel() {
  try {
    const id = getWorkspaceId();
    const res = await fetch(`${API_PATH}?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * Push personnel to the cloud API.
 * Returns `true` on success, `false` on failure.
 */
export async function pushPersonnel(personnel) {
  try {
    const id = getWorkspaceId();
    const res = await fetch(`${API_PATH}?id=${encodeURIComponent(id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, data: personnel }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Start polling for remote changes.
 * Calls `onUpdate(data)` whenever the cloud data differs from `currentData`.
 * Returns a stop function.
 */
export function startPolling(getCurrentData, onUpdate) {
  let lastSignature = '';
  let timer = null;

  const poll = async () => {
    const cloud = await fetchPersonnel();
    if (!cloud) return;
    const signature = JSON.stringify(cloud);
    if (signature !== lastSignature) {
      lastSignature = signature;
      onUpdate(cloud);
    }
  };

  // Initial fetch to set the baseline signature.
  const init = async () => {
    const cloud = await fetchPersonnel();
    if (cloud) {
      lastSignature = JSON.stringify(cloud);
      onUpdate(cloud);
    }
  };
  init();

  // Poll periodically.
  timer = setInterval(poll, POLL_INTERVAL_MS);

  // Also poll when the user returns to the tab.
  const onFocus = () => poll();
  globalThis.addEventListener?.('focus', onFocus);

  return () => {
    if (timer) clearInterval(timer);
    globalThis.removeEventListener?.('focus', onFocus);
  };
}