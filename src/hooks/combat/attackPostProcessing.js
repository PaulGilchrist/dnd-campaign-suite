import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { hasPotentCantrip, applyMinDamageAdjustment } from './loggedDiceRollUtils.js';
import { getEmpoweredEvocationFeatures, getEmpoweredEvocationIntModifier } from '../../services/rules/spells/postCastRiderService.js';
import { addEntry } from '../../services/ui/logService.js';

export async function processAttackAfterResult(hit, isAutoMiss, targetName, characterName, campaignName, context, combatSummary, characters, logEntry, setPopupHtml, state) {
    if (context?.rollType !== 'attack') return;
    const { effectiveD20, r1, r2, bonus, effectiveD20Roll, isCrit, targetAc, effectiveAc, homingStrikesUsed, homingStrikesBonus, homingStrikesAttempted, hit: finalHit, isAutoMiss: finalAutoMiss } = state;

    storeLastAttackRoll({ characterName, campaignName, context, effectiveD20, bonus, targetName, targetAc, effectiveAc, finalHit, isCrit, homingStrikesUsed, homingStrikesBonus });

    if (combatSummary && targetName) {
        storeCampaignLastAttack({ characterName, campaignName, context, targetName, effectiveD20, effectiveD20Roll, r1, r2, finalHit, finalAutoMiss, isCrit, targetAc, effectiveAc, homingStrikesUsed, homingStrikesBonus, homingStrikesAttempted });
    }

    // MN-017: a Riposte attack that misses must not leave a stale Superiority
    // Die armed — the damage pipeline (pendingRiposteDieValue consumer) only
    // runs on hits, so clear the armed die here and log the spent reaction.
    clearRiposteDieOnMiss({ finalHit, characterName, targetName, campaignName });

    storeRollContextAndSuperiorityPrompt({ characterName, campaignName, context, targetName, effectiveD20, bonus, hit, finalHit, isCrit });

    // CLA-230: one-shot "next attack roll" advantage is consumed by the ONE
    // attack that rolls (Moonlight Step / Shadow Step / Steady Aim / Blink).
    // Strip the attacker's non-vex next_attack_advantage te once the roll
    // resolves — hit OR miss both consume it; an auto-miss rolls no d20, so
    // the advantage survives. Runs BEFORE the miss-effects block below so te
    // granted by this same miss (Vex-style triggers) is not self-consumed.
    consumeOneShotAdvantage({ characterName, campaignName, finalAutoMiss });

    // Miss effects (vex, etc.)
    grantMissAdvantageEffects({ finalHit, finalAutoMiss, targetName, context, characterName, campaignName });

    // Graze damage
    if (context?.grazeDamage && targetName && !finalHit && !finalAutoMiss) {
        await processGrazeDamage(context, targetName, characterName, campaignName, characters, logEntry, setPopupHtml);
    }

    // Vex/distracting strike/sap clearing on hit — each reads original effects and writes independently (matches original behavior)
    clearHitConsumedEffects({ targetName, characterName, finalHit, campaignName });

    // Sap / Hand of Harm clearing: disadvantage_next_attack is consumed by the
    // attacker's next attack roll regardless of hit or miss — re-read the freshest
    // value so it composes with the hit-only clears above
    clearSapDisadvantage({ targetName, characterName, campaignName });
}

function storeLastAttackRoll({ characterName, campaignName, context, effectiveD20, bonus, targetName, targetAc, effectiveAc, finalHit, isCrit, homingStrikesUsed, homingStrikesBonus }) {
    const { name, attackName, autoDamageName, attackerName, coverAcBonus } = context || {};
    setRuntimeValue(characterName, 'lastAttackRoll', {
        attackName: attackName || autoDamageName || name,
        attackerName: attackerName || characterName,
        d20: effectiveD20,
        bonus: homingStrikesUsed ? (bonus + homingStrikesBonus) : bonus,
        targetName,
        targetAc,
        hit: finalHit,
        isCrit,
        effectiveAc,
        coverAcBonus: coverAcBonus || 0,
        homingStrikesBonus: homingStrikesUsed ? homingStrikesBonus : undefined,
        timestamp: Date.now(),
    }, campaignName);
}

