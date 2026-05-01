/* eslint-disable react/prop-types */
import React from 'react'
import usePopup from './common/use-popup'

function CharReactions({ playerStats }) {
    const { showPopup, PopupElement } = usePopup((specialAction) => {
        if (specialAction.details) {
            return `<b>${specialAction.name}</b><br/>${specialAction.description}<br/><br/>${specialAction.details}`;
        }
        return null;
    });
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

    return (
        <div>
            <div className='sectionHeader'>Reactions</div>
            {PopupElement}
              {reactions.map((reaction) => {
                return <div key={reaction.name}>
                    <b className={reaction.details ? "clickable" : ""} onClick={() => showPopup(reaction)}>{reaction.name}:</b> <span dangerouslySetInnerHTML={{ __html: reaction.description }}></span>
                </div>
            })}
        </div>
    )
}

export default CharReactions

