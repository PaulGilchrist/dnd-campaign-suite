  

import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import { sanitizeHtml } from '../../services/sanitize.js';
import { buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'
import { OPPORTUNITY_ATTACK, MELEE_REACH_FEET } from '../../services/baseCombatActions.js'
import { hasAutomation } from '../../services/automationService.js'
import { rollExpression } from '../../services/diceRoller.js'

function CharReactions({ playerStats, campaignName, cannotAct }) {
    const { popupHtml, setPopupHtml, rollAttack } = useLoggedDiceRoll(playerStats.name, campaignName);
       // Build reactions list immutably
    let reactions = [...(playerStats.reactions || [])];

    if (playerStats.spellAbilities && playerStats.spellAbilities.spells.length > 0) {
        let reactionSpells = playerStats.spellAbilities.spells.filter(spell => spell.casting_time === '1 reaction' && (spell.prepared === 'Always' || spell.prepared === 'Prepared'));
        reactionSpells.forEach(spell => {
            if (!reactions.some((reaction) => reaction.name === spell.name)) {
                reactions.push({
                     "name": spell.name,
                     "description": spell.desc
                  });
              }
          });
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

    return (
        <div>
            <div className='sectionHeader'>Reactions</div>
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