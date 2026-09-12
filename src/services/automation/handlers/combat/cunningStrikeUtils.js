const SIZE_ORDER = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

function hasRequiredToolOrItem(option, playerStats) {
    const toolProficiencies = playerStats?.toolProficiencies || [];
    const hasProficiency = toolProficiencies.some(p =>
        p.toLowerCase().includes(option.requires.toLowerCase())
    );
    const inventory = playerStats?.inventory || {};
    const allItems = [
        ...(inventory.equipped || []),
        ...(inventory.backpack || []),
    ];
    const hasItem = allItems.some(item => {
        const itemName = typeof item === 'string' ? item : item.name;
        return itemName && itemName.toLowerCase().includes(option.requires.toLowerCase());
    });
    return hasProficiency || hasItem;
}

function validateTripSizeLimit(option, targetName, getCombatContextSync) {
    if (option.sizeLimit !== 'large_or_smaller' || !targetName) return null;
    const combatContext = getCombatContextSync(targetName);
    if (!combatContext) return null;
    const targetSizeIndex = SIZE_ORDER.indexOf(combatContext.size);
    if (targetSizeIndex !== -1 && targetSizeIndex > SIZE_ORDER.indexOf('Large')) {
        return {
            valid: false,
            reason: `Target is ${combatContext.size} (too large for Trip — only Large or smaller affected).`,
        };
    }
    // If we can't determine size from combat context, allow it (default assumption: target is valid size)
    return null;
}

function validateChargerPushSizeLimit(option, targetName, playerStats, getCombatContextSync) {
    if (option.sizeLimit !== 'one_size_larger' || !targetName) return null;
    const playerSize = playerStats.size || 'Medium';
    const combatContext = getCombatContextSync(targetName);
    if (!combatContext) return null;
    const playerSizeIndex = SIZE_ORDER.indexOf(playerSize);
    const targetSizeIndex = SIZE_ORDER.indexOf(combatContext.size);
    if (playerSizeIndex === -1 || targetSizeIndex === -1) return null;
    const maxAllowedIndex = playerSizeIndex + 1;
    if (targetSizeIndex > maxAllowedIndex) {
        return {
            valid: false,
            reason: `Target is ${combatContext.size} (too large for Charger push — only up to ${SIZE_ORDER[maxAllowedIndex]} allowed when player is ${playerSize}).`,
        };
    }
    return null;
}

/**
 * Validate a Cunning Strike option before applying it.
 * Checks prerequisites (e.g., Poisoner's Kit) and size limits.
 */
export function validateCunningStrikeOption(option, targetName, playerStats, getCombatContextSync) {
    // Check tool/item requirements (e.g., Poisoner's Kit for Poison option)
    if (option.requires && !hasRequiredToolOrItem(option, playerStats)) {
        return {
            valid: false,
            reason: `Requires ${option.requires} which the character does not have.`,
        };
    }

    // Check size limit for Trip (Large or smaller)
    const tripInvalid = validateTripSizeLimit(option, targetName, getCombatContextSync);
    if (tripInvalid) return tripInvalid;

    // Check size limit for Charger push (one size larger than player)
    const chargerInvalid = validateChargerPushSizeLimit(option, targetName, playerStats, getCombatContextSync);
    if (chargerInvalid) return chargerInvalid;

    return { valid: true };
}

/**
 * Synchronous helper to get target info from combat context.
 * Removed localStorage dependency — now returns null so size validations
 * pass through (default assumption: target is valid size).
 * Accepts an optional `overrideContext` parameter for testing purposes.
 */
let _getCombatContextSyncOverride = null;

export function getCombatContextSync(targetName, overrideContext) {
    if (overrideContext !== undefined) return overrideContext;
    if (_getCombatContextSyncOverride !== null) return _getCombatContextSyncOverride;
    // Combat context is now managed via server/SSE only.
    // Size validations that need this data should use the combatSummary
    // from the initiative component state.
    return null;
}

export function setGetCombatContextSyncOverride(val) {
    _getCombatContextSyncOverride = val;
}

export function clearGetCombatContextSyncOverride() {
    _getCombatContextSyncOverride = null;
}

/**
 * Apply Cunning Strike cost by deducting Sneak Attack dice.
 * The cost is specified as "Nd6" meaning N d6 dice to forgo.
 * We track this in runtime state so the damage computation can account for it.
 */
export async function applyCunningStrikeCost(playerStats, campaignName, costD6, getRuntimeValue, setRuntimeValue, addEntry) {
    // Track the Cunning Strike cost for this turn
    const key = '_cunningStrikeCostUsed';
    const currentCost = Number(getRuntimeValue(playerStats.name, key, campaignName) ?? 0);
    await setRuntimeValue(playerStats.name, key, currentCost + costD6, campaignName);

    addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Cunning Strike',
        description: `Forgoing ${costD6}d6 Sneak Attack damage dice for Cunning Strike cost.`,
    }).catch((e) => { console.error("[cunningStrikeUtils:log-error]", e); });
}
