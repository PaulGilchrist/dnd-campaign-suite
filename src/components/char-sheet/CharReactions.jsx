import React from 'react'
import Popup from '../common/popup.jsx'
import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
import MetamagicPopup from './popups/MetamagicPopup.jsx'
import ArcaneWardRestoreModal from './modals/arcane/ArcaneWardRestoreModal.jsx'
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
import { applyWarCasterReaction } from '../../services/automation/handlers/reactions/reactionSpellHandler.js'
import { useSpellMetamagicFlow } from '../../hooks/combat/useSpellMetamagicFlow.js'
import { useSpellUpcastFlow } from '../../hooks/combat/useSpellUpcastFlow.js'
import { useSpellPositionResolver } from '../../hooks/combat/useSpellPositionResolver.js';
import { useSpellCastExecutor } from '../../hooks/combat/useSpellCastExecutor.js';
import { resolveSpellDamageAtLevel, isAutoHitSpell } from '../../services/rules/core/spellDamageUtils.js';
import { signFormatter } from '../../services/ui/formatUtils.js';
import './CharActions.css'

function CharReactions({ playerStats, campaignName, cannotAct, mapName, characters }) {
    const { setPopupHtml } = useDiceRollPopup();
    const { rollAttack, rollDamage } = useLoggedDiceRoll(playerStats.name, campaignName, { characters });
    const [selectedSpell, setSelectedSpell] = React.useState(null);
    const [reactiveSpellEligible, setReactiveSpellEligible] = React.useState(null);
    const [reactiveSpellWarnings, setReactiveSpellWarnings] = React.useState(false);
    const [isReactiveSpellFlow, setIsReactiveSpellFlow] = React.useState(false);
    const [arcaneWardRestoreModal, setArcaneWardRestoreModal] = React.useState(null);

    const activeBuffs = useRuntimeValue(playerStats?.name, 'activeBuffs', campaignName) ?? [];

    const pwhStance = useRuntimeValue(playerStats?.name, 'powerWordHealStandPermission', campaignName);

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
            rollAttack(attack.name, attack.hitBonus, { targetName, forcedMode: undefined, isOpportunityAttack: true });
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
                setArcaneWardRestoreModal(result.payload);
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

    const { castAction: reactionCastAction } = useSpellCastExecutor(rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName, characters, setPopupHtml, {}, cachedReactionCastPosRef);

    const { pendingMetamagic, gateMetamagic, handleConfirm, handleSkip } = useSpellMetamagicFlow(playerStats, campaignName, reactionCastAction);
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
                        }}>{resolvedDamage}</div>
                        <div className='left'>{damageType || (spell.heal_at_slot_level ? 'Healing' : 'Utility')}</div>
                    </React.Fragment>;
                })}<div className='half-line'></div>
            </div>}
            {arcaneWardRestoreModal && (
                <ArcaneWardRestoreModal
                    {...arcaneWardRestoreModal}
                    playerStats={playerStats}
                    campaignName={campaignName}
                    onClose={() => setArcaneWardRestoreModal(null)}
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