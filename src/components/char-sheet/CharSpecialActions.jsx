import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { useState, useCallback, useEffect, useRef } from 'react';
import { getCategories } from '../../services/character/featureCategories.js'
import { renderMarkdownInline, sanitizeHtml } from '../../services/ui/sanitize.js';
import { getFightingStyle } from '../../services/character/fightingStyles.js'
import { executeHandler } from '../../services/automation/index.js';
import { isInteractiveAutomation } from '../../services/combat/automation/automationService.js';
import TeleportModal from './modals/TeleportModal.jsx';
import SignatureSpellsModal from './modals/arcane/SignatureSpellsModal.jsx';
import SpellMasteryModal from './modals/arcane/SpellMasteryModal.jsx';
import SavantModal from './modals/arcane/SavantModal.jsx';
import CombatSuperiorityModal from './modals/CombatSuperiorityModal.jsx';
import { onSignatureSpellsSelected } from '../../services/automation/handlers/class-wizard/signatureSpellsHandler.js';
import { onSpellMasterySelected } from '../../services/automation/handlers/class-wizard/spellMasteryHandler.js';
import { onSavantSelected } from '../../services/automation/handlers/class-wizard/SavantHandler.js';
import { onCombatSuperioritySelected, executeManeuver } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { addEntry } from '../../services/ui/logService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { SHOW_DICE_ROLL_DELAY } from '../../config/ui-config.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';

