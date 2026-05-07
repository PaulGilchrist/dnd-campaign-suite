 

import useActionPopup from './common/use-action-popup.jsx'
import Popup from '../common/popup.jsx'
import { sanitizeHtml } from '../../services/sanitize.js';

function CharCharacterAdvancement({ playerStats }) {
    const { showPopup, popupHtml, setPopupHtml } = useActionPopup('feature');
    const features = playerStats.characterAdvancement || [];
    
    return (
         <div>
             <div className='sectionHeader'>Character Advancement</div>
               {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)} />}
             {features.map((feature, index) => {
                return <div key={feature.name || `character-advancement-${index}`}>
                      <b className={feature.details ? "clickable" : ""} onClick={() => showPopup(feature)}>{feature.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(feature.description) }}></span>
                  </div>
              })}
          </div>
      )
}

export default CharCharacterAdvancement
