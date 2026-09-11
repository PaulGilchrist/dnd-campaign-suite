import React from 'react'
import Popup from '../common/popup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import MetamagicPopup from './popups/MetamagicPopup.jsx'
import ArcaneWardRestoreModal from './modals/arcane/ArcaneWardRestoreModal.jsx'
import BastionOfLawSpendModal from './modals/divine/BastionOfLawSpendModal.jsx'
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx'
import BendFateModal from './modals/BendFateModal.jsx'
import BoonFateModal from './modals/BoonFateModal.jsx'
import StepsOfTheFeyTauntModal from './modals/StepsOfTheFeyTauntModal.jsx'
import SearingVengeanceModal from './modals/SearingVengeanceModal.jsx'
import { getReactionSpellNames } from '../../services/ui/spellSectionUtils.js'
import { getCategories } from '../../services/character/featureCategories.js'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js'
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js'
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js'
import { OPPORTUNITY_ATTACK, MELEE_REACH_FEET } from '../../services/combat/baseCombatActions.js'
import { hasAutomation, hasSpeedyOpportunityDisadvantage } from '../../services/combat/automation/automationService.js'
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js'
import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { executeHandler, confirmSearingVengeance, skipSearingVengeance } from '../../services/automation/index.js'
import { createSaveListener } from '../../services/automation/common/savePrompt.js'
import { addEntry } from '../../services/ui/logService.js'
import { addExpiration } from '../../services/rules/effects/expirations.js'
import { applyWarCasterReaction } from '../../services/automation/handlers/reactions/reactionSpellHandler.js'
import { applyInspiringMovement } from '../../services/automation/handlers/reactions/reactionBonusHandler.js'
import { normalizeAutoDamage, resolveAttackDamageStandalone } from './useAttackDamageResolution.js'
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js'
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js'
import { useSpellPositionResolver } from '../../hooks/combat/useSpellPositionResolver.js';
import { useSpellCastExecutor } from '../../hooks/combat/useSpellCastExecutor.js';
import { resolveSpellDamageAtLevel, isAutoHitSpell, resolveHealExpression } from '../../services/rules/core/spellDamageUtils.js'
import { signFormatter } from '../../services/ui/formatUtils.js';
import './CharActions.css'

function appendDynamicReactions(reactions, playerStats, activeBuffs, pwhStance) {
    // Add automation reactions from playerStats.automation.reactions (e.g., Commanding Presence reaction)
    const automationReactions = playerStats.automation?.reactions || [];
    for (const auto of automationReactions) {
        const featureName = auto.name || auto.type;
        if (featureName && !reactions.find(r => r.name === featureName)) {
            reactions.push({
                name: featureName,
                description: auto.description || '',
                automation: { ...auto },
            });
        }
    }

    // Add dynamic reactions from active buffs (e.g., Revivification from Rage of the Gods)
    for (const buff of activeBuffs) {
        if (buff.reactionSave && !reactions.find(r => r.name === 'Revivification')) {
            reactions.push({
                name: 'Revivification',
                description: 'When a creature within 30 feet of you would drop to 0 Hit Points, you can take a Reaction to expend a use of your Rage to instead change the target\'s Hit Points to a number equal to your Barbarian level.',
                automation: {
                    type: 'revivification',
                    reactionSave: buff.reactionSave,
                },
            });
        }
    }

    // Add Stand reaction from Power Word Heal
    if (pwhStance && !reactions.find(r => r.name === 'Stand (Power Word Heal)')) {
        reactions.push({
            name: 'Stand (Power Word Heal)',
            description: 'You can use your Reaction to stand up.',
        });
    }
}

// Add Bastion of Law ward reaction if active — replace the action entry
// with the spend variant so clicking it triggers handleSpendDice (SPEND
// modal) instead of handleBastionOfLaw (CREATE modal).
function applyBastionOfLawReaction(reactions, wardActive, wardDice) {
    if (!wardActive || wardDice.length === 0) return;
    const bastionReaction = {
        name: 'Bastion of Law',
        description: `Ward active (${wardDice.length}d8 remaining). Click when you take damage to spend dice and reduce damage.`,
        automation: {
            type: 'bastion_of_law_spend',
        },
    };
    const existingIdx = reactions.findIndex(r => r.name === 'Bastion of Law');
    if (existingIdx !== -1) {
        reactions[existingIdx] = bastionReaction;
    } else {
        reactions.push(bastionReaction);
    }
}

function refreshTrackedReactionDescriptions(reactions, playerStats) {
    // Update Stone's Endurance description based on remaining uses
    const stonesEnduranceCurrent = getRuntimeValue(playerStats.name, 'stonesEnduranceUses');
    const stonesEnduranceUses = stonesEnduranceCurrent != null ? stonesEnduranceCurrent : (playerStats._trackedResources?.stonesEnduranceUses?.current ?? 0);
    const stonesEnduranceReaction = reactions.find(r => r.name === "Stone's Endurance");
    if (stonesEnduranceReaction) {
        stonesEnduranceReaction.description = stonesEnduranceUses > 0
            ? `When you take damage, you can take a Reaction to roll 1d12 + CON modifier and heal up to that amount (capped at damage taken). ${stonesEnduranceUses} uses remaining. Recharges on a Long Rest.`
            : 'No uses remaining. Uses will reset on the next Long Rest.';
    }

    // Update Storm's Thunder description based on remaining uses
    const stormsThunderCurrent = getRuntimeValue(playerStats.name, 'stormsThunderUses');
    const stormsThunderUses = stormsThunderCurrent != null ? stormsThunderCurrent : (playerStats._trackedResources?.stormsThunderUses?.current ?? 0);
    const stormsThunderReaction = reactions.find(r => r.name === "Storm's Thunder");
    if (stormsThunderReaction) {
        stormsThunderReaction.description = stormsThunderUses > 0
            ? `When you take damage from a creature within 60 feet of you, you can take a Reaction to deal 1d8 thunder damage to that creature. ${stormsThunderUses} uses remaining. Recharges on a Long Rest.`
            : 'No uses remaining. Uses will reset on the next Long Rest.';
    }
}

// Build the reactions list + reaction-spells list immutably from playerStats,
// active buffs, and dynamic buff/stance grants. Returns the entries the
// component renders plus the click-through reaction spells.
function buildReactions({ playerStats, activeBuffs, pwhStance, wardActive, wardDice }) {
    const reactions = [...(playerStats.reactions || [])];

    appendDynamicReactions(reactions, playerStats, activeBuffs, pwhStance);
    applyBastionOfLawReaction(reactions, wardActive, wardDice);
    refreshTrackedReactionDescriptions(reactions, playerStats);

    const reactionSpellNames = getReactionSpellNames(playerStats);
    let reactionSpells = [];
    if (playerStats.spellAbilities && playerStats.spellAbilities.spells.length > 0) {
        reactionSpells = playerStats.spellAbilities.spells.filter(spell => reactionSpellNames.has(spell.name));
    }
    // Add base reactions to reaction list
    if (!reactions.find((reaction) => reaction.name === OPPORTUNITY_ATTACK.name)) {
        reactions.push(OPPORTUNITY_ATTACK);
    }

    return { reactions, reactionSpells };
}

function RedirectForceModals({ modalState, handleRedirectConfirm, handleRedirectSkip, handleEnergyRedirectionConfirm, handleEnergyRedirectionSkip }) {
    return (
        <>
            {modalState.deflectRedirectModal && (
                <SecondaryTargetModal
                    title={modalState.deflectRedirectModal.title}
                    targets={modalState.deflectRedirectModal.targets}
                    confirmLabel={modalState.deflectRedirectModal.confirmLabel || 'Redirect Force'}
                    confirmIcon={modalState.deflectRedirectModal.confirmIcon || 'fa-bolt'}
                    featureDescription={modalState.deflectRedirectModal.featureDescription}
                    description={modalState.deflectRedirectModal.description}
                    onTargetSelected={handleRedirectConfirm}
                    onSkip={handleRedirectSkip}
                />
            )}
            {modalState.energyRedirectionModal && (
                <SecondaryTargetModal
                    title={modalState.energyRedirectionModal.title}
                    targets={modalState.energyRedirectionModal.targets}
                    confirmLabel={modalState.energyRedirectionModal.confirmLabel || 'Redirect'}
                    confirmIcon={modalState.energyRedirectionModal.confirmIcon || 'fa-bolt'}
                    featureDescription={modalState.energyRedirectionModal.featureDescription}
                    description={modalState.energyRedirectionModal.description}
                    onTargetSelected={handleEnergyRedirectionConfirm}
                    onSkip={handleEnergyRedirectionSkip}
                />
            )}
        </>
    );
}

