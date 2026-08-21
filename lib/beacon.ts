// Fire-and-forget POST that survives navigation and tab close. Prefers
// navigator.sendBeacon (the browser flushes it even while the page unloads)
// and falls back to fetch with `keepalive` where sendBeacon is unavailable.
// Used for chat lifecycle pings — ending a random match, leaving a room — that
// must reach the server on unmount/unload.
export function postBeacon(url: string, body: unknown) {
  const payload = JSON.stringify(body);
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(
      url,
      new Blob([payload], { type: 'application/json' }),
    );
    return;
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  });
}
