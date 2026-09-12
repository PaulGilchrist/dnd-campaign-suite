import { evaluateAutoExpression } from './automationExpressions.js'
import { parseMagicItemName } from '../../rules/core/attackCalc.js'
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js'
import { getChosenRuntimeValue } from '../../automation/common/choiceStorage.js'
import { applyGreatWeaponFighting } from '../../rules/core/greatWeaponFighting.js'
import { markOncePerTurn } from '../../automation/common/oncePerTurn.js'
import { buildAttackInfo } from './automationInfoBuilder.js'

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

/**
 * Collect passive buffs from a feature's automation entries.
 */
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
const CHOICE_MASTERY_NAMES = ['Push', 'Topple'];

function accumulateExtraMasteries(passive, acc) {
    if (!Array.isArray(passive.extraMastery)) return;
    for (const m of passive.extraMastery) {
        const bucket = CHOICE_MASTERY_NAMES.includes(m) ? acc.choiceMasteries : acc.extraMasteries;
        if (!bucket.includes(m)) {
            bucket.push(m);
        }
    }
}

function accumulateMasteryChoice(passive, playerStats, acc) {
    if (passive.type !== 'weapon_mastery_choice' || !passive.masteryProperties) return;
    const chosenMastery = getChosenRuntimeValue(playerStats, passive.name, 'chosenMastery');
    if (chosenMastery && passive.masteryProperties.includes(chosenMastery)) {
        acc.extraMasteries.push(chosenMastery);
    }
}

function accumulateKindMastery(passive, playerStats, baseName, weapon, acc) {
    if (passive.type !== 'weapon_kind_mastery') return;
    const chosenWeapons = getRuntimeValue(playerStats.name, '_Weapon_Kind_Mastery_chosenWeapons');
    if (!Array.isArray(chosenWeapons) || !chosenWeapons.includes(baseName)) return;
    if (!passive.meleeOnly || weapon?.weapon_range === 'Melee') {
        acc.hasKindMasteryMatch = true;
    }
}

function accumulateMasteryPassive(passive, playerStats, baseName, weapon, acc) {
    accumulateExtraMasteries(passive, acc);
    if (Array.isArray(passive.replaceMastery) && passive.replaceMastery.length > 0) {
        acc.replaceMastery = passive.replaceMastery;
    }
    accumulateMasteryChoice(passive, playerStats, acc);
    accumulateKindMastery(passive, playerStats, baseName, weapon, acc);
}

export function collectWeaponMastery(weaponName, playerStats) {
    const { baseName } = parseMagicItemName(weaponName);
    const weapon = playerStats.equipment?.find(item => item.name === baseName);
    let baseMastery = weapon?.mastery || null;

    const acc = { extraMasteries: [], replaceMastery: null, choiceMasteries: [], hasKindMasteryMatch: false };
    const passives = playerStats.automation?.passives || [];
    for (const passive of passives) {
        accumulateMasteryPassive(passive, playerStats, baseName, weapon, acc);
    }

    // WM-008: kind-bucket gate. When the player has a weapon_kind_mastery passive,
    // the base mastery is only usable on weapons in the chosen kinds bucket — this
    // must be applied BEFORE the replaceMastery branch, otherwise Tactical Master
    // (replaceMastery) bypassed the gate and a non-chosen weapon (e.g. Shortbow with
    // chosenWeapons=['Shortsword']) kept its raw Vex mastery and auto-applied it.
    const hasKindGate = passives.some(p => p.type === 'weapon_kind_mastery');
    if (hasKindGate && !acc.hasKindMasteryMatch) {
        baseMastery = null;
    }

    let replaceMasteryOptions = null;
    if (acc.replaceMastery) {
        if (baseMastery) {
            // Tactical Master: only offer replacement when weapon has a usable mastery
            replaceMasteryOptions = acc.replaceMastery;
        }
    } else if (acc.choiceMasteries.length > 0) {
        replaceMasteryOptions = acc.choiceMasteries;
    } else if (!acc.hasKindMasteryMatch) {
        baseMastery = null;
    }

    return {
        baseMastery,
        extraMasteries: [...new Set(acc.extraMasteries)],
        replaceMasteryOptions: replaceMasteryOptions || null,
        choiceMasteries: acc.choiceMasteries.length > 0 ? acc.choiceMasteries : null,
    };
}

