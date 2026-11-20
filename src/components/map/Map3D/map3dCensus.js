// Per-origin census line for the 3D header (owner ruling 2026-11-20,
// "count only live-visible"). The chip used to read raw doc counts, so a
// visitor saw "1 monsters" for a token the scene had culled or ghosted.
// These counts are derived from the SAME predicates the scene's build
// dispatch applies (map3dVisibility.js + the ghostCells memory + the
// secret-door and fog gates in map3dScene.js), so the header-chip ↔
// getCensus() bucket mirror law holds for every origin:
//   walls   → _buildWalls(effectiveWalls, fog, isLocalhost)
//   items   → _buildPlacedItems (census items + fallback buckets; visitors
//             never see a secret-door model)
//   players → _buildPlayers (fog gate)
//   npcs / monsters → _buildNpcs (visible + fog gates)
//   last known → _buildLastKnownTokens (creature, NOT live-visible, memory
//             present) — ghosted tokens surface here instead of masquerading
//             as live creatures. null on the GM/toggle-OFF lane.
// The GM (isLocalhost) short-circuits every gate, so GM lines keep the full
// doc counts; only the plural wording changed. When EVERY count is zero (a
// never-explored map on a fresh origin, or a genuinely empty map for the GM)
// the zero-row `0 walls · 0 items · …` is truthful but noise, so the seam
// returns a single honest nothing-revealed face instead (owner ruling
// 2026-11-20 improve). The face is a pure function of the counts.
import { computeEffectiveWalls } from '../../../services/maps/effectiveWalls.js';
import { isItemVisible, isCreatureToken, isPlayerVisible } from './map3dVisibility.js';

const plural = (count, noun) => `${count} ${count === 1 ? noun : `${noun}s`}`;

export const NOTHING_REVEALED_LINE = 'Nothing revealed yet';

export function censusCounts({ walls, placedItems, players, fog, isLocalhost, ghostCells }) {
    const items = placedItems || [];
    const liveFog = fog || new Set();
    const effectiveWalls = walls ? computeEffectiveWalls(walls, items) : new Set();
    const tokens = items.filter(isCreatureToken);
    const liveToken = (item) => isItemVisible(item, liveFog, isLocalhost);
    const ghosted = (item) => !liveToken(item) && Boolean(ghostCells && ghostCells.has(item.id));
    return {
        walls: Array.from(effectiveWalls).filter((key) => isLocalhost || !liveFog.has(key)).length,
        items: items.filter((item) => !isCreatureToken(item)
            && (isLocalhost || item.type !== 'secretDoor')
            && liveToken(item)).length,
        players: (players || []).filter((p) => isPlayerVisible(p, liveFog, isLocalhost)).length,
        npcs: tokens.filter((i) => i.type === 'npc' && liveToken(i)).length,
        monsters: tokens.filter((i) => i.type === 'monster' && liveToken(i)).length,
        lastKnown: tokens.filter(ghosted).length,
    };
}

export function buildCensusLine(data) {
    const c = censusCounts(data);
    if (!c.walls && !c.items && !c.players && !c.npcs && !c.monsters && !c.lastKnown) {
        return NOTHING_REVEALED_LINE;
    }
    const terms = [
        plural(c.walls, 'wall'),
        plural(c.items, 'item'),
        plural(c.players, 'player'),
        plural(c.npcs, 'npc'),
        plural(c.monsters, 'monster'),
    ];
    if (c.lastKnown > 0) terms.push(`${c.lastKnown} last known`);
    return terms.join(' · ');
}