// [recordKey, contextKey, fallback] — fields stamped from context with defaults,
// in the exact original object key order.
const LAST_ATTACK_CONTEXT_DEFAULTS = [
    ['damageType', 'damageType', null],
    ['damageFormula', 'autoDamageFormula', null],
    ['damageName', 'autoDamageName', null],
    ['damageSchool', 'autoDamageSchool', null],
    ['saveDc', 'saveDc', null],
    ['saveType', 'saveType', null],
    ['dcSuccess', 'dcSuccess', null],
    ['metamagicTwinTarget', 'metamagicTwinTarget', null],
    ['metamagicHeighten', 'metamagicHeighten', null],
    ['isCantrip', 'isCantrip', null],
    ['overchannelActive', 'overchannelActive', null],
    ['overchannelUseCount', 'overchannelUseCount', null],
    ['overchannelSpellLevel', 'overchannelSpellLevel', null],
    ['secondaryFormula', 'autoDamageSecondaryFormula', null],
    ['secondaryDamageType', 'autoDamageSecondaryDamageType', null],
    ['rangeReason', 'rangeReason', null],
    ['coverLevel', 'coverLevel', null],
    ['coverAcBonus', 'coverAcBonus', 0],
    ['coverReason', 'coverReason', null],
    ['resistanceNotice', 'resistanceNotice', null],
    ['forcedMode', 'forcedMode', null],
    ['isAutoCrit', 'isAutoCrit', false],
    ['autoReroll', 'autoReroll', null],
    ['autoRerollBonus', 'autoRerollBonus', null],
    ['defensiveDuelistBonus', 'defensiveDuelistBonus', 0],
    ['baitAndSwitchBonus', 'baitAndSwitchBonus', 0],
    ['statusEffects', 'statusEffects', null],
];

function buildDefaultedContextFields(context) {
    const fields = {};
    for (const [recordKey, contextKey, fallback] of LAST_ATTACK_CONTEXT_DEFAULTS) {
        fields[recordKey] = context?.[contextKey] || fallback;
    }
    return fields;
}

function resolveWeaponType(isMelee, damageType) {
    if (isMelee != null) return isMelee ? 'melee' : 'ranged';
    return damageType === 'ranged' ? 'ranged' : 'melee';
}

function storeCampaignLastAttack({ characterName, campaignName, context, targetName, effectiveD20, effectiveD20Roll, r1, r2, finalHit, finalAutoMiss, isCrit, targetAc, effectiveAc, homingStrikesUsed, homingStrikesBonus, homingStrikesAttempted }) {
    const { name, rollType, effectiveBonus, isMelee, damageType, isUnarmedStrike, affectedTargets, isPsychicBlade } = context || {};
    setRuntimeValue('campaign', 'lastAttack', {
        attackerName: characterName,
        targetName,
        d20: effectiveD20,
        d20Rolls: [r1, r2],
        bonus: effectiveBonus,
        total: effectiveD20 + effectiveBonus,
        targetAc,
        effectiveAc,
        hit: finalHit,
        isCrit,
        weaponType: resolveWeaponType(isMelee, damageType),
        isUnarmedStrike: isUnarmedStrike || false,
        isAutoMiss: finalAutoMiss,
        isNatural20: effectiveD20Roll === 20,
        isNatural1: effectiveD20Roll === 1,
        attackName: name,
        rollType,
        ...buildDefaultedContextFields(context),
        affectedTargets: affectedTargets || [targetName],
        // CLA-320: machine-readable Homing Strikes evidence + Psychic
        // Blade trigger stamp so the manual Reactions row can enforce
        // its trigger and refuse an already-resolved miss.
        isPsychicBlade: isPsychicBlade === true,
        homingStrikesAttempted: !!homingStrikesAttempted,
        homingStrikesUsed: !!homingStrikesUsed,
        homingStrikesBonus: homingStrikesUsed ? homingStrikesBonus : null,
    }, campaignName);
}

