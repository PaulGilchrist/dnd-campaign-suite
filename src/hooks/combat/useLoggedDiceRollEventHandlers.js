import { addExpiration } from '../../services/rules/effects/expirations.js';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import {
  computeDamageAfterEvasion,
  applyDamageToTarget,
  normalizeSaveType,
} from '../../services/rules/combat/applyDamage.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { stripSummonedFromCombatSummary } from '../../services/combat/summons/summonedCreatureService.js';
import { resolveCreatureType } from '../../services/combat/creatureTypeResolver.js';
import { addEntry } from '../../services/ui/logService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { hasSoulstitchProtection } from './loggedDiceRollUtils.js';
import utils from '../../services/ui/utils.js';
import { getPendingPopupSetter } from '../../services/combat/auras/pendingPopupRegistry.js';
import { getPendingSavePrompt } from '../../services/combat/auras/pendingSaveRegistry.js';
import storage from '../../services/ui/storage.js';
import { isCircleOfPowerActive } from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { cleanupConcentrationEffects } from '../../services/combat/concentration/concentrationService.js';
import { isResilientSphereActive } from '../../services/combat/automation/automationPassives.js';
import { triggerViciousMockeryForGeneric } from '../../services/rules/features/viciousMockeryService.js';
import { getHpThreshold, assignSecondaryFields, buildDamageBreakdownEntry } from './handlers/damageHandlerUtils.js';

const SECONDARY_SUFFIXES = ['Name', 'Formula', 'Rolls', 'Total', 'Modifier', 'DamageType', 'FinalDamage'];

function syncListenerPromptFilters(detail, pending, campaignName) {
    const listenerPrompts = getRuntimeValue('campaign', 'pendingSaveListenerPrompts');
    const prompts = Array.isArray(listenerPrompts) ? listenerPrompts : [];
    const filteredPrompts = prompts.filter(id => id !== detail.promptId);
    if (filteredPrompts.length === prompts.length) return;
    // createSaveListener prompts are not in the pendingSaveRegistry — read campaignName from the runtime store.
    const pendingSavesStore = getRuntimeValue('campaign', 'pendingSavePrompts') || {};
    const saveCampaignName = pending?.campaignName || pendingSavesStore[detail.promptId]?.campaignName || campaignName;
    setRuntimeValue('campaign', 'pendingSaveListenerPrompts', filteredPrompts, saveCampaignName);
}

function determineEvasion({ detail, pending, targetChar, charactersRef, isIncapacitated, normalizedSaveType }) {
    const ownEvasion = targetChar?.computedStats?.evasionEffects;
    const hasOwnEvasion = !isIncapacitated && pending.dcSuccess === 'half' && ownEvasion?.some(ef => ef.saveType === normalizedSaveType);
    const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && pending.dcSuccess === 'half' &&
        (charactersRef.current || []).some(c => {
            if (c.name === detail.targetName) return false;
            const ev = c?.computedStats?.evasionEffects;
            return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
        });
    const hasEvasion = detail.evasionActive ?? (hasOwnEvasion || hasSharedEvasion || isCircleOfPowerActive(detail.targetName, pending.campaignName));
    return { hasEvasion, hasOwnEvasion };
}

function computeSecondaryRoll(pending) {
    if (!pending.autoDamageSecondaryFormula) return null;
    const secondaryFormula = pending.autoDamageSecondaryFormula;
    const secondaryName = pending.autoDamageSecondaryName || pending.name;
    const secondaryDamageType = pending.autoDamageSecondaryDamageType;
    const isAutoCrit = pending.isAutoCrit || false;
    const secondaryRollResult = isAutoCrit ? rollExpressionDoubled(secondaryFormula) : rollExpression(secondaryFormula);
    if (!secondaryRollResult) return null;
    return {
        formula: secondaryFormula,
        name: secondaryName,
        damageType: secondaryDamageType,
        total: secondaryRollResult.total,
        modifier: secondaryRollResult.modifier,
        rolls: secondaryRollResult.rolls,
        ignoreResistance: (pending.playerStats && hasIgnoreResistance(pending.playerStats, secondaryDamageType)) || false,
    };
}

