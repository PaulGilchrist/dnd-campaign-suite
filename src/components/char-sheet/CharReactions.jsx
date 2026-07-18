import React from 'react'
import Popup from '../common/popup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import MetamagicPopup from './popups/MetamagicPopup.jsx'
import ArcaneWardRestoreModal from './modals/arcane/ArcaneWardRestoreModal.jsx'
import BastionOfLawSpendModal from './modals/divine/BastionOfLawSpendModal.jsx'
import SecondaryTargetModal from './modals/shared/SecondaryTargetModal.jsx'
import BendFateModal from './modals/BendFateModal.jsx'
import { getReactionSpellNames } from '../../services/ui/spellSectionUtils.js'
import { getCategories } from '../../services/character/featureCategories.js'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { buildFeatureDetailHtml } from '../../hooks/combat/useActionPopup.js'
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js'
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js'
import { OPPORTUNITY_ATTACK, MELEE_REACH_FEET } from '../../services/combat/baseCombatActions.js'
import { hasAutomation, hasTacticalShift, hasSpeedyOpportunityDisadvantage } from '../../services/combat/automation/automationService.js'
import { getCombatContext, getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js'
import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js'
import { executeHandler } from '../../services/automation/index.js'
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
import { resolveSpellDamageAtLevel, isAutoHitSpell } from '../../services/rules/core/spellDamageUtils.js'
import { signFormatter } from '../../services/ui/formatUtils.js';
import './CharActions.css'

function CharReactions({ playerStats, campaignName, cannotAct, mapName, characters }) {
    const { setPopupHtml } = useDiceRollPopup();
    const { rollAttack, rollDamage } = useLoggedDiceRoll(playerStats.name, campaignName, { characters, autoDamageSource: 'char-reactions', autoDamageRoll: async (autoDamage, isCrit) => {
            const { attack, ctx: ctxOverrides } = normalizeAutoDamage(autoDamage, isCrit, playerStats);
            await resolveAttackDamageStandalone(attack, ctxOverrides, { playerStats, campaignName, setPopupHtml, rollDamage, setModalState: () => {} });
        } });
    const [selectedSpell, setSelectedSpell] = React.useState(null);
    const [reactiveSpellEligible, setReactiveSpellEligible] = React.useState(null);
    const [reactiveSpellWarnings, setReactiveSpellWarnings] = React.useState(false);
    const [isReactiveSpellFlow, setIsReactiveSpellFlow] = React.useState(false);
    const [modalState, setModalState] = React.useState({});
    // modalState and setModalState are now passed as props from CharSheet

    const activeBuffs = useRuntimeValue(playerStats?.name, 'activeBuffs', campaignName) ?? [];

    const pwhStance = useRuntimeValue(playerStats?.name, 'powerWordHealStandPermission', campaignName);

    const getReactionSpellDamageDisplay = React.useCallback((spell) => {
        if (spell.heal_at_slot_level) return '';
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
    let reactions = [...(playerStats.reactions || [])];

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

    // Add Bastion of Law ward reaction if active
    const wardActive = useRuntimeValue(playerStats?.name, 'bastionOfLawActive', campaignName);
    const wardDice = useRuntimeValue(playerStats?.name, 'bastionOfLawWardDice', campaignName) || [];
    if (wardActive && wardDice.length > 0 && !reactions.find(r => r.name === 'Bastion of Law')) {
        reactions.push({
            name: 'Bastion of Law',
            description: `Ward active (${wardDice.length}d8 remaining). Click when you take damage to spend dice and reduce damage.`,
            automation: {
                type: 'bastion_of_law_spend',
            },
        });
    }

    const reactionSpellNames = getReactionSpellNames(playerStats);
    let reactionSpells = [];
    if (playerStats.spellAbilities && playerStats.spellAbilities.spells.length > 0) {
        reactionSpells = playerStats.spellAbilities.spells.filter(spell => reactionSpellNames.has(spell.name));
    }
    // Add base reactions to reaction list
    if (!reactions.find((reaction) => reaction.name === OPPORTUNITY_ATTACK.name)) {
        reactions.push(OPPORTUNITY_ATTACK);
    }

    const handleReactionClick = async (reaction) => {
        if (cannotAct) return;
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
                    const targetHasTacticalShift = hasTacticalShift(target);
                    const targetHasSpeedy = hasSpeedyOpportunityDisadvantage(target);
                    if (targetNoOA || targetHasTacticalShift) {
                        const html = `<b>Opportunity Attack</b><br/>${target.name} is protected by Inspiring Movement and cannot be targeted by Opportunity Attacks right now.`;
                        setPopupHtml(html);
                        return;
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

        const result = await executeHandler(reaction, playerStats, campaignName, mapName, playerStats.equipment);
        if (!result) {
            const html = buildFeatureDetailHtml(reaction);
            if (html) setPopupHtml(html);
            return;
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
            setPopupHtml(result.payload);
            if (result.payload.eligibleSpells && result.payload.eligibleSpells.length > 0) {
                setReactiveSpellEligible(result.payload.eligibleSpells);
                setReactiveSpellWarnings(result.payload.hasWarnings || false);
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
            } else {
                const html = buildFeatureDetailHtml(reaction);
                if (html) setPopupHtml(html);
            }
            return;
        }

        const html = buildFeatureDetailHtml(reaction);
        if (html) setPopupHtml(html);
    };

    const getTargetInfo = React.useCallback(async () => {
        const cs = await getCombatContext(campaignName);
        if (!cs) return null;
        return getTargetFromAttacker(cs, playerStats.name);
    }, [playerStats.name, campaignName]);

    const { resolvePositions: resolveReactionSpellPositions, cachedPosRef: cachedReactionCastPosRef } = useSpellPositionResolver(campaignName, mapName, playerStats.name);

    const { castAction: reactionCastAction } = useSpellCastExecutor(rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, {}, cachedReactionCastPosRef, setModalState);

    const { pendingMetamagic, gateMetamagic, handleConfirm, handleSkip } = useSpellMetamagicFlow(playerStats, campaignName, reactionCastAction, null, characters);
    const { buildUpcastLevels } = useSpellUpcastFlow(playerStats, campaignName);

    const handleReactionSpellCast = React.useCallback(async (spell, metaCtx) => {
        setSelectedSpell(null);

        await resolveReactionSpellPositions();
        gateMetamagic(spell, metaCtx);
    }, [gateMetamagic, resolveReactionSpellPositions]);

    const handleReactiveSpellCast = React.useCallback(async (spell, metaCtx) => {
        setReactiveSpellEligible(null);
        setReactiveSpellWarnings(false);
        setSelectedSpell(null);

        const targetName = getTargetFromAttacker(await getCombatContext(campaignName), playerStats.name)?.name || 'unknown target';
        applyWarCasterReaction(targetName, spell.name, spell, playerStats, campaignName);

        await resolveReactionSpellPositions();
        gateMetamagic(spell, metaCtx);
    }, [gateMetamagic, resolveReactionSpellPositions, campaignName, playerStats]);

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
                <Popup onClickOrKeyDown={() => { setReactiveSpellEligible(null); setReactiveSpellWarnings(false); }}>
                    <div className="dice-roll-result">
                        <div className="dice-roll-header">
                            <i className="fa-solid fa-wand-magic-sparkles"></i>Reactive Spell
                        </div>
                        <div>Select a spell with casting time of 1 action to cast as a reaction:</div>
                        <div className="attacks" style={{ marginTop: '8px' }}>
                            {reactiveSpellEligible.map((spellData) => (
                                <div key={spellData.name} className="clickable" style={{ padding: '4px 0', color: '#4fc3f7' }}
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
                                    {spellData.name}{!spellData.isSingleTarget ? ' <i>(multi-target)</i>' : ''}
                                </div>
                            ))}
                        </div>
                        {reactiveSpellWarnings && (
                            <div className="dice-roll-hint" style={{ color: '#ff9800', marginTop: '8px' }}>
                                Some selected spells target more than one creature. Reactive Spell works best with single-target spells.
                            </div>
                        )}
                        <div className="dice-roll-hint" style={{ marginTop: '8px' }}>click to dismiss</div>
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
                    const resolvedDamage = spell.heal_at_slot_level ? '' : resolveSpellDamageAtLevel(spell, playerStats.level);
                    const autoHit = isAutoHitSpell(spell);
                    const isSpellAtk = !spell.dc;
                    return <React.Fragment key={spell.name}>
                        <div className='left clickable' onClick={() => setSelectedSpell(spell)}>{spell.name}</div>
                        <div>{spell.level === 0 ? 'Cantrip' : spell.level}</div>
                        <div>{spell.range}</div>
                        {autoHit
                            ? <div></div>
                            : isSpellAtk
                                ? <div className={"clickable" + (cannotAct ? " disabled-attack" : "")} onClick={() => {
                                    const attackItem = { ...spell, type: 'Reaction', hitBonus: playerStats.spellAbilities?.toHit, saveDc: null, saveType: null, saveSuccess: null, damage: resolvedDamage, damageType };
                                    rollAttack(attackItem.name, attackItem.hitBonus, { forcedMode: undefined });
                                }}>{signFormatter.format(playerStats.spellAbilities?.toHit)}</div>
                                : <div className="save-dc-display">DC {playerStats.spellAbilities?.saveDc} {spell.dc?.dc_type}</div>}
                        <div className={resolvedDamage ? "clickable" : ""} onClick={() => {
                            if (cannotAct) return;
                            reactionCastAction(spell, {});
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
                        const result = await executeHandler(action, playerStats, campaignName, mapName, playerStats.equipment);
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
            {reactions.filter(r => !getCategories(playerStats.rules || '5e').featuresToIgnore.includes(r.name)).map((reaction) => {
                const isClickable = reaction.details || reaction.name === OPPORTUNITY_ATTACK.name || hasAutomation(reaction);
                return <div key={reaction.name}>
                    <b className={isClickable ? "clickable" : ""} onClick={() => handleReactionClick(reaction)}>{reaction.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(reaction.description) }}></span>
                </div>
            })}
        </div>
    )
}

export default CharReactions