import { loadMonsters } from '../ui/dataLoader.js';
import { npcToMonsterFormat } from '../encounters/npcStatBlockUtils.js';

let monstersCache = null;

function stripTrailingNumber(name) {
    return name.replace(/\s+\d+$/, '');
}

// fix#115 single-contract: the one case-insensitive name comparison shared by both
// campaign-NPC lookup lanes (caller supplies the suffix-stripped baseName).
// Deliberately NOT findNPCByName (npcStatBlockUtils.js): that requires a full
// stat block (numeric AC AND positive HP via npcHasStatBlock); these lanes gate
// weaker by design — any imagePath here, numeric AC only in getMonsterData
// (mirrored-twins-not-assumed fix#200; behavior pinned in monsterUtils.test.js
// U4/D2, findNPCByName output shape owned by #1159).
function matchByName(npc, baseName) {
    return npc.name?.toLowerCase() === baseName.toLowerCase();
}

// fix#1177(b): unified cache guard (was :35 "empty-array = miss-refetch" vs
// :66 "empty-array = cached-permanent"). Empty is always not-loaded-HERE:
// /data/monsters.json ships 636 entries (3,184,485 bytes on disk, census
// 2026-10-23) and loadMonsters resolves [] only through its single fetch/
// parse failure exit (dataLoader.js:370; :336 is loadEquipment's twin) — []
// means failed-or-unloaded,
// never legit data. The fix#90 empty-is-data case lives on the campaign-roster
// lane (the `npcs` arg — e.g. Frostfall/data/npcs.json is literally `[]`,
// 2 bytes) which never enters monstersCache. Refetch is self-healing and
// loadMonsters dedupes in-flight fetches via monstersPromise, so a persistent
// failure costs no stampede.
async function findBestiaryMonster(npcName) {
    if (!monstersCache || !monstersCache.length) {
        monstersCache = await loadMonsters();
    }
    const baseName = stripTrailingNumber(npcName);
    return monstersCache.find(m => m.name.toLowerCase() === baseName.toLowerCase()) || null;
}

/**
 * Look up a monster image URL by NPC name, with optional campaign NPC fallback.
 * Strips trailing numbers (e.g., "Goblin 1" -> "Goblin") for case-insensitive lookup.
 * If an npcs array is provided, checks campaign NPCs first for avatar image.
 * If campaignName is provided, relative imagePath values from campaign NPCs are prefixed with the campaign path.
 * Returns fully formed URLs (absolute for remote monsters, campaign-prefixed for local NPC images).
 */
export async function getMonsterImageUrl(npcName, npcs, campaignName) {
    if (!npcName) return null;

    // Check campaign NPCs first if provided
    if (npcs?.length) {
        const baseName = stripTrailingNumber(npcName);
        const npc = npcs.find(n => {
            if (!n.imagePath) return false;
            return matchByName(n, baseName);
        });
        if (npc?.imagePath) {
            // Campaign NPC images are always local — prefix with campaign path if available
            if (npc.imagePath.includes('campaigns/')) return npc.imagePath;
            if (campaignName) return `campaigns/${campaignName}/${npc.imagePath}`;
            return npc.imagePath;
        }
    }

    const monster = await findBestiaryMonster(npcName);
    if (monster) {
        return `https://paulgilchrist.github.io/dnd-tools/images/${monster.index}.jpg`;
     }
    return null;
}

/**
 * Look up a monster data object by NPC name, with optional campaign NPC fallback.
 * Same lookup logic as getMonsterImageUrl but returns the full monster object.
 * If an npcs array is provided, checks campaign NPCs with stat blocks first.
 */
export async function getMonsterData(npcName, npcs) {
    if (!npcName) return null;

    // Check campaign NPCs first if provided
    if (npcs?.length) {
        const baseName = stripTrailingNumber(npcName);
        const npc = npcs.find(n => {
            if (typeof n.armorClass !== 'number') return false;
            return matchByName(n, baseName);
        });
        if (npc) {
            return npcToMonsterFormat(npc);
        }
    }

    return findBestiaryMonster(npcName);
}