async function applySecondaryDamage({ combatSummary, pendingTargetName, secondaryData, campaignName, charactersRef, attacker }) {
    const secondaryApplyResultData = await applyDamageToTarget(combatSummary, pendingTargetName, secondaryData.total, [secondaryData.damageType], campaignName, charactersRef.current, secondaryData.ignoreResistance, attacker, true, { skipConcentration: true });
    const secondaryFinalDamage = secondaryApplyResultData?.finalDamage ?? secondaryData.total;
    if (secondaryApplyResultData && secondaryApplyResultData.finalDamage > 0) {
        endInvisibilityOnHostileAction(attacker, campaignName);
    }
    return {
        name: secondaryData.name,
        formula: secondaryData.formula,
        rolls: secondaryData.rolls,
        total: secondaryData.total,
        modifier: secondaryData.modifier,
        damageType: secondaryData.damageType,
        finalDamage: secondaryFinalDamage,
        resistanceDetails: secondaryApplyResultData?.resistanceDetails || [],
    };
}

function applyFailedSaveStatusEffects({ detail, pending, combatSummary, charactersRef, characterName }) {
    const targetName = pending.targetName;
    const targetCreature = combatSummary?.creatures?.find(c => c.name === targetName);
    const targetCharacter = (charactersRef.current || []).find(c => utils.getName(c.name) === targetName);
    const targetStats = targetCharacter?.computedStats || targetCharacter;
    const effectsToExpire = [];
    for (const effect of pending.statusEffects) {
        const condKey = String(effect).toLowerCase();
        const attackerName = pending.attackerName || pending.sourceAttackerName || null;
        if (!attackerName) {
            console.error('[save-result-handler] Status effect missing attacker for', condKey, ':', { promptId: detail.promptId, pendingKeys: Object.keys(pending), characterName });
        }
        const attackerCreature = combatSummary?.creatures?.find(c => c.name === attackerName);
        if (targetStats && playerIsImmuneToCondition({
            conditionKey: condKey,
            playerStats: targetStats,
            getRuntimeValue: getRuntimeValue,
            campaignName: pending.campaignName,
            sourceCreatureType: resolveCreatureType(attackerCreature),
        })) {
            continue;
        }
        if (targetCreature) {
            const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
            const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
            setRuntimeValue(targetName, 'activeConditions', [...filtered, condKey], pending.campaignName);
            effectsToExpire.push({ type: 'condition', condition: condKey });
        }
    }
    if (effectsToExpire.length > 0) {
        addExpiration(characterName, targetName, effectsToExpire, pending.campaignName, 2);
    }
}

async function applyOverchannelSelfDamage({ pending, characterName, campaignName, charactersRef, logEntry }) {
    if (!pending.overchannelActive || !(pending.overchannelUseCount > 1)) return;
    const overchannelSpellLevel = pending.overchannelSpellLevel || 1;
    const dicePerLevel = 2 + (pending.overchannelUseCount - 1);
    const totalDice = dicePerLevel * overchannelSpellLevel;
    const necroticFormula = `${totalDice}d12`;
    const necroticResult = rollExpression(necroticFormula);
    if (!necroticResult) return;
    const casterCombatSummary = getCombatSummary(campaignName);
    const casterApplyResult = await applyDamageToTarget(casterCombatSummary, characterName, necroticResult.total, ['Necrotic'], campaignName, charactersRef.current, true, characterName);
    logEntry({
        type: 'roll',
        characterName,
        rollType: 'overchannel-damage',
        name: 'Overchannel',
        formula: necroticFormula,
        rolls: necroticResult.rolls,
        total: necroticResult.total,
        modifier: necroticResult.modifier,
        damageType: 'Necrotic',
        targetName: characterName,
        finalDamage: casterApplyResult?.finalDamage,
        note: 'Overchannel self-damage (ignores resistance/immunity)',
    });
}

async function triggerViciousMockeryOnFail({ detail, pending }) {
    if (detail.success || !pending.viciousMockerySpell) return;
    try {
        await triggerViciousMockeryForGeneric(
            pending.viciousMockerySpell,
            { spellSaveDc: detail.saveDc, targetName: pending.targetName },
            pending.playerStats,
            pending.campaignName,
            pending.viciousMockeryMapName
        );
    } catch (err) {
        console.error('[save-result-handler] Vicious Mockery trigger failed:', err);
    }
}

