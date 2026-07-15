import { buildAttackInfo } from './automationInfoBuilder.js'
import { evaluateAutoExpression } from './automationExpressions.js'
import { parseMagicItemName } from '../../rules/core/attackCalc.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { getChosenRuntimeValue } from '../../automation/common/choiceStorage.js'
import { applyGreatWeaponFighting } from '../../rules/core/greatWeaponFighting.js'

/**
 * Check if playerStats has a passive automation matching type and effect.
 *
 * @param {Object} playerStats - PlayerStats object
 * @param {string} type - Automation type (e.g. 'passive_rule', 'passive_buff', 'passive_immunity')
 * @param {string} effect - Effect identifier
 * @returns {boolean}
 */
export function hasPassiveEffect(playerStats, type, effect) {
    if (!playerStats) return false;
    const passives = playerStats.automation?.passives || [];
    return passives.some(p => p.type === type && p.effect === effect);
}

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
    let replaceMasteryOptions = null;
    let hasKindMasteryMatch = false;
    const passives = playerStats.automation?.passives || [];
    const passivesWithExtraMastery = passives.filter(p => p.extraMastery && Array.isArray(p.extraMastery) && p.extraMastery.length > 0);
    if (passivesWithExtraMastery.length > 0) {
        console.error('[collectWeaponMastery] Weapons with extraMastery passives:', weaponName, 'passives:', JSON.stringify(passivesWithExtraMastery.map(p => ({ name: p.name, extraMastery: p.extraMastery }))), 'baseMastery:', baseMastery);
    }
    for (const passive of passives) {
        if (passive.extraMastery && Array.isArray(passive.extraMastery)) {
            extraMasteries.push(...passive.extraMastery);
        }
        if (passive.replaceMastery && Array.isArray(passive.replaceMastery) && passive.replaceMastery.length > 0) {
            replaceMastery = passive.replaceMastery;
        }
        if (passive.type === 'weapon_mastery_choice' && passive.masteryProperties) {
            const chosenMastery = getChosenRuntimeValue(playerStats, passive.name, 'chosenMastery');
            if (chosenMastery && passive.masteryProperties.includes(chosenMastery)) {
                extraMasteries.push(chosenMastery);
            }
        }
        if (passive.type === 'weapon_kind_mastery') {
            const chosenWeapons = getRuntimeValue(playerStats.name, '_Weapon_Kind_Mastery_chosenWeapons');
            if (chosenWeapons && Array.isArray(chosenWeapons) && chosenWeapons.includes(baseName)) {
                const isMeleeOnly = passive.meleeOnly;
                if (!isMeleeOnly || weapon?.weapon_range === 'Melee') {
                    hasKindMasteryMatch = true;
                }
            }
        }
    }

    if (replaceMastery) {
        if (baseMastery) {
            // Tactical Master: only offer replacement when weapon has a usable mastery
            replaceMasteryOptions = replaceMastery;
        }
    } else if (!hasKindMasteryMatch) {
        baseMastery = null;
    }

    return {
        baseMastery,
        extraMasteries: [...new Set(extraMasteries)],
        replaceMasteryOptions: replaceMasteryOptions || null,
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

export function resolveHealingBonusesWithDetails(playerStats, prof, level, slotLevel) {
    const passives = playerStats.automation?.passives || [];
    let totalBonus = 0;
    const details = [];
    for (const passive of passives) {
        if (passive.type === 'passive_rule' && passive.effect === 'bonus_healing' && passive.bonusExpression) {
            const bonus = evaluateAutoExpression(passive.bonusExpression, playerStats, prof, level, slotLevel);
            if (typeof bonus === 'number' && !isNaN(bonus) && bonus > 0) {
                totalBonus += bonus;
                details.push({ name: passive.name, amount: bonus });
            }
        }
        if (passive.type === 'passive_rule' && passive.effect === 'max_hp_increase' && passive.alsoSelfHealing?.extraHealingExpression) {
            const bonus = evaluateAutoExpression(passive.alsoSelfHealing.extraHealingExpression, playerStats, prof, level, slotLevel);
            if (typeof bonus === 'number' && !isNaN(bonus) && bonus > 0) {
                totalBonus += bonus;
                details.push({ name: passive.name, amount: bonus });
            }
        }
    }
    return { totalBonus, details };
}

export function hasHealingMaximization(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'maximize_healing_dice');
}

export function hasRerollHealingOnes(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'reroll_healing_ones');
}

export function hasTacticalShift(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'tactical_shift_no_oa');
}

export function hasSpeedyOpportunityDisadvantage(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'opportunity_attacks_disadvantage');
}

export function hasSpeedyDifficultTerrainIgnore(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'ignore_difficult_terrain_on_dash');
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
            const chosenType = getChosenRuntimeValue(playerStats, passive.name, 'chosenType');
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
            const chosenType = getChosenRuntimeValue(playerStats, passive.name, 'chosenType');
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
    return hasPassiveEffect(playerStats, 'passive_buff', 'blindsight');
}

export function hasTruesight(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_buff', 'truesight');
}

export function hasFastWrestler(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_buff', 'fast_wrestler');
}

export function hasGreatWeaponFighting(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'great_weapon_fighting');
}

export function hasTwoWeaponFighting(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'two_weapon_fighting');
}

export function hasSomaticComponentWaiver(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_buff', 'somatic_component_waiver');
}

export function hasNaturallyStealthy(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'naturally_stealthy');
}

export function hasInterception(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'interception');
}

export function hasProtection(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'protection');
}

export function hasThrownWeaponFighting(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'thrown_weapon_fighting');
}

export function hasBlessedWarrior(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'blessed_warrior');
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
