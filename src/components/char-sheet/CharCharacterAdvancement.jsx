
import useActionPopup from '../../hooks/useActionPopup.js'
import Popup from '../common/Popup.jsx'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { hasAutomation } from '../../services/combat/automationService.js'
import { executeHandler } from '../../services/automation/index.js'

function CharCharacterAdvancement({ playerStats, campaignName }) {
    const { showPopup, popupHtml, setPopupHtml } = useActionPopup('feature');
    const features = playerStats.characterAdvancement || [];

    const handleClick = async (feature) => {
        if (hasAutomation(feature)) {
            const result = await executeHandler(feature, playerStats, campaignName);
            if (result?.type === 'popup') {
                const payload = result.payload;
                const html = typeof payload === 'string'
                    ? payload
                    : `<b><i class="fa-solid fa-music"></i> ${payload.name || feature.name}</b><br/>${payload.description || ''}<br/><span class="dice-roll-hint">click to dismiss</span>`;
                setPopupHtml(html);
            }
        } else {
            showPopup(feature);
        }
    };

    return (
         <div>
             <div className='sectionHeader'>Character Advancement</div>
               {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)} />}
             {features.map((feature, index) => {
                const isClickable = feature.details || hasAutomation(feature);
                return <div key={feature.name || `character-advancement-${index}`}>
                      <b className={isClickable ? "clickable" : ""} onClick={() => handleClick(feature)}>{feature.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(feature.description) }}></span>
                  </div>
              })}<div className='half-line'></div>
          </div>
      )
}

export default CharCharacterAdvancement
