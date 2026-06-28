import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { useState, useCallback, useEffect } from 'react';
import { getCategories } from '../../services/character/featureCategories.js'
import { renderMarkdownInline } from '../../services/ui/sanitize.js';
import { loadFightingStyles } from '../../services/ui/dataLoader.js';
import { executeHandler } from '../../services/automation/index.js';
import { isInteractiveAutomation } from '../../services/combat/automation/automationService.js';
import TeleportModal from './modals/TeleportModal.jsx';
import SignatureSpellsModal from './modals/arcane/SignatureSpellsModal.jsx';
import SpellMasteryModal from './modals/arcane/SpellMasteryModal.jsx';
import SavantModal from './modals/arcane/SavantModal.jsx';
import CombatSuperiorityModal from './modals/CombatSuperiorityModal.jsx';
import WeaponKindMasteryModal from './modals/WeaponKindMasteryModal.jsx';
import WeaponMasteryChoiceModal from './modals/WeaponMasteryChoiceModal.jsx';
import { onSignatureSpellsSelected } from '../../services/automation/handlers/class-wizard/signatureSpellsHandler.js';
import { onSpellMasterySelected } from '../../services/automation/handlers/class-wizard/spellMasteryHandler.js';
import { onSavantSelected } from '../../services/automation/handlers/class-wizard/SavantHandler.js';

import { SHOW_DICE_ROLL_DELAY } from '../../config/ui-config.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { useCombatSuperiorityModal } from '../../hooks/combat/useCombatSuperiorityModal.js';

function CharSpecialActions({ playerStats, campaignName, cannotAct, characters }) {
    const [teleportModal, setTeleportModal] = useState(null);
    const [signatureSpellsModal, setSignatureSpellsModal] = useState(null);
    const [spellMasteryModal, setSpellMasteryModal] = useState(null);
    const [savantModal, setSavantModal] = useState(null);
    const [weaponKindMasteryModal, setWeaponKindMasteryModal] = useState(null);
    const [weaponMasteryChoiceModal, setWeaponMasteryChoiceModal] = useState(null);
    const [fightingStylesMap, setFightingStylesMap] = useState(null);
    const { setPopupHtml } = useDiceRollPopup();
    const { rollAttack, rollDamage } = useLoggedDiceRoll(playerStats?.name, campaignName, {
        characters,
        autoDamageSource: 'char-special-actions',
        autoDamageRoll: async (autoDamage, isCrit) => {
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
                }
            } else {
                const match = formula.match(/^(\d+)\s*\[Superiority\]$/);
                if (match) {
                    const dieValue = parseInt(match[1], 10);
                    result = { total: dieValue, rolls: [dieValue], modifier: 0 };
                } else {
                    result = isCrit ? rollExpressionDoubled(autoDamage.formula) : rollExpression(autoDamage.formula);
                }
            }
            if (result) {
                const context = {
                    damageType: autoDamage.damageType,
                    targetName: autoDamage.targetName,
                    attackerName: autoDamage.attackerName,
                    isAutoCrit: isCrit,
                    playerStats,
                    doubledRolls: result.doubledRolls,
                };
                rollDamage(autoDamage.name, autoDamage.formula, result.total, result.rolls, result.modifier, context);
                if (autoDamage.ripostePopup) {
                    const payload = autoDamage.ripostePopup;
                    const html = typeof payload === 'string'
                        ? payload
                        : `<b><i class="fa-solid fa-bolt"></i> ${payload.name || 'Combat Superiority'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
                    setTimeout(() => {
                        setPopupHtml(html);
                    }, SHOW_DICE_ROLL_DELAY);
                }
            }
        },
    });

    const {
        combatSuperiorityModal,
        setCombatSuperiorityModal,
        handleCombatSuperiorityConfirm,
        handleCombatSuperiorityReopenSelection,
    } = useCombatSuperiorityModal(playerStats, campaignName, rollAttack, rollDamage, setPopupHtml);

    useEffect(() => {
        let cancelled = false;
        loadFightingStyles().then(styles => {
            if (cancelled) return;
            const map = {};
            styles.forEach(s => { map[s.name] = s; });
            setFightingStylesMap(map);
        });
        return () => { cancelled = true; };
    }, []);

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
            } else if (result.modalName === 'weaponKindMastery') {
                setWeaponKindMasteryModal(result.payload);
            } else if (result.modalName === 'weaponMasteryChoice') {
                setWeaponMasteryChoiceModal(result.payload);
            }
        }
    }, [playerStats, campaignName, cannotAct, setCombatSuperiorityModal]);

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



    // Build specialActions list immutably
    let specialActions = [...(playerStats.specialActions || [])];

    // Add fighting style special actions
    if (fightingStylesMap && playerStats.class.fightingStyles) {
        if (playerStats.class.fightingStyles.includes('Great Weapon Fighting') && !specialActions.find((specialAction) => specialAction.name === 'Great Weapon Fighting')) {
            const style = fightingStylesMap['Great Weapon Fighting'];
            if (style) specialActions.push(style);
         } else if (playerStats.class.fightingStyles.includes('Interception') && !specialActions.find((specialAction) => specialAction.name === 'Interception')) {
            const style = fightingStylesMap['Interception'];
            if (style) specialActions.push(style);
         } else if (playerStats.class.fightingStyles.includes('Protection') && !specialActions.find((specialAction) => specialAction.name === 'Protection')) {
            const style = fightingStylesMap['Protection'];
            if (style) specialActions.push(style);
         } else if (playerStats.class.fightingStyles.includes('Two-Weapon Fighting') && !specialActions.find((specialAction) => specialAction.name === 'Two-Weapon Fighting')) {
            const style = fightingStylesMap['Two-Weapon Fighting'];
            if (style) specialActions.push(style);
            }
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
            {weaponKindMasteryModal && (
                <WeaponKindMasteryModal
                    {...weaponKindMasteryModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setWeaponKindMasteryModal(null)}
                />
            )}
            {weaponMasteryChoiceModal && (
                <WeaponMasteryChoiceModal
                    {...weaponMasteryChoiceModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setWeaponMasteryChoiceModal(null)}
                    onConfirm={() => setWeaponMasteryChoiceModal(null)}
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