function buildSaveLastAttackData({ detail, pending, characterName, appliedDamage, finalDamage }) {
    return {
        attackerName: pending.attackerName || pending.sourceAttackerName || characterName,
        targetName: detail.targetName,
        d20: detail.roll,
        d20Rolls: detail.rawRolls || [detail.roll],
        bonus: detail.saveBonus,
        total: detail.total,
        rollType: 'attack',
        saveType: detail.saveType,
        saveDc: detail.saveDc,
        saveResult: detail.success ? 'success' : 'failure',
        damageFormula: pending.formula || null,
        attackName: pending.name || pending.sourceName || null,
        damageType: pending.damageType || null,
        rawDamage: pending.rawDamage || 0,
        primaryDamage: pending.rawDamage || 0,
        primaryDamageType: pending.damageType || null,
        actualDamage: appliedDamage || finalDamage,
        damageApplied: (appliedDamage || finalDamage) > 0,
        statusEffects: pending.statusEffects || null,
        affectedTargets: pending.statusEffects ? [detail.targetName] : undefined,
        timestamp: Date.now(),
    };
}

function buildSavePopupData({ detail, pending, applyResult, newHp, maxHp, appliedDamage, finalDamage, secondaryResult }) {
    const popupData = {
        type: 'save-damage',
        name: pending.name,
        formula: pending.formula,
        rolls: pending.rolls,
        total: appliedDamage || finalDamage,
        bonus: 0,
        modifier: pending.modifier,
        damageType: pending.damageType,
        targetName: detail.targetName,
        targetCurrentHp: applyResult?.newHp ?? newHp,
        targetMaxHp: maxHp,
        saveDc: detail.saveDc,
        saveType: detail.saveType,
        dcSuccess: detail.dcSuccess,
        saveResult: { roll: detail.roll, total: detail.total, bonus: detail.saveBonus, success: detail.success },
        finalDamage: appliedDamage || finalDamage,
        damageApplied: true,
        damageReduced: applyResult?.damageReduced,
    };
    if (applyResult?.interceptedFeature) {
        popupData.interceptedFeature = applyResult.interceptedFeature;
    }
    assignSecondaryFields(popupData, secondaryResult, SECONDARY_SUFFIXES);
    return popupData;
}

