import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { hasBardicInspirationOffense, getBardicInspirationDieSize, getBardicInspirationDieSizeFromClass } from '../../services/combat/auras/bardicInspirationState.js';
import { hasEmpoweredSpell } from '../../services/rules/spells/empoweredSpellService.js';
import { getChaModifier } from '../../services/rules/spells/metamagicRules.js';
import { addEntry } from '../../services/ui/logService.js';
import {
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    getSlowAcPenalty,
    getWardingBondAcBonus,
} from './loggedDiceRollUtils.js';
import { isResilientSphereActive } from '../../services/combat/automation/automationPassives.js';
import { endSanctuary } from '../../services/automation/handlers/spells/sanctuaryHandler.js';
import { getManeuversForRules } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { getKnownManeuvers } from './battleMaster.js';

// Re-export standalone helpers
export { hasStarryDragonActive, starryDragonAppliesToRoll } from './starryDragon.js';
export { getKnownManeuvers, getSuperiorityDice } from './battleMaster.js';

// Import extracted modules
import { checkAttackBlockers } from './attackBlockers.js';
import { handleSanctuarySave } from './sanctuarySave.js';
import { computeD20Roll } from './d20RollComputation.js';
import { resolveTarget } from './targetResolution.js';
import { resolveHit } from './hitResolution.js';
import { computeTargetAc } from './targetAcComputation.js';
import { processAttackAfterResult, processPotentCantrip } from './attackPostProcessing.js';
import { processSaveRoll } from './saveProcessing.js';
import { processInitiativeRoll } from './initiativeProcessing.js';
import { consumeFeatsOfChaos } from './globalFeats.js';
import { consumeArmedRestoreBalance } from '../../services/combat/restoreBalanceState.js';

// Sanctuary / blocker pre-phase for attack rolls. Returns true when the roll
// must be aborted (blocked attacker or unresolved sanctuary save).
async function runAttackPrePhase({ attackerName, targetName, campaignName, setPopupHtml, logEntry }) {
    // Sanctuary: ends when the warded creature makes an attack
    const attackerSanctuary = (getRuntimeValue('campaign', 'targetEffects') || []).find(
        te => te.effect === 'sanctuary' && te.target === attackerName
    );
    if (attackerSanctuary) {
        endSanctuary(attackerSanctuary.source, attackerName, campaignName,
            `${attackerName} made an attack, ending Sanctuary.`);
    }

    if (attackerName && targetName && checkAttackBlockers(attackerName, targetName, campaignName, setPopupHtml, addEntry)) {
        return true;
    }

    // Sanctuary: if target is warded, attacker must succeed on WIS save before attack roll
    if (attackerName && targetName) {
        const proceed = await handleSanctuarySave(attackerName, targetName, campaignName, setPopupHtml, logEntry);
        if (!proceed) return true;
    }
    return false;
}

