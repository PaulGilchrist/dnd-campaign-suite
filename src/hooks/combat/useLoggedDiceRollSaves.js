import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    computeDamageAfterEvasion,
    rollSaveForCreature,
    applyDamageToTarget,
    normalizeSaveType,
} from '../../services/rules/combat/applyDamage.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import storage from '../../services/ui/storage.js';
import { MELEE_REACH_FEET } from '../../services/combat/baseCombatActions.js';
import { hasIgnoreResistance, evaluateAutoExpression } from '../../services/combat/automation/automationService.js';
import utils from '../../services/ui/utils.js';
import { isCircleOfPowerActive } from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';

export function createSaves(deps) {
    const { characterName, campaignName, setPopupHtml, logEntry, logAndShow, pendingSaves, charactersRef } = deps;

    async function triggerGloriousDefenseCounterAttack() {
        const playerName = characterName;
        const chaBonus = charactersRef?.current?.find(c => c.name === playerName)?.abilities?.find(a => a.name === 'Charisma')?.bonus || 0;

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
                defensiveDuelistBonus: 0,
                popupMessage: `${characterName} has no uses remaining for Glorious Defense. Recharges on a Long Rest.`,
            });
            return;
        }

        const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);

        if (!lastAttack || lastAttack.targetName !== playerName) {
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
                defensiveDuelistBonus: 0,
                popupMessage: `${characterName}: The last attack did not target you.`,
            });
            return;
        }

        const chaMod = Math.max(1, chaBonus);
        const newAc = lastAttack.targetAc != null ? lastAttack.targetAc + chaMod : null;
        const wouldHit = newAc != null ? (lastAttack.d20 + lastAttack.bonus >= newAc) : null;
        const attackerName = lastAttack.attackerName || 'Unknown creature';

        if (wouldHit === true) {
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
                defensiveDuelistBonus: 0,
                popupMessage: `The CHA bonus (+${chaMod}) was not enough to change the outcome.`,
            });
            return;
        }

        // Attack becomes a miss — use the counterattack
        const combatSummary = await loadCombatSummary(campaignName);
        const playerCreature = combatSummary?.creatures?.find(c => c.type === 'player' && c.name === playerName);
        const attacks = playerCreature?.attacks || [];
        const meleeAttacks = attacks.filter(a => a.range === MELEE_REACH_FEET);
        const attack = meleeAttacks.length > 0 ? meleeAttacks[0] : attacks[0];

        if (!attack) {
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
                defensiveDuelistBonus: 0,
                popupMessage: `${characterName} has no melee attack available.`,
            });
            return;
        }

        await setRuntimeValue(playerName, usesKey, currentUses - 1, campaignName);

        logEntry({
            type: 'ability_use',
            characterName: playerName,
            abilityName: 'Glorious Defense',
            description: `${playerName} used Glorious Defense against ${attackerName} — the attack misses due to the CHA modifier (${chaMod}) and ${playerName} makes a melee counterattack.`,
            targetName: attackerName,
        }).catch((e) => { console.error("[useLoggedDiceRollSaves] Error:", e); });

        logAndShow(attack.name, attack.hitBonus, 'attack', { targetName: attackerName, forcedMode: undefined });
    }
    async function quickRollPlayerSave(promptId, targetName, saveType, saveDc, selectedAllies) {
        const pending = pendingSaves[promptId];
        if (!pending) return;

        const combatSummary = await loadCombatSummary(campaignName);
        const target = combatSummary?.creatures?.find(c => c.name === pending.targetName);
        if (!target) return;

        let disadvantage = pending.metamagicHeighten || false;
        const targetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
        const idx = targetEffects.findIndex(te => te.target === pending.targetName && te.effect === 'disadvantage_on_next_save');
        if (idx !== -1) {
            disadvantage = true;
            targetEffects.splice(idx, 1);
            setRuntimeValue('campaign', 'targetEffects', [...targetEffects], campaignName);
        }

        // Bane/Blade Ward: apply -1d4 penalty to saving throws
        let baneSavePenalty = 0;
        let baneSaveRoll = null;
        let baneSaveDisplayLabel = 'Bane';
        const baneEffectsForSave = targetEffects.filter(te => te.target === pending.targetName && te.effect === 'bane_penalty');
        if (baneEffectsForSave.length > 0) {
            const r = rollExpression('1d4');
            if (r) {
                baneSavePenalty = -r.total;
                baneSaveRoll = r.total;
                baneSaveDisplayLabel = baneEffectsForSave[0].displayLabel || 'Bane';
            }
        }

        // Bane/Blade Ward on attacker: grant +1d4 to the target's save when the attacker is cursed
        let baneAttackerBonus = 0;
        let baneAttackerRoll = null;
        let baneAttackerDisplayLabel = 'Bane';
        if (pending.attackerName) {
            const baneOnAttacker = targetEffects.filter(te => te.target === pending.attackerName && te.effect === 'bane_penalty');
            if (baneOnAttacker.length > 0) {
                const r = rollExpression('1d4');
                if (r) {
                    baneAttackerBonus += r.total;
                    baneAttackerRoll = r.total;
                    baneAttackerDisplayLabel = baneOnAttacker[0].displayLabel || 'Bane';
                }
            }
        }

        // Bless: add 1d4 to saving throws
        let blessSaveBonus = 0;
        const blessEffectsForSave = targetEffects.filter(te => te.target === pending.targetName && te.effect === 'bless_bonus');
        if (blessEffectsForSave.length > 0) {
            const r = rollExpression('1d4');
            if (r) {
                blessSaveBonus += r.total;
            }
        }

        const targetChar = (charactersRef.current || []).find(c => c.name === pending.targetName);
        const targetSaveModifiers = targetChar?.saveModifiers || targetChar?.computedStats?.saveModifiers || [];
        // CLA-324: against_spell advantage only on saves against spells — spell-origin is
        // identifiable from the pending prompt flag or a spell-save-owned lastAttack stamp.
        const hasAgainstSpellAdvantage = targetSaveModifiers.some(mod => mod.target === 'saving_throw' && mod.effect === 'advantage' && mod.condition === 'against_spell');
        const lastAttackOrigin = hasAgainstSpellAdvantage ? (getRuntimeValue('campaign', 'lastAttack', campaignName) || {}) : {};
        const spellOrigin = pending.isSpellDamage === true ||
          (lastAttackOrigin.rollType === 'spell-save' && (!pending.attackerName || lastAttackOrigin.attackerName === pending.attackerName));
        const advantage = hasAgainstSpellAdvantage && spellOrigin;
        const targetActiveBuffs = getRuntimeValue(pending.targetName, 'activeBuffs', campaignName) || [];
        const isDodging = Array.isArray(targetActiveBuffs) && targetActiveBuffs.some(b => b.effect === 'dodge');
        const isDexSave = saveType.toUpperCase() === 'DEX';
        const dodgeAdvantage = isDodging && isDexSave;
        const beaconWisAdvantage = targetEffects.some(te => te.effect === 'beacon_of_hope') && saveType.toUpperCase() === 'WIS';
        const circleOfPowerAdvantage = isCircleOfPowerActive(pending.targetName, campaignName);
        const saveResult = rollSaveForCreature(target, saveType, saveDc, disadvantage, advantage || dodgeAdvantage || beaconWisAdvantage || circleOfPowerAdvantage);
        saveResult.total += baneSavePenalty + blessSaveBonus + baneAttackerBonus;

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
        const hasEvasion = hasOwnEvasion || hasSelectedEvasion || hasSharedEvasion || isCircleOfPowerActive(pending.targetName, campaignName);
        let finalDamage = computeDamageAfterEvasion(pending.rawDamage, saveResult.success, pending.dcSuccess, hasEvasion);

        if (hasEvasion) {
            logEntry({
                type: 'roll',
                characterName: pending.targetName,
                rollType: 'evasion',
                name: hasOwnEvasion ? 'Evasion' : hasSelectedEvasion ? 'Evasion' : circleOfPowerAdvantage ? 'Circle of Power' : 'Leading Evasion',
                targetName: pending.targetName,
                saveType,
                saveDc: pending.saveDc,
                saveResult: saveResult.success ? 'success' : 'failure',
                dcSuccess: pending.dcSuccess,
                timestamp: Date.now(),
                id: utils.guid(),
            });
        }

        const isShieldActive = Array.isArray(targetActiveBuffs) && targetActiveBuffs.some(b => b.effect === 'shield');
        const isMagicMissile = pending.name && pending.name.toLowerCase() === 'magic missile';
        if (isShieldActive && isMagicMissile) {
            finalDamage = 0;
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
        const allCharacters = charactersRef.current || [];
        const applyResult = await applyDamageToTarget(combatSummary, pending.targetName, finalDamage, [pending.damageType], campaignName, allCharacters, ignoreResistance, pending.attackerName || characterName);

        storage.set('combatSummary', combatSummary, campaignName);

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
            total: finalDamage,
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
            baneRoll: baneSaveRoll,
            baneDisplayLabel: baneSaveDisplayLabel,
            baneAttackerRoll: baneAttackerRoll,
            baneAttackerDisplayLabel: baneAttackerDisplayLabel,
            blessRoll: null,
        });
    }

    return {
        quickRollPlayerSave,
        triggerGloriousDefenseCounterAttack,
    };
}
