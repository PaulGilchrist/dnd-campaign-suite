// Shared grid-size-field validation for the twin map generate modals
// (GenerateDungeonModal / GenerateTerrainModal). The Terrain twin used to
// silently clamp an out-of-range grid (Math.max(30, Math.min(100, n))) and
// generate anyway — the map landed at a different size than the hint promised
// with no notice (TE backlog 2026-11-12). Both twins now BLOCK with a
// persistent inline error, each aligned to its own real bounds (dungeon
// 7–100, terrain 30–100). A cleared number input reads Number('') === 0
// (React-19 law), so blanks honestly hit the below-minimum gate too.

// Returns { gridSize: <integer> } for an integer within [min, max],
// or { error } with plain-English copy naming the real bounds.
export function parseGridInput(raw, min, max) {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        return { error: `Grid size must be between ${min} and ${max}` };
    }
    return { gridSize: parsed };
}
