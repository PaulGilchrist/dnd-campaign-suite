import { is2024 } from './rules-helpers.js';

// Wizard-authored custom items are full objects (custom flag or their own
// description); unknown plain strings are just catalog misses.
function isCustomEntry(itemNameOrObj) {
    return Boolean(itemNameOrObj) && typeof itemNameOrObj === 'object'
        && Boolean(itemNameOrObj.custom || itemNameOrObj.description);
}

/**
 * Get magic items for a character (handles both rulesets internally).
 */
export function getMagicItems(allMagicItems, playerSummary, playerStats) {
    const inventoryMagicItems = playerSummary.inventory?.magicItems;
    if (!Array.isArray(inventoryMagicItems)) {
        console.error('rules: expected inventory.magicItems to be an array for', playerSummary.name || 'unknown');
        throw new Error('Missing array: inventory.magicItems for ' + (playerSummary.name || 'unknown'));
    }

    if (!allMagicItems || inventoryMagicItems.length === 0) {
        // 2024 returns [], 5e returns null
        if (is2024(playerStats, playerSummary)) {
            return [];
         }
        return null;
    }

    const processedItems = inventoryMagicItems.map(itemNameOrObj => {
        let itemName = typeof itemNameOrObj === 'string' ? itemNameOrObj : itemNameOrObj.name;
        const magicItem = allMagicItems.find(m => m.name === itemName);

        if (!magicItem) {
            if (is2024(playerStats, playerSummary)) {
                // 2024 drops unknown catalog strings but keeps wizard custom
                // items — they carry their own type/rarity/description.
                return isCustomEntry(itemNameOrObj) ? { ...itemNameOrObj } : null;
             }
            return { ...itemNameOrObj }; // 5e keeps the item even if not found
         }

        if (magicItem.name === 'Ring of Spell Storing' || magicItem.name === 'Spell Ring' || magicItem.name === 'Spell Scroll') {
            return { ...magicItem, details: magicItem.description, description: itemNameOrObj.spell || itemNameOrObj.description };
         }

        const result = { ...magicItem };
        if (typeof itemNameOrObj === 'object' && itemNameOrObj.quantity) {
            result.quantity = itemNameOrObj.quantity;
         }
        if (typeof itemNameOrObj === 'object' && itemNameOrObj.rarity) {
            result.rarity = itemNameOrObj.rarity;
         }

        return result;
    });

    // 2024 filters out nulls, 5e does not
    if (is2024(playerStats, playerSummary)) {
        return processedItems.filter(item => item !== null);
    }

    return processedItems;
}
