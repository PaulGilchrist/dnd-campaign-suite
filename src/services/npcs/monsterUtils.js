import { loadMonsters } from '../ui/dataLoader.js';
import { npcToMonsterFormat } from '../encounters/npcStatBlockUtils.js';

let monstersCache = null;

function stripTrailingNumber(name) {
    return name.replace(/\s+\d+$/, '');
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
            return n.name?.toLowerCase() === baseName.toLowerCase();
        });
        if (npc?.imagePath) {
            // Campaign NPC images are always local — prefix with campaign path if available
            if (npc.imagePath.includes('campaigns/')) return npc.imagePath;
            if (campaignName) return `campaigns/${campaignName}/${npc.imagePath}`;
            return npc.imagePath;
        }
    }

    if (!monstersCache || !monstersCache.length) {
        monstersCache = await loadMonsters();
    }
    const baseName = stripTrailingNumber(npcName);
    const monster = monstersCache.find(m => m.name.toLowerCase() === baseName.toLowerCase());
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
            return n.name?.toLowerCase() === baseName.toLowerCase();
        });
        if (npc) {
            return npcToMonsterFormat(npc);
        }
    }

    if (!monstersCache) {
        monstersCache = await loadMonsters();
    }
    const baseName = stripTrailingNumber(npcName);
    return monstersCache.find(m => m.name.toLowerCase() === baseName.toLowerCase()) || null;
}
