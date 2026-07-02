import { addExpiration } from '../../services/rules/effects/expirations.js';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import {
  computeDamageAfterEvasion,
  applyDamageToTarget,
} from '../../services/rules/combat/applyDamage.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { postLogEntry } from '../../services/shared/logPoster.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { hasSoulstitchProtection } from './loggedDiceRollUtils.js';
import utils from '../../services/ui/utils.js';
import storage from '../../services/ui/storage.js';

export function setupEventListeners(deps) {
    const { characterName, campaignName, logEntry, charactersRef } = deps;

    if (campaignName && !window.__pendingResultHandlersInstalled) {
        window.__pendingResultHandlersInstalled = true;

        window.addEventListener('save-result', (e) => {
            const pending = window.__pendingSaves[e.detail.promptId];
            if (!pending) return;

            const combatSummary = getCombatSummary(campaignName);
            const saveTypeUpper = (e.detail.saveType || '').toUpperCase();
            const targetChar = (charactersRef.current || []).find(c => c.name === e.detail.targetName);
            const targetConditions = getRuntimeValue(e.detail.targetName, 'activeConditions', pending.campaignName) || [];
            const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');

            const isSoulstitchProtected = hasSoulstitchProtection(e.detail.targetName, characterName, pending.campaignName);

            const targetActiveBuffs = getRuntimeValue(e.detail.targetName, 'activeBuffs', pending.campaignName) || [];
            const isShieldActive = Array.isArray(targetActiveBuffs) && targetActiveBuffs.some(b => b.effect === 'shield');
            const isMagicMissile = pending.name && pending.name.toLowerCase() === 'magic missile';

            const ownEvasion = targetChar?.computedStats?.evasionEffects;
            const hasOwnEvasion = !isIncapacitated && pending.dcSuccess === 'half' && ownEvasion?.some(ef => ef.saveType === saveTypeUpper);
            const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && pending.dcSuccess === 'half' &&
                (charactersRef.current || []).some(c => {
                    if (c.name === e.detail.targetName) return false;
                    const ev = c?.computedStats?.evasionEffects;
                    return ev?.some(ef => ef.saveType === saveTypeUpper && ef.shareable && ef.shareRange >= 5);
                });
            const hasEvasion = hasOwnEvasion || hasSharedEvasion;
            let finalDamage = isSoulstitchProtected || (isShieldActive && isMagicMissile) ? 0 : computeDamageAfterEvasion(
                e.detail.rawDamage, e.detail.success, e.detail.dcSuccess, hasEvasion
            );

            const interveneShieldActive = getRuntimeValue(e.detail.targetName, 'interveneShieldActive', pending.campaignName);
            if (interveneShieldActive && e.detail.saveType === 'DEX' && e.detail.dcSuccess === 'half') {
                if (e.detail.success) {
                    finalDamage = 0;
                }
                setRuntimeValue(e.detail.targetName, 'interveneShieldActive', null, pending.campaignName);
            }
            const pendingTargetName = pending.targetName;
            let targetMaxHp = 0;
            if (combatSummary) {
                const t = combatSummary.creatures.find(c => c.name === pendingTargetName);
                if (t) targetMaxHp = t.type === 'player' ? (getRuntimeValue(t.name, 'hitPoints') ?? 0) : t.maxHp;
            }
            const ignoreResistance = (pending.playerStats && hasIgnoreResistance(pending.playerStats, pending.damageType)) || false;
            const applyResult = applyDamageToTarget(
                combatSummary, pendingTargetName, finalDamage, [pending.damageType], pending.campaignName, charactersRef.current, ignoreResistance, pending.attackerName || characterName, true
            );

            if (applyResult && applyResult.finalDamage > 0) {
                endInvisibilityOnHostileAction(pending.attackerName || characterName, pending.campaignName);
            }

            let secondaryResult = null;
            let secondaryFinalDamage = 0;
            if (pending.autoDamageSecondaryFormula) {
                const secondaryFormula = pending.autoDamageSecondaryFormula;
                const secondaryName = pending.autoDamageSecondaryName || pending.name;
                const secondaryDamageType = pending.autoDamageSecondaryDamageType;
                const isAutoCrit = pending.isAutoCrit || false;
                const secondaryRollResult = isAutoCrit ? rollExpressionDoubled(secondaryFormula) : rollExpression(secondaryFormula);
                if (secondaryRollResult) {
                    const secondaryTotal = secondaryRollResult.total;
                    let secondaryRawDamage = secondaryTotal;
                    const secondaryIgnoreResistance = (pending.playerStats && hasIgnoreResistance(pending.playerStats, secondaryDamageType)) || false;
                    const secondaryApplyResult = applyDamageToTarget(combatSummary, pendingTargetName, secondaryRawDamage, [secondaryDamageType], pending.campaignName, charactersRef.current, secondaryIgnoreResistance, pending.attackerName || characterName, true);
                    secondaryFinalDamage = secondaryApplyResult?.finalDamage ?? secondaryRawDamage;
                    if (secondaryApplyResult && secondaryApplyResult.finalDamage > 0) {
                        endInvisibilityOnHostileAction(pending.attackerName || characterName, pending.campaignName);
                    }
                    secondaryResult = {
                        name: secondaryName,
                        formula: secondaryFormula,
                        rolls: secondaryRollResult.rolls,
                        total: secondaryTotal,
                        modifier: secondaryRollResult.modifier,
                        damageType: secondaryDamageType,
                        finalDamage: secondaryFinalDamage,
                    };
                }
            }

            const totalDamageDealt = (applyResult?.finalDamage ?? 0) + secondaryFinalDamage;
            const newHp = applyResult?.newHp ?? (combatSummary?.creatures?.find(c => c.name === pendingTargetName)?.currentHp ?? 0);
            const maxHp = targetMaxHp;
            const oldHp = newHp + totalDamageDealt;
            const isDead = newHp <= 0;
            const wasAlive = oldHp > 0;
            const wasBloodied = oldHp > 0 && oldHp <= Math.floor(maxHp / 2);
            const isBloodied = newHp > 0 && newHp <= Math.floor(maxHp / 2);
            let threshold;
            if (!wasAlive && isDead) threshold = 'dead';
            else if (!wasBloodied && isBloodied) threshold = 'bloodied';
            else if (wasBloodied && !isBloodied && newHp > 0) threshold = 'recovering';

            const hpEntry = {
                type: 'hp_change',
                targetName: pendingTargetName,
                delta: -(totalDamageDealt),
                currentHp: newHp,
                maxHp,
                isHealing: false,
                isUnconscious: isDead,
            };
            if (threshold) hpEntry.threshold = threshold;
            postLogEntry(pending.campaignName, hpEntry);

            if (pendingTargetName.startsWith('player-')) {
                setRuntimeValue(pendingTargetName, 'currentHitPoints', newHp, pending.campaignName);
                if (oldHp > 0 && isDead) {
                    setRuntimeValue(pendingTargetName, 'deathSaves', [false, false, false], pending.campaignName);
                    setRuntimeValue(pendingTargetName, 'deathFailures', [false, false, false], pending.campaignName);
                }
            }

            const logEntryData = {
                type: 'roll',
                characterName: pending.attackerName || characterName,
                rollType: 'save-damage',
                name: pending.name,
                formula: pending.formula,
                rolls: pending.rolls,
                total: pending.rawDamage,
                modifier: pending.modifier,
                damageType: pending.damageType,
                targetName: e.detail.targetName,
                saveType: e.detail.saveType,
                saveDc: e.detail.saveDc,
                dcSuccess: e.detail.dcSuccess,
                saveResult: isSoulstitchProtected ? 'soulstitch_auto_success' : (e.detail.success ? 'success' : 'failure'),
                saveRoll: e.detail.roll,
                saveBonus: e.detail.saveBonus,
                saveRawRolls: e.detail.rawRolls,
                mode: pending.metamagicHeighten ? 'disadvantage' : 'normal',
                bonusDetail: e.detail.bonusDetail,
                finalDamage: applyResult?.finalDamage ?? finalDamage,
                isAoe: pending.isAoe || false,
                aoeAffectedCount: pending.isAoe ? (e.detail.aoeAffectedCount || null) : null,
                soulstitchProtected: isSoulstitchProtected,
                note: 'combined_save_damage_roll',
            };
            if (secondaryResult) {
                logEntryData.secondaryName = secondaryResult.name;
                logEntryData.secondaryFormula = secondaryResult.formula;
                logEntryData.secondaryRolls = secondaryResult.rolls;
                logEntryData.secondaryTotal = secondaryResult.total;
                logEntryData.secondaryModifier = secondaryResult.modifier;
                logEntryData.secondaryDamageType = secondaryResult.damageType;
                logEntryData.secondaryFinalDamage = secondaryResult.finalDamage;
            }
            logEntry(logEntryData);

            if (pending.overchannelActive && pending.overchannelUseCount > 1) {
                const overchannelSpellLevel = pending.overchannelSpellLevel || 1;
                const dicePerLevel = 2 + (pending.overchannelUseCount - 1);
                const totalDice = dicePerLevel * overchannelSpellLevel;
                const necroticFormula = `${totalDice}d12`;
                const necroticResult = rollExpression(necroticFormula);
                if (necroticResult) {
                    const casterCombatSummary = getCombatSummary(campaignName);
                    const casterApplyResult = applyDamageToTarget(casterCombatSummary, characterName, necroticResult.total, ['Necrotic'], campaignName, charactersRef.current, true, characterName);
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
            }

            delete window.__pendingSaves[e.detail.promptId];

            if (!e.detail.success && pending.statusEffects?.length > 0) {
                const targetName = pending.targetName;
                const targetCreature = combatSummary?.creatures?.find(c => c.name === targetName);
                const targetCharacter = (charactersRef.current || []).find(c => utils.getName(c.name) === targetName);
                const targetStats = targetCharacter?.computedStats || targetCharacter;
                const effectsToExpire = [];
                for (const effect of pending.statusEffects) {
                    const condKey = String(effect).toLowerCase();
                    const attackerName = pending.attackerName || characterName;
                    const attackerCreature = combatSummary?.creatures?.find(c => c.name === attackerName);
                    if (targetStats && playerIsImmuneToCondition({
                        conditionKey: condKey,
                        playerStats: targetStats,
                        getRuntimeValue: getRuntimeValue,
                        campaignName: pending.campaignName,
                        sourceCreatureType: attackerCreature?.type,
                    })) {
                        continue;
                    }
                    if (targetCreature?.type === 'player') {
                        const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
                        const filtered = conditions.filter(c => String(c).toLowerCase() !== condKey);
                        setRuntimeValue(targetName, 'activeConditions', [...filtered, condKey], pending.campaignName);
                        effectsToExpire.push({ type: 'condition', condition: condKey });
                    } else if (targetCreature) {
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

            const popupData = {
                type: 'save-damage',
                name: pending.name,
                formula: pending.formula,
                rolls: pending.rolls,
                total: applyResult?.finalDamage ?? finalDamage,
                bonus: 0,
                modifier: pending.modifier,
                damageType: pending.damageType,
                targetName: e.detail.targetName,
                targetCurrentHp: applyResult?.newHp ?? newHp,
                targetMaxHp,
                saveDc: e.detail.saveDc,
                saveType: e.detail.saveType,
                dcSuccess: e.detail.dcSuccess,
                saveResult: { roll: e.detail.roll, total: e.detail.total, bonus: e.detail.saveBonus, success: e.detail.success },
                finalDamage: applyResult?.finalDamage ?? finalDamage,
                damageApplied: true,
                damageReduced: applyResult?.damageReduced,
            };
            if (secondaryResult) {
                popupData.secondaryName = secondaryResult.name;
                popupData.secondaryFormula = secondaryResult.formula;
                popupData.secondaryRolls = secondaryResult.rolls;
                popupData.secondaryTotal = secondaryResult.total;
                popupData.secondaryModifier = secondaryResult.modifier;
                popupData.secondaryDamageType = secondaryResult.damageType;
                popupData.secondaryFinalDamage = secondaryResult.finalDamage;
            }
            pending.setPopupHtml(popupData);
        });

        window.addEventListener('death-save-result', (e) => {
            logEntry({
                type: 'death_save',
                characterName: e.detail.targetName,
                roll: e.detail.roll,
                isNatural20: e.detail.isNat20,
                isNatural1: e.detail.isNat1,
                success: e.detail.success,
            });
        });

        window.addEventListener('concentration-result', (e) => {
            logEntry({
                type: 'roll',
                characterName: e.detail.targetName,
                rollType: 'concentration-save',
                name: 'Constitution',
                rolls: [e.detail.roll],
                mode: 'normal',
                total: e.detail.total,
                bonus: e.detail.saveBonus,
                bonusDetail: e.detail.bonusDetail,
                condition: `Concentration: ${e.detail.spellName}`,
                dc: e.detail.dc,
                success: e.detail.success,
                timestamp: Date.now(),
                id: utils.guid(),
            });

            const combatSummary = getCombatSummary(campaignName);
            if (combatSummary) {
                const creature = combatSummary.creatures.find(c =>
                    c.name === e.detail.targetName || c.name.startsWith(e.detail.targetName + ' ')
                );
                if (creature && !e.detail.success) {
                    creature.concentration = null;
                    setRuntimeValue(e.detail.targetName, 'mantleOfMajestyActive', null, campaignName);
                    storage.set('combatSummary', combatSummary, campaignName);
                    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
                }
            }
        });
    }
}
