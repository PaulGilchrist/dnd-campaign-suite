// Shared seed-field parsing for the twin map generate modals
// (GenerateDungeonModal / GenerateTerrainModal). A typed seed must be a real
// whole number: passing a bad one through parseInt produced NaN, which the
// generators silently coerced (mulberry32(NaN) ≡ seed 0) or dropped — maps
// that claimed a seed but were not reproducible from it (SD backlog 2026-11-12).
// Empty input stays random (seed: null → caller decides the random source);
// "0" is a VALID seed and must survive (never `value || fallback`).

export const SEED_ERROR = 'Seed must be a whole number';

// Returns { seed: <integer> } for a valid number ("0" included),
// { seed: null } for empty/whitespace, or { error: SEED_ERROR }.
export function parseSeedInput(raw) {
    const trimmed = String(raw ?? '').trim();
    if (trimmed === '') return { seed: null };
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? { seed: parsed } : { error: SEED_ERROR };
}