function logLuckyReroll(characterName, campaignName, name, rollType, ctx) {
    if (!ctx.luckyRerolled) return;
    addEntry(campaignName, {
        type: 'ability_use',
        characterName,
        abilityName: 'Lucky (Halfling)',
        description: `${characterName} used Lucky (Halfling trait): rerolled natural 1 on ${name} ${rollType} → ${ctx.luckyRerollValue}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[Lucky] Log error:', e); });
}

function logIndomitableMight(characterName, campaignName, name, rollType, bonus, context, ctx) {
    const strReplaceApplied = (context?.strSaveReplace && rollType === 'save') || (context?.strCheckReplace && (rollType === 'check' || rollType === 'skill'));
    const originalTotal = ctx.effectiveD20Roll + bonus + ctx.cosmicOmenAppliedBonus + ctx.sunderingBlowBonus;
    if (!(strReplaceApplied && originalTotal < (context?.strScore || 10))) return;
    addEntry(campaignName, {
        type: 'ability_use',
        characterName,
        abilityName: 'Indomitable Might',
        description: `${characterName} used Indomitable Might on ${name} ${rollType}: d20 ${ctx.effectiveD20Roll} + ${bonus} = ${originalTotal} → replaced by Strength ${context?.strScore}`,
        timestamp: Date.now(),
    }).catch((e) => { console.error('[Indomitable Might] Log error:', e); });
}

function buildRollLogEntry({ characterName, rollType, name, ctx, context, target, targetAc }) {
    return {
        type: 'roll',
        characterName,
        rollType,
        name,
        rolls: [ctx.r1, ctx.r2],
        mode: ctx.forcedMode || 'normal',
        total: ctx.effectiveD20Roll,
        bonus: ctx.effectiveBonus,
        bonusDetail: ctx.finalBonusDetail,
        baneRoll: ctx.baneAttackRoll,
        baneDisplayLabel: ctx.baneDisplayLabel,
        blessRoll: ctx.blessAttackRoll,
        isNatural20: ctx.effectiveD20Roll === 20,
        isNatural1: ctx.effectiveD20Roll === 1,
        targetName: (rollType === 'attack' || rollType === 'save') ? (target?.name || context?.targetName) : undefined,
        targetAc,
        effectiveAc: ctx.effectiveAc,
        shieldAcBonus: ctx._shieldAcBonus || 0,
        shieldOfFaithAcBonus: ctx._shieldOfFaithAcBonus || 0,
        wardingBondAcBonus: ctx._wardingBondAcBonus || 0,
        slowAcPenalty: ctx._slowAcPenalty || 0,
        damageType: context?.damageType,
        hit: ctx.hit,
        isAutoMiss: ctx.isAutoMiss,
        isCrit: ctx.isCrit,
        rangeReason: context?.rangeReason,
        resistanceNotice: context?.resistanceNotice,
        hunterLoreNotice: context?.hunterLoreNotice,
        coverLevel: context?.coverLevel,
        coverAcBonus: context?.coverAcBonus,
        coverReason: context?.coverReason,
        advantageReason: context?.advantageReason,
    };
}

function buildAutoDamage({ context, name, characterName, ctx, autoDamageSourceRef, targetName }) {
    if (!context?.autoDamageFormula) return undefined;
    return {
        name: context.autoDamageName || name,
        formula: context.autoDamageFormula,
        autoDamageSchool: context.autoDamageSchool,
        damageType: context.damageType,
        damageTypeChoices: context.damageTypeChoices,
        targetName: targetName,
        attackerName: context.attackerName || characterName,
        saveDc: context.saveDc,
        saveType: context.saveType,
        dcSuccess: context.dcSuccess,
        metamagicTwinTarget: context.metamagicTwinTarget,
        metamagicHeighten: context.metamagicHeighten,
        isCantrip: context.isCantrip,
        overchannelActive: context.overchannelActive,
        overchannelUseCount: context.overchannelUseCount,
        overchannelSpellLevel: context.overchannelSpellLevel,
        secondaryFormula: context.autoDamageSecondaryFormula,
        secondaryDamageType: context.autoDamageSecondaryDamageType,
        ripostePopup: context.ripostePopup,
        source: autoDamageSourceRef?.current || characterName,
        isAutoCrit: ctx.isCrit,
        sneakAttackDice: context?.sneakAttackDice || 0,
        d20Roll: ctx.effectiveD20Roll,
    };
}

function buildRerollAndReplacementFlags(context) {
    return {
        autoReroll: context?.autoReroll,
        autoRerollBonus: context?.autoRerollBonus,
        autoRerollCondition: context?.autoRerollCondition,
        autoRerollForAttack: context?.autoRerollForAttack || context?.boonOfCombatProwess,
        strSaveReplace: context?.strSaveReplace,
        strScore: context?.strScore,
        strCheckReplace: context?.strCheckReplace,
        reliableTalent: context?.reliableTalent,
        wisCheckReplace: context?.wisCheckReplace,
        wisCheckMinBonus: context?.wisCheckMinBonus,
        defensiveDuelistBonus: context?.defensiveDuelistBonus || 0,
        baitAndSwitchBonus: context?.baitAndSwitchBonus || 0,
        d20Floor10: context?.d20Floor10,
    };
}

const LUCK_INSPIRATION_PASSTHROUGH_KEYS = [
    'tacticalMind', 'tacticalMindBonus', 'darkOnesLuck', 'strokeOfLuck',
    'psiBolsteredKnack', 'psiBolsteredKnackDieSize', 'bardicInspiration', 'bardicInspirationDie',
];

function buildLuckInspirationEmpoweredFlags(context, ctx, characterName, campaignName) {
    const stats = context?.playerStats;
    const flags = {};
    for (const key of LUCK_INSPIRATION_PASSTHROUGH_KEYS) {
        flags[key] = context?.[key];
    }
    flags.bardicInspirationDefense = ctx.bardicInspirationDefense;
    flags.bardicInspirationDefenseDieSize = ctx.bardicInspirationDefenseDieSize;
    flags.bardicInspirationDefenseTargetName = ctx.bardicInspirationDefenseTargetName;
    flags.bardicInspirationOffense = context?.bardicInspirationOffense || (stats ? hasBardicInspirationOffense(stats, campaignName) : false);
    flags.bardicInspirationOffenseDieSize = context?.bardicInspirationOffenseDieSize || getBardicInspirationDieSize(characterName, campaignName) || (stats ? getBardicInspirationDieSizeFromClass(stats) : null);
    flags.empoweredSpell = context?.empoweredSpell || (stats ? hasEmpoweredSpell(stats) : false);
    flags.empoweredSpellChaMod = context?.empoweredSpellChaMod || getChaModifier(stats);
    return flags;
}

function buildAttackFeatureFlags({ ctx, context, characterName, campaignName }) {
    return {
        ...buildRerollAndReplacementFlags(context),
        starryDragonFloor: ctx.starryDragonFloor,
        ...buildLuckInspirationEmpoweredFlags(context, ctx, characterName, campaignName),
    };
}

function buildPopupData({ ctx, context, name, rollType, targetAc, targetName, characterName, campaignName, autoDamage, availableSuperiorityManeuvers }) {
    return {
        type: 'd20',
        rollType,
        name,
        rolls: ctx.luckyRerolled ? [ctx.luckyRerollValue] : [ctx.r1, ctx.r2],
        bonus: ctx.effectiveBonus,
        bonusDetail: ctx.finalBonusDetail,
        baneRoll: ctx.baneAttackRoll,
        baneDisplayLabel: ctx.baneDisplayLabel,
        blessRoll: ctx.blessAttackRoll,
        targetName,
        targetAc,
        effectiveAc: ctx.effectiveAc,
        shieldAcBonus: ctx._shieldAcBonus || 0,
        shieldOfFaithAcBonus: ctx._shieldOfFaithAcBonus || 0,
        wardingBondAcBonus: ctx._wardingBondAcBonus || 0,
        slowAcPenalty: ctx._slowAcPenalty || 0,
        hit: ctx.hit,
        isAutoMiss: ctx.isAutoMiss,
        rangeReason: context?.rangeReason,
        resistanceNotice: context?.resistanceNotice,
        hunterLoreNotice: context?.hunterLoreNotice,
        coverLevel: context?.coverLevel,
        coverAcBonus: context?.coverAcBonus,
        coverReason: context?.coverReason,
        forcedMode: ctx.forcedMode,
        advantageReason: context?.advantageReason,
        isAutoCrit: context?.isAutoCrit,
        isCrit: ctx.isCrit,
        isNatural20: ctx.effectiveD20Roll === 20,
        isNatural1: ctx.effectiveD20Roll === 1,
        autoDamage,
        ...buildAttackFeatureFlags({ ctx, context, characterName, campaignName }),
        cosmicOmenAppliedBonus: ctx.cosmicOmenAppliedBonus,
        cosmicOmenDetail: ctx.cosmicOmenDetail,
        pendingSkillCheckAppliedBonus: ctx.pendingSkillCheckAppliedBonus,
        pendingSkillCheckDetail: ctx.pendingSkillCheckDetail,
        luckyRerolled: ctx.luckyRerolled,
        luckyRerollValue: ctx.luckyRerollValue,
        unerringStrikeApplied: ctx.unerringStrikeApplied,
        homingStrikesUsed: ctx.homingStrikesUsed === true,
        homingStrikesBonus: ctx.homingStrikesBonus || 0,
        characterName,
        campaignName,
        availableSuperiorityManeuvers,
    };
}

function storeCheckResults({ characterName, campaignName, ctx, context, name, rollType, bonus, targetName, combatSummary }) {
    const effectiveD20 = (context?.d20Floor10 && ctx.r1 <= 9) ? 10 : ctx.r1;
    const reliableD20 = context?.reliableTalent && effectiveD20 <= 9 ? 10 : effectiveD20;
    setRuntimeValue(characterName, 'lastAbilityCheck', {
        d20: reliableD20,
        bonus,
        checkName: name,
        targetName,
        timestamp: Date.now(),
    }, campaignName);

    if (combatSummary) {
        setRuntimeValue('campaign', 'lastAttack', {
            attackerName: characterName,
            targetName,
            d20: reliableD20,
            d20Rolls: [ctx.r1, ctx.r2],
            bonus,
            total: reliableD20 + bonus,
            checkName: name,
            rollType,
            timestamp: Date.now(),
        }, campaignName);
    }

    setRuntimeValue(characterName, '_lastRollContext', {
        type: 'check',
        checkName: name,
        oldTotal: reliableD20 + bonus,
        timestamp: Date.now(),
    }, campaignName);
}

// Restore Balance (CLA-295): an armed holder within 60 ft who can see the
// roller cancels this roll's Advantage/Disadvantage to a normal d20.
async function maybeCancelForcedMode({ ctx, rollType, characterName, campaignName, combatSummary, name }) {
    if (!(ctx.forcedMode === 'advantage' || ctx.forcedMode === 'disadvantage')) return;
    const rollerName = rollType === 'attack' ? (ctx.attackerName || characterName) : characterName;
    const cancelledBy = await consumeArmedRestoreBalance(campaignName, combatSummary, rollerName, name, rollType);
    if (cancelledBy) {
        ctx.forcedMode = 'normal';
    }
}

// Bi die size for bardic inspiration defense (attack-only)
function resolveBiDieSize(rollType, target, campaignName, characters) {
    if (!(rollType === 'attack' && target)) return null;
    return getBardicInspirationDieSize(target.name, campaignName) || getBardicInspirationDieSizeFromClass(characters.find(c => c.name === target.name)?.computedStats);
}

// Propagate context mutations back to original context object
function propagateContextMutations(ctx, context) {
    const contextKeys = ['notice', 'bardicInspirationDefense', 'bardicInspirationDefenseDieSize', 'bardicInspirationDefenseTargetName', 'bardicInspirationDefenseAttackRoll', 'bardicInspirationDefenseBonus', 'bardicInspirationDefenseEffectiveAc', 'forcedMode'];
    for (const key of contextKeys) {
        if (ctx[key] !== undefined) {
            context[key] = ctx[key];
        }
    }
    if (ctx._duelPopup) {
        context._duelPopup = ctx._duelPopup;
    }
}

function resolvePopupTargetName(rollType, target, context) {
    return (rollType === 'attack' || rollType === 'save') ? (target?.name || context?.targetName) : undefined;
}

function warnIfSaveMissingAttacker({ rollType, context, characterName, targetName, name }) {
    if (rollType === 'save' && !context?.attackerName && context?.saveDc) {
        console.error('[useLoggedDiceRollAttack] Save roll missing context.attackerName:', { characterName, targetName, name, context });
    }
}

// Player saves are resolved via the save-prompt seam — popup is set by the
// save-result handler instead.
function shouldSkipSavePopup(rollType, target, context) {
    return rollType === 'save' && target?.type === 'player' && context?.saveDc != null;
}

// Roll-type tail processing (check/skill storage, save resolution, initiative).
async function processRollTypeTail({ rollType, target, targetName, combatSummary, characterName, campaignName, ctx, bonus, logEntry, setPopupHtml, availableSuperiorityManeuvers }) {
    if (rollType === 'check' || rollType === 'skill') {
        storeCheckResults({ characterName, campaignName, ctx, context: ctx, name: ctx.name, rollType, bonus, targetName, combatSummary });
    }

    if (rollType === 'save') {
        await processSaveRoll({ rollType, target, characterName, campaignName, context: ctx, bonus, r1: ctx.r1, r2: ctx.r2, logEntry, setPopupHtml });
    }

    if (rollType === 'initiative') {
        await processInitiativeRoll({ characterName, campaignName, context: ctx, bonus, effectiveD20Roll: ctx.effectiveD20Roll, r1: ctx.r1, r2: ctx.r2, setPopupHtml, availableSuperiorityManeuvers, cosmicOmenAppliedBonus: ctx.cosmicOmenAppliedBonus, characters: ctx._characters });
    }
}

export function createLogAndShow(deps) {
    const { characterName, campaignName, characters, setPopupHtml, logEntry, autoDamageSourceRef } = deps;

    return async function logAndShow(name, bonus, rollType, context) {
        context = context || {};
        const ctx = { ...context, name, rollType };

        if (rollType === 'attack') {
            const attackerName = ctx.attackerName || characterName;
            const blocked = await runAttackPrePhase({ attackerName, targetName: ctx.targetName, campaignName, setPopupHtml, logEntry });
            if (blocked) return;
        }

        // Load combat summary early (needed for maneuver loading, target resolution)
        const combatSummary = await loadCombatSummary(campaignName);

        // Resolve target (needed for compelled duel forcedMode before d20 resolution)
        const { target, availableSuperiorityManeuvers } = await resolveTarget(characterName, campaignName, ctx, combatSummary, characters, getKnownManeuvers);
        ctx._target = target;

        // Show compelled duel popup if target resolution set one
        if (ctx._duelPopup) {
            setPopupHtml(ctx._duelPopup);
        }

        await maybeCancelForcedMode({ ctx, rollType, characterName, campaignName, combatSummary, name });

        // Compute d20 roll with all modifiers
        const d20Result = computeD20Roll(characterName, campaignName, name, rollType, ctx, bonus, isResilientSphereActive);
        Object.assign(ctx, d20Result);
        ctx.effectiveD20 = d20Result.effectiveD20;

        // Pre-load maneuver cache for skill check / initiative superiority buttons
        if (rollType === 'check' || rollType === 'skill' || rollType === 'initiative') {
            await getManeuversForRules('2024');
        }

        // AC computation (attack-only)
        const targetAc = computeTargetAc(ctx, target, characters);

        ctx._shieldAcBonus = getShieldAcBonus(target?.name, campaignName);
        ctx._shieldOfFaithAcBonus = getShieldOfFaithAcBonus(target?.name, campaignName);
        ctx._wardingBondAcBonus = getWardingBondAcBonus(target?.name, campaignName);
        ctx._slowAcPenalty = getSlowAcPenalty(target?.name, campaignName);

        // Bi die size for bardic inspiration defense (attack-only)
        ctx._biDieSize = resolveBiDieSize(rollType, target, campaignName, characters);

        // _characters for save processing
        ctx._characters = characters;

        // Save saveDc/saveType for save processing
        ctx._saveDc = context?.saveDc;
        ctx._saveType = context?.saveType;

        // Resolve hit (unbreakable majesty, bardic inspiration, veer, soul blades, crit, death strike) — attack-only
        let resolveResult = { hit: undefined, isAutoMiss: false, isCrit: false, unerringStrikeApplied: false, homingStrikesUsed: false, homingStrikesBonus: 0, targetAc, effectiveAc: undefined, effectiveD20Roll: ctx.effectiveD20Roll };
        if (rollType === 'attack') {
            ctx.bonus = bonus;
            resolveResult = await resolveHit({ characterName, campaignName, context: ctx, bonus, effectiveD20Roll: ctx.effectiveD20Roll, target, combatSummary, characters, logEntry });
            Object.assign(ctx, resolveResult);
        }

        // Propagate context mutations back to original context object
        propagateContextMutations(ctx, context);

        // Log Lucky reroll to campaign log
        logLuckyReroll(characterName, campaignName, name, rollType, ctx);

        // Log Indomitable Might to campaign log
        logIndomitableMight(characterName, campaignName, name, rollType, bonus, context, ctx);

        logEntry(buildRollLogEntry({ characterName, rollType, name, ctx, context, target, targetAc }));

        const targetName = resolvePopupTargetName(rollType, target, context);

        warnIfSaveMissingAttacker({ rollType, context, characterName, targetName, name });

        const autoDamage = buildAutoDamage({ context, name, characterName, ctx, autoDamageSourceRef, targetName });

        const shouldSkipPopup = shouldSkipSavePopup(rollType, target, context);
        if (!shouldSkipPopup) {
            setPopupHtml(buildPopupData({ ctx, context, name, rollType, targetAc, targetName, characterName, campaignName, autoDamage, availableSuperiorityManeuvers }));

            const luckyActive = getRuntimeValue(characterName, 'luckyAdvantageActive');
            if (luckyActive) {
                await setRuntimeValue(characterName, 'luckyAdvantageActive', null, campaignName);
            }
        }

        // Process attack post-results (lastAttack storage, graze, potent cantrip, vex clearing)
        await processAttackAfterResult({ hit: ctx.hit, isAutoMiss: ctx.isAutoMiss, targetName, characterName, campaignName, context: ctx, combatSummary, characters, logEntry, setPopupHtml, state: ctx });

        // Potent cantrip half-damage on miss
        await processPotentCantrip({ hit: ctx.hit, isAutoMiss: ctx.isAutoMiss, targetName, characterName, campaignName, context: ctx, characters, logEntry, setPopupHtml });

        await processRollTypeTail({ rollType, target, targetName, combatSummary, characterName, campaignName, ctx, bonus, logEntry, setPopupHtml, availableSuperiorityManeuvers });

        // Consume Feats of Chaos after one d20 roll
        consumeFeatsOfChaos(characterName, campaignName);
    };
}
