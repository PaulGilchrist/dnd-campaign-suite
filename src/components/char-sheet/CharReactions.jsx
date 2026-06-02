   import React from 'react'
   import Popup from '../common/Popup.jsx'
   import DiceRollResult from './DiceRollResult.jsx'
   import SpellDetailPopup from './char-spells/SpellDetailPopup.jsx'
   import MetamagicPopup from './MetamagicPopup.jsx'
    import { sanitizeHtml } from '../../services/sanitize.js';
    import { buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
    import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'
    import { OPPORTUNITY_ATTACK, MELEE_REACH_FEET } from '../../services/baseCombatActions.js'
    import { hasAutomation } from '../../services/automationService.js'
    import { rollExpression } from '../../services/diceRoller.js'
    import { getCurrentSorceryPoints, getMaxSorceryPoints, spendSorceryPoints } from '../../hooks/useMetamagic.js'
    import { addEntry } from '../../services/logService.js'

function CharReactions({ playerStats, campaignName, cannotAct }) {
    const { popupHtml, setPopupHtml, rollAttack } = useLoggedDiceRoll(playerStats.name, campaignName);
    const [selectedSpell, setSelectedSpell] = React.useState(null);
    const [pendingMetamagic, setPendingMetamagic] = React.useState(null);

     // Build reactions list immutably
    let reactions = [...(playerStats.reactions || [])];

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

    const handleReactionClick = (reaction) => {
        if (cannotAct) return;
        if (hasAutomation(reaction)) {
            handleAutomationReaction(reaction);
            return;
        }
        if (reaction.name === OPPORTUNITY_ATTACK.name) {
            const meleeAttacks = playerStats.attacks.filter(a => a.type === 'Action' && a.range === MELEE_REACH_FEET);
            const attackRoll = meleeAttacks.length > 0 ? meleeAttacks[0] : playerStats.attacks[0];
            if (attackRoll) {
                rollAttack(attackRoll.name, attackRoll.hitBonus, { forcedMode: undefined });
            }
        } else {
            const html = buildFeatureDetailHtml(reaction);
            if (html) setPopupHtml(html);
        }
    };

    const handleAutomationReaction = (reaction) => {
        if (cannotAct) return;
        const auto = reaction.automation;
        if (!auto) return;
        switch (auto.type) {
            case 'damage_reduction': {
                if (auto.redirect && setPopupHtml) {
                    const reductionExpr = auto.reductionExpression || '0';
                    const damageResult = rollExpression(reductionExpr);
                    if (damageResult) {
                        setPopupHtml({
                            type: 'damage_reduction_redirect',
                            name: reaction.name,
                            description: reaction.description || '',
                            reductionExpression: reductionExpr,
                            reductionRolls: damageResult.rolls,
                            reductionModifier: damageResult.modifier,
                            reductionTotal: damageResult.total,
                            redirectCost: auto.redirectCost || null,
                            redirectDamage: auto.redirectDamage || '',
                            redirectSave: auto.redirectSave || 'DEX',
                        });
                    }
                } else if (setPopupHtml) {
                    setPopupHtml({
                        type: 'damage_reduction',
                        name: reaction.name,
                        description: reaction.description || '',
                        reductionExpression: auto.reductionExpression || '',
                        trigger: auto.trigger || '',
                    });
                }
                break;
            }
            default: {
                const html = buildFeatureDetailHtml(reaction);
                if (html) setPopupHtml(html);
                break;
            }
          }
      };

     const isReactionSorcerer = playerStats.class?.name === 'Sorcerer';

       // Reaction spell - click through to select metamagic
   const handleReactionSpellSelectMeta = (spell) => {
     if (!isReactionSorcerer) {
          addEntry(campaignName, {
            type: 'spell',
             characterName: playerStats.name,
             spellName: spell.name,
              spellLevel: spell.level || 0,
             castingTime: spell.casting_time,
             metamagic: [],
             timestamp: Date.now(),
           });
          return;
          }
       const currentSP = getCurrentSorceryPoints(playerStats.name, getMaxSorceryPoints(playerStats));
       setPendingMetamagic({
            spellName: spell.name,
            spellLevel: spell.level || 0,
             _currentSP: currentSP,
             castingTime: spell.casting_time,
          });
        setSelectedSpell(null);
      };

     const handleReactionMetamagicConfirm = React.useCallback((result) => {
         if (result && result.totalCost && result.totalCost > 0) {
            spendSorceryPoints(playerStats.name, result.totalCost, campaignName);
           }
         addEntry(campaignName, {
              type: 'spell',
             characterName: playerStats.name,
             spellName: pendingMetamagic.spellName,
             spellLevel: pendingMetamagic.spellLevel || 0,
            castingTime: pendingMetamagic.castingTime,
           metamagic: result ? (result.options || []) : [],
              spCost: result ? (result.totalCost || 0) : 0,
             timestamp: Date.now(),
          });
       setPendingMetamagic(null);
      }, [playerStats.name, campaignName, pendingMetamagic]);

   const handleReactionMetamagicSkip = React.useCallback(() => {
        addEntry(campaignName, {
           type: 'spell',
           characterName: playerStats.name,
            spellName: pendingMetamagic.spellName,
            spellLevel: pendingMetamagic.spellLevel || 0,
             castingTime: pendingMetamagic.castingTime,
            metamagic: [],
              spCost: 0,
           timestamp: Date.now(),
         });
       setPendingMetamagic(null);
      }, [playerStats.name, campaignName, pendingMetamagic]);

    return (
        <div className='char-reactions'>
            <div className='sectionHeader'>Reactions</div>
               {selectedSpell && (
                   <Popup onClickOrKeyDown={() => setSelectedSpell(null)}>
                       <SpellDetailPopup
                          spell={selectedSpell}
                          playerStats={playerStats}
                          campaignName={campaignName}
                          onClose={() => setSelectedSpell(null)}
                          onCast={(spell) => { handleReactionSpellSelectMeta(spell); }}
                       />
                   </Popup>
               )}
               {pendingMetamagic && (
                   <div>
                    <MetamagicPopup
                         spell={{ name: pendingMetamagic.spellName, level: pendingMetamagic.spellLevel || 0 }}
                         playerStats={{ ...playerStats, _metamagicCurrentSP: pendingMetamagic._currentSP }}
                         campaignName={campaignName}
                         onConfirm={handleReactionMetamagicConfirm}
                         onSkip={handleReactionMetamagicSkip}
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