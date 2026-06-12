import { buildAttackInfo } from './automationInfoBuilder.js'
import { evaluateAutoExpression } from './automationExpressions.js'
import { parseMagicItemName } from '../rules/attackCalc.js'

export function getPassiveBuffs(features, playerStats) {
    const buffs = []
    if (!features) return buffs

    features.forEach(feature => {
        if (!feature?.automation) return
        const info = buildAttackInfo(feature, playerStats)
        if (info && (info.type === 'passive_buff' || info.type === 'passive_rule' || info.type === 'passive_immunity')) {
            buffs.push(info)
        }
    })

    return buffs
}

/**
 * Collect available weapon mastery properties for a given weapon.
 * Combines the weapon's base mastery with any extra mastery from features
 * (e.g., Battering Roots grants Push/Topple in addition to the weapon's own mastery).
 * @param {string} weaponName - Name of the weapon (may include magic prefix)
 * @param {Object} playerStats - PlayerStats object with equipment + automation.passives
 * @returns {{ baseMastery: string|null, extraMasteries: string[] }}
 */
export function collectWeaponMastery(weaponName, playerStats) {
    const { baseName } = parseMagicItemName(weaponName);
    const weapon = playerStats.equipment?.find(item => item.name === baseName);
    const baseMastery = weapon?.mastery || null;

    const extraMasteries = [];
    const passives = playerStats.automation?.passives || [];
    for (const passive of passives) {
        if (passive.extraMastery && Array.isArray(passive.extraMastery)) {
            extraMasteries.push(...passive.extraMastery);
        }
    }

    return {
        baseMastery,
        extraMasteries: [...new Set(extraMasteries)],
    };
}

export function resolveHealingBonuses(playerStats, prof, level, slotLevel) {
    const passives = playerStats.automation?.passives || [];
    let totalBonus = 0;
    for (const passive of passives) {
        if (passive.type === 'passive_rule' && passive.effect === 'bonus_healing' && passive.bonusExpression) {
            const bonus = evaluateAutoExpression(passive.bonusExpression, playerStats, prof, level, slotLevel);
            if (typeof bonus === 'number' && !isNaN(bonus)) {
                totalBonus += bonus;
            }
        }
    }
    return totalBonus;
}

export function hasHealingMaximization(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_rule' && p.effect === 'maximize_healing_dice');
}
