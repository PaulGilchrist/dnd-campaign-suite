/**
 * Server-owned character-name handling, shared by the create (POST) and
 * rename/save (PUT) lanes of campaigns-character.js. One display-name
 * normalization + one filename recipe, so the two lanes can never drift
 * (bug-character-delete-sanitizer-mismatch class, 2026-10-28-P backlog).
 *
 * The client mirror lives in src/services/campaign/characterFileName.js
 * (Vite cannot import from server/, so it is a documented byte-identical
 * copy); server/utils/characterName.test.js pins their equivalence for a
 * fixture list of nasty names.
 */

/**
 * Normalize a display name at the server boundary: trim the edges and
 * collapse internal whitespace runs to a single space, so " X " stores as
 * "X" and "A  B" collapses to "A B" — the exact string a clean spelling
 * produces, which makes the duplicate-name guard collide (400) instead of
 * creating edge-underscore files like "X_.json".
 * @param {*} name - proposed display name (any type; non-strings normalize to '')
 * @returns {string} normalized name, '' when absent/blank (caller 400s)
 */
export function normalizeCharacterName(name) {
    if (typeof name !== 'string') return '';
    return name.trim().replace(/\s+/g, ' ');
}

/**
 * Canonical character-name → on-disk filename recipe: case preserved, every
 * non-alphanumeric character becomes '_'. Applied to the NORMALIZED name by
 * both route lanes.
 * @param {string} name - normalized display name
 * @returns {string} filename, e.g. 'QA_Trim_Probe.json'
 */
export function characterFileName(name) {
    return `${String(name).replace(/[^a-zA-Z0-9]/g, '_')}.json`;
}
