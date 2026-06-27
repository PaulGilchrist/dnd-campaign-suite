import { useState, useCallback, useEffect, useRef } from 'react';
import { executeHandler } from '../../services/automation/index.js';
import { setRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { loadCombatSummary, setCombatSummaryCache } from '../../services/encounters/combatData.js';
import { SHOW_DICE_ROLL_DELAY } from '../../config/ui-config.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { executeManeuver, onCombatSuperioritySelected } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

export function useCombatSuperiorityModal(playerStats, campaignName, rollAttack, rollDamage, onPopupHtml) {
    const [combatSuperiorityModal, setCombatSuperiorityModal] = useState(null);
    const popupHtmlRef = useRef(null);

    const showPopup = useCallback((html) => {
        if (onPopupHtml) {
            onPopupHtml(html);
        }
    }, [onPopupHtml]);

    const handleCombatSuperiorityConfirm = useCallback(async (selectedManeuverNames, singleUseManeuverName) => {
        if (!combatSuperiorityModal) return;
        setCombatSuperiorityModal(null);

        let result;
        if (singleUseManeuverName) {
            result = await executeManeuver(combatSuperiorityModal.action, playerStats, campaignName, singleUseManeuverName);
            if (result?.logEntries) {
                for (const entry of result.logEntries) {
                    await addEntry(campaignName, entry).catch(() => {});
                }
            }
            if (result?.type === 'modal' && result.modalName === 'baitAndSwitchChoice') {
                window.dispatchEvent(new CustomEvent('bait-and-switch-modal-show', { detail: result.payload }));
                return;
            }
            if (result?.type === 'modal' && result.modalName === 'commanderStrikeChoice') {
                window.dispatchEvent(new CustomEvent('commander-strike-modal-show', { detail: result.payload }));
                return;
            }
            if (result?.type === 'modal' && result.modalName === 'rallyChoice') {
                window.dispatchEvent(new CustomEvent('rally-choice-modal-show', { detail: result.payload }));
                return;
            }
            if (result?.effect === 'attack_roll_bonus' && result?.dieValue && rollAttack) {
                const lastAttackRoll = getRuntimeValue(playerStats.name, 'lastAttackRoll', campaignName);
                const cs = await loadCombatSummary(campaignName);
                const la = cs?.lastAttack;
                if (lastAttackRoll?.d20 != null && lastAttackRoll?.targetAc != null && la?.damageFormula) {
                    const dieValue = result.dieValue;
                    const origTotal = lastAttackRoll.d20 + (lastAttackRoll.bonus || 0);
                    const newTotal = origTotal + dieValue;
                    const newHit = newTotal >= lastAttackRoll.targetAc;
                    const isNatural20 = lastAttackRoll.d20 === 20;
                    const wasCrit = lastAttackRoll.isCrit || isNatural20;

                    const updatedRoll = {
                        ...lastAttackRoll,
                        bonus: (lastAttackRoll.bonus || 0) + dieValue,
                        total: newTotal,
                        hit: newHit,
                        isCrit: wasCrit,
                    };
                    await setRuntimeValue(playerStats.name, 'lastAttackRoll', updatedRoll, campaignName);

                    if (cs?.lastAttack) {
                        cs.lastAttack = { ...cs.lastAttack, total: newTotal, hit: newHit, isCrit: wasCrit };
                        setCombatSummaryCache(cs, campaignName);
                    }

                    const desc = `Precision Attack: Added ${dieValue} to the attack roll (${lastAttackRoll.d20} + ${lastAttackRoll.bonus || 0} + ${dieValue} = ${newTotal}). ${newHit ? 'The attack now hits!' : 'The attack still misses.'}`;

                    await addEntry(campaignName, {
                        type: 'ability_use',
                        characterName: playerStats.name,
                        abilityName: 'Precision Attack',
                        description: desc,
                    }).catch(() => {});

                    if (newHit && rollDamage) {
                        const la = cs?.lastAttack;
                        if (la?.damageFormula) {
                            const damageType = la.damageType || 'Slashing';
                            const damageName = la.damageName || la.attackName;
                            const damageResult = rollExpression(la.damageFormula);
                            if (damageResult) {
                                const context = {
                                    damageType,
                                    targetName: la.targetName,
                                    attackerName: playerStats.name,
                                };
                                rollDamage(damageName, la.damageFormula, damageResult.total, damageResult.rolls, damageResult.modifier, context);
                            }
                        }
                        setRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', null, campaignName);
                        return;
                    }
                    showPopup({ type: 'automation_info', name: 'Precision Attack', description: desc });
                    return;
                }
            }
            if (result?.type === 'popup') {
                const payload = result.payload;
                const html = typeof payload === 'string'
                    ? payload
                    : `<b><i class="fa-solid fa-bolt"></i> ${payload.name || 'Combat Superiority'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
                showPopup(html);
            }
            if (result?.type === 'attack_roll' && rollAttack) {
                const { attack, targetName } = result.payload;
                const superiorityDieValue = result.context?.superiorityDieValue || 0;
                const totalHitBonus = attack.hitBonus + superiorityDieValue;
                const baseFormula = result.context?.baseDamageFormula || attack.damageFormula;
                const combinedFormula = superiorityDieValue > 0 && baseFormula ? `${baseFormula} + ${superiorityDieValue} [Superiority]` : (baseFormula || null);
                rollAttack(attack.name, totalHitBonus, {
                    targetName,
                    forcedMode: undefined,
                    isOpportunityAttack: true,
                    autoDamageFormula: combinedFormula,
                    autoDamageName: `${attack.name} (Riposte)`,
                    damageType: attack.damageType || 'Slashing',
                    autoDamageRollResult: null,
                    superiorityDieValue,
                    ripostePopup: result.popup,
                });
            }
            return;
        }

        result = await onCombatSuperioritySelected(combatSuperiorityModal.action, playerStats, campaignName, selectedManeuverNames, singleUseManeuverName);
        if (result?.logEntries) {
            for (const entry of result.logEntries) {
                await addEntry(campaignName, entry).catch(() => {});
            }
        }
        if (result?.type === 'modal' && result.modalName === 'rallyChoice') {
            window.dispatchEvent(new CustomEvent('rally-choice-modal-show', { detail: result.payload }));
            return;
        }
        if (result?.type === 'popup') {
            const payload = result.payload;
            const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-bolt"></i> ${payload.name || 'Combat Superiority'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            showPopup(html);
        }
        if (result?.popup) {
            const payload = result.popup;
            const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-bolt"></i> ${payload.name || 'Combat Superiority'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            showPopup(html);
        }
        if (result?.type === 'attack_roll' && rollAttack) {
            const { attack, targetName } = result.payload;
            const superiorityDieValue = result.context?.superiorityDieValue || 0;
            const totalHitBonus = attack.hitBonus + superiorityDieValue;
            const baseFormula = result.context?.baseDamageFormula || attack.damageFormula;
            const combinedFormula = superiorityDieValue > 0 && baseFormula ? `${baseFormula} + ${superiorityDieValue} [Superiority]` : (baseFormula || null);
            rollAttack(attack.name, totalHitBonus, {
                targetName,
                forcedMode: undefined,
                isOpportunityAttack: true,
                autoDamageFormula: combinedFormula,
                autoDamageName: `${attack.name} (Riposte)`,
                damageType: attack.damageType || 'Slashing',
                autoDamageRollResult: null,
                superiorityDieValue,
            });
        }
    }, [combatSuperiorityModal, playerStats, campaignName, rollAttack, rollDamage, showPopup]);

    const handleCombatSuperiorityReopenSelection = useCallback(async () => {
        if (!combatSuperiorityModal || !combatSuperiorityModal.action) return;
        const reOpenAction = {
            ...combatSuperiorityModal.action,
            automation: {
                ...combatSuperiorityModal.action.automation,
                forceSelectionMode: true,
            },
        };
        const result = await executeHandler(reOpenAction, playerStats, campaignName, null);
        if (result && result.type === 'modal' && result.modalName === 'combatSuperiority') {
            setCombatSuperiorityModal(result.payload);
        }
    }, [combatSuperiorityModal, playerStats, campaignName]);

    useEffect(() => {
        const parent = document.querySelector('.char-actions');
        if (!parent) return;
        if (typeof globalThis.MutationObserver === 'undefined') return;
        const observer = new globalThis.MutationObserver(() => {
            const popup = parent.querySelector('[class*="popup"]') || parent.querySelector('.popup');
            popupHtmlRef.current = !!popup;
        });
        observer.observe(parent, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let handledPending = false;
        const checkAndHandlePending = () => {
            if (combatSuperiorityModal) return;
            const pending = getRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', campaignName);
            if (!pending || (!pending.attackContext && !pending.skillContext)) {
                return;
            }
            if (handledPending) return;
            handledPending = true;

            const promptType = pending.rollType;
            let handlerType;
            if (promptType === 'attack') {
                handlerType = 'combat_superiority_attack_rider';
            } else if (promptType === 'skill_check') {
                handlerType = 'combat_superiority_prompt_skill_check';
            } else {
                return;
            }

            const handlerAction = {
                automation: { type: handlerType },
                name: 'Combat Superiority',
            };

            const checkPopupVisible = () => {
                if (popupHtmlRef.current) {
                    setTimeout(checkPopupVisible, 200);
                    return;
                }
                executeHandler(handlerAction, playerStats, campaignName, null).then(result => {
                    if (result && result.type === 'modal' && result.modalName === 'combatSuperiority') {
                        setCombatSuperiorityModal(result.payload);
                        setRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', null, campaignName);
                    }
                }).catch(e => {
                    console.error('[useCombatSuperiorityModal] Error checking pending prompt:', e);
                    setRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', null, campaignName);
                });
            };

            setTimeout(checkPopupVisible, SHOW_DICE_ROLL_DELAY);
        };

        const intervalId = setInterval(checkAndHandlePending, 500);
        return () => clearInterval(intervalId);
    }, [combatSuperiorityModal, playerStats, campaignName]);

    return {
        combatSuperiorityModal,
        setCombatSuperiorityModal,
        handleCombatSuperiorityConfirm,
        handleCombatSuperiorityReopenSelection,
    };
}
