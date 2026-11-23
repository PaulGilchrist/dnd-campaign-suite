/**
 * The ONE client-side hostname read for GM-environment identity (mirrors the
 * server's req.hostname localhost gate, AGENTS "Map Lane Write Authority").
 * Previously duplicated inline in useCampaignManagement; hoisted here when the
 * Sound Owner lane needed the same predicate (code-simplicity: extract when a
 * check appears in multiple places).
 */
export function isLocalhostBrowser(hostname = window.location.hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    /^127\./.test(hostname)
  );
}
