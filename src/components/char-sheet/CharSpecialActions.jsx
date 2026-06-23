import { useState, useCallback, useEffect } from 'react';
import Popup from '../common/Popup.jsx'
import { getCategories } from '../../services/character/featureCategories.js'
import { renderMarkdownInline } from '../../services/ui/sanitize.js';
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
import { onCombatSuperioritySelected } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

function CharSpecialActions({ playerStats, campaignName, cannotAct }) {
    const [popupHtml, setPopupHtml] = useState(null);
    const [teleportModal, setTeleportModal] = useState(null);
    const [signatureSpellsModal, setSignatureSpellsModal] = useState(null);
    const [spellMasteryModal, setSpellMasteryModal] = useState(null);
    const [savantModal, setSavantModal] = useState(null);
    const [combatSuperiorityModal, setCombatSuperiorityModal] = useState(null);

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
    }, [signatureSpellsModal, playerStats, campaignName]);

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
    }, [spellMasteryModal, playerStats, campaignName]);

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
    }, [savantModal, playerStats, campaignName]);

    const handleCombatSuperiorityConfirm = useCallback(async (selectedManeuverNames, singleUseManeuverName) => {
        if (!combatSuperiorityModal) return;
        const result = await onCombatSuperioritySelected(combatSuperiorityModal.action, playerStats, campaignName, selectedManeuverNames, singleUseManeuverName);
        setCombatSuperiorityModal(null);
        if (result?.type === 'popup') {
            const payload = result.payload;
            const html = typeof payload === 'string'
                ? payload
                : `<b><i class="fa-solid fa-bolt"></i> ${payload.name || 'Combat Superiority'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [combatSuperiorityModal, playerStats, campaignName]);

    useEffect(() => {
        const checkPendingPrompt = () => {
            if (combatSuperiorityModal) return;
            const pending = getRuntimeValue(playerStats.name, 'pendingCombatSuperiorityPrompt');
            if (!pending) return;
            if (!pending.attackContext && !pending.skillContext) return;

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

        const intervalId = setInterval(checkPendingPrompt, 500);
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
            {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)} />}
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
