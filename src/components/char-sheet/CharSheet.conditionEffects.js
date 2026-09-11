import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { computeConditionEffects, getNetAttackMode, CONDITIONS_THAT_CANNOT_ACT } from '../../services/combat/conditions/conditionEffects.js'
import { getCombatSummary } from '../../services/encounters/combatData.js'
import { getDistanceFeet } from '../../services/rules/combat/rangeValidation.js'
import { isDistanceInRange } from '../../services/rules/combat/rangeCheck.js'
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js'
import { isCreatureWarded } from '../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js'
import { getHolyAuraTargets } from '../../services/automation/handlers/buffs/holyAuraHandler.js'

// Merge save modifiers from active combat stances (e.g. Rage STR save advantage)
function buildStanceSaveModifiers(activeBuffs) {
    if (!Array.isArray(activeBuffs)) return [];
    return activeBuffs.filter(b => b.advantages?.length).flatMap(b =>
        b.advantages
            .filter(a => a.toLowerCase().includes('saves'))
            .map(a => {
                const abilityMatch = a.match(/^(\w{3})\s+saves/);
                return abilityMatch
                    ? { source: b.name, target: 'saving_throw', condition: 'stance_active', effect: 'advantage', abilities: [abilityMatch[1].toUpperCase()] }
                    : null;
            })
            .filter(Boolean)
    );
}

// Protection from Evil and Good: if already charmed/frightened by a warded creature,
// the target has Advantage on any new saving throw against the relevant effect
function buildPfeagSaveAdvantage(activeConditions, pfeagActive, playerStats) {
    if (!pfeagActive || !playerStats) return [];
    const hasCharmed = activeConditions.includes('charmed');
    const hasFrightened = activeConditions.includes('frightened');
    if (!hasCharmed && !hasFrightened) return [];
    return [{
        source: 'Protection from Evil and Good',
        target: 'saving_throw',
        condition: 'pfeag_save_advantage',
        effect: 'advantage',
    }];
}

function applyRerollKillSwitches(conditionEffects, playerStats, campaignName) {
    // Kill-switches for the once-per-rest reroll features must never disable the
    // Halfling Lucky trait (autoRerollCondition 'roll_equals_1' — unlimited, passive).
    const isHalflingLuckyReroll = conditionEffects.autoRerollCondition === 'roll_equals_1';
    const fanaticalFocusUsed = getRuntimeValue(playerStats.name, 'fanaticalFocusUsed', campaignName);
    if (fanaticalFocusUsed && conditionEffects.autoRerollForSaves && !isHalflingLuckyReroll) {
        conditionEffects.autoRerollForSaves = false;
        conditionEffects.autoRerollBonus = null;
    }
    const indomitableUses = Number(getRuntimeValue(playerStats.name, 'indomitableUses', campaignName) ?? 0);
    const indomitableMax = playerStats.level >= 17 ? 3 : playerStats.level >= 13 ? 2 : 1;
    if (indomitableUses >= indomitableMax && conditionEffects.autoRerollForSaves && !isHalflingLuckyReroll) {
        conditionEffects.autoRerollForSaves = false;
        conditionEffects.autoRerollBonus = null;
    }
    const strokeOfLuckUsed = getRuntimeValue(playerStats.name, 'strokeOfLuckUsed', campaignName);
    if (strokeOfLuckUsed && conditionEffects.strokeOfLuck) {
        conditionEffects.strokeOfLuck = false;
    }
}

// Warding Bond: +1 AC and +1 to all saving throws (only if within 60 feet)
function buffsHave(activeBuffs, predicate) {
    return Array.isArray(activeBuffs) && activeBuffs.some(predicate);
}

function hasBuffEffect(activeBuffs, effect) {
    return buffsHave(activeBuffs, b => b.effect === effect);
}

function normalizeExhaustion(storedExhaustion) {
    return typeof storedExhaustion === 'number' ? Math.min(6, Math.max(0, storedExhaustion)) : 0;
}