function CharReactions({ playerStats, campaignName, cannotAct, mapName, characters }) {
    const { setPopupHtml } = useDiceRollPopup();
    const { rollAttack, rollDamage } = useLoggedDiceRoll(playerStats.name, campaignName, { characters, autoDamageSource: 'char-reactions', autoDamageRoll: async (autoDamage, isCrit) => {
            const { attack, ctx: ctxOverrides } = normalizeAutoDamage(autoDamage, isCrit, playerStats);
            await resolveAttackDamageStandalone(attack, ctxOverrides, { playerStats, campaignName, setPopupHtml, rollDamage, setModalState: () => {} });
        } });
    const [selectedSpell, setSelectedSpell] = React.useState(null);
    const [reactiveSpellEligible, setReactiveSpellEligible] = React.useState(null);
    const [isReactiveSpellFlow, setIsReactiveSpellFlow] = React.useState(false);
    const [modalState, setModalState] = React.useState({});
    // modalState and setModalState are now passed as props from CharSheet

    const activeBuffs = useRuntimeValue(playerStats?.name, 'activeBuffs', campaignName) ?? [];

    const pwhStance = useRuntimeValue(playerStats?.name, 'powerWordHealStandPermission', campaignName);

    const getReactionSpellDamageDisplay = React.useCallback((spell) => {
        if (spell.heal_at_slot_level) {
            const spellCastingMod = playerStats.spellAbilities?.modifier || 0;
            return resolveHealExpression(spell, playerStats.level, spellCastingMod);
        }
        const resolved = resolveSpellDamageAtLevel(spell, playerStats.level);
        if (!resolved || spell.level !== 0) return resolved;
        const potentFeature = playerStats.automation?.actions?.find(
            a => a.type === 'damage_bonus' && !a.upgrades && a.options?.some(o => o.toLowerCase().includes('spellcasting'))
        );
        if (!potentFeature) return resolved;
        const optKey = `_${(potentFeature.name || 'PotentSpellcasting').replace(/\s+/g, '_')}_option`;
        const chosen = getRuntimeValue(playerStats.name, optKey, campaignName);
        if (potentFeature.options.length > 1 && !chosen) return resolved;
        if (chosen && !chosen.toLowerCase().includes('spellcasting')) return resolved;
        const wis = playerStats.abilities?.find(a => a.name === 'Wisdom');
        const wisMod = Math.max(0, wis?.bonus || 0);
        if (wisMod <= 0) return resolved;
        return `${resolved}+${wisMod}`;
    }, [playerStats, campaignName]);

    // Build reactions list immutably
    const wardActive = useRuntimeValue(playerStats?.name, 'bastionOfLawActive', campaignName);
    const wardDice = useRuntimeValue(playerStats?.name, 'bastionOfLawWardDice', campaignName) || [];
    const { reactions, reactionSpells } = buildReactions({ playerStats, activeBuffs, pwhStance, wardActive, wardDice });

    // SP-109: a slowed creature can't take Reactions.
    const isSlowed = () => {
        const conditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName) || [];
        return Array.isArray(conditions) && conditions.some(c => String(c).toLowerCase() === 'slow');
    };
    const refuseSlowedReaction = (reactionName) => {
        setPopupHtml(`<b>Reaction Blocked</b><br/>${playerStats.name} is Slowed and can't take Reactions.`);
        addEntry(campaignName, {
            type: 'automation',
            creatureName: playerStats.name,
            name: 'Slow',
            description: `${reactionName} blocked — ${playerStats.name} is Slowed and can't take Reactions.`,
            timestamp: Date.now(),
        }).catch((e) => { console.error('[CharReactions:log-error]', e); });
    };

    const handleReactionClick = async (reaction) => {
        if (cannotAct) return;
        if (isSlowed()) {
            refuseSlowedReaction(reaction.name);
            return;
        }
        if (hasAutomation(reaction)) {
            handleAutomationReaction(reaction);
            return;
        }
        if (reaction.name === OPPORTUNITY_ATTACK.name) {
            handleOpportunityAttack();
            return;
        }
        if (reaction.name === 'Stand (Power Word Heal)') {
            const conditions = getRuntimeValue(playerStats.name, 'activeConditions', campaignName) || [];
            const newConditions = conditions.filter(c => String(c).toLowerCase() !== 'prone');
            if (newConditions.length !== conditions.length) {
                setRuntimeValue(playerStats.name, 'activeConditions', newConditions, campaignName);
            }
            setRuntimeValue(playerStats.name, 'powerWordHealStandPermission', false, campaignName);
            const html = `<b>Stand (Power Word Heal)</b><br/>You used your Reaction to stand up.`;
            setPopupHtml(html);
            return;
        }
        const html = buildFeatureDetailHtml(reaction);
        if (html) setPopupHtml(html);
    };

    const handleOpportunityAttack = async () => {
        try {
            const cs = await getCombatContext(campaignName);
            if (cs) {
                const target = getTargetFromAttacker(cs, playerStats.name);
                if (target) {
                    const targetNoOA = getRuntimeValue(target.name, 'inspiringMovementNoOA');
                    // CLA-353: cs combatants carry no automation/passives (initiativeService.js:15-23),
                    // so gate Tactical Shift (and any other no-OA source, e.g. Step of the Wind) on the
                    // live campaign-level no_opportunity_attacks te instead of a dead passive lookup.
                    const campaignTargetEffects = getRuntimeValue('campaign', 'targetEffects', campaignName) || [];
                    const targetNoOATe = campaignTargetEffects.find(te => te.effect === 'no_opportunity_attacks'
                        && (Array.isArray(te.target) ? te.target.includes(target.name) : te.target === target.name));
                    const targetHasSpeedy = hasSpeedyOpportunityDisadvantage(target);
                    if (targetNoOA || targetNoOATe) {
                        const protector = targetNoOATe ? (targetNoOATe.source || 'Tactical Shift') : 'Inspiring Movement';
                        const html = `<b>Opportunity Attack</b><br/>${target.name} is protected by ${protector} and cannot be targeted by Opportunity Attacks right now.`;
                        setPopupHtml(html);
                        addEntry(campaignName, {
                            type: 'automation',
                            creatureName: playerStats.name,
                            name: 'Opportunity Attack',
                            description: `Opportunity Attack refused — ${target.name} is protected by ${protector} and cannot be targeted by Opportunity Attacks.`,
                            timestamp: Date.now(),
                        }).catch((e) => { console.error('[CharReactions:OA-refusal-log-error]', e); });
                        return;
                    }
                    const targetManeuveringNoOA = getRuntimeValue(target.name, 'maneuveringStepNoOA');
                    if (targetManeuveringNoOA) {
                        const grantSource = getRuntimeValue(target.name, 'maneuveringStepNoOASource');
                        if (!grantSource || grantSource === playerStats.name) {
                            const html = `<b>Opportunity Attack</b><br/>${target.name} was granted Maneuvering Attack movement and cannot be targeted by Opportunity Attacks from ${grantSource || playerStats.name} right now.`;
                            setPopupHtml(html);
                            return;
                        }
                    }
                    if (targetHasSpeedy) {
                        const html = `<b>Opportunity Attack</b><br/>${target.name} has Agile Movement — opportunity attacks against them have Disadvantage.`;
                        setPopupHtml(html);
                        return;
                    }
                }
            }
        } catch (_e) { /* fall through to normal OA */ }
        const meleeAttacks = playerStats.attacks.filter(a => a.type === 'Action' && a.range === MELEE_REACH_FEET);
        const attackRoll = meleeAttacks.length > 0 ? meleeAttacks[0] : playerStats.attacks[0];
        if (attackRoll) {
            rollAttack(attackRoll.name, attackRoll.hitBonus, { forcedMode: undefined, isOpportunityAttack: true });
        }
    };

    const handleAutomationReaction = async (reaction) => {
        if (cannotAct) return;
        const auto = reaction.automation;
        if (!auto) return;

        const result = await executeHandler(reaction, playerStats, campaignName, mapName, characters);
        if (!result) {
            const html = buildFeatureDetailHtml(reaction);
            if (html) setPopupHtml(html);
            return;
        }

        // MN-017/MN-013: handlers return logEntries that must reach the campaign
        // log (mirrors the MN-016 Rally flush in useCharActionsModalHandlers).
        if (Array.isArray(result.logEntries)) {
            result.logEntries.forEach(entry => addEntry(campaignName, entry).catch((e) => { console.error('[CharReactions] Error flushing logEntries:', e); }));
        }

        if (result.type === 'attack_roll') {
            const { attack, targetName } = result.payload;
            const autoDamageFormula = attack.damage || null;
            const autoDamageName = attack.name;
            const damageType = attack.damageType || 'Slashing';
            rollAttack(attack.name, attack.hitBonus, { targetName, forcedMode: undefined, isOpportunityAttack: true, autoDamageFormula, autoDamageName, damageType });
            return;
        }

        if (result.type === 'popup') {
            // FT-099: eligibleSpells checked FIRST — the Reactive Spell picker
            // must render clickable rows; the read-only automation_info popup is
            // the fallback (refusals, "no spells available").
            if (Array.isArray(result.payload.eligibleSpells) && result.payload.eligibleSpells.length > 0) {
                setReactiveSpellEligible(result.payload.eligibleSpells);
                return;
            }
            if (result.payload.type === 'automation_info') {
                setPopupHtml(result.payload);
            }
            return;
        }

        if (result.type === 'modal') {
            if (result.modalName === 'arcaneWardRestore') {
                setModalState({ arcaneWardRestoreModal: result.payload });
            } else if (result.modalName === 'inspiringMovementAlly') {
                setModalState({ inspiringMovementAllyModal: result.payload });
            } else if (result.modalName === 'beguilingTwist') {
                setModalState({ beguilingTwistModal: result.payload });
            } else if (result.modalName === 'bastionOfLawSpend') {
                setModalState({ bastionOfLawSpendModal: result.payload });
            } else if (result.modalName === 'bendFateChoice') {
                setModalState({ bendFateModal: result.payload });
            } else if (result.modalName === 'boonFateChoice') {
                setModalState({ boonFateModal: result.payload });
            } else if (result.modalName === 'deflectRedirect') {
                setModalState({ deflectRedirectModal: result.payload });
            } else if (result.modalName === 'stepsOfTheFeyTaunt') {
                setModalState({ stepsOfTheFeyTauntModal: result.payload });
            } else if (result.modalName === 'searingVengeance') {
                setModalState({ searingVengeanceModal: { ...result.payload, reaction, campaignName, characters } });
            } else if (result.modalName === 'energyRedirection') {
                setModalState({ energyRedirectionModal: result.payload });
            } else if (result.modalName === 'commandingPresenceReaction') {
                setModalState({ commandingPresenceReactionModal: result.payload });
            } else {
                const html = buildFeatureDetailHtml(reaction);
                if (html) setPopupHtml(html);
            }
            return;
        }

        const html = buildFeatureDetailHtml(reaction);
        if (html) setPopupHtml(html);
    };

    const handleRedirectConfirm = React.useCallback(async (targetName) => {
        if (!modalState.deflectRedirectModal) return;
        setModalState({ deflectRedirectModal: null });
        if (!targetName) return;
        await modalState.deflectRedirectModal.onTargetSelected(targetName);
    }, [modalState.deflectRedirectModal, setModalState]);

    const handleRedirectSkip = React.useCallback(async () => {
        if (!modalState.deflectRedirectModal) return;
        setModalState({ deflectRedirectModal: null });
        await modalState.deflectRedirectModal.onSkip?.();
    }, [modalState.deflectRedirectModal, setModalState]);

    const handleEnergyRedirectionConfirm = React.useCallback(async (targetName) => {
        if (!modalState.energyRedirectionModal) return;
        setModalState({ energyRedirectionModal: null });
        if (!targetName) return;
        const result = await modalState.energyRedirectionModal.onTargetSelected(targetName);
        if (result && result.type === 'popup') {
            setPopupHtml(result.payload);
        }
    }, [modalState.energyRedirectionModal, setModalState, setPopupHtml]);

    const handleEnergyRedirectionSkip = React.useCallback(async () => {
        if (!modalState.energyRedirectionModal) return;
        setModalState({ energyRedirectionModal: null });
        await modalState.energyRedirectionModal.onSkip?.();
    }, [modalState.energyRedirectionModal, setModalState]);

    const handleSearingVengeanceConfirm = React.useCallback(async (selectedTargets) => {
        if (!modalState.searingVengeanceModal) return;
        setModalState({ searingVengeanceModal: null });
        const { campaignName: modalCampaign, characters: modalCharacters, automation } = modalState.searingVengeanceModal;
        if (!selectedTargets || selectedTargets.length === 0) return;
        const result = await confirmSearingVengeance(automation, playerStats, modalCampaign, mapName, modalCharacters, { ...modalState.searingVengeanceModal, selectedTargets });
        if (result) {
            if (result.type === 'popup') {
                setPopupHtml(result.payload);
            }
        }
    }, [modalState.searingVengeanceModal, setModalState, playerStats, mapName, setPopupHtml]);

    const handleSearingVengeanceSkip = React.useCallback(async () => {
        if (!modalState.searingVengeanceModal) return;
        setModalState({ searingVengeanceModal: null });
        const { campaignName: modalCampaign, automation } = modalState.searingVengeanceModal;
        const result = await skipSearingVengeance(automation, playerStats, modalCampaign, modalState.searingVengeanceModal);
        if (result) {
            if (result.type === 'popup') {
                setPopupHtml(result.payload);
            }
        }
    }, [modalState.searingVengeanceModal, setModalState, playerStats, setPopupHtml]);

    const handleCommandingPresenceConfirm = React.useCallback(async (targetName) => {
        if (!modalState.commandingPresenceReactionModal) return;
        setModalState({ commandingPresenceReactionModal: null });
        if (!targetName) return;
        const { onTargetSelected } = modalState.commandingPresenceReactionModal;
        const result = await onTargetSelected(targetName);
        if (result) {
            if (result.type === 'popup') {
                setPopupHtml(result.payload);
            }
        }
    }, [modalState.commandingPresenceReactionModal, setModalState, setPopupHtml]);

    const handleCommandingPresenceSkip = React.useCallback(async () => {
        if (!modalState.commandingPresenceReactionModal) return;
        setModalState({ commandingPresenceReactionModal: null });
        const { onSkip } = modalState.commandingPresenceReactionModal;
        if (onSkip) {
            await onSkip();
        }
    }, [modalState.commandingPresenceReactionModal, setModalState]);

    const getTargetInfo = React.useCallback(async () => {
        const cs = await getCombatContext(campaignName);
        if (!cs) return null;
        return getTargetFromAttacker(cs, playerStats.name);
    }, [playerStats.name, campaignName]);

    const { resolvePositions: resolveReactionSpellPositions, cachedPosRef: cachedReactionCastPosRef } = useSpellPositionResolver(campaignName, mapName, playerStats.name);

    const { castAction: reactionCastAction } = useSpellCastExecutor(rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, {}, cachedReactionCastPosRef, setModalState);

    const { pendingMetamagic, gateMetamagic, handleConfirm, handleSkip } = useSpellMetamagicFlow(playerStats, campaignName, reactionCastAction, null, characters, setPopupHtml);
    const { buildUpcastLevels } = useSpellUpcastFlow(playerStats, campaignName);

    const handleReactionSpellCast = React.useCallback(async (spell, metaCtx) => {
        setSelectedSpell(null);

        await resolveReactionSpellPositions();
        gateMetamagic(spell, metaCtx);
    }, [gateMetamagic, resolveReactionSpellPositions]);

    const handleReactiveSpellCast = React.useCallback(async (spell, metaCtx) => {
        setReactiveSpellEligible(null);
        setSelectedSpell(null);

        const cs = await getCombatContext(campaignName);
        const target = getTargetFromAttacker(cs, playerStats.name);
        if (!target) {
            setPopupHtml({
                type: 'automation_info',
                name: 'Reactive Spell',
                description: 'Reactive Spell requires a target — set the Target dropdown on your initiative card first. Nothing was cast.',
            });
            addEntry(campaignName, {
                type: 'automation',
                characterName: playerStats.name,
                automationType: 'reactive_spell_refused',
                name: 'Reactive Spell',
                description: 'Reactive Spell: requires a target — nothing was cast.',
                timestamp: Date.now(),
            }).catch((e) => { console.error('[CharReactions:reactive-spell-refusal-log-error]', e); });
            return;
        }

        const applied = await applyWarCasterReaction(target.name, spell.name, spell, playerStats, campaignName);
        if (!applied?.ok) {
            setPopupHtml({
                type: 'automation_info',
                name: 'Reactive Spell',
                description: `Reactive Spell — ${applied?.refused || 'Refused.'} No spell slot consumed.`,
            });
            return;
        }

        // Real cast leg — gateMetamagic → prepareSpellCast pays the slot
        // numerically, then reactionCastAction resolves the spell.
        await resolveReactionSpellPositions();
        gateMetamagic(spell, metaCtx);
    }, [gateMetamagic, resolveReactionSpellPositions, campaignName, playerStats, setPopupHtml]);

    const handleInspiringMovementConfirm = React.useCallback(async (allyName) => {
        if (!modalState.inspiringMovementAllyModal) return;
        const { action, playerStats: imPlayerStats, campaignName: imCampaignName, halfSpeed, noOAs } = modalState.inspiringMovementAllyModal;
        setModalState({ inspiringMovementAllyModal: null });
        if (!allyName) return;
        const result = await applyInspiringMovement(action, imPlayerStats, imCampaignName, allyName, halfSpeed, noOAs);
        if (!result) return;
        if (result.type === 'popup') {
            setPopupHtml(result.payload);
        }
    }, [modalState.inspiringMovementAllyModal, setModalState, setPopupHtml]);

    const handleBeguilingTwistConfirm = React.useCallback((targetName) => {
        if (!modalState.beguilingTwistModal) return;
        const { playerStats: btPlayerStats, campaignName: btCampaignName, conditionKey, saveDc, featureName } = modalState.beguilingTwistModal;
        setModalState({ beguilingTwistModal: null });
        if (!targetName) return;

        const { promptId } = createSaveListener(btCampaignName, {
            targetName,
            saveType: 'WIS',
            saveDc,
        });

        addEntry(btCampaignName, {
            type: 'ability_use',
            characterName: btPlayerStats.name,
            abilityName: featureName,
            description: `${btPlayerStats.name} used ${featureName} — ${targetName} must make WIS save (DC ${saveDc}) or be ${conditionKey} for 1 minute.`,
            promptId,
        }).catch((e) => { console.error("[beguilingTwist] Error:", e); });

        const handleSaveResult = (event) => {
            if (event.detail.promptId !== promptId) return;

            if (!event.detail.success) {
                const conditions = getRuntimeValue(targetName, 'activeConditions') || [];
                const filtered = (Array.isArray(conditions) ? conditions : []).filter(c => String(c).toLowerCase() !== conditionKey);
                setRuntimeValue(targetName, 'activeConditions', [...filtered, conditionKey], btCampaignName);

                addExpiration(btPlayerStats.name, targetName, [
                    { type: 'condition', condition: conditionKey }
                ], btCampaignName);

                addEntry(btCampaignName, {
                    type: 'save_result',
                    characterName: btPlayerStats.name,
                    targetName,
                    saveDc,
                    saveType: 'WIS',
                    success: false,
                    description: `${targetName} failed WIS save. ${targetName} is now ${conditionKey} for 1 minute.`,
                }).catch((e) => { console.error("[beguilingTwist] Error:", e); });
            } else {
                addEntry(btCampaignName, {
                    type: 'save_result',
                    characterName: btPlayerStats.name,
                    targetName,
                    saveDc,
                    saveType: 'WIS',
                    success: true,
                    description: `${targetName} succeeded on WIS save. ${featureName} has no effect.`,
                }).catch((e) => { console.error("[beguilingTwist] Error:", e); });
            }

            window.removeEventListener('save-result', handleSaveResult);
        };

        window.addEventListener('save-result', handleSaveResult);

        setPopupHtml({
            type: 'automation_info',
            name: featureName,
            targetName,
            description: `Target ${targetName} must make a WIS saving throw (DC ${saveDc}) or be ${conditionKey} for 1 minute.`,
        });
    }, [modalState.beguilingTwistModal, setModalState, setPopupHtml]);

    return (
        <div className='char-actions'>
            {/*
             * CHAR REACTIONS — Spells with casting time of "Reaction".
             * These go on the reaction bar of the character sheet.
             * Use getReactionSpellNames() to determine which spells belong here.
             *
             * MODALS/HANDLERS: Reaction spells that need target selection or complex
             * automation should go in CharReactions modals or CharActionModals when
             * triggered by action-based events (e.g. Opportunity Attack, War Caster).
             *
             * DO NOT put action or bonus action spell handlers here.
             */}
            <div className='sectionHeader'>Reactions</div>
            {selectedSpell && (
                <Popup onClickOrKeyDown={() => { setSelectedSpell(null); setIsReactiveSpellFlow(false); }}>
                    <SpellDetailPopup
                        spell={selectedSpell}
                        playerStats={playerStats}
                        campaignName={campaignName}
                        playerLevel={playerStats.level}
                        upcastLevels={buildUpcastLevels(selectedSpell)}
                        onClose={() => { setSelectedSpell(null); setIsReactiveSpellFlow(false); }}
                        onCast={isReactiveSpellFlow ? handleReactiveSpellCast : handleReactionSpellCast}
                    />
                </Popup>
            )}
            {reactiveSpellEligible && (
                <Popup onClickOrKeyDown={() => { setReactiveSpellEligible(null); }}>
                    <div className="dice-roll-result">
                        <div className="dice-roll-header">
                            <i className="fa-solid fa-wand-magic-sparkles"></i>Reactive Spell
                        </div>
                        <div>Select a single target spell with casting time of 1 action to cast as a reaction:</div>
                        <div className="reactive-spell-list">
                            {[...reactiveSpellEligible].sort((a, b) => a.name.localeCompare(b.name)).map((spellData) => (
                                <div key={spellData.name} className="clickable reactive-spell-row"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setReactiveSpellEligible(null);
                                        const fullSpell = {
                                            ...spellData,
                                            prepared: 'Always',
                                        };
                                        setSelectedSpell(fullSpell);
                                        setIsReactiveSpellFlow(true);
                                    }}>
                                    <span>{spellData.name}</span>
                                </div>
                            ))}
                        </div>
                        <div className="dice-roll-hint">click to dismiss</div>
                    </div>
                </Popup>
            )}
            {pendingMetamagic && (
                <div>
                    <MetamagicPopup
                        spell={{ name: pendingMetamagic.spellName, level: pendingMetamagic.spellLevel || 0 }}
                        playerStats={{ ...playerStats, _metamagicCurrentSP: pendingMetamagic._currentSP }}
                        campaignName={campaignName}
                        onConfirm={handleConfirm}
                        onSkip={handleSkip}
                    />
                </div>
            )}
            {reactionSpells.length > 0 && <div className='attacks'>
                <div className='left'><b>Name</b></div>
                <div><b>Level</b></div>
                <div><b>Range</b></div>
                <div><b>Hit</b></div>
                <div><b>Damage</b></div>
                <div className='left'><b>Type</b></div>
                {reactionSpells.map((spell) => {
                    const damageType = typeof spell.damage === 'string' ? '' : (spell.damage?.damage_type || '');
                    const resolvedDamage = spell.heal_at_slot_level
                        ? resolveHealExpression(spell, playerStats.level, playerStats.spellAbilities?.modifier || 0)
                        : resolveSpellDamageAtLevel(spell, playerStats.level);
                    const autoHit = isAutoHitSpell(spell);
                    const isSpellAtk = !spell.dc;
                    const hasAttackType = spell.attack_type != null && spell.attack_type !== '';
                    return <React.Fragment key={spell.name}>
                        <div className='left clickable' onClick={() => {
                            if (isSlowed()) { refuseSlowedReaction(spell.name); return; }
                            setSelectedSpell(spell);
                        }}>{spell.name}</div>
                        <div>{spell.level === 0 ? 'Cantrip' : spell.level}</div>
                        <div>{spell.range}</div>
                        {autoHit
                            ? <div></div>
                            : isSpellAtk && hasAttackType
                                ? <div className={"clickable" + (cannotAct ? " disabled-attack" : "")} onClick={() => {
                                    const attackItem = { ...spell, type: 'Reaction', hitBonus: playerStats.spellAbilities?.toHit, saveDc: null, saveType: null, saveSuccess: null, damage: resolvedDamage, damageType };
                                    rollAttack(attackItem.name, attackItem.hitBonus, { forcedMode: undefined });
                                }}>{signFormatter.format(playerStats.spellAbilities?.toHit)}</div>
                                : isSpellAtk && !hasAttackType
                                    ? <div></div>
                                    : <div className="save-dc-display">DC {playerStats.spellAbilities?.saveDc} {spell.dc?.dc_type}</div>}
                        <div className={resolvedDamage ? "clickable" : ""} onClick={() => {
                            if (cannotAct) return;
                            // SINGLE ENTRY POINT for reaction spell casting:
                            // gateMetamagic is the single entry point (calls prepareSpellCast → spell slots, concentration)
                            // NEVER call reactionCastAction, castAction, or executeSpellCast directly from JSX onClick handlers.
                            gateMetamagic(spell, {});
                        }}>{getReactionSpellDamageDisplay(spell)}</div>
                        <div className='left'>{damageType || (spell.heal_at_slot_level ? 'Healing' : 'Utility')}</div>
                    </React.Fragment>;
                })}<div className='half-line'></div>
            </div>}
            {modalState.arcaneWardRestoreModal && (
                <ArcaneWardRestoreModal
                    {...modalState.arcaneWardRestoreModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setModalState({ arcaneWardRestoreModal: null })}
                />
            )}
            {modalState.inspiringMovementAllyModal && (
                <SecondaryTargetModal
                    title="Inspiring Movement — Choose Ally"
                    targets={modalState.inspiringMovementAllyModal.creatureTargets}
                    confirmLabel="Move"
                    confirmIcon="fa-person-walking"
                    featureDescription="Both you and the chosen ally move up to half your Speeds without provoking Opportunity Attacks."
                    onTargetSelected={handleInspiringMovementConfirm}
                    onSkip={() => handleInspiringMovementConfirm(null)}
                />
            )}
            {modalState.beguilingTwistModal && (
                <SecondaryTargetModal
                    title="Beguiling Twist — Choose Target"
                    targets={modalState.beguilingTwistModal.targets}
                    confirmLabel="Force Save"
                    confirmIcon="fa-wand-sparkles"
                    featureDescription={`Target must make a WIS save (DC ${modalState.beguilingTwistModal.saveDc}) or be ${modalState.beguilingTwistModal.conditionKey} for 1 minute.`}
                    onTargetSelected={handleBeguilingTwistConfirm}
                    onSkip={() => handleBeguilingTwistConfirm(null)}
                />
            )}
            {modalState.bastionOfLawSpendModal && (
                <BastionOfLawSpendModal
                    {...modalState.bastionOfLawSpendModal}
                    playerName={playerStats.name}
                    campaignName={campaignName}
                    onClose={() => setModalState({ bastionOfLawSpendModal: null })}
                    onConfirm={async (diceToSpend, rollResultData) => {
                        const action = {
                            automation: { type: 'bastion_of_law_spend' },
                            numDice: diceToSpend,
                            preRollResult: rollResultData,
                        };
                        const result = await executeHandler(action, playerStats, campaignName, mapName, characters);
                        if (result) {
                            if (result.type === 'popup') {
                                setPopupHtml(result.payload);
                            }
                            if (result.type === 'modal') {
                                setModalState({ bastionOfLawSpendModal: result.payload });
                            }
                        }
                    }}
                />
            )}
            {modalState.bendFateModal && (
                <BendFateModal
                    {...modalState.bendFateModal}
                    onClose={() => setModalState({ bendFateModal: null })}
                />
            )}
            {modalState.boonFateModal && (
                <BoonFateModal
                    {...modalState.boonFateModal}
                    onClose={() => setModalState({ boonFateModal: null })}
                />
            )}
            <RedirectForceModals modalState={modalState} handleRedirectConfirm={handleRedirectConfirm} handleRedirectSkip={handleRedirectSkip} handleEnergyRedirectionConfirm={handleEnergyRedirectionConfirm} handleEnergyRedirectionSkip={handleEnergyRedirectionSkip} />
            {modalState.stepsOfTheFeyTauntModal && (
                <StepsOfTheFeyTauntModal
                    {...modalState.stepsOfTheFeyTauntModal}
                    onClose={() => setModalState({ stepsOfTheFeyTauntModal: null })}
                />
            )}
            {modalState.searingVengeanceModal && (
                <SearingVengeanceModal
                    creatureTargets={modalState.searingVengeanceModal.creatureTargets}
                    onConfirm={handleSearingVengeanceConfirm}
                    onSkip={handleSearingVengeanceSkip}
                />
            )}
            {modalState.commandingPresenceReactionModal && (
                <SecondaryTargetModal
                    title={modalState.commandingPresenceReactionModal.title}
                    targets={modalState.commandingPresenceReactionModal.targets}
                    confirmLabel={modalState.commandingPresenceReactionModal.confirmLabel || 'Force Save'}
                    confirmIcon={modalState.commandingPresenceReactionModal.confirmIcon || 'fa-wand-sparkles'}
                    featureDescription={modalState.commandingPresenceReactionModal.featureDescription}
                    description={modalState.commandingPresenceReactionModal.description}
                    onTargetSelected={handleCommandingPresenceConfirm}
                    onSkip={handleCommandingPresenceSkip}
                />
            )}
            {reactions.filter(r => !getCategories(playerStats.rules || '5e').featuresToIgnore.includes(r.name)).map((reaction) => {
                const isClickable = (reaction.details || reaction.name === OPPORTUNITY_ATTACK.name || reaction.name === 'Stand (Power Word Heal)' || hasAutomation(reaction)) && reaction.name !== 'Reactive Strike';
                return <div key={reaction.name}>
                    <b className={isClickable ? "clickable" : ""} onClick={() => isClickable && handleReactionClick(reaction)}>{reaction.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(reaction.description) }}></span>
                </div>
            })}
        </div>
    )
}

export default CharReactions