function describeHealingBonus(passive, bonus, requirePositive) {
    if (typeof bonus !== 'number' || isNaN(bonus)) return null;
    if (requirePositive && !(bonus > 0)) return null;
    return { name: passive.name, amount: bonus };
}

// Effects 'bonus_healing' and 'max_hp_increase'/'fortified_health' are mutually
// exclusive on a single passive, so the branches never both fire for one entry.
function healingPassiveContribution({ passive, stats, prof, level, slotLevel, campaignName, requirePositive }) {
    if (passive.type !== 'passive_rule') return null;
    if (passive.effect === 'bonus_healing' && passive.bonusExpression) {
        return describeHealingBonus(passive, evaluateAutoExpression(passive.bonusExpression, stats, prof, level, slotLevel), requirePositive);
    }
    if ((passive.effect === 'max_hp_increase' || passive.effect === 'fortified_health') && passive.alsoSelfHealing?.extraHealingExpression) {
        if (passive.alsoSelfHealing.oncePerTurn && campaignName) {
            const stored = getRuntimeValue(stats.name, '_fortifiedHealth_usedRound');
            if (stored) return null;
        }
        return describeHealingBonus(passive, evaluateAutoExpression(passive.alsoSelfHealing.extraHealingExpression, stats, prof, level, slotLevel), requirePositive);
    }
    return null;
}

export function resolveHealingBonuses(playerStats, prof, level, slotLevel, campaignName) {
    const passives = playerStats.automation?.passives || [];
    let totalBonus = 0;
    for (const passive of passives) {
        const contribution = healingPassiveContribution({ passive, stats: playerStats, prof, level, slotLevel, campaignName, requirePositive: false });
        if (contribution) totalBonus += contribution.amount;
    }
    return totalBonus;
}

export function resolveHealingBonusesWithDetails(playerStats, prof, level, slotLevel, campaignName, targetStats) {
    const passives = playerStats.automation?.passives || [];
    let totalBonus = 0;
    const details = [];
    const applyContribution = (stats, passive) => {
        const contribution = healingPassiveContribution({ passive, stats, prof, level, slotLevel, campaignName, requirePositive: true });
        if (!contribution) return;
        totalBonus += contribution.amount;
        details.push(contribution);
    };
    for (const passive of passives) {
        applyContribution(playerStats, passive);
    }
    if (targetStats && targetStats !== playerStats) {
        const targetPassives = targetStats.automation?.passives || [];
        for (const passive of targetPassives) {
            applyContribution(targetStats, passive);
        }
    }
    return { totalBonus, details };
}

export async function markFortifiedHealthUsed(playerStats, campaignName) {
    return markOncePerTurn('Fortified Health', '_fortifiedHealth_usedRound', playerStats, campaignName);
}

export function hasHealingMaximization(playerStats) {
    return hasPassiveEffect(playerStats, 'passive_rule', 'maximize_healing_dice');
}

