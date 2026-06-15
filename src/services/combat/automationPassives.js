import { buildAttackInfo } from './automationInfoBuilder.js'
import { evaluateAutoExpression } from './automationExpressions.js'
import { parseMagicItemName } from '../rules/core/attackCalc.js'
import { getRuntimeValue } from '../../hooks/useRuntimeState.js'
import { applyGreatWeaponFighting } from '../rules/core/greatWeaponFighting.js'

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
        if (passive.type === 'weapon_mastery_choice' && passive.masteryProperties) {
            const typeKey = `_${passive.name.replace(/\s+/g, '_')}_chosenMastery`;
            const chosenMastery = getRuntimeValue(playerStats.name, typeKey, playerStats.campaignName);
            if (chosenMastery && passive.masteryProperties.includes(chosenMastery)) {
                extraMasteries.push(chosenMastery);
            }
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
        if (passive.type === 'passive_rule' && passive.effect === 'max_hp_increase' && passive.alsoSelfHealing?.extraHealingExpression) {
            const bonus = evaluateAutoExpression(passive.alsoSelfHealing.extraHealingExpression, playerStats, prof, level, slotLevel);
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

export function hasRerollHealingOnes(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_rule' && p.effect === 'reroll_healing_ones');
}

export function hasTacticalShift(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_rule' && p.effect === 'tactical_shift_no_oa');
}

export function hasSpeedyOpportunityDisadvantage(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_rule' && p.effect === 'opportunity_attacks_disadvantage');
}

export function hasSpeedyDifficultTerrainIgnore(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_rule' && p.effect === 'ignore_difficult_terrain_on_dash');
}

export function isResistantToDamageType(playerStats, damageType) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p =>
        p.type === 'passive_immunity' &&
        Array.isArray(p.damageResistance) &&
        p.damageResistance.some(d => d.toLowerCase() === String(damageType).toLowerCase())
    );
}

export function hasIgnoreResistance(playerStats, damageType) {
    const passives = playerStats.automation?.passives || [];
    for (const passive of passives) {
        if (passive.type === 'passive_rule' && passive.effect === 'ignore_resistance') {
            const damageTypes = passive.damageTypes || [];
            if (damageTypes.length === 0) return true;
            if (damageTypes.some(dt => dt.toLowerCase() === String(damageType).toLowerCase())) {
                return true;
            }
        }
        if (passive.type === 'damage_type_choice' && passive.effect === 'elemental_adept') {
            const typeKey = `_${passive.name.replace(/\s+/g, '_')}_chosenType`;
            const chosenType = getRuntimeValue(playerStats.name, typeKey, playerStats.campaignName);
            if (chosenType && chosenType.toLowerCase() === String(damageType).toLowerCase()) {
                return true;
            }
        }
    }
    return false;
}

export function hasMinDamage(playerStats, damageType) {
    const passives = playerStats.automation?.passives || [];
    for (const passive of passives) {
        if (passive.type === 'damage_type_choice' && passive.effect === 'elemental_adept' && passive.minDamage) {
            const typeKey = `_${passive.name.replace(/\s+/g, '_')}_chosenType`;
            const chosenType = getRuntimeValue(playerStats.name, typeKey, playerStats.campaignName);
            if (chosenType && chosenType.toLowerCase() === String(damageType).toLowerCase()) {
                return true;
            }
        }
    }
    return false;
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

export function hasBlindsight(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_buff' && p.effect === 'blindsight');
}

export function hasTruesight(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_buff' && p.effect === 'truesight');
}

export function hasFastWrestler(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_buff' && p.effect === 'fast_wrestler');
}

export function hasGreatWeaponFighting(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_rule' && p.effect === 'great_weapon_fighting');
}

export function hasTwoWeaponFighting(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_rule' && p.effect === 'two_weapon_fighting');
}

export function hasSomaticComponentWaiver(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_buff' && p.effect === 'somatic_component_waiver');
}

export function hasNaturallyStealthy(playerStats) {
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === 'passive_rule' && p.effect === 'naturally_stealthy');
}

export function applyGreatWeaponFightingToDamage(rolls, playerStats) {
    if (!hasGreatWeaponFighting(playerStats)) {
        return rolls;
    }
    return applyGreatWeaponFighting(rolls);
}

export function getDamageReduction(playerStats, damageType, isWearingHeavyArmor) {
    if (!playerStats) return null;
    const passives = playerStats.automation?.passives || [];
    const reactions = playerStats.automation?.reactions || [];
    const specialActions = playerStats.automation?.specialActions || [];
    const allAutomations = [...passives, ...reactions, ...specialActions];
    let totalReduction = 0;
    for (const auto of allAutomations) {
        if (auto.type !== 'damage_reduction') continue;
        if (auto.reaction) continue;
        const damageTypes = auto.damageTypes || [];
        if (damageTypes.length > 0 && !damageTypes.some(dt => dt.toLowerCase() === String(damageType).toLowerCase())) {
            continue;
        }
        const condition = auto.condition || '';
        if (condition === 'wearing_heavy_armor' && !isWearingHeavyArmor) {
            continue;
        }
        if (auto.trigger === 'damage_taken_of_chosen_resistance_type') {
            const playerName = playerStats.name;
            const campaignName = playerStats.campaignName;
            const chosenDamageType = getRuntimeValue(playerName, 'resistanceChosenDamageType', campaignName);
            if (!chosenDamageType || chosenDamageType.toLowerCase() !== String(damageType).toLowerCase()) {
                continue;
            }
            const isUsedThisTurn = getRuntimeValue(playerName, 'resistanceUsedThisTurn', campaignName);
            if (isUsedThisTurn) {
                continue;
            }
        }
        let reduction = 0;
        if (typeof auto.reduction === 'number') {
            reduction = auto.reduction;
        } else if (typeof auto.reductionExpression === 'number') {
            reduction = auto.reductionExpression;
        } else if (typeof auto.reductionExpression === 'string' && auto.reductionExpression) {
            reduction = evaluateAutoExpression(auto.reductionExpression, playerStats);
        }
        if (typeof reduction === 'number' && reduction > 0) {
            totalReduction += reduction;
        }
    }
    return totalReduction > 0 ? totalReduction : null;
}