function CharSpecialActions({ playerStats, campaignName, cannotAct, characters }) {
    const [teleportModal, setTeleportModal] = useState(null);
    const [signatureSpellsModal, setSignatureSpellsModal] = useState(null);
    const [spellMasteryModal, setSpellMasteryModal] = useState(null);
    const [savantModal, setSavantModal] = useState(null);
    const [combatSuperiorityModal, setCombatSuperiorityModal] = useState(null);
    const { popupHtml, setPopupHtml } = useDiceRollPopup();
    const { rollAttack, rollDamage } = useLoggedDiceRoll(playerStats?.name, campaignName, {
        characters,
        autoDamageRoll: async (autoDamage, isCrit) => {
            console.log('[CharSpecialActions] autoDamageRoll called', { formula: autoDamage.formula, isCrit, rollDamageType: typeof rollDamage });
            const formula = autoDamage.formula;
            let result;
            const superiorityMatch = formula.match(/\+ (\d+)\s*\[Superiority\]$/);
            if (superiorityMatch) {
                const baseFormula = formula.replace(/\+ \d+\s*\[Superiority\]/, '');
                const superiorityValue = parseInt(superiorityMatch[1], 10);
                const baseResult = isCrit ? rollExpressionDoubled(baseFormula) : rollExpression(baseFormula);
                if (baseResult) {
                    result = {
                        total: baseResult.total + superiorityValue,
                        rolls: [...baseResult.rolls, superiorityValue],
                        modifier: baseResult.modifier,
                    };
                    console.log('[CharSpecialActions] Base + Superiority damage', { baseFormula, baseResult, superiorityValue, total: result.total });
                }
            } else {
                const match = formula.match(/^(\d+)\s*\[Superiority\]$/);
                if (match) {
                    const dieValue = parseInt(match[1], 10);
                    result = { total: dieValue, rolls: [dieValue], modifier: 0 };
                    console.log('[CharSpecialActions] Superiority die (flat value)', { dieValue });
                } else {
                    result = isCrit ? rollExpressionDoubled(autoDamage.formula) : rollExpression(autoDamage.formula);
                    console.log('[CharSpecialActions] rollExpression result', { result, formula });
                }
            }
            if (result) {
                const context = {
                    damageType: autoDamage.damageType,
                    targetName: autoDamage.targetName,
                    attackerName: autoDamage.attackerName,
                };
                console.log('[CharSpecialActions] calling rollDamage', { name: autoDamage.name, formula: autoDamage.formula, total: result.total });
                console.log('[CharSpecialActions] rollDamage context', { context: JSON.stringify(context) });
                rollDamage(autoDamage.name, autoDamage.formula, result.total, result.rolls, result.modifier, context);
                console.log('[CharSpecialActions] rollDamage returned');
            }
        },
    });

    const handleAutomationClick = useCallback(async (action) => {
        if (cannotAct) return;
        const result = await executeHandler(action, playerStats, campaignName, null);
        if (!result) return;
        if (result.type === 'modal') {
            if (result.modalName === 'teleport') {
                setTeleportModal(result.payload);
            } else if (result.modalName === 'signatureSpells') {
                setSignatureSpellsModal(result.payload);
            } else if (result.modalName === 'spellMastery') {
                setSpellMasteryModal(result.payload);
            } else if (result.modalName?.includes('Savant')) {
                setSavantModal(result.payload);
            } else if (result.modalName === 'combatSuperiority') {
                setCombatSuperiorityModal(result.payload);
            }
        }
    }, [playerStats, campaignName, cannotAct]);

    const handleSignatureSpellsConfirm = useCallback(async (spell1, spell2) => {
        if (!signatureSpellsModal) return;
        const result = await onSignatureSpellsSelected(signatureSpellsModal.action, playerStats, campaignName, spell1, spell2);
        setSignatureSpellsModal(null);
        if (result?.type === 'popup') {
            const payload = result.payload;
            const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-magic"></i> ${payload.name || 'Signature Spells'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [signatureSpellsModal, playerStats, campaignName, setPopupHtml]);

    const handleSpellMasteryConfirm = useCallback(async (spell1, spell2) => {
        if (!spellMasteryModal) return;
        const result = await onSpellMasterySelected(spellMasteryModal.action, playerStats, campaignName, spell1, spell2);
        setSpellMasteryModal(null);
        if (result?.type === 'popup') {
            const payload = result.payload;
            const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-magic"></i> ${payload.name || 'Spell Mastery'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [spellMasteryModal, playerStats, campaignName, setPopupHtml]);

    const handleSavantConfirm = useCallback(async (spell1, spell2) => {
        if (!savantModal) return;
        const result = await onSavantSelected(savantModal.action, playerStats, campaignName, spell1, spell2, savantModal.school);
        setSavantModal(null);
        if (result?.type === 'popup') {
            const payload = result.payload;
            const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-magic"></i> ${payload.name || savantModal.school} Savant</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [savantModal, playerStats, campaignName, setPopupHtml]);

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
            if (result?.type === 'popup') {
                const payload = result.payload;
                const html = typeof payload === 'string'
                    ? payload
                    : `<b><i class="fa-solid fa-bolt"></i> ${payload.name || 'Combat Superiority'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
                setPopupHtml(html);
            }
            if (result?.type === 'attack_roll' && rollAttack) {
                const { attack, targetName } = result.payload;
                const superiorityDieValue = result.context?.superiorityDieValue || 0;
                const superiorityDieSize = result.context?.superiorityDieSize || 6;
                const totalHitBonus = attack.hitBonus + superiorityDieValue;
                const baseFormula = result.context?.baseDamageFormula || attack.damageFormula;
                const combinedFormula = superiorityDieValue > 0 && baseFormula ? `${baseFormula} + ${superiorityDieValue}[Superiority]` : (baseFormula || null);
                console.log('[CharSpecialActions] Firing attack_roll', { attackName: attack.name, hitBonus: attack.hitBonus, superiorityDieValue, superiorityDieSize, totalHitBonus, targetName, damageFormula: combinedFormula, baseFormula });
                rollAttack(attack.name, totalHitBonus, { targetName, forcedMode: undefined, isOpportunityAttack: true, autoDamageFormula: combinedFormula, autoDamageName: `${attack.name} (Riposte)`, damageType: attack.damageType || 'Slashing', autoDamageRollResult: null, superiorityDieValue });
            }
            return;
        }

        result = await onCombatSuperioritySelected(combatSuperiorityModal.action, playerStats, campaignName, selectedManeuverNames, singleUseManeuverName);
        if (result?.logEntries) {
            for (const entry of result.logEntries) {
                await addEntry(campaignName, entry).catch(() => {});
            }
        }
        if (result?.type === 'popup') {
            const payload = result.payload;
            const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-bolt"></i> ${payload.name || 'Combat Superiority'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
        if (result?.popup) {
            const payload = result.popup;
            const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-bolt"></i> ${payload.name || 'Combat Superiority'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
        if (result?.type === 'attack_roll' && rollAttack) {
            const { attack, targetName } = result.payload;
            const superiorityDieValue = result.context?.superiorityDieValue || 0;
            const superiorityDieSize = result.context?.superiorityDieSize || 6;
            const totalHitBonus = attack.hitBonus + superiorityDieValue;
            const baseFormula = result.context?.baseDamageFormula || attack.damageFormula;
            const combinedFormula = superiorityDieValue > 0 && baseFormula ? `${baseFormula} + ${superiorityDieValue}[Superiority]` : (baseFormula || null);
            console.log('[CharSpecialActions] Firing attack_roll', { attackName: attack.name, hitBonus: attack.hitBonus, superiorityDieValue, superiorityDieSize, totalHitBonus, targetName, damageFormula: combinedFormula, baseFormula });
            rollAttack(attack.name, totalHitBonus, { targetName, forcedMode: undefined, isOpportunityAttack: true, autoDamageFormula: combinedFormula, autoDamageName: `${attack.name} (Riposte)`, damageType: attack.damageType || 'Slashing', autoDamageRollResult: null, superiorityDieValue });
        }
    }, [combatSuperiorityModal, playerStats, campaignName, rollAttack, setPopupHtml]);

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

    const popupHtmlRef = useRef(null);
    useEffect(() => {
        /* global MutationObserver */
        const parent = document.querySelector('.char-actions');
        if (!parent) return;
        const observer = new MutationObserver(() => {
            const popup = parent.querySelector('[class*="Popup"]') || parent.querySelector('.popup');
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
                if (handledPending) handledPending = false;
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
                    console.error('[CharSpecialActions] Error checking pending Combat Superiority prompt:', e);
                    setRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt', null, campaignName);
                });
            };

            setTimeout(checkPopupVisible, SHOW_DICE_ROLL_DELAY);
        };

        const intervalId = setInterval(checkAndHandlePending, 500);
        return () => clearInterval(intervalId);
    }, [combatSuperiorityModal, playerStats, campaignName]);



    // Build specialActions list immutably
    let specialActions = [...(playerStats.specialActions || [])];

      // Add fighting style special actions
    if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Great Weapon Fighting') && !specialActions.find((specialAction) => specialAction.name === 'Great Weapon Fighting')) {
        const style = getFightingStyle('Great Weapon Fighting');
        if (style) specialActions.push(style);
     } else if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Protection') && !specialActions.find((specialAction) => specialAction.name === 'Protection')) {
        const style = getFightingStyle('Protection');
        if (style) specialActions.push(style);
        }


    // Get names of features that should not be shown in Special Actions
    const actionNames = new Set(playerStats.actions?.map(action => action.name) || []);
    const bonusActionNames = new Set(playerStats.bonusActions?.map(action => action.name) || []);
    const reactionNames = new Set(playerStats.reactions?.map(action => action.name) || []);
    const characterAdvancementNames = new Set(playerStats.characterAdvancement?.map(feature => feature.name) || []);
    
      const categories = getCategories(playerStats.rules || '5e');
    
    // Filter out features that are in actions, bonusActions, reactions, or characterAdvancement, or featuresToIgnore
    const filteredActions = specialActions.filter(action => 
          !actionNames.has(action.name) && 
          !bonusActionNames.has(action.name) && 
          !reactionNames.has(action.name) &&
          !characterAdvancementNames.has(action.name) &&
          !categories.featuresToIgnore.includes(action.name)
      );
    
    const uniqueActions = Array.from(new Map(filteredActions.map(action => [action.name, action])).values());
    return (
            <div>
                <div className='sectionHeader'>Special Actions</div>
             {teleportModal && (
                <TeleportModal
                    action={teleportModal.action}
                    playerStats={teleportModal.playerStats}
                    campaignName={teleportModal.campaignName}
                    onClose={() => setTeleportModal(null)}
                />
            )}
            {signatureSpellsModal && (
                <SignatureSpellsModal
                    payload={signatureSpellsModal}
                    onConfirm={handleSignatureSpellsConfirm}
                    onClose={() => setSignatureSpellsModal(null)}
                />
            )}
            {spellMasteryModal && (
                <SpellMasteryModal
                    payload={spellMasteryModal}
                    onConfirm={handleSpellMasteryConfirm}
                    onClose={() => setSpellMasteryModal(null)}
                />
            )}
            {savantModal && (
                <SavantModal
                    payload={savantModal}
                    onConfirm={handleSavantConfirm}
                    onClose={() => setSavantModal(null)}
                />
            )}
            {combatSuperiorityModal && (
                <CombatSuperiorityModal
                    payload={combatSuperiorityModal}
                    onConfirm={handleCombatSuperiorityConfirm}
                    onReopenSelection={handleCombatSuperiorityReopenSelection}
                    onClose={() => setCombatSuperiorityModal(null)}
                />
            )}
            {uniqueActions.map((specialAction, index) => {
                const isClickable = isInteractiveAutomation(specialAction);
                return <div key={specialAction.name || `special-action-${index}`}>
                        <b className={isClickable ? "clickable" : ""} onClick={isClickable ? () => handleAutomationClick(specialAction) : undefined}>{specialAction.name}:</b> <span dangerouslySetInnerHTML={{ __html: renderMarkdownInline(specialAction.description) }}></span>
                    </div>
                })}
           </div>
        )
}

export default CharSpecialActions
