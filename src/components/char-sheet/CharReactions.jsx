    import React from 'react'
    import Popup from '../common/Popup.jsx'
    import DiceRollResult from './DiceRollResult.jsx'
    import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
    import MetamagicPopup from './MetamagicPopup.jsx'
      import { sanitizeHtml } from '../../services/ui/sanitize.js';
       import { buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
       import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'
       import { OPPORTUNITY_ATTACK, MELEE_REACH_FEET } from '../../services/combat/baseCombatActions.js'
        import { hasAutomation, hasTacticalShift } from '../../services/combat/automationService.js'
        import { getCombatContext, getTargetFromAttacker } from '../../services/rules/damageUtils.js'
        import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js'
       import { executeHandler } from '../../services/automation/index.js'
     import { useSpellMetamagicFlow } from '../../hooks/useSpellMetamagicFlow.js'
     import { useSpellUpcastFlow } from '../../hooks/useSpellUpcastFlow.js'
     import { executeSpellCast } from '../../services/rules/spellCastService.js'
     import * as mapsService from '../../services/maps/mapsService.js';
     import { getNearestPlacedItem } from '../../services/rules/rangeValidation.js';

function CharReactions({ playerStats, campaignName, cannotAct, mapName, characters }) {
    const { popupHtml, setPopupHtml, rollAttack, rollDamage } = useLoggedDiceRoll(playerStats.name, campaignName, { characters });
    const [selectedSpell, setSelectedSpell] = React.useState(null);

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

    let reactionSpells = [];
    if (playerStats.spellAbilities && playerStats.spellAbilities.spells.length > 0) {
        const reactionCastingTimes = ['1 reaction', '1 Reaction', 'reaction', 'Reaction'];
        const attackNames = new Set((playerStats.attacks || []).map(a => a.name));
        reactionSpells = playerStats.spellAbilities.spells.filter(spell => reactionCastingTimes.includes(spell.casting_time) && (spell.prepared === 'Always' || spell.prepared === 'Prepared') && !attackNames.has(spell.name));
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
                    if (targetNoOA || targetHasTacticalShift) {
                        const html = `<b>Opportunity Attack</b><br/>${target.name} is protected by Inspiring Movement and cannot be targeted by Opportunity Attacks right now.`;
                        setPopupHtml(html);
                        return;
                    }
                }
            }
        } catch (e) { /* fall through to normal OA */ }
        const meleeAttacks = playerStats.attacks.filter(a => a.type === 'Action' && a.range === MELEE_REACH_FEET);
        const attackRoll = meleeAttacks.length > 0 ? meleeAttacks[0] : playerStats.attacks[0];
        if (attackRoll) {
            rollAttack(attackRoll.name, attackRoll.hitBonus, { forcedMode: undefined });
        }
    };

    const handleAutomationReaction = async (reaction) => {
        if (cannotAct) return;
        const auto = reaction.automation;
        if (!auto) return;

        const result = await executeHandler(reaction, playerStats, campaignName, mapName);
        if (!result) {
            const html = buildFeatureDetailHtml(reaction);
            if (html) setPopupHtml(html);
            return;
        }

        if (result.type === 'attack_roll') {
            const { attack, targetName } = result.payload;
            rollAttack(attack.name, attack.hitBonus, { targetName, forcedMode: undefined });
            return;
        }

        if (result.type === 'popup') {
            setPopupHtml(result.payload);
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

      const cachedReactionCastPosRef = React.useRef(null);

const reactionCastAction = React.useCallback((spell, metaCtx) => {
        const pos = cachedReactionCastPosRef.current;
        executeSpellCast(spell, metaCtx, { rollAttack, rollDamage, playerStats, getTargetInfo, attackerPos: pos?.attackerPos, targetPos: pos?.targetPos, campaignName, mapName });
        cachedReactionCastPosRef.current = null;
    }, [rollAttack, rollDamage, playerStats, getTargetInfo, campaignName, mapName]);
      const { pendingMetamagic, gateMetamagic, handleConfirm, handleSkip } = useSpellMetamagicFlow(playerStats, campaignName, reactionCastAction);
      const { buildUpcastLevels } = useSpellUpcastFlow(playerStats, campaignName);

      const resolveReactionSpellPositions = React.useCallback(async () => {
        if (!mapName) return;
        try {
          const [mapData] = await Promise.all([
            mapsService.loadMapData(campaignName, mapName),
          ]);
          const attackerPlayer = mapData?.players?.find(p => p.name === playerStats.name);
          if (attackerPlayer) {
            const cs = await getCombatContext(campaignName);
            const target = cs ? getTargetFromAttacker(cs, playerStats.name) : null;
            if (target) {
              const targetPlayer = mapData?.players?.find(p => p.name === target.name);
              const targetNpc = mapData?.placedItems?.length
                ? getNearestPlacedItem(mapData.placedItems, target.name, attackerPlayer)
                : null;
              const targetPos = targetPlayer
                ? { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY }
                : targetNpc
                  ? { gridX: targetNpc.gridX, gridY: targetNpc.gridY }
                  : null;
              if (targetPos) {
                cachedReactionCastPosRef.current = {
                  attackerPos: { gridX: attackerPlayer.gridX, gridY: attackerPlayer.gridY },
                  targetPos,
                };
              }
            }
          }
        } catch { /* positions unavailable */ }
      }, [mapName, campaignName, playerStats.name]);

      const handleReactionSpellCast = React.useCallback(async (spell) => {
        setSelectedSpell(null);

        await resolveReactionSpellPositions();
        gateMetamagic(spell);
      }, [gateMetamagic, resolveReactionSpellPositions]);

    return (
        <div className='char-reactions'>
            <div className='sectionHeader'>Reactions</div>
               {selectedSpell && (
                   <Popup onClickOrKeyDown={() => setSelectedSpell(null)}>
                       <SpellDetailPopup
                          spell={selectedSpell}
                          playerStats={playerStats}
                          campaignName={campaignName}
                          playerLevel={playerStats.level}
                          upcastLevels={buildUpcastLevels(selectedSpell)}
                          onClose={() => setSelectedSpell(null)}
                           onCast={handleReactionSpellCast}
                        />
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
                 <div><b>Range</b></div>
                 <div><b>Hit</b></div>
                 <div><b>Damage</b></div>
                 <div className='left'><b>Type</b></div>
                 {reactionSpells.map((spell) => {
                     return <React.Fragment key={spell.name}>
                         <div className='left clickable' onClick={() => setSelectedSpell(spell)}>{spell.name}</div>
                         <div>{spell.range}</div>
                         <div>—</div>
                         <div>Utility</div>
                         <div className='left'></div>
                     </React.Fragment>;
                 })}<div className='half-line'></div>
             </div>}
             {popupHtml && (
                <Popup onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)}>
                    {typeof popupHtml === 'string' ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }}></div> :
                     <DiceRollResult {...popupHtml} />}
                </Popup>
            )}
              {reactions.map((reaction) => {
                const isClickable = reaction.details || reaction.name === OPPORTUNITY_ATTACK.name || hasAutomation(reaction);
                return <div key={reaction.name}>
                     <b className={isClickable ? "clickable" : ""} onClick={() => handleReactionClick(reaction)}>{reaction.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(reaction.description) }}></span>
                 </div>
             })}
        </div>
    )
}

export default CharReactions