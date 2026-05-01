/* eslint-disable react/prop-types */
import React from 'react'
import usePopup from './common/use-popup'
import { sanitizeHtml } from '../../services/sanitize.js';

function CharCharacterAdvancement({ playerStats }) {
    const { showPopup, PopupElement } = usePopup((feature) => {
        if (feature.details) {
            return `<b>${feature.name}</b><br/>${feature.description}<br/><br/>${feature.details}`;
            }
        return null;
       });
    const features = playerStats.characterAdvancement || [];
    
    return (
         <div>
             <div className='sectionHeader'>Character Advancement</div>
               {PopupElement}
             {features.map((feature, index) => {
               return <div key={feature.name || `character-advancement-${index}`}>
                     <b className={feature.details ? "clickable" : ""} onClick={() => showPopup(feature)}>{feature.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(feature.description) }}></span>
                 </div>
             })}
         </div>
     )
}

export default CharCharacterAdvancement