function buildAllSaveModifiers(playerStats, stanceSaveModifiers, pfeagSaveAdvantage, mageHandControlled) {
    return [...(playerStats?.saveModifiers || []), ...stanceSaveModifiers, ...pfeagSaveAdvantage]
        .filter(m => m.condition !== 'mage_hand_legerdemain' || mageHandControlled);
}

// Boolean activity flags (buff-effect lookups + runtime reads) feeding computeConditionEffects.
function computeConditionFlags(activeBuffs, playerStats, campaignName) {
    return {
        isRaging: buffsHave(activeBuffs, b => b.damageBonusExpression),
        shapeShiftActive: hasBuffEffect(activeBuffs, 'shape_shift'),
        isPeerlessAthlete: getRuntimeValue(playerStats?.name, 'peerlessAthleteActive', campaignName),
        isLargeFormActive: getRuntimeValue(playerStats?.name, 'largeFormActive', campaignName),
        seeInvisibilityActive: hasBuffEffect(activeBuffs, 'see_invisibility'),
        isLivingLegendActive: getRuntimeValue(playerStats?.name, 'livingLegendActive', campaignName) === true,
        isElderChampionActive: getRuntimeValue(playerStats?.name, 'elderChampionActive', campaignName) === true,
        isHolyAuraActive: getHolyAuraTargets(playerStats?.name, campaignName),
        isProtectionFromPoisonActive: buffsHave(activeBuffs, b => b.name === 'Protection from Poison' && b.effect === 'protection_from_poison'),
        isTranceOfOrderActive: getRuntimeValue(playerStats?.name, 'tranceOfOrderActive', campaignName) === true,
    };
}

// Protection from Evil and Good: warded attacker has Disadvantage on attack rolls against the target.
function applyPfeagTargetDisadvantage(conditionEffects, playerStats, combatContext, campaignName) {
    const attackerName = combatContext.attackerName;
    if (!attackerName) return;
    const attackerCreature = combatContext.creatures?.find(c => c.name === attackerName);
    if (attackerCreature && isCreatureWarded(attackerCreature.type, playerStats.name, campaignName)) {
        conditionEffects.targetDisadvantageCount = (conditionEffects.targetDisadvantageCount || 0) + 1;
    }
}

// Elusive: no attack roll can have Advantage against you unless Incapacitated.
function applyElusive(conditionEffects, playerStats, activeConditions) {
    const hasElusive = [
        ...(playerStats.actions || []),
        ...(playerStats.bonusActions || []),
        ...(playerStats.reactions || []),
        ...(playerStats.specialActions || [])
    ].some(a => a.name === 'Elusive');
    const isIncapacitated = activeConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c));
    if (hasElusive && !isIncapacitated) {
        conditionEffects.noAdvantageAgainst = true;
    }
}

