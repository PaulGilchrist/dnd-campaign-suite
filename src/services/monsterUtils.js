import { loadMonsters } from './dataLoader.js';

let monstersCache = null;

/**
 * Look up a monster image URL by NPC name.
 * Strips trailing numbers (e.g., "Goblin 1" → "Goblin") for case-insensitive lookup.
 * Returns the image URL if the monster exists and has `image: true`, otherwise null.
 */
export async function getMonsterImageUrl(npcName) {
    if (!npcName) return null;
    if (!monstersCache) {
        monstersCache = await loadMonsters();
    }
    // Strip trailing number (e.g., "Goblin 1" -> "Goblin")
    const baseName = npcName.replace(/\s+\d+$/, '');
    // Case-insensitive lookup by name
    const monster = monstersCache.find(m => m.name.toLowerCase() === baseName.toLowerCase());
    if (monster && monster.image === true) {
        return `https://paulgilchrist.github.io/dnd-tools/images/${monster.index}.jpg`;
    }
    return null;
}
