
import useActionPopup from '../../hooks/useActionPopup.js'
import Popup from '../common/Popup.jsx'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { hasAutomation } from '../../services/combat/automationService.js'
import { executeHandler } from '../../services/automation/index.js'
import { getRuntimeValue, setRuntimeValue } from '../../hooks/useRuntimeState.js';

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

    const handleChoiceClick = async (feature, optionName, e) => {
        e.stopPropagation();
        const optionKey = `_${feature.name.replace(/\s+/g, '_')}_option`;
        await setRuntimeValue(playerStats.name, optionKey, optionName, campaignName);
        window.dispatchEvent(new CustomEvent('buffs-updated'));
    };

    return (
         <div>
             <div className='sectionHeader'>Character Advancement</div>
               {popupHtml && <Popup html={popupHtml} onClickOrKeyDown={() => setPopupHtml && setPopupHtml(null)} />}
             {features.map((feature, index) => {
                const isClickable = feature.details || hasAutomation(feature);
                const options = feature.automation?.options;
                const optionKey = options ? `_${feature.name.replace(/\s+/g, '_')}_option` : null;
                const currentOption = optionKey ? (getRuntimeValue(playerStats.name, optionKey, campaignName) || options[0]) : null;
                return <div key={feature.name || `character-advancement-${index}`}>
                      <b className={isClickable ? "clickable" : ""} onClick={() => handleClick(feature)}>{feature.name}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(feature.description) }}></span>
                      {options && options.length > 1 && (
                          <div style={{ marginTop: '4px', fontSize: '0.9em' }}>
                              <span style={{ opacity: 0.7 }}>Choice: </span>
                              {options.map((opt, i) => (
                                  <span key={opt}>
                                      {i > 0 && <span style={{ opacity: 0.4 }}> | </span>}
                                      <span
                                          className="clickable"
                                          style={opt === currentOption ? { fontWeight: 'bold', textDecoration: 'underline' } : { opacity: 0.6 }}
                                          onClick={(e) => handleChoiceClick(feature, opt, e)}
                                      >
                                          {opt}
                                      </span>
                                  </span>
                              ))}
                          </div>
                      )}
                  </div>
              })}<div className='half-line'></div>
          </div>
      )
}

export default CharCharacterAdvancement
