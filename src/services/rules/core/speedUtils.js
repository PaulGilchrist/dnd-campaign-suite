import { getElfisLineageSelection } from '../../automation/handlers/class-other/elfishLineageHandler.js';

/**
 * Apply Elfish Lineage Wood Elf speed bonus.
 * Adds 5 ft. to base speed when Wood Elf lineage is selected.
 */
export function applyElfisLineageSpeed(playerStats, playerSummary) {
    const lineage = getElfisLineageSelection(playerStats, playerSummary?.campaignName);
    if (lineage === 'Wood Elf' && playerStats.speed != null) {
        return playerStats.speed + 5;
    }
    return playerStats.speed;
}

/**
 * Strip an armor/qty suffix like "( +1 )" from an equipped item name.
 */
function parseItemName(name) {
    return name.includes('(') ? name.substring(0, name.indexOf('(')).trim() : name;
}

function checkHeavyArmor(equippedItems, allEquipment) {
    return equippedItems.some(itemName => {
        const item = allEquipment.find(eq => eq.name === parseItemName(itemName) || eq.name === itemName);
        return Boolean(item && item.armor_category === 'Heavy');
    });
}

function speedConditionAllows(passive, isWearingHeavyArmor, isWearingArmor, isWieldingShield) {
    if (passive.condition === 'no_heavy_armor') return !isWearingHeavyArmor;
    if (passive.condition === 'no_armor_no_shield') return !isWearingArmor && !isWieldingShield;
    return true;
}

function speedPassiveBonus(passive, isWearingHeavyArmor, isWearingArmor, isWieldingShield) {
    if (passive.type !== 'passive_buff' || !passive.bonusExpression) return 0;
    const parsed = parseInt(passive.bonusExpression, 10);
    if (isNaN(parsed)) return 0;
    if (passive.effect === 'speed_increase') return parsed;
    if (passive.effect === 'speed_bonus') {
        return speedConditionAllows(passive, isWearingHeavyArmor, isWearingArmor, isWieldingShield) ? parsed : 0;
    }
    return 0;
}

/**
 * Apply speed increase bonuses from passive_buff features (e.g., Boon of Speed, Speedy feat).
 */
export function applySpeedIncreasePassives(playerStats) {
    const passives = playerStats.automation?.passives;
    if (!Array.isArray(passives)) {
        console.error('rules: expected passives to be an array for', playerStats.name);
        throw new Error('Missing array: passives for ' + playerStats.name);
    }
    const equippedItems = playerStats.inventory?.equipped || [];
    const allEquipment = playerStats.equipment || [];
    const isWearingHeavyArmor = checkHeavyArmor(equippedItems, allEquipment);
    const isWearingArmor = allEquipment.some(eq => equippedItems.includes(eq.name) && eq.equipment_category === 'Armor');
    const isWieldingShield = equippedItems.some(name => parseItemName(name) === 'Shield');
    let bonus = 0;
    for (const passive of passives) {
        bonus += speedPassiveBonus(passive, isWearingHeavyArmor, isWearingArmor, isWieldingShield);
    }
    if (bonus > 0 && playerStats.speed != null) {
        return playerStats.speed + bonus;
    }
    return playerStats.speed;
}
