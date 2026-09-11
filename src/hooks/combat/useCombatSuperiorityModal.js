import { useState, useCallback, useEffect, useRef } from 'react';
import { executeHandler } from '../../services/automation/index.js';
import { setRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { executeManeuver, onCombatSuperioritySelected } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const CHOICE_MODAL_EVENTS = {
    baitAndSwitchChoice: 'bait-and-switch-modal-show',
    commanderStrikeChoice: 'commander-strike-modal-show',
    rallyChoice: 'rally-choice-modal-show',
    sweepingAttackTarget: 'sweeping-attack-modal-show',
};

const SINGLE_USE_CHOICE_MODALS = ['baitAndSwitchChoice', 'commanderStrikeChoice', 'rallyChoice', 'sweepingAttackTarget'];
const MULTI_USE_CHOICE_MODALS = ['rallyChoice', 'sweepingAttackTarget'];

async function logResultEntries(campaignName, result) {
    if (!result?.logEntries) return;
    for (const entry of result.logEntries) {
        await addEntry(campaignName, entry).catch((e) => { console.error("[useCombatSuperiorityModal:log-error]", e); });
    }
}

function dispatchChoiceModal(result, allowedModalNames) {
    if (result?.type !== 'modal') return false;
    const eventName = allowedModalNames.includes(result.modalName) ? CHOICE_MODAL_EVENTS[result.modalName] : undefined;
    if (!eventName) return false;
    window.dispatchEvent(new CustomEvent(eventName, { detail: result.payload }));
    return true;
}

function buildResultPopupHtml(payload) {
    return typeof payload === 'string'
        ? payload
        : `<b><i class="fa-solid fa-bolt"></i> ${payload.name || 'Combat Superiority'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
}

function showResultPopup(payload, showPopup) {
    showPopup(buildResultPopupHtml(payload));
}

function dispatchAttackRollResult(result, rollAttack, extraOptions) {
    if (result?.type !== 'attack_roll' || !rollAttack) return;
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
        ...extraOptions,
    });
}

// Precision Attack: add the superiority die to the last attack roll, re-resolve hit/miss,
// and trigger damage when the amended roll now hits. Returns true when handled.
async function handlePrecisionAttack(result, playerStats, campaignName, rollAttack, rollDamage, showPopup) {
    if (!(result?.effect === 'attack_roll_bonus' && result?.dieValue && rollAttack)) return false;
    const lastAttackRoll = await getRuntimeValue(playerStats.name, 'lastAttackRoll', campaignName);
    const lastAttack = await getRuntimeValue('campaign', 'lastAttack', campaignName);
    if (!(lastAttackRoll?.d20 != null && lastAttackRoll?.targetAc != null && lastAttack?.damageFormula)) return false;

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

    const updatedLastAttack = { ...lastAttack, total: newTotal, hit: newHit, isCrit: wasCrit };
    await setRuntimeValue('campaign', 'lastAttack', updatedLastAttack, campaignName);

    const desc = `Precision Attack: Added ${dieValue} to the attack roll (${lastAttackRoll.d20} + ${lastAttackRoll.bonus || 0} + ${dieValue} = ${newTotal}). ${newHit ? 'The attack now hits!' : 'The attack still misses.'}`;

    await addEntry(campaignName, {
        type: 'ability_use',
        characterName: playerStats.name,
        abilityName: 'Precision Attack',
        description: desc,
    }).catch((e) => { console.error("[useCombatSuperiorityModal:log-error]", e); });

    if (newHit && rollDamage) {
        const la = await getRuntimeValue('campaign', 'lastAttack', campaignName);
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
        return true;
    }
    showPopup({ type: 'automation_info', name: 'Precision Attack', description: desc });
    return true;
}

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
        const modalAction = combatSuperiorityModal.action;
        setCombatSuperiorityModal(null);

        if (singleUseManeuverName) {
            const result = await executeManeuver(modalAction, playerStats, campaignName, singleUseManeuverName);
            await logResultEntries(campaignName, result);
            if (dispatchChoiceModal(result, SINGLE_USE_CHOICE_MODALS)) return;
            if (await handlePrecisionAttack(result, playerStats, campaignName, rollAttack, rollDamage, showPopup)) return;
            if (result?.type === 'popup') showResultPopup(result.payload, showPopup);
            dispatchAttackRollResult(result, rollAttack, { ripostePopup: result.popup });
            return;
        }

        const result = await onCombatSuperioritySelected(modalAction, playerStats, campaignName, selectedManeuverNames, singleUseManeuverName);
        await logResultEntries(campaignName, result);
        if (dispatchChoiceModal(result, MULTI_USE_CHOICE_MODALS)) return;
        if (result?.type === 'popup') showResultPopup(result.payload, showPopup);
        if (result?.popup) showResultPopup(result.popup, showPopup);
        dispatchAttackRollResult(result, rollAttack, {});
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

            checkPopupVisible();
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
