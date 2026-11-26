/**
 * Token cosmetics (learnability backlog Item 5) — the ONE canonical home for
 * per-token personalization: ring colour + label visibility per creature.
 *
 * FIELD HOME DECISION (lane trace, 2026-11-25):
 * Indoor token DRAGS persist through the map-document lane (usePlayerDragging
 * → useMapLoader.flushSave → PUT /api/campaigns/:c/maps/:slug) — a lane that
 * is GM-ONLY on both ends (flushSave early-returns for non-localhost
 * clients, server maps.js refuseUnlessGm). The `/positioning` change-data
 * route has no client consumers at all. The ONLY shared lane a visitor tab
 * can genuinely WRITE is the per-character runtime bucket
 * (POST /api/campaigns/:campaign/:characterName — "players write their own
 * character keys" per the Server-First Pattern), broadcast on the existing
 * `change-<campaign>-<charName>` SSE channel and adopted tab-wide by
 * App.jsx applyStoreUpdate. Cosmetics therefore ride the CHARACTER BUCKET as
 * key `tokenCosmetics` — the same lane `activeConditions` already lives on,
 * joinable from both surfaces by creature NAME (indoor players[].name, hex
 * marchingOrder names). Hex docs carry no per-character token rows at all,
 * so the map doc could never be ONE home for both surfaces anyway.
 * Consequence: cosmetics follow the CREATURE (one look on every board it
 * appears on), and ownership gating is client-side by the existing
 * isTokenOwnedHere precedent (visitor edits only the sidebar-selected
 * character's token; GM edits any) — exactly how the post-WW visitor
 * target-select lane gates writes, since device identity is a client-only
 * fact the server can never verify.
 *
 * Canonical row shape (ONE shape, no legacy variants):
 *   { ringColor: <palette id | null>, hideLabel: <boolean> }
 * Absent key ≡ normalizeTokenCosmetics(null) ≡ today's default look.
 *
 * The palette is fixed on purpose (swatches, never a free color picker):
 * every entry reuses a color value already used by the badge/status language
 * (CreatureBadge.css / TokenStatusIndicators.css / Map.css families), with
 * deep light-theme variants so rings stay legible on both the dark indoor
 * board and paper faces. CSS halves live in tokenCosmetics.css — this module
 * stays CSS-free so the SERVER can import it too (keyValidators scans
 * stored rows against isTokenRingId; same server-imports-src precedent as
 * outdoorConfig.js and SpellOverlay.js).
 */

/** The runtime character-bucket key every token-cosmetics row lives under. */
export const TOKEN_COSMETICS_KEY = 'tokenCosmetics';

/** Fixed in-theme palette (~8 swatches). ids are the stored vocabulary. */
export const TOKEN_PALETTE = [
    { id: 'ember', label: 'Ember' },
    { id: 'crimson', label: 'Crimson' },
    { id: 'amber', label: 'Amber' },
    { id: 'gold', label: 'Gold' },
    { id: 'leaf', label: 'Leaf' },
    { id: 'azure', label: 'Azure' },
    { id: 'violet', label: 'Violet' },
    { id: 'slate', label: 'Slate' },
];

const PALETTE_IDS = new Set(TOKEN_PALETTE.map((entry) => entry.id));

/** True when `id` names a palette entry (server validator + render share). */
export function isTokenRingId(id) {
    return PALETTE_IDS.has(id);
}

/**
 * CSS class carrying the ring's color tokens (tokenCosmetics.css defines
 * --token-ring / --token-ring-deep per id and every surface consumes them).
 * Unknown/absent id ⇒ null ⇒ the token wears the default disc stroke.
 */
export function getTokenRingClass(id) {
    return isTokenRingId(id) ? `token-ring-${id}` : null;
}

/**
 * The ONE reader of a stored row: tolerates absent/null/garbage by returning
 * the canonical default, and never invents values a stored row did not carry
 * (unknown ring ids fall back to the default ring rather than rendering an
 * off-palette color the server refused to admit in the first place).
 */
export function normalizeTokenCosmetics(row) {
    const src = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
    return {
        ringColor: isTokenRingId(src.ringColor) ? src.ringColor : null,
        hideLabel: src.hideLabel === true,
    };
}
