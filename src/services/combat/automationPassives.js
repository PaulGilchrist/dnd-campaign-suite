import { buildAttackInfo } from './automationInfoBuilder.js'
import { evaluateAutoExpression } from './automationExpressions.js'
import { parseMagicItemName } from '../rules/attackCalc.js'
import { getRuntimeValue } from '../../hooks/useRuntimeState.js'

export function getPassiveBuffs(features, playerStats) {
    const buffs = []
    if (!features) return buffs

    features.forEach(feature => {
        if (!feature?.automation) return
        const automations = Array.isArray(feature.automation) ? feature.automation : [feature.automation]
        for (const auto of automations) {
            const info = buildAttackInfo({ ...feature, automation: auto }, playerStats)
            if (info && (info.type === 'passive_buff' || info.type === 'passive_rule' || info.type === 'passive_immunity')) {
                buffs.push(info)
            }
        }
    })

    return buffs
}

/**
 * Collect available weapon mastery properties for a given weapon.
 * Combines the weapon's base mastery with any extra mastery from features
 * (e.g., Battering Roots grants Push/Topple in addition to the weapon's own mastery).
 * If a feature has replaceMastery (e.g., Tactical Master), the weapon's base mastery
 * is replaced with the replacement list instead of being used directly.
 * @param {string} weaponName - Name of the weapon (may include magic prefix)
 * @param {Object} playerStats - PlayerStats object with equipment + automation.passives
 * @returns {{ baseMastery: string|null, extraMasteries: string[] }}
 */
export function collectWeaponMastery(weaponName, playerStats) {
    const { baseName } = parseMagicItemName(weaponName);
    const weapon = playerStats.equipment?.find(item => item.name === baseName);
    let baseMastery = weapon?.mastery || null;

    const extraMasteries = [];
    let replaceMastery = null;
    const passives = playerStats.automation?.passives || [];
    for (const passive of passives) {
        if (passive.extraMastery && Array.isArray(passive.extraMastery)) {
            extraMasteries.push(...passive.extraMastery);
        }
        if (passive.replaceMastery && Array.isArray(passive.replaceMastery)) {
            replaceMastery = passive.replaceMastery;
        }
    }

    if (replaceMastery) {
        baseMastery = null;
        extraMasteries.push(...replaceMastery);
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

export function hasTacticalShift(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_rule' && p.effect === 'tactical_shift_no_oa');
}

export function hasDamageResistance(playerStats, damageType) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p =>
        p.type === 'passive_immunity' &&
        Array.isArray(p.damageResistance) &&
        p.damageResistance.some(d => d.toLowerCase() === String(damageType).toLowerCase())
    );
}

export function getDamageResistances(playerStats) {
    const passives = playerStats.automation?.passives || [];
    const resistances = [];
    for (const passive of passives) {
        if (passive.type === 'passive_immunity' && Array.isArray(passive.damageResistance)) {
            resistances.push(...passive.damageResistance);
        }
    }
    return [...new Set(resistances)];
}

export function isResilientSphereActive(targetName, campaignName) {
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    return activeBuffs.some(b => b.effect === 'resilient_sphere');
}

export function getResilientSphereSource(targetName, campaignName) {
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const buff = activeBuffs.find(b => b.effect === 'resilient_sphere');
    return buff?.sourceCharacter || null;
}
