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
import { confirmTeleport } from '../../services/automation/handlers/class-warlock/tempTeleportHandler.js';
import SignatureSpellsModal from './modals/arcane/SignatureSpellsModal.jsx';
import SpellMasteryModal from './modals/arcane/SpellMasteryModal.jsx';
import SavantModal from './modals/arcane/SavantModal.jsx';
import CombatSuperiorityModal from './modals/CombatSuperiorityModal.jsx';
import WeaponKindMasteryModal from './modals/WeaponKindMasteryModal.jsx';
import WeaponMasteryChoiceModal from './modals/WeaponMasteryChoiceModal.jsx';
import ResourcePoolModal from './modals/ResourcePoolModal.jsx';
import NaturalRecoveryModal from './modals/NaturalRecoveryModal.jsx';
import CircleOfTheLandSpellsModal from './modals/CircleOfTheLandSpellsModal.jsx';
import ElementalAffinityModal from './modals/ElementalAffinityModal.jsx';
import WildMagicSurgeModal from './modals/WildMagicSurgeModal.jsx';
import StrideOfTheElementsModal from './modals/StrideOfTheElementsModal.jsx';
import ElementalEpitomeModal from './modals/ElementalEpitomeModal.jsx';
import DestructiveStrideModal from './modals/DestructiveStrideModal.jsx';
import QuiveringPalmModal from './modals/QuiveringPalmModal.jsx';
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx';
import StepsOfTheFeyTauntModal from './modals/StepsOfTheFeyTauntModal.jsx';
import { onSignatureSpellsSelected } from '../../services/automation/handlers/class-wizard/signatureSpellsHandler.js';
import { onSpellMasterySelected } from '../../services/automation/handlers/class-wizard/spellMasteryHandler.js';
import { onSavantSelected } from '../../services/automation/handlers/class-wizard/SavantHandler.js';
import { addEntry } from '../../services/ui/logService.js';
import './CharSpecialActions.css';


