
import { getCategories } from '../../services/character/featureCategories.js'
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import './CharCharacterAdvancement.css';

function CharCharacterAdvancement({ playerStats, campaignName }) {
    const categories = getCategories(playerStats.rules || '5e');
    const features = (playerStats.characterAdvancement || []).filter(f => !categories.featuresToIgnore.includes(f.name));

    const grouped = {};
    for (const feature of features) {
        if (!grouped[feature.name]) {
            grouped[feature.name] = { feature, count: 0 };
        }
        grouped[feature.name].count++;
    }

    const handleChoiceClick = async (feature, optionName, e) => {
        e.stopPropagation();
        const optionKey = `_${feature.name.replace(/\s+/g, '_')}_option`;
        await setRuntimeValue(playerStats.name, optionKey, optionName, campaignName);
        window.dispatchEvent(new CustomEvent('buffs-updated'));
    };

    return (
          <div className='char-character-advancement'>
              <div className='sectionHeader'>Character Advancement</div>
              {Object.values(grouped).map(({ feature, count }) => {
                const options = feature.automation?.options;
                const optionKey = options ? `_${feature.name.replace(/\s+/g, '_')}_option` : null;
                const currentOption = optionKey ? (getRuntimeValue(playerStats.name, optionKey, campaignName) || (typeof options[0] === 'object' ? options[0].name : options[0])) : null;
                const displayName = count > 1 ? `${feature.name} * ${count}` : feature.name;
                return <div key={feature.name || `character-advancement-${feature.index || ''}`}>
                      <b>{displayName}:</b> <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(feature.description) }}></span>
                      {options && options.length > 1 && (
                          <div style={{ marginTop: '4px', fontSize: '0.9em' }}>
                              <span style={{ opacity: 0.7 }}>Choice: </span>
                              {options.map((opt, i) => (
                                  <span key={typeof opt === 'object' ? opt.name : opt}>
                                      {i > 0 && <span style={{ opacity: 0.4 }}> | </span>}
                                      <span
                                           className="clickable"
                                           style={opt === currentOption ? { fontWeight: 'bold', textDecoration: 'underline' } : { opacity: 0.6 }}
                                           onClick={(e) => handleChoiceClick(feature, typeof opt === 'object' ? opt.name : opt, e)}
                                       >
                                           {typeof opt === 'object' ? opt.name : opt}
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
