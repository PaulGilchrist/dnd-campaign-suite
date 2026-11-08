// Client-side GM-authority check — the mirror of the server's refuseUnlessGm
// hostname law (campaigns-character.js / maps.js: localhost is the GM machine,
// LAN clients get a read-only view per AGENTS.md). Same derivation as
// useCampaignManagement.js:9 and the inline CharSheet/CharSummary checks; this
// shared module exists because non-React service/handler lanes cannot import
// the hook. Fail-closed: any non-localhost hostname (or no window) is a
// visitor and must never write GM-authority keys.
export function isGmHost() {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || /^127\./.test(host);
}