function clearRiposteDieOnMiss({ finalHit, characterName, targetName, campaignName }) {
    if (finalHit !== false) return;
    const pendingRiposteDie = getRuntimeValue(characterName, 'pendingRiposteDieValue', campaignName);
    if (!(pendingRiposteDie != null && Number(pendingRiposteDie) > 0)) return;
    setRuntimeValue(characterName, 'pendingRiposteDieValue', null, campaignName);
    addEntry(campaignName, {
        type: 'ability_use',
        characterName,
        abilityName: 'Riposte',
        description: `${characterName}'s Riposte attack against ${targetName || 'unknown target'} missed — Superiority Die expended, no damage dealt.`,
        targetName: targetName || null,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[MN-017 Riposte] Error logging miss:', e); });
}

function storeRollContextAndSuperiorityPrompt({ characterName, campaignName, context, targetName, effectiveD20, bonus, hit, finalHit, isCrit }) {
    const { name, autoDamageFormula, damageType, saveDc, saveType, isUnarmedStrike } = context || {};
    setRuntimeValue(characterName, '_lastRollContext', {
        type: 'attack',
        attackName: name,
        damageFormula: autoDamageFormula || null,
        damageType: damageType || null,
        targetName,
        oldTotal: effectiveD20 + bonus,
        oldHit: hit,
        timestamp: Date.now(),
    }, campaignName);

    setRuntimeValue(characterName, 'pendingCombatSuperiorityPrompt', {
        rollType: 'attack',
        attackContext: {
            hit: finalHit,
            isCrit: isCrit,
            weaponType: damageType === 'ranged' ? 'ranged' : 'melee',
            isUnarmedStrike: isUnarmedStrike || false,
            targetName: targetName,
            saveDc: saveDc || null,
            saveType: saveType || null,
            timestamp: Date.now(),
        },
        timestamp: Date.now(),
    }, campaignName);
}

function consumeOneShotAdvantage({ characterName, campaignName, finalAutoMiss }) {
    if (finalAutoMiss) return;
    const attackerEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const oneShotAdvantage = attackerEffects.filter(
        te => te.effect === 'next_attack_advantage' && te.target === characterName && !te.vexTarget
    );
    if (oneShotAdvantage.length === 0) return;
    const clearedEffects = attackerEffects.filter(
        te => !(te.effect === 'next_attack_advantage' && te.target === characterName && !te.vexTarget)
    );
    setRuntimeValue('campaign', 'targetEffects', clearedEffects, campaignName);
}

function grantMissAdvantageEffects({ finalHit, finalAutoMiss, targetName, context, characterName, campaignName }) {
    if (finalHit || finalAutoMiss || !targetName) return;
    const passives = context?.playerStats?.automation?.passives;
    if (!passives) return;
    const missEffects = passives.filter(
        p => p.type === 'auto_effect' && p.trigger === 'miss' && p.effect === 'next_attack_advantage'
    );
    if (missEffects.length === 0) return;
    const storedEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    for (const effect of missEffects) {
        const newEffect = {
            target: characterName,
            source: effect.name,
            effect: 'next_attack_advantage',
            vexTarget: targetName,
            duration: effect.duration || 'until_start_of_next_turn',
        };
        storedEffects.push(newEffect);
    }
    setRuntimeValue('campaign', 'targetEffects', storedEffects, campaignName);
    for (const effect of missEffects) {
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: characterName,
            abilityName: effect.name,
            description: `${characterName}'s ${effect.name} grants advantage on the next attack roll against ${targetName}`,
            targetName: targetName,
        }).catch((e) => { console.error("[attackPostProcessing:log-error]", e); });
    }
}

// Vex + distracting strike clearing — both read the same original snapshot and
// write independently (matches original behavior).
function clearHitConsumedEffects({ targetName, characterName, finalHit, campaignName }) {
    if (!targetName || !finalHit) return;
    const allEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    // Vex clearing
    const vexEffects = allEffects.filter(te => te.effect === 'next_attack_advantage' && te.target === characterName && te.vexTarget === targetName);
    if (vexEffects.length > 0) {
        const clearedEffects = allEffects.filter(te => !(te.effect === 'next_attack_advantage' && te.target === characterName && te.vexTarget === targetName));
        setRuntimeValue('campaign', 'targetEffects', clearedEffects, campaignName);
    }
    // Distracting strike clearing
    const distractingEffects = allEffects.filter(te => te.effect === 'distracting_strike_advantage' && te.target === targetName && te.source !== characterName);
    if (distractingEffects.length > 0) {
        const clearedEffects = allEffects.filter(te => !(te.effect === 'distracting_strike_advantage' && te.target === targetName && te.source !== characterName));
        setRuntimeValue('campaign', 'targetEffects', clearedEffects, campaignName);
    }
}

