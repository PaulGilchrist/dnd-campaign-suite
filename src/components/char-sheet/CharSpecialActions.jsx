import { useState, useCallback, useEffect } from 'react';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { useCombatSuperiorityModal } from '../../hooks/combat/useCombatSuperiorityModal.js';
import { normalizeAutoDamage, resolveAttackDamageStandalone } from './useAttackDamageResolution.js';
import { getCategories } from '../../services/character/featureCategories.js';
import { renderMarkdownInline, sanitizeHtml } from '../../services/ui/sanitize.js';
import { loadFightingStyles } from '../../services/ui/dataLoader.js';
import { executeHandler } from '../../services/automation/index.js';
import { isInteractiveAutomation } from '../../services/combat/automation/automationService.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { applyChoice } from '../../services/automation/handlers/class-ranger/defensiveTacticsHandler.js';
import { applyChoice as applyHunterPreyChoice } from '../../services/automation/handlers/class-ranger/hunterPreyHandler.js';
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
import './CharSpecialActions.css';


function CharSpecialActions({ playerStats, campaignName, cannotAct, characters }) {
    const [teleportModal, setTeleportModal] = useState(null);
    const [signatureSpellsModal, setSignatureSpellsModal] = useState(null);
    const [spellMasteryModal, setSpellMasteryModal] = useState(null);
    const [savantModal, setSavantModal] = useState(null);
    const [weaponKindMasteryModal, setWeaponKindMasteryModal] = useState(null);
    const [weaponMasteryChoiceModal, setWeaponMasteryChoiceModal] = useState(null);
    const [featureChoiceModal, setFeatureChoiceModal] = useState(null);
    const [fightingStylesMap, setFightingStylesMap] = useState(null);
    const { setPopupHtml } = useDiceRollPopup();
    const { rollAttack, rollDamage } = useLoggedDiceRoll(playerStats?.name, campaignName, {
        characters,
        autoDamageSource: 'char-special-actions',
        autoDamageRoll: async (autoDamage, isCrit) => {
            const { attack, ctx: ctxOverrides } = normalizeAutoDamage(autoDamage, isCrit, playerStats);
            await resolveAttackDamageStandalone(attack, ctxOverrides, { playerStats, campaignName, setPopupHtml, rollDamage, setModalState: () => {} });
            if (autoDamage.ripostePopup) {
                const payload = autoDamage.ripostePopup;
                const html = typeof payload === 'string'
                    ? payload
                    : `<b><i class="fa-solid fa-bolt"></i> ${payload.name || 'Combat Superiority'}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
                setPopupHtml(html);
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

    const handleFeatureChoiceConfirm = useCallback(async (choice) => {
        if (!featureChoiceModal) return;
        const { action, optionKey } = featureChoiceModal;
        if (action.automation?.type === 'defensive_tactics') {
            const result = await applyChoice(playerStats, campaignName, choice);
            if (result?.type === 'popup') {
                setPopupHtml(result.payload);
            }
            setFeatureChoiceModal(null);
            return;
        }
        if (action.automation?.type === 'hunter_prey') {
            const result = await applyHunterPreyChoice(playerStats, campaignName, choice);
            if (result?.type === 'popup') {
                setPopupHtml(result.payload);
            }
            setFeatureChoiceModal(null);
            return;
        }
        setRuntimeValue(playerStats.name, optionKey, choice, campaignName);
        setFeatureChoiceModal(null);
        const restMessage = (action.automation?.type === 'defensive_tactics' || action.automation?.type === 'hunter_prey')
            ? 'This choice can be changed on a Short Rest or Long Rest.'
            : 'This choice can be changed by clicking the feature again.';
        const html = `<b>${action.name}</b><br/>Option chosen: <b>${choice}</b>. ${restMessage}`;
        setPopupHtml(html);
    }, [featureChoiceModal, playerStats, campaignName, setPopupHtml]);

    const handleFeatureChoiceSkip = useCallback(() => {
        setFeatureChoiceModal(null);
    }, []);

    const handleAutomationClick = useCallback(async (action) => {
        if (cannotAct) return;
        const auto = action.automation;
        if (auto?.type === 'defensive_tactics') {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setFeatureChoiceModal({ action, options: ['Escape the Horde', 'Multiattack Defense'], optionKey });
                return;
            }
        }
        if (auto?.type === 'hunter_prey') {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_choice`;
            const chosenOption = getRuntimeValue(playerStats.name, optionKey, campaignName);
            if (!chosenOption) {
                setFeatureChoiceModal({ action, options: ['Colossus Slayer', 'Horde Breaker'], optionKey });
                return;
            }
        }
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
        } else if (result.type === 'popup') {
            const payload = result.payload;
            const name = payload?.name || action?.name || 'Automation';
            const description = payload?.description || '';
            const html = `<b>${name}</b><br/>${description}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [playerStats, campaignName, cannotAct, setCombatSuperiorityModal, setPopupHtml]);

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
            <div className='char-special-actions'>
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
            {featureChoiceModal && (
                <div className="sp-overlay" onClick={handleFeatureChoiceSkip}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-bolt"></i> {featureChoiceModal.action.name}
                        </div>
                        <div className="sp-body">
                            <p><b>Choose your option:</b></p>
                            <p style={{ opacity: 0.8, fontSize: '0.9em' }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(featureChoiceModal.action.description) }}></p>
                            <div style={{ textAlign: 'center', marginTop: '16px' }}>
                                {featureChoiceModal.options.map((opt, i) => {
                                    const optName = typeof opt === 'string' ? opt : opt.name;
                                    return (
                                        <button
                                            key={optName || i}
                                            className="sp-roll-btn"
                                            style={{ margin: '0 6px 8px 6px' }}
                                            onClick={() => handleFeatureChoiceConfirm(optName)}
                                        >
                                            {optName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={handleFeatureChoiceSkip}>Cancel</button>
                        </div>
                    </div>
                </div>
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