export function hasHealingMaximizationForTarget(caster, targetName, campaignName) {
    if (hasHealingMaximization(caster)) return true;
    if (!targetName) return false;
    const effects = getRuntimeValue('campaign', 'targetEffects', campaignName);
    if (!Array.isArray(effects)) return false;
    return effects.some(te => te.effect === 'beacon_of_hope' && te.target === targetName);
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

function gatedResistanceTypes(passive, playerStats) {
    if (passive.name === 'Stormborn') {
        const wrathActive = getRuntimeValue(playerStats.name, 'wrathOfTheSeaActive');
        if (!wrathActive) return [];
    }
    if (passive.name === 'Full of Stars') {
        const activeBuffs = getRuntimeValue(playerStats.name, 'activeBuffs') || [];
        const starryFormActive = Array.isArray(activeBuffs) && activeBuffs.some(b => b.name === 'Starry Form');
        if (!starryFormActive) return [];
    }
    return passive.damageTypes;
}

function landMappedResistance(passive, playerStats) {
    const runtimeLandType = getRuntimeValue(playerStats.name, '_circleOfTheLandType') || '';
    const landType = (runtimeLandType || playerStats.class?.major?.type || playerStats.class?.subclass?.type || '').toLowerCase().trim();
    if (landType && passive.landMappings[landType]) {
        return [passive.landMappings[landType]];
    }
    return [];
}

// CLA-336: active-gated type:'resistance' passives (Stormborn Cold/Lightning/
// Thunder while Wrath of the Sea is active) must resolve LIVE at hit-resolution.
// Gates mirror rulesFactory.getPlayerStats (the compute-time path never sees the
// wrathOfTheSeaActive toggle flip). 5e shares this function — 5e data's only
// type:'resistance' passive (Avatar of Battle) is always-on and emits ungated.
function passiveResistanceContribution(passive, playerStats) {
    if (passive.type === 'passive_immunity' && Array.isArray(passive.damageResistance)) {
        return passive.damageResistance;
    }
    if (passive.type === 'passive_buff' && Array.isArray(passive.resistances)) {
        return passive.resistances;
    }
    if (passive.type === 'damage_type_choice' && passive.effect === 'fiendish_resilience') {
        const chosenType = getChosenRuntimeValue(playerStats, passive.name, 'chosenType');
        return chosenType ? [chosenType] : [];
    }
    if (passive.type === 'resistance' && Array.isArray(passive.damageTypes)) {
        return gatedResistanceTypes(passive, playerStats);
    }
    if (passive.type === 'land_resistance' && passive.landMappings && typeof passive.landMappings === 'object') {
        return landMappedResistance(passive, playerStats);
    }
    return [];
}

export function getDamageResistances(playerStats) {
    const passives = playerStats.automation?.passives || [];
    const resistances = [];
    for (const passive of passives) {
        resistances.push(...passiveResistanceContribution(passive, playerStats));
    }
    return [...new Set(resistances)];
}

export function isResilientSphereActive(targetName, campaignName) {
    // Check activeBuffs (works for both 5e and 2024)
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    if (activeBuffs.some(b => b.effect === 'resilient_sphere')) return true;

    // Check targetEffects (2024 version)
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    if (targetEffects.some(te => te.effect === 'resilient_sphere' && te.target === targetName)) return true;

    return false;
}

export function getResilientSphereSource(targetName, campaignName) {
    const activeBuffs = getRuntimeValue(targetName, 'activeBuffs', campaignName) || [];
    const buff = activeBuffs.find(b => b.effect === 'resilient_sphere');
    if (buff?.sourceCharacter) return buff.sourceCharacter;

    // Check targetEffects for 2024 version
    const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
    const te = targetEffects.find(te => te.effect === 'resilient_sphere' && te.target === targetName);
    return te?.source || null;
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

function chosenResistanceGateAllows(auto, playerStats, damageType) {
    const playerName = playerStats.name;
    const campaignName = playerStats.campaignName;
    const chosenDamageType = getRuntimeValue(playerName, 'resistanceChosenDamageType', campaignName);
    if (!chosenDamageType || chosenDamageType.toLowerCase() !== String(damageType).toLowerCase()) {
        return false;
    }
    return !getRuntimeValue(playerName, 'resistanceUsedThisTurn', campaignName);
}

function resolveEntryReduction(auto, playerStats) {
    if (typeof auto.reduction === 'number') return auto.reduction;
    if (typeof auto.reductionExpression === 'number') return auto.reductionExpression;
    if (typeof auto.reductionExpression === 'string' && auto.reductionExpression) {
        return evaluateAutoExpression(auto.reductionExpression, playerStats);
    }
    return 0;
}

function reductionApplies(auto, playerStats, damageType, isWearingHeavyArmor) {
    if (auto.type !== 'damage_reduction') return false;
    if (auto.reaction) return false;
    const damageTypes = auto.damageTypes || [];
    if (damageTypes.length > 0 && !damageTypes.some(dt => dt.toLowerCase() === String(damageType).toLowerCase())) {
        return false;
    }
    const condition = auto.condition || '';
    if (condition === 'wearing_heavy_armor' && !isWearingHeavyArmor) {
        return false;
    }
    if (auto.trigger === 'damage_taken_of_chosen_resistance_type') {
        return chosenResistanceGateAllows(auto, playerStats, damageType);
    }
    return true;
}

export function getDamageReduction(playerStats, damageType, isWearingHeavyArmor) {
    if (!playerStats) return null;
    const automation = playerStats.automation || {};
    const allAutomations = [...(automation.passives || []), ...(automation.reactions || []), ...(automation.specialActions || [])];
    let totalReduction = 0;
    for (const auto of allAutomations) {
        if (!reductionApplies(auto, playerStats, damageType, isWearingHeavyArmor)) continue;
        const reduction = resolveEntryReduction(auto, playerStats);
        if (typeof reduction === 'number' && reduction > 0) {
            totalReduction += reduction;
        }
    }
    return totalReduction > 0 ? totalReduction : null;
}