// Post-compute buff/feature modifiers applied to the base conditionEffects, in original order.
function applyPostComputeModifiers(conditionEffects, activeBuffs, playerSummary, playerStats, combatContext, campaignName, pfeagActive, activeConditions) {
    if (playerStats) {
        const speedHalvedTime = getRuntimeValue(playerStats.name, 'stunned_speedHalved', campaignName);
        if (speedHalvedTime) conditionEffects.speedHalved = true;
        if (conditionEffects.autoRerollBonus) {
            conditionEffects.autoRerollBonus = evaluateAutoExpression(conditionEffects.autoRerollBonus, playerStats);
        }
        applyRerollKillSwitches(conditionEffects, playerStats, campaignName);
    }
    // Reckless Attack: enemies have Advantage on attack rolls against you
    if (hasBuffEffect(activeBuffs, 'advantage_attacks_advantage_against')) {
        conditionEffects.targetAdvantageCount = (conditionEffects.targetAdvantageCount || 0) + 1;
    }
    // Blessing of the Trickster: Advantage on Dexterity (Stealth) checks
    const hasTricksterBlessing = hasBuffEffect(activeBuffs, 'advantage_on_stealth');
    if (hasTricksterBlessing) {
        conditionEffects.abilityCheckAdvantage = true;
        conditionEffects.abilityCheckAdvantageSkill = 'Stealth';
    }
    // Buff-ally effects (e.g., Zealous Presence): Advantage on attack rolls and saving throws
    const buffAllyActive = hasBuffEffect(activeBuffs, 'advantage_attacks_and_saves');
    if (buffAllyActive) {
        conditionEffects.attackAdvantageCount = (conditionEffects.attackAdvantageCount || 0) + 1;
        conditionEffects.saveAdvantageCount = (conditionEffects.saveAdvantageCount || 0) + 1;
    }
    // Cloak of Shadows: Invisibility grants attack advantage and target disadvantage
    const cloakOfShadowsActive = hasBuffEffect(activeBuffs, 'cloak_of_shadows');
    if (cloakOfShadowsActive) {
        conditionEffects.attackAdvantageCount = (conditionEffects.attackAdvantageCount || 0) + 1;
        conditionEffects.targetDisadvantageCount = (conditionEffects.targetDisadvantageCount || 0) + 1;
    }
    // Shield: +5 AC until start of next turn, immune to Magic Missile
    const shieldActive = hasBuffEffect(activeBuffs, 'shield');
    if (shieldActive) {
        conditionEffects.shieldAcBonus = 5;
        conditionEffects.magicMissileImmune = true;
    }
    const { wardingBondAcBonus, wardingBondSaveBonus } = computeWardingBondBonuses(activeBuffs, playerSummary, playerStats, combatContext);
    if (wardingBondAcBonus > 0) {
        conditionEffects.wardingBondAcBonus = wardingBondAcBonus;
    }
    if (wardingBondSaveBonus > 0) {
        conditionEffects.saveBonusExpression = (conditionEffects.saveBonusExpression || '0') + ' + ' + wardingBondSaveBonus;
    }
    // Shield of Faith: +2 AC for duration (Concentration, up to 10 minutes)
    const shieldOfFaithActive = hasBuffEffect(activeBuffs, 'shield_of_faith');
    if (shieldOfFaithActive) {
        conditionEffects.shieldOfFaithAcBonus = 2;
    }
    // Alert: Other creatures don't gain advantage on attack rolls against you from being unseen
    if (playerStats?.unseenAttackerAdvantageNegate) {
        conditionEffects.noAdvantageAgainst = true;
    }
    // Protection from Evil and Good: warded creatures have Disadvantage on attack rolls against you
    if (pfeagActive && playerStats && combatContext) {
        applyPfeagTargetDisadvantage(conditionEffects, playerStats, combatContext, campaignName);
    }
    // Haste: Advantage on Dexterity saving throws
    const hasteActive = hasBuffEffect(activeBuffs, 'haste');
    if (hasteActive) {
        conditionEffects.saveAdvantageAbilities = [...(conditionEffects.saveAdvantageAbilities || []), 'DEX'];
    }
    if (playerStats) {
        applyElusive(conditionEffects, playerStats, activeConditions);
    }
    return { hasTricksterBlessing, buffAllyActive, cloakOfShadowsActive, shieldActive, shieldOfFaithActive, hasteActive, wardingBondAcBonus, wardingBondSaveBonus };
}

function computeWardingBondBonuses(activeBuffs, playerSummary, playerStats, combatContext) {
    let wardingBondAcBonus = 0;
    let wardingBondSaveBonus = 0;
    for (const buff of activeBuffs) {
        if (buff.effect !== 'warding_bond' || !buff.sourceCharacter) continue;
        const casterName = buff.sourceCharacter;
        if (casterName === playerSummary?.name) continue;
        const casterCreature = combatContext?.creatures?.find(c => c.name === casterName);
        const targetCreature = combatContext?.creatures?.find(c => c.name === playerStats?.name);
        const distance = casterCreature && targetCreature ? getDistanceFeet(casterCreature.position, targetCreature.position) : null;
        if (distance === null || isDistanceInRange(distance, 60)) {
            if (buff.acBonus) {
                wardingBondAcBonus += buff.acBonus;
            }
            if (buff.saveBonus) {
                wardingBondSaveBonus += buff.saveBonus;
            }
        }
    }
    return { wardingBondAcBonus, wardingBondSaveBonus };
}