function clearSapDisadvantage({ targetName, characterName, campaignName }) {
    if (!targetName) return;
    const freshestEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const sapEffects = freshestEffects.filter(te => te.effect === 'disadvantage_next_attack' && te.target === characterName);
    if (sapEffects.length === 0) return;
    const clearedEffects = freshestEffects.filter(te => !(te.effect === 'disadvantage_next_attack' && te.target === characterName));
    setRuntimeValue('campaign', 'targetEffects', clearedEffects, campaignName);
}

async function processGrazeDamage(context, targetName, characterName, campaignName, characters, logEntry, setPopupHtml) {
    const grazeAbilityMod = context?.grazeAbilityMod || 0;
    const grazeDamageAmount = Math.max(0, grazeAbilityMod);
    if (grazeDamageAmount > 0) {
        const grazeDamageType = context?.damageType || 'Slashing';
        const grazeFormula = `${grazeDamageAmount} [Graze]`;
        const combatSummary2 = await loadCombatSummary(campaignName);
        const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, grazeDamageType)) || false;
        const applyResult = await applyDamageToTarget(combatSummary2, targetName, grazeDamageAmount, [grazeDamageType], campaignName, characters, ignoreResistance, characterName);
        const grazeTargetMaxHp = context._target?.type === 'player'
            ? (getRuntimeValue(targetName, 'hitPoints') ?? 0)
            : context._target?.maxHp ?? 0;
        logEntry({
            type: 'roll',
            characterName,
            rollType: 'graze-damage',
            name: context.name,
            formula: grazeFormula,
            rolls: [grazeDamageAmount],
            total: grazeDamageAmount,
            modifier: 0,
            damageType: grazeDamageType,
            targetName: targetName,
            finalDamage: applyResult?.finalDamage,
            note: 'Graze: ability modifier damage on miss',
        });
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: characterName,
            abilityName: 'Graze',
            description: `${characterName} used Graze on ${context.name} against ${targetName}`,
            targetName: targetName,
        }).catch((e) => { console.error("[attackPostProcessing:log-error]", e); });
        setPopupHtml({
            type: 'graze-damage',
            name: `${context.name} (Graze)`,
            formula: grazeFormula,
            rolls: [grazeDamageAmount],
            bonus: 0,
            modifier: 0,
            damageType: grazeDamageType,
            targetName: targetName,
            total: grazeDamageAmount,
            targetCurrentHp: applyResult?.newHp,
            targetMaxHp: grazeTargetMaxHp,
            damageApplied: true,
            finalDamage: applyResult?.finalDamage,
            damageReduced: applyResult?.damageReduced,
        });
    }
}

export async function processPotentCantrip(hit, isAutoMiss, targetName, characterName, campaignName, context, combatSummary, characters, logEntry, setPopupHtml) {
    const potentPlayerStats = context?.playerStats;
    const hasPotentCantripFlag = hasPotentCantrip(potentPlayerStats);
    if (!hasPotentCantripFlag) return;
    if (!context?.autoDamageFormula) return;
    if (hit) return;

    const potentFormula = context.autoDamageFormula;
    const storedDamageResult = context?.autoDamageRollResult;

    if (!isAutoMiss) {
        await processPotentCantripMissDamage(potentFormula, storedDamageResult, hit, isAutoMiss, targetName, characterName, campaignName, context, combatSummary, characters, logEntry, setPopupHtml, 'miss');
    } else if (context?.saveDc) {
        await processPotentCantripMissDamage(potentFormula, storedDamageResult, hit, isAutoMiss, targetName, characterName, campaignName, context, combatSummary, characters, logEntry, setPopupHtml, 'autoMiss');
    }
}

