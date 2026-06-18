import { addExpiration } from '../../services/rules/effects/expirations.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import {
  computeDamageAfterEvasion,
  applyDamageToTarget,
} from '../../services/rules/combat/applyDamage.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { hasSoulstitchProtection } from './useLoggedDiceRollUtils.js';
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
                combatSummary, pendingTargetName, finalDamage, [pending.damageType], pending.campaignName, null, ignoreResistance, pending.attackerName || characterName
            );

            if (applyResult && applyResult.finalDamage > 0) {
                endInvisibilityOnHostileAction(pending.attackerName || characterName, pending.campaignName);
            }

            logEntry({
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
            });

            if (pending.overchannelActive && pending.overchannelUseCount > 1) {
                const overchannelSpellLevel = pending.overchannelSpellLevel || 1;
                const dicePerLevel = 2 + (pending.overchannelUseCount - 1);
                const totalDice = dicePerLevel * overchannelSpellLevel;
                const necroticFormula = `${totalDice}d12`;
                const necroticResult = rollExpression(necroticFormula);
                if (necroticResult) {
                    const casterCombatSummary = getCombatSummary(campaignName);
                    const casterApplyResult = applyDamageToTarget(casterCombatSummary, characterName, necroticResult.total, ['Necrotic'], campaignName, null, true, characterName);
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
                const usesKey = '_Overchannel_uses';
                const restKey = '_Overchannel_restTimestamp';
                const now = Date.now();
                const lastRestTimestamp = getRuntimeValue(characterName, restKey, campaignName);
                let currentUses;
                if (lastRestTimestamp && now - lastRestTimestamp < 86400000) {
                    currentUses = Number(getRuntimeValue(characterName, usesKey, campaignName) ?? 1);
                } else if (!lastRestTimestamp) {
                    currentUses = Number(getRuntimeValue(characterName, usesKey, campaignName) ?? 1);
                } else {
                    currentUses = 1;
                }
                if (currentUses > 0) {
                    setRuntimeValue(characterName, usesKey, currentUses - 1, campaignName);
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
                        targetCreature.conditions = (targetCreature.conditions || []).filter(c => c.key !== condKey);
                        targetCreature.conditions.push({
                            id: utils.guid(),
                            key: condKey,
                            label: effect.charAt(0).toUpperCase() + effect.slice(1),
                            dc: pending.saveDc,
                            ability: pending.saveType.toLowerCase(),
                            endsOnDamage: true,
                        });
                        effectsToExpire.push({ type: 'condition', condition: condKey });
                    }
                }
                if (effectsToExpire.length > 0) {
                    addExpiration(characterName, targetName, effectsToExpire, pending.campaignName, 2);
                }
            }

            pending.setPopupHtml({
                type: 'save-damage',
                name: pending.name,
                formula: pending.formula,
                rolls: pending.rolls,
                bonus: 0,
                modifier: pending.modifier,
                damageType: pending.damageType,
                targetName: e.detail.targetName,
                targetCurrentHp: applyResult?.newHp,
                targetMaxHp,
                saveDc: e.detail.saveDc,
                saveType: e.detail.saveType,
                dcSuccess: e.detail.dcSuccess,
                saveResult: { roll: e.detail.roll, total: e.detail.total, bonus: e.detail.saveBonus, success: e.detail.success },
                finalDamage: applyResult?.finalDamage,
                damageApplied: true,
                damageReduced: applyResult?.damageReduced,
            });
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