export function setupEventListeners(deps) {
    const { characterName, campaignName, logEntry, charactersRef } = deps;

    if (!window.__pendingResultHandlersInstalled) {
        window.__pendingResultHandlersInstalled = true;

        window.addEventListener('save-result', async (e) => {
            const detail = e.detail;
            const pending = getPendingSavePrompt(detail.promptId);
            syncListenerPromptFilters(detail, pending, campaignName);

            if (!pending) {
                // createSaveListener resolves its own save via its internal promise — nothing more to do here.
                return;
            }

            // Resilient Sphere — block save-based attacks when attacker or target is enclosed
            const rsAttackerSphere = pending.attackerName ? isResilientSphereActive(pending.attackerName, pending.campaignName) : false;
            const rsTargetSphere = pending.targetName ? isResilientSphereActive(pending.targetName, pending.campaignName) : false;
            if (rsAttackerSphere || rsTargetSphere) {
                return;
            }

            const normalizedSaveType = normalizeSaveType(detail.saveType || pending.saveType);
            const targetChar = (charactersRef.current || []).find(c => c.name === detail.targetName);
            const targetConditions = getRuntimeValue(detail.targetName, 'activeConditions', pending.campaignName) || [];
            const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');

            const isSoulstitchProtected = hasSoulstitchProtection(detail.targetName, characterName, pending.campaignName);

            const targetActiveBuffs = getRuntimeValue(detail.targetName, 'activeBuffs', pending.campaignName) || [];
            const isShieldActive = Array.isArray(targetActiveBuffs) && targetActiveBuffs.some(b => b.effect === 'shield');
            const isMagicMissile = pending.name && pending.name.toLowerCase() === 'magic missile';

            const { hasEvasion, hasOwnEvasion } = determineEvasion({ detail, pending, targetChar, charactersRef, isIncapacitated, normalizedSaveType });
            let finalDamage = isSoulstitchProtected || (isShieldActive && isMagicMissile) ? 0 : computeDamageAfterEvasion(
                detail.rawDamage ?? pending.rawDamage, detail.success, detail.dcSuccess, hasEvasion
            );

            if (hasEvasion) {
                const evasionName = hasOwnEvasion ? 'Evasion' : 'Leading Evasion';
                logEntry({
                    type: 'roll',
                    characterName: detail.targetName,
                    rollType: 'evasion',
                    name: evasionName,
                    targetName: detail.targetName,
                    saveType: normalizedSaveType,
                    saveDc: detail.saveDc,
                    saveResult: detail.success ? 'success' : 'failure',
                    dcSuccess: detail.dcSuccess,
                    timestamp: Date.now(),
                    id: utils.guid(),
                });
            }

            const pendingTargetName = pending.targetName;
            let targetMaxHp = 0;
            const combatSummary = getCombatSummary(campaignName);
            if (combatSummary) {
                const t = combatSummary.creatures.find(c => c.name === pendingTargetName);
                if (t) targetMaxHp = t.type === 'player' ? (getRuntimeValue(t.name, 'hitPoints') ?? 0) : t.maxHp;
            }
            const ignoreResistance = (pending.playerStats && hasIgnoreResistance(pending.playerStats, pending.damageType)) || false;
            const attacker = pending.attackerName || pending.sourceAttackerName || null;

            // Compute secondary damage info first (dice rolls only, no damage application)
            // so we can use the combined total for the concentration DC
            const secondaryData = computeSecondaryRoll(pending);

            // Apply primary damage with combined concentration total (if secondary exists).
            // CLA-324: carry spell-origin from the pending prompt flag.
            const isSpellDamage = pending.isSpellDamage === true;
            const applyResult = await applyDamageToTarget(combatSummary, pendingTargetName, finalDamage, [pending.damageType], pending.campaignName, charactersRef.current, ignoreResistance, attacker, true, secondaryData
                ? { concentrationTotalDamage: finalDamage + secondaryData.total, isSpellDamage }
                : { isSpellDamage });

            const isIntercepted = applyResult?.intercepted;
            const appliedDamage = isIntercepted ? (applyResult.damageDealt ?? 0) : (applyResult?.finalDamage ?? 0);

            if (appliedDamage > 0) {
                endInvisibilityOnHostileAction(attacker, pending.campaignName);
            }

            const secondaryResult = secondaryData
                ? await applySecondaryDamage({ combatSummary, pendingTargetName, secondaryData, campaignName: pending.campaignName, charactersRef, attacker })
                : null;
            const secondaryFinalDamage = secondaryResult ? secondaryResult.finalDamage : 0;

            const totalDamageDealt = appliedDamage + secondaryFinalDamage;
            const newHp = applyResult?.newHp ?? (combatSummary?.creatures?.find(c => c.name === pendingTargetName)?.currentHp ?? 0);
            const maxHp = targetMaxHp;
            const hpAfterDamage = isIntercepted ? 0 : newHp;
            const oldHp = isIntercepted ? applyResult.oldHp : (newHp + totalDamageDealt);
            const isUnconscious = hpAfterDamage <= 0;
            const threshold = getHpThreshold({ oldHp, newHp, maxHp, deadHp: hpAfterDamage });

            const damageBreakdown = [buildDamageBreakdownEntry(applyResult, pending.damageType, appliedDamage || finalDamage)];
            if (secondaryResult) {
                damageBreakdown.push(buildDamageBreakdownEntry(secondaryResult, secondaryResult.damageType, secondaryResult.finalDamage));
            }

            if (totalDamageDealt > 0) {
                const hpEntry = {
                    type: 'hp_change',
                    targetName: pendingTargetName,
                    delta: -(totalDamageDealt),
                    currentHp: hpAfterDamage,
                    maxHp,
                    isHealing: false,
                    isUnconscious: isUnconscious,
                    damageBreakdown,
                };
                if (threshold) hpEntry.threshold = threshold;
                addEntry(pending.campaignName, hpEntry).catch((e) => { console.error("[useLoggedDiceRollEventHandlers] Error:", e); });
            }

            if (pendingTargetName.startsWith('player-')) {
                setRuntimeValue(pendingTargetName, 'currentHitPoints', newHp, pending.campaignName);
                if (oldHp > 0 && isUnconscious) {
                    setRuntimeValue(pendingTargetName, 'deathSaves', [false, false, false], pending.campaignName);
                    setRuntimeValue(pendingTargetName, 'deathFailures', [false, false, false], pending.campaignName);
                }
            }

            logEntry({
                type: 'roll',
                characterName: detail.targetName,
                rollType: 'save',
                name: pending.name,
                rolls: [detail.roll],
                mode: detail.mode || 'normal',
                total: detail.total,
                bonus: detail.saveBonus,
                isNatural20: detail.roll === 20,
                isNatural1: detail.roll === 1,
                targetName: detail.targetName,
                saveType: detail.saveType,
                saveDc: detail.saveDc,
                saveResult: detail.success ? 'success' : 'failure',
                attackerName: attacker,
                dcSuccess: detail.dcSuccess,
                timestamp: Date.now(),
                id: utils.guid(),
            });

            const logEntryData = {
                type: 'roll',
                characterName: attacker,
                rollType: 'save-damage',
                name: pending.name,
                formula: pending.formula,
                rolls: pending.rolls,
                total: pending.rawDamage,
                modifier: pending.modifier,
                damageType: pending.damageType,
                targetName: detail.targetName,
                saveType: detail.saveType,
                saveDc: detail.saveDc,
                dcSuccess: detail.dcSuccess,
                saveResult: isSoulstitchProtected ? 'soulstitch_auto_success' : (detail.success ? 'success' : 'failure'),
                saveRoll: detail.roll,
                saveBonus: detail.saveBonus,
                saveRawRolls: detail.rawRolls,
                forcedMode: pending.metamagicHeighten ? 'disadvantage' : 'normal',
                bonusDetail: detail.bonusDetail,
                finalDamage: appliedDamage || finalDamage,
                isAoe: pending.isAoe || false,
                aoeAffectedCount: pending.isAoe ? (detail.aoeAffectedCount || null) : null,
                soulstitchProtected: isSoulstitchProtected,
                note: 'combined_save_damage_roll',
            };
            assignSecondaryFields(logEntryData, secondaryResult, SECONDARY_SUFFIXES);
            logEntry(logEntryData);

            await applyOverchannelSelfDamage({ pending, characterName, campaignName, charactersRef, logEntry });

            if (!detail.success && pending.statusEffects?.length > 0) {
                applyFailedSaveStatusEffects({ detail, pending, combatSummary, charactersRef, characterName });
            }

            // CLA-377: Vicious Mockery disadvantage is applied on the FAILED save only,
            // after the save resolves (mirrors the statusEffects-on-fail leg above).
            await triggerViciousMockeryOnFail({ detail, pending });

            // Always write lastAttack for save-based damage (player targets) — counterspell needs this
            // But first, check if a spell handler/modal already owns lastAttack (spell-save) — skip if so
            const checkLastAttack = await getRuntimeValue('campaign', 'lastAttack', pending.campaignName);
            if (checkLastAttack?.rollType === 'spell-save' && (pending.name || pending.sourceName) === checkLastAttack.attackName) {
                return;
            }
            const saveLastAttackData = buildSaveLastAttackData({ detail, pending, characterName, appliedDamage, finalDamage });
            setRuntimeValue('campaign', 'lastAttack', saveLastAttackData, pending.campaignName);

            const popupData = buildSavePopupData({ detail, pending, applyResult, newHp, maxHp, appliedDamage, finalDamage, secondaryResult });
            const setPopupHtml = getPendingPopupSetter(detail.promptId);
            if (setPopupHtml) {
                setPopupHtml(popupData);
            }
        });

        window.addEventListener('death-save-result', (e) => {
            logEntry({
                type: 'death_save',
                characterName: e.detail.targetName,
                roll: e.detail.roll,
                isNatural20: e.detail.isNat20,
                isNatural1: e.detail.isNat1,
                success: e.detail.success,
                totalSuccesses: e.detail.newSaves?.filter(Boolean).length ?? 0,
                totalFailures: e.detail.newFailures?.filter(Boolean).length ?? 0,
            });
        });

        window.addEventListener('concentration-result', (e) => {
            logEntry({
                type: 'roll',
                characterName: e.detail.targetName,
                rollType: 'concentration-save',
                name: 'Constitution',
                rolls: e.detail.rawRolls || [e.detail.roll],
                mode: e.detail.mode || 'normal',
                total: e.detail.total,
                bonus: e.detail.saveBonus,
                bonusDetail: e.detail.bonusDetail,
                condition: `Concentration: ${e.detail.spellName}`,
                dc: e.detail.dc,
                success: e.detail.success,
                timestamp: Date.now(),
                id: utils.guid(),
                advantageSources: e.detail.advantageSources || null,
            });

            const combatSummary = getCombatSummary(campaignName);
            if (combatSummary) {
                const creature = combatSummary.creatures.find(c =>
                    c.name === e.detail.targetName || c.name.startsWith(e.detail.targetName + ' ')
                );
                if (creature && !e.detail.success) {
                    const concentrationSpell = creature.concentration?.spell;
                    creature.concentration = null;
                    stripSummonedFromCombatSummary(combatSummary, creature.name);
                    setRuntimeValue(e.detail.targetName, 'mantleOfMajestyActive', null, campaignName);
                    storage.set('combatSummary', combatSummary, campaignName);
                    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
                    cleanupConcentrationEffects(creature.name, concentrationSpell, campaignName);
                }
            }
        });
    }
}
