  

import Popup from '../common/Popup.jsx'
import DiceRollResult from './DiceRollResult.jsx'
import { sanitizeHtml } from '../../services/sanitize.js';
import { buildFeatureDetailHtml } from '../../hooks/useActionPopup.js'
import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js'

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
    if (!reactions.find((reaction) => reaction.name === 'Opportunity Attack')) {
        reactions.push({ "name": "Opportunity Attack", "description": "Can attack creature that moves out of your reach" });
    }

    const handleReactionClick = (reaction) => {
        if (cannotAct) return;
        if (reaction.name === 'Opportunity Attack') {
            const meleeAttacks = playerStats.attacks.filter(a => a.type === 'Action' && a.range === 5);
            const attackRoll = meleeAttacks.length > 0 ? meleeAttacks[0] : playerStats.attacks[0];
            if (attackRoll) {
                rollAttack(attackRoll.name, attackRoll.hitBonus, { forcedMode: undefined });
            }
        } else {
            const html = buildFeatureDetailHtml(reaction);
            if (html) setPopupHtml(html);
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
                return <div key={reaction.name}>
                     <b className={reaction.details || reaction.name === 'Opportunity Attack' ? "clickable" : ""} onClick={() => handleReactionClick(reaction)}>{reaction.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(reaction.description) }}></span>
                 </div>
             })}
        </div>
    )
}

export default CharReactions