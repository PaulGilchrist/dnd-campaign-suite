 

import useActionPopup from '../../hooks/useActionPopup.js'
import Popup from '../common/Popup.jsx'
import { renderMarkdownInline } from '../../services/sanitize.js';
import { getFightingStyle } from '../../services/fightingStyles.js'

function CharSpecialActions({ playerStats }) {
    const { showPopup, popupHtml, setPopupHtml } = useActionPopup('feature')
      // Build specialActions list immutably
    let specialActions = [...(playerStats.specialActions || [])];

      // Add fighting style special actions
    if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Great Weapon Fighting') && !specialActions.find((specialAction) => specialAction.name === 'Great Weapon Fighting')) {
        const style = getFightingStyle('Great Weapon Fighting');
        if (style) specialActions.push(style);
     } else if (playerStats.class.fightingStyles && playerStats.class.fightingStyles.includes('Protection') && !specialActions.find((specialAction) => specialAction.name === 'Protection')) {
        const style = getFightingStyle('Protection');
        if (style) specialActions.push(style);
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
            {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)} />}
               {uniqueActions.map((specialAction, index) => {
                return <div key={specialAction.name || `special-action-${index}`}>
                        <b className={specialAction.details ? "clickable" : ""} onClick={() => showPopup(specialAction)}>{specialAction.name}:</b> <span dangerouslySetInnerHTML={{ __html: renderMarkdownInline(specialAction.description) }}></span>
                    </div>
                })}
           </div>
       )
}

export default CharSpecialActions