function CharSpecialActions({ playerStats, campaignName, cannotAct, characters }) {
    const [teleportModal, setTeleportModal] = useState(null);
    const [moonlightStepFallback, setMoonlightStepFallback] = useState(null);
    const [signatureSpellsModal, setSignatureSpellsModal] = useState(null);
    const [spellMasteryModal, setSpellMasteryModal] = useState(null);
    const [savantModal, setSavantModal] = useState(null);
    const [weaponKindMasteryModal, setWeaponKindMasteryModal] = useState(null);
    const [weaponMasteryChoiceModal, setWeaponMasteryChoiceModal] = useState(null);
    const [resourcePoolModal, setResourcePoolModal] = useState(null);
    const [naturalRecoveryModal, setNaturalRecoveryModal] = useState(null);
    const [circleOfTheLandSpellsModal, setCircleOfTheLandSpellsModal] = useState(null);
    const [featureChoiceModal, setFeatureChoiceModal] = useState(null);
    const [aspectOfTheWildsModal, setAspectOfTheWildsModal] = useState(null);
    const [elementalAffinityModal, setElementalAffinityModal] = useState(null);
    const [wildMagicSurgeModal, setWildMagicSurgeModal] = useState(null);
    const [strideModal, setStrideModal] = useState(null);
    const [epitomeModal, setEpitomeModal] = useState(null);
    const [destructiveStrideModal, setDestructiveStrideModal] = useState(null);
    const [destructiveStrideTargetModal, setDestructiveStrideTargetModal] = useState(null);
    const [quiveringPalmModal, setQuiveringPalmModal] = useState(null);
    const [stepsOfTheFeyTauntModal, setStepsOfTheFeyTauntModal] = useState(null);
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
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: action.name,
            description: `Chose option: ${choice}`,
        }).catch(() => {});
        const restMessage = (action.automation?.type === 'defensive_tactics' || action.automation?.type === 'hunter_prey')
            ? 'This choice can be changed on a Short Rest or Long Rest.'
            : 'This choice can be changed by clicking the feature again.';
        const html = `<b>${action.name}</b><br/>Option chosen: <b>${choice}</b>. ${restMessage}`;
        setPopupHtml(html);
    }, [featureChoiceModal, playerStats, campaignName, setPopupHtml]);

    const handleFeatureChoiceSkip = useCallback(() => {
        setFeatureChoiceModal(null);
    }, []);

    const handleAspectOfTheWildsConfirm = useCallback(async (choice) => {
        const existingBuffs = getRuntimeValue(playerStats.name, 'activeBuffs', campaignName);
        const currentBuffs = Array.isArray(existingBuffs) ? [...existingBuffs] : [];
        const aspectBuffIndex = currentBuffs.findIndex(b => b.name === 'Aspect of the Wilds');
        if (aspectBuffIndex !== -1) {
            currentBuffs[aspectBuffIndex] = {
                name: 'Aspect of the Wilds',
                effect: choice === 'Owl' ? 'darkvision_aspect' : choice === 'Panther' ? 'climb_speed_aspect' : 'swim_speed_aspect',
                duration: 'infinite',
                optionName: choice,
            };
        } else {
            currentBuffs.push({
                name: 'Aspect of the Wilds',
                effect: choice === 'Owl' ? 'darkvision_aspect' : choice === 'Panther' ? 'climb_speed_aspect' : 'swim_speed_aspect',
                duration: 'infinite',
                optionName: choice,
            });
        }
        setRuntimeValue(playerStats.name, 'activeBuffs', currentBuffs, campaignName);
        setRuntimeValue(playerStats.name, 'aspectOfTheWildsOption', choice, campaignName);
        setRuntimeValue(playerStats.name, 'aspectOfTheWildsUsedThisRest', true, campaignName);
        setAspectOfTheWildsModal(null);
        addEntry(campaignName, {
            type: 'ability_use',
            characterName: playerStats.name,
            abilityName: 'Aspect of the Wilds',
            description: `Chose ${choice} aspect`,
        }).catch(() => {});
        const effects = {
            Owl: 'Darkvision 60 ft.',
            Panther: 'Climb speed equal to walking speed',
            Salmon: 'Swim speed equal to walking speed',
        };
        const html = `<b>Aspect of the Wilds</b><br/>Chose <b>${choice}</b>: ${effects[choice]}<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
    }, [playerStats, campaignName, setPopupHtml]);

    const handleAspectOfTheWildsSkip = useCallback(() => {
        setAspectOfTheWildsModal(null);
    }, []);

    const aspectOptions = [
        { name: 'Owl', description: 'You have Darkvision with a range of 60 feet. If you already have Darkvision, its range increases by 60 feet.', icon: 'eye' },
        { name: 'Panther', description: 'You have a Climb Speed equal to your Speed.', icon: 'paw' },
        { name: 'Salmon', description: 'You have a Swim Speed equal to your Speed.', icon: 'fish' },
    ];

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
        if (auto?.type === 'damage_bonus' && auto.options?.length > 0 && auto.options.every(o => typeof o === 'string')) {
            const optionKey = `_${action.name.replace(/\s+/g, '_')}_option`;
            setFeatureChoiceModal({ action, options: auto.options, optionKey });
            return;
        }
        if (auto?.type === 'animal_aspect') {
            const alreadyUsed = getRuntimeValue(playerStats.name, 'aspectOfTheWildsUsedThisRest', campaignName);
            if (alreadyUsed) {
                const html = `<b>Aspect of the Wilds</b><br/>Already chosen this rest. It can be changed after a Long Rest.<br/><span class="dice-roll-hint">click to dismiss</span>`;
                setPopupHtml(html);
                return;
            }
            setAspectOfTheWildsModal(true);
            return;
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
            } else if (result.modalName === 'resourcePool') {
                setResourcePoolModal(result.payload);
            } else if (result.modalName === 'naturalRecovery') {
                setNaturalRecoveryModal(result.payload);
            } else if (result.modalName === 'circleOfTheLandSpells') {
                setCircleOfTheLandSpellsModal(result.payload);
            } else if (result.modalName === 'moonlightStepFallback') {
                setMoonlightStepFallback(result.payload);
            } else if (result.modalName === 'elementalAffinity') {
                setElementalAffinityModal(result.payload);
            } else if (result.modalName === 'wildMagicSurge') {
                setWildMagicSurgeModal(result.payload);
            } else if (result.modalName === 'strideOfTheElements') {
                setStrideModal(result.payload);
            } else if (result.modalName === 'elementalEpitome') {
                setEpitomeModal(result.payload);
            } else if (result.modalName === 'destructiveStride') {
                setDestructiveStrideModal(result.payload);
            } else if (result.modalName === 'destructiveStrideTarget') {
                setDestructiveStrideTargetModal(result.payload);
            } else if (result.modalName === 'quiveringPalm') {
                setQuiveringPalmModal(result.payload);
            } else if (result.modalName === 'stepsOfTheFeyTaunt') {
                setStepsOfTheFeyTauntModal(result.payload);
            }
        } else if (result.type === 'popup') {
            const payload = result.payload;
            const name = payload?.name || action?.name || 'Automation';
            const description = payload?.description || '';
            const html = `<b>${name}</b><br/>${description}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [playerStats, campaignName, cannotAct, setCombatSuperiorityModal, setPopupHtml]);    const handleStrideConfirm = useCallback(async (optionName, buffEntry) => {
        if (!strideModal) return;
        const { action, playerStats: modalPlayerStats, campaignName: modalCampaign } = strideModal;
        setStrideModal(null);

        const stored = getRuntimeValue(modalPlayerStats.name, 'activeBuffs', modalCampaign);
        const activeBuffs = Array.isArray(stored) ? stored : [];
        const existingStride = activeBuffs.find(b => b.name === 'Stride of the Elements');
        const newBuffs = existingStride
            ? activeBuffs.map(b => b.name === 'Stride of the Elements' ? { ...b, ...buffEntry } : b)
            : [...activeBuffs, { name: 'Stride of the Elements', ...buffEntry }];
        await setRuntimeValue(modalPlayerStats.name, 'activeBuffs', newBuffs, modalCampaign);

        const descriptions = {
            'Ice Walk': 'You can walk across and climb icy or wet surfaces without needing to make an Ability Check. You ignore difficult terrain that is composed of ice or snow.',
            '+10 Speed': 'Your Speed increases by 10 feet.',
            'Fly Speed': 'You gain a Fly Speed equal to your Speed.',
            'Teleport 30 ft': 'You can teleport up to 30 ft to an unoccupied space you can see.',
        };
        const description = `Chose ${optionName}: ${descriptions[optionName] || optionName}`;
        await addEntry(modalCampaign, {
            type: 'ability_use',
            characterName: modalPlayerStats.name,
            abilityName: action.name,
            description,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[StrideOfTheElements] Error logging:', e); });

        const html = `<b>${action.name}</b><br/>Chose <strong>${optionName}</strong>. ${descriptions[optionName] || optionName}<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
    }, [strideModal, setPopupHtml]);

    const handleEpitomeConfirm = useCallback(async (payload) => {
        if (!epitomeModal) return;
        const { action } = epitomeModal;
        setEpitomeModal(null);
        const html = `<b>${action.name}</b><br/>${payload?.description || 'Elemental Epitome activated.'}<br/><span class="dice-roll-hint">click to dismiss</span>`;
        setPopupHtml(html);
    }, [epitomeModal, setPopupHtml]);

    const handleEpitomeClose = useCallback(() => {
        setEpitomeModal(null);
    }, []);

    const handleDestructiveStrideConfirm = useCallback(async (result) => {
        if (!destructiveStrideModal) return;
        setDestructiveStrideModal(null);
        if (result?.type === 'modal' && result.modalName === 'destructiveStrideTarget') {
            setDestructiveStrideTargetModal(result.payload);
        } else if (result?.type === 'popup') {
            const html = `<b>${result.payload?.name || 'Destructive Stride'}</b><br/>${result.payload?.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [destructiveStrideModal, setPopupHtml]);

    const handleDestructiveStrideTargetConfirm = useCallback(async (targetName) => {
        if (!destructiveStrideTargetModal) return;
        const { action, playerStats: modalPlayerStats, campaignName: modalCampaign, chosenType, martialArtsDie } = destructiveStrideTargetModal;
        setDestructiveStrideTargetModal(null);

        const { applyTargetChoice } = await import('../../services/automation/handlers/combat/destructiveStrideHandler.js');
        const result = await applyTargetChoice(action, modalPlayerStats, modalCampaign, targetName, chosenType, martialArtsDie);

        if (result?.type === 'popup') {
            const html = `<b>${result.payload?.name || 'Destructive Stride'}</b><br/>${result.payload?.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [destructiveStrideTargetModal, setPopupHtml]);

    const handleDestructiveStrideTargetSkip = useCallback(() => {
        setDestructiveStrideTargetModal(null);
    }, []);

    const handleMoonlightStepFallbackConfirm = useCallback(async () => {
        if (!moonlightStepFallback) return;
        const { action, playerStats: fallbackStats, campaignName: fallbackCampaign, slotLevel } = moonlightStepFallback;
        setMoonlightStepFallback(null);
        const res = await confirmTeleport(action, fallbackStats, fallbackCampaign, false, slotLevel);
        if (res?.type === 'popup') {
            const payload = res.payload;
            const html = `<b>${payload.name || action.name}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
            setPopupHtml(html);
        }
    }, [moonlightStepFallback, setPopupHtml]);

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
                    isMoonlightStep={teleportModal.action?.automation?.effect === 'moonlight_step_teleport'}
                />
            )}
            {moonlightStepFallback && (
                <div className="sp-overlay" onClick={() => setMoonlightStepFallback(null)}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-moon"></i> {moonlightStepFallback.action.name}
                        </div>
                        <div className="sp-body">
                            <p>No Moonlight Step uses remaining. Consume a level {moonlightStepFallback.slotLevel} spell slot to use Moonlight Step?</p>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-roll-btn" onClick={handleMoonlightStepFallbackConfirm}>
                                <i className="fa-solid fa-check"></i> Yes, Consume Slot
                            </button>
                            <button className="sp-dismiss-btn" onClick={() => setMoonlightStepFallback(null)}>
                                <i className="fa-solid fa-times"></i> No
                            </button>
                        </div>
                    </div>
                </div>
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
            {resourcePoolModal && (
                <ResourcePoolModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    automation={resourcePoolModal.automation}
                    onClose={() => setResourcePoolModal(null)}
                />
            )}
            {naturalRecoveryModal && (
                <NaturalRecoveryModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setNaturalRecoveryModal(null)}
                />
            )}
            {circleOfTheLandSpellsModal && (
                <CircleOfTheLandSpellsModal
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setCircleOfTheLandSpellsModal(null)}
                />
            )}
            {elementalAffinityModal && (
                <ElementalAffinityModal
                    action={elementalAffinityModal.action}
                    playerStats={elementalAffinityModal.playerStats}
                    campaignName={elementalAffinityModal.campaignName}
                    onClose={() => setElementalAffinityModal(null)}
                />
            )}
            {wildMagicSurgeModal && (
                <WildMagicSurgeModal
                    {...wildMagicSurgeModal}
                    onClose={() => setWildMagicSurgeModal(null)}
                />
            )}
            {strideModal && (
                <StrideOfTheElementsModal
                    action={strideModal.action}
                    playerStats={strideModal.playerStats}
                    campaignName={strideModal.campaignName}
                    onConfirm={handleStrideConfirm}
                    onClose={() => setStrideModal(null)}
                />
            )}
            {epitomeModal && (
                <ElementalEpitomeModal
                    action={epitomeModal.action}
                    playerStats={epitomeModal.playerStats}
                    campaignName={epitomeModal.campaignName}
                    currentResistance={epitomeModal.currentResistance}
                    onConfirm={handleEpitomeConfirm}
                    onClose={handleEpitomeClose}
                />
            )}
            {destructiveStrideModal && (
                <DestructiveStrideModal
                    action={destructiveStrideModal.action}
                    playerStats={destructiveStrideModal.playerStats}
                    campaignName={destructiveStrideModal.campaignName}
                    onConfirm={handleDestructiveStrideConfirm}
                    onClose={() => setDestructiveStrideModal(null)}
                />
            )}
            {destructiveStrideTargetModal && (
                <SecondaryTargetModal
                    title="Destructive Stride"
                    icon="fa-person-running"
                    targets={destructiveStrideTargetModal.targets || []}
                    description="Choose a creature within 5 ft. that you entered a space near while striding. A creature can take this damage only once per turn."
                    confirmLabel="Strike"
                    confirmIcon="fa-person-running"
                    onTargetSelected={handleDestructiveStrideTargetConfirm}
                    onSkip={handleDestructiveStrideTargetSkip}
                />
            )}
            {quiveringPalmModal && (
                <QuiveringPalmModal
                    {...quiveringPalmModal}
                    onClose={() => setQuiveringPalmModal(null)}
                />
            )}
            {stepsOfTheFeyTauntModal && (
                <StepsOfTheFeyTauntModal
                    {...stepsOfTheFeyTauntModal}
                    onClose={() => setStepsOfTheFeyTauntModal(null)}
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
            {aspectOfTheWildsModal && (
                <div className="sp-overlay" onClick={handleAspectOfTheWildsSkip}>
                    <div className="sp-modal" onClick={e => e.stopPropagation()}>
                        <div className="sp-header">
                            <i className="fa-solid fa-paw"></i> Aspect of the Wilds
                        </div>
                        <div className="sp-body">
                            <p>Choose an animal aspect:</p>
                            <div style={{ textAlign: 'left', marginTop: '12px' }}>
                                {aspectOptions.map((opt, i) => (
                                    <label key={i} style={{ display: 'block', padding: '8px 12px', margin: '4px 0', borderRadius: '6px', cursor: 'pointer', background: 'transparent', border: '1px solid transparent' }}>
                                        <input
                                            type="radio"
                                            name="aspectOption"
                                            onChange={() => handleAspectOfTheWildsConfirm(opt.name)}
                                            style={{ marginRight: '8px' }}
                                        />
                                        <i className={`fas fa-${opt.icon}`}></i> <strong>{opt.name}</strong> — {opt.description}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="sp-actions">
                            <button className="sp-dismiss-btn" onClick={handleAspectOfTheWildsSkip}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
            {uniqueActions.map((specialAction, index) => {
                const isInteractive = isInteractiveAutomation(specialAction);
                const auto = specialAction.automation;
                const hasStringOptions = auto?.type === 'damage_bonus' && auto.options?.length > 0 && auto.options.every(o => typeof o === 'string');
                const isClickable = isInteractive || (hasStringOptions);
                return <div key={specialAction.name || `special-action-${index}`}>
                        <b className={isClickable ? "clickable" : ""} onClick={isClickable ? () => handleAutomationClick(specialAction) : undefined}>{specialAction.name}:</b> <span dangerouslySetInnerHTML={{ __html: renderMarkdownInline(specialAction.description) }}></span>
                    </div>
                })}
           </div>
        )
}

export default CharSpecialActions
