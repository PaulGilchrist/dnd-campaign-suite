// Canonical character-name normalization + on-disk filename recipe. MUST stay
// byte-identical with the server owner (server/utils/characterName.js — Vite
// cannot import from server/, so this is a documented mirror; equivalence is
// pinned for a nasty-name fixture list in server/utils/characterName.test.js).
// Create/edit/delete lanes, the SSE delete-mirror (App.jsx) and the healing
// target fetch all derive filenames through these helpers so they can never
// drift apart again (bug-character-delete-sanitizer-mismatch, 2026-10-28-P
// name-normalization backlog item). Kept in its own dependency-free module so
// consumer tests that wholesale-mock campaignService still get the real recipe.

/**
 * Normalize a display name the same way the server does at its boundary:
 * trim + collapse internal whitespace runs (" X " → "X", "A  B" → "A B").
 * @param {*} name - proposed display name (non-strings normalize to '')
 * @returns {string} normalized name
 */
export function normalizeCharacterName(name) {
    if (typeof name !== 'string') return '';
    return name.trim().replace(/\s+/g, ' ');
}

export function characterFileName(name) {
    return `${String(name).replace(/[^a-zA-Z0-9]/g, '_')}.json`;
}

export default characterFileName;
