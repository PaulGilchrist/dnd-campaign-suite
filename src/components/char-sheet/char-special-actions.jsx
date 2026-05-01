/* eslint-disable react/prop-types */
import React from 'react'
import usePopup from './common/use-popup'

function CharSpecialActions({ playerStats }) {
    const { showPopup, PopupElement } = usePopup((specialAction) => {
        if (specialAction.details) {
            return `<b>${specialAction.name}</b><br/>${specialAction.description}<br/><br/>${specialAction.details}`;
        }
        return null;
    });
     // Build specialActions list immutably
    let specialActions = [...(playerStats.specialActions || [])];

     // Add fighting style special actions
    if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Great Weapon Fighting') && !specialActions.find((specialAction) => specialAction.name === 'Great Weapon Fighting')) {
        specialActions.push({ "name": "Great Weapon Fighting", "description": "When you roll a 1 or 2 on a damage die for an attack you make with a melee weapon that you are wielding with two hands, you can reroll the die and must use the new roll, even if the new roll is a 1 or a 2. The weapon must have the two-handed or versatile property for you to gain this benefit." });
    } else if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Protection') && !specialActions.find((specialAction) => specialAction.name === 'Protection')) {
        specialActions.push({ "name": "Protection", "description": "When a creature you can see attacks a target other than you that is within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll. You must be wielding a shield." });
      }
   
    // Get names of features that should not be shown in Special Actions
    const actionNames = new Set(playerStats.actions?.map(action => action.name) || []);
    const bonusActionNames = new Set(playerStats.bonusActions?.map(action => action.name) || []);
    const reactionNames = new Set(playerStats.reactions?.map(action => action.name) || []);
    const characterAdvancementNames = new Set(playerStats.characterAdvancement?.map(feature => feature.name) || []);
    
      // Filter out features that are in actions, bonusActions, reactions, or characterAdvancement
    const filteredActions = specialActions.filter(action => 
          !actionNames.has(action.name) && 
          !bonusActionNames.has(action.name) && 
          !reactionNames.has(action.name) &&
          !characterAdvancementNames.has(action.name)
      );
    
    const uniqueActions = Array.from(new Map(filteredActions.map(action => [action.name, action])).values());
    return (
           <div>
               <div className='sectionHeader'>Special Actions</div>
            {PopupElement}
               {uniqueActions.map((specialAction, index) => {
                return <div key={specialAction.name || `special-action-${index}`}>
                       <b className={specialAction.details ? "clickable" : ""} onClick={() => showPopup(specialAction)}>{specialAction.name}:</b> <span dangerouslySetInnerHTML={{ __html: specialAction.description }}></span>
                   </div>
               })}
           </div>
       )
}

export default CharSpecialActions

