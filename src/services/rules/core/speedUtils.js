import { elfishLineageSpeedBonus } from '../../automation/handlers/class-other/elfishLineageHandler.js';

/**
 * Apply Elfish Lineage Wood Elf speed bonus (CLA-118).
 * The bonus is read from the races.json ladder (speedBonus); the grant seeds
 * from playerStats.speed and falls back to the race JSON base so a Wood Elf
 * whose loaded summary carries no speed still receives the ladder bump.
 */
export function applyElfisLineageSpeed(playerStats, playerSummary) {
    const bonus = elfishLineageSpeedBonus(playerStats, playerSummary?.campaignName);
    if (!bonus) return playerStats.speed;
    const base = playerStats.speed ?? playerStats.race?.speed;
    if (base == null) {
        console.error('[speedUtils] Wood Elf lineage speed grant but no race speed to apply it to:', playerStats.name);
        return playerStats.speed;
    }
    return base + bonus;
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