export function computeCharConditionEffects(playerSummary, playerStats, campaignName, activeBuffs) {
    const storedConditions = getRuntimeValue(playerSummary?.name, 'activeConditions', campaignName);
    const storedExhaustion = getRuntimeValue(playerSummary?.name, 'exhaustionLevel', campaignName);
    const exhaustionLevel = normalizeExhaustion(storedExhaustion);
    const activeConditions = Array.isArray(storedConditions) ? storedConditions : [];

    const stanceSaveModifiers = buildStanceSaveModifiers(activeBuffs);

    // Protection from Evil and Good: check if spell is active
    const pfeagActive = hasBuffEffect(activeBuffs, 'protection_from_evil_and_good');
    const pfeagSaveAdvantage = buildPfeagSaveAdvantage(activeConditions, pfeagActive, playerStats);
    // CLA-218: Mage Hand Legerdemain — the conditional_advantage saveModifier
    // (target ability_check, abilities DEX, condition mage_hand_legerdemain)
    // only applies while the spectral hand is being controlled (bonus action;
    // flag set by mageHandControlHandler, cleared at next-turn start by the
    // mage_hand_legerdemain turn-start consumer). Without the control flag the
    // modifier must be dropped — its condition matches no active condition, so
    // saveModifierApplies would otherwise fall through to an unconditional pass.
    const mageHandControlled = getRuntimeValue(playerStats?.name, 'mageHandControlled', campaignName) === true;
    const allSaveModifiers = buildAllSaveModifiers(playerStats, stanceSaveModifiers, pfeagSaveAdvantage, mageHandControlled);
    const allTargetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) ?? [];
    const myTargetEffects = allTargetEffects.filter(te => te.target === (playerSummary?.name));
    const flags = computeConditionFlags(activeBuffs, playerStats, campaignName);
    const combatContext = getCombatSummary(campaignName);
    const conditionEffects = computeConditionEffects(activeConditions, allSaveModifiers, myTargetEffects, flags.isRaging, flags.shapeShiftActive, flags.isPeerlessAthlete, flags.isLargeFormActive, combatContext, flags.seeInvisibilityActive, playerStats?.name, flags.isLivingLegendActive, flags.isElderChampionActive, false, flags.isHolyAuraActive, flags.isProtectionFromPoisonActive, flags.isTranceOfOrderActive, playerStats?.hasPowerfulBuild === true);

    const { hasTricksterBlessing, buffAllyActive, cloakOfShadowsActive, shieldActive, shieldOfFaithActive, hasteActive, wardingBondAcBonus, wardingBondSaveBonus } =
        applyPostComputeModifiers(conditionEffects, activeBuffs, playerSummary, playerStats, combatContext, campaignName, pfeagActive, activeConditions);

    const cannotAct = activeConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c));
    // SP-111: the Poisoned-by-Stinking-Cloud rider blocks Actions + Bonus
    // Actions but NOT Reactions — cannotActActions feeds CharActions /
    // CharBonusActions / CharSpells / CharSpecialActions; CharReactions keeps
    // the condition-only cannotAct.
    const cloudBlockTe = myTargetEffects.find(te => te && te.effect === 'no_action_and_bonus_action');
    const cannotActActions = cannotAct || conditionEffects.cannotAct === true || !!cloudBlockTe;
    const conditionAttackMode = getNetAttackMode(conditionEffects.attackAdvantageCount, conditionEffects.attackDisadvantageCount, conditionEffects.restoreBalance);
    const exhausted = 2 * exhaustionLevel;

    return {
        conditionEffects,
        cannotAct,
        cannotActActions,
        cannotActReason: cloudBlockTe ? (cloudBlockTe.reason || 'Can\'t take an Action or Bonus Action') : null,
        conditionAttackMode,
        isRaging: flags.isRaging,
        shapeShiftActive: flags.shapeShiftActive,
        shieldActive,
        shieldOfFaithActive,
        hasteActive,
        pfeagActive,
        cloakOfShadowsActive,
        buffAllyActive,
        hasTricksterBlessing,
        wardingBondAcBonus,
        wardingBondSaveBonus,
        exhaustionLevel,
        exhaustionPenalty: exhausted,
    };
}