function buildPotentMissFormula(potentFormula, potentPlayerStats, context) {
    const hasEmpoweredEvoc = getEmpoweredEvocationFeatures(potentPlayerStats).length > 0;
    const empEvocIntMod = hasEmpoweredEvoc ? getEmpoweredEvocationIntModifier(potentPlayerStats) : 0;
    const spellSchool = (context?.autoDamageSchool || '').toLowerCase();
    const isEvocation = spellSchool === 'evocation';
    const shouldApplyEmpoweredEvoc = hasEmpoweredEvoc && isEvocation && empEvocIntMod > 0;
    return shouldApplyEmpoweredEvoc ? `${potentFormula} + ${empEvocIntMod} [Empowered Evocation]` : potentFormula;
}

// Returns { aborted } when a fresh roll fails — preserves the original
// early-return before any logging/damage application.
function resolvePotentMissTotal(storedDamageResult, missType, finalFormula, context) {
    if (storedDamageResult && missType === 'miss') {
        return { damageResult: undefined, adjustedTotal: applyMinDamageAdjustment(storedDamageResult.total, storedDamageResult.rolls, context?.playerStats, context?.damageType) };
    }
    const damageResult = rollExpression(finalFormula);
    if (!damageResult) return { aborted: true };
    return { damageResult, adjustedTotal: applyMinDamageAdjustment(damageResult.total, damageResult.rolls, context?.playerStats, context?.damageType) };
}

function buildPotentMissLogData({ characterName, context, targetName, finalFormula, damageResult, storedDamageResult, halfDamage }) {
    return {
        type: 'roll',
        characterName,
        rollType: 'cantrip-miss-half-damage',
        name: context.name,
        formula: finalFormula,
        rolls: damageResult?.rolls || storedDamageResult?.rolls || [],
        total: halfDamage,
        modifier: damageResult?.modifier ?? storedDamageResult?.modifier ?? 0,
        damageType: context?.damageType,
        targetName: targetName,
        isPotentCantrip: true,
    };
}

function buildPotentMissPopupData({ context, targetName, finalFormula, damageResult, storedDamageResult, applyResult, missTargetMaxHp }) {
    return {
        type: 'save-damage',
        name: context.name,
        formula: finalFormula,
        rolls: damageResult?.rolls || storedDamageResult?.rolls || [],
        total: applyResult?.finalDamage,
        bonus: damageResult?.modifier ?? storedDamageResult?.modifier ?? 0,
        modifier: damageResult?.modifier ?? storedDamageResult?.modifier ?? 0,
        damageType: context?.damageType,
        targetName: targetName,
        targetCurrentHp: applyResult?.newHp,
        targetMaxHp: missTargetMaxHp,
        saveDc: context?.saveDc,
        saveType: context?.saveType,
        dcSuccess: 'half',
        finalDamage: applyResult?.finalDamage,
        damageApplied: true,
        damageReduced: applyResult?.damageReduced,
        isPotentCantrip: true,
    };
}

async function processPotentCantripMissDamage(potentFormula, storedDamageResult, hit, isAutoMiss, targetName, characterName, campaignName, context, combatSummary, characters, logEntry, setPopupHtml, missType) {
    const potentPlayerStats = context?.playerStats;
    const finalFormula = buildPotentMissFormula(potentFormula, potentPlayerStats, context);

    const { damageResult, adjustedTotal, aborted } = resolvePotentMissTotal(storedDamageResult, missType, finalFormula, context);
    if (aborted) return;

    const halfDamage = Math.floor(adjustedTotal / 2);
    const combatSummary2 = await loadCombatSummary(campaignName);
    const ignoreResistance = (context?.playerStats && hasIgnoreResistance(context.playerStats, context?.damageType)) || false;
    const applyResult = await applyDamageToTarget(combatSummary2, targetName, halfDamage, [context?.damageType], campaignName, characters, ignoreResistance, context.attackerName || characterName);
    const missTargetMaxHp = context._target?.type === 'player'
        ? (getRuntimeValue(targetName, 'hitPoints') ?? 0)
        : context._target?.maxHp ?? 0;

    logEntry(buildPotentMissLogData({ characterName, context, targetName, finalFormula, damageResult, storedDamageResult, halfDamage }));

    setPopupHtml(buildPotentMissPopupData({ context, targetName, finalFormula, damageResult, storedDamageResult, applyResult, missTargetMaxHp }));
}
