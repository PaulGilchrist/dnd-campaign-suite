import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    computeDamageAfterEvasion,
    rollSaveForCreature,
    applyDamageToTarget,
    normalizeSaveType,
} from '../../services/rules/combat/applyDamage.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { getTargetFromAttacker, getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { MELEE_REACH_FEET } from '../../services/combat/baseCombatActions.js';
import { hasIgnoreResistance, evaluateAutoExpression } from '../../services/combat/automation/automationService.js';

export function createSaves(deps) {
    const { characterName, campaignName, setPopupHtml, logEntry, logAndShow, pendingSaves, charactersRef } = deps;

    async function triggerGloriousDefenseCounterAttack() {
        const playerName = characterName;
        const chaBonus = 0;

        const usesKey = 'gloriousDefenseUses';
        const usesMax = Math.max(1, chaBonus);
        const currentUses = Number(getRuntimeValue(playerName, usesKey, campaignName) ?? usesMax);

        if (currentUses <= 0) {
            setPopupHtml({
                type: 'd20',
                rollType: 'attack',
                name: 'Glorious Defense',
                rolls: [],
                bonus: 0,
                targetName: null,
                targetAc: null,
                hit: undefined,
                isAutoMiss: false,
                forcedMode: undefined,
                isCrit: false,
                isAutoCrit: false,
                gloriousDefenseBonus: 0,
                defensiveDuelistBonus: 0,
                popupMessage: `${characterName} has no uses remaining for Glorious Defense. Recharges on a Long Rest.`,
            });
            return;
        }

        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

        const cs = await getCombatContext(campaignName);
        const target = cs ? getTargetFromAttacker(cs, playerName) : null;
        const targetName = target?.name || null;

        const combatSummary = await loadCombatSummary(campaignName);
        const playerCreature = combatSummary?.creatures?.find(c => c.type === 'player' && c.name === playerName);
        const attacks = playerCreature?.attacks || [];
        const meleeAttacks = attacks.filter(a => a.range === MELEE_REACH_FEET);
        const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : attacks[0];

        if (!attack) {
            await setRuntimeValue(playerName, usesKey, currentUses, campaignName);
            setPopupHtml({
                type: 'd20',
                rollType: 'attack',
                name: 'Glorious Defense',
                rolls: [],
                bonus: 0,
                targetName: null,
                targetAc: null,
                hit: undefined,
                isAutoMiss: false,
                forcedMode: undefined,
                isCrit: false,
                isAutoCrit: false,
                gloriousDefenseBonus: 0,
                defensiveDuelistBonus: 0,
                popupMessage: `${characterName} has no melee attack available.`,
            });
            return;
        }

        logEntry({
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Glorious Defense',
            description: `${playerName} used Glorious Defense counter-attack against ${targetName || 'attacker'}.`,
        }).catch((e) => { console.error("[useLoggedDiceRollSaves] Error:", e); });

        logAndShow(attack.name, attack.hitBonus, 'attack', { targetName, forcedMode: undefined });
    }
    async function quickRollPlayerSave(promptId, targetName, saveType, saveDc, selectedAllies) {
        const pending = pendingSaves[promptId];
        if (!pending) {
            console.log('[quickRollPlayerSave] NO pending for promptId', promptId);
            return;
        }
        console.log('[quickRollPlayerSave] called for promptId', promptId,
            'target:', targetName,
            'saveType:', saveType,
            'saveDc:', saveDc,
            'pending.attackerName:', pending.attackerName,
            'pending.name:', pending.name);

        const combatSummary = await loadCombatSummary(campaignName);
        const target = combatSummary?.creatures?.find(c => c.name === pending.targetName);
        if (!target) return;

        let disadvantage = pending.metamagicHeighten || false;
        const targetEffects = getRuntimeValue(campaignName, 'targetEffects', campaignName) || [];
        const riderEffectIdx = targetEffects.findIndex(te => te.target === pending.targetName && te.effect === 'disadvantage_on_next_save');
        if (riderEffectIdx !== -1) {
            disadvantage = true;
            targetEffects.splice(riderEffectIdx, 1);
            setRuntimeValue(campaignName, 'targetEffects', targetEffects, campaignName);
        }
        const targetChar = (charactersRef.current || []).find(c => c.name === pending.targetName);
        const targetSaveModifiers = targetChar?.saveModifiers || targetChar?.computedStats?.saveModifiers || [];
        const advantage = targetSaveModifiers.some(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition === 'against_spell');
        const saveResult = rollSaveForCreature(target, saveType, saveDc, disadvantage, advantage);

        const normalizedSaveType = normalizeSaveType(saveType);
        const targetConditions = getRuntimeValue(pending.targetName, 'activeConditions', campaignName) || [];
        const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');

        const ownEvasion = targetChar?.computedStats?.evasionEffects;
        const hasOwnEvasion = !isIncapacitated && pending.dcSuccess === 'half' && ownEvasion?.some(ef => ef.saveType === normalizedSaveType);
        const hasSelectedEvasion = selectedAllies?.has?.(pending.targetName) || false;
        const hasSharedEvasion = !hasOwnEvasion && !hasSelectedEvasion && !isIncapacitated && pending.dcSuccess === 'half' &&
            (charactersRef.current || []).some(c => {
                if (c.name === pending.targetName) return false;
                const ev = c?.computedStats?.evasionEffects;
                return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
            });
        const hasEvasion = hasOwnEvasion || hasSelectedEvasion || hasSharedEvasion;
        let finalDamage = computeDamageAfterEvasion(pending.rawDamage, saveResult.success, pending.dcSuccess, hasEvasion);

        const targetActiveBuffs = getRuntimeValue(pending.targetName, 'activeBuffs', campaignName) || [];
        const isShieldActive = Array.isArray(targetActiveBuffs) && targetActiveBuffs.some(b => b.effect === 'shield');
        const isMagicMissile = pending.name && pending.name.toLowerCase() === 'magic missile';
        if (isShieldActive && isMagicMissile) {
            finalDamage = 0;
        }

        const interveneShieldActive = getRuntimeValue(pending.targetName, 'interveneShieldActive', campaignName);
        if (interveneShieldActive && pending.saveType === 'DEX' && pending.dcSuccess === 'half') {
            if (saveResult.success) {
                finalDamage = 0;
            }
            setRuntimeValue(pending.targetName, 'interveneShieldActive', null, campaignName);
        }

        const isCantripFlag = pending.isCantrip || false;
        const hasBlessedStrikesOptions = pending.context?.playerStats?.automation?.actions?.some(
            a => a.type === 'damage_bonus' && a.options?.length > 0 && a.options.includes('Potent Spellcasting')
        ) || false;
        if (hasBlessedStrikesOptions && isCantripFlag && saveResult.success && pending.dcSuccess === 'none') {
            finalDamage = Math.floor(pending.rawDamage / 2);
        }
        if (isCantripFlag && !saveResult.success && pending.dcSuccess === 'none') {
            const playerStats = pending.context?.playerStats;
            if (playerStats?.automation?.actions) {
                const allAutomation = [
                    ...(playerStats.automation.actions || []),
                    ...(playerStats.automation.passives || []),
                ];
                const cantripBonuses = playerStats.automation.actions.filter(
                    a => a.type === 'damage_bonus' && a.options?.length > 0 && a.tempHpExpression
                );
                const upgradedNames = new Set(allAutomation.filter(b => b.upgrades).map(b => b.upgrades));
                const filteredBonuses = cantripBonuses.filter(b => !upgradedNames.has(b.name));
                for (const bonus of filteredBonuses) {
                    const tempHp = evaluateAutoExpression(bonus.tempHpExpression, playerStats);
                    if (tempHp && !isNaN(tempHp) && tempHp > 0) {
                        const combatSummaryForTargets = await loadCombatSummary(campaignName);
                        const allies = combatSummaryForTargets?.creatures?.filter(c =>
                            c.type === 'player' || c.type === 'npc' || c.type === 'monster'
                        ) || [];
                        if (allies.length > 0) {
                            const targets = allies.map(c => ({
                                name: c.name,
                                currentHp: c.currentHp,
                                maxHp: c.maxHp,
                                size: c.size,
                                type: c.type,
                            }));
                            window.dispatchEvent(new CustomEvent('potent-spellcasting-temp-hp', {
                                detail: {
                                    title: 'Improved Blessed Strikes — Potent Spellcasting',
                                    targets,
                                    tempHp,
                                    campaignName,
                                    attackerName: characterName,
                                    confirmLabel: 'Grant Temp HP',
                                },
                                bubbles: true,
                            }));
                        }
                    }
                }
            }
        }
        const ignoreResistance = (pending.playerStats && hasIgnoreResistance(pending.playerStats, pending.damageType)) || false;
        const applyResult = applyDamageToTarget(combatSummary, pending.targetName, finalDamage, [pending.damageType], campaignName, null, ignoreResistance, pending.attackerName || characterName);

        delete pendingSaves[promptId];

        sendSaveResult(campaignName, targetName, {
            promptId,
            success: saveResult.success,
            roll: saveResult.roll,
            total: saveResult.total,
            saveBonus: saveResult.bonus,
        });

        setPopupHtml({
            type: 'save-damage',
            name: pending.name,
            formula: pending.formula,
            rolls: pending.rolls,
            total: applyResult?.finalDamage,
            bonus: 0,
            modifier: pending.modifier,
            damageType: pending.damageType,
            targetName: target.name,
            targetCurrentHp: applyResult?.newHp,
            targetMaxHp: target.type === 'player'
                ? (getRuntimeValue(target.name, 'hitPoints') ?? 0)
                : target.maxHp,
            saveDc,
            saveType,
            dcSuccess: pending.dcSuccess,
            saveResult,
            finalDamage: applyResult?.finalDamage,
            damageApplied: true,
            damageReduced: applyResult?.damageReduced,
        });
    }

    return {
        quickRollPlayerSave,
        triggerGloriousDefenseCounterAttack,
    };
}
