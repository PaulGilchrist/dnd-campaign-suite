
import { applyLongRest } from '../../services/rules/restRules.js'
import { hasTranceTrait } from '../../services/rules/tranceRules.js'

function LongRestButton({ playerStats, campaignName, onLongRest }) {
  const hasTrance = hasTranceTrait(playerStats)

  const handleLongRest = () => {
    applyLongRest(playerStats, campaignName)
    onLongRest && onLongRest()
   };

  return (
     <button className="char-btn" onClick={handleLongRest} title={hasTrance ? "Long Rest (4 hours): restore all HP, spell slots, hit dice, and class resources" : "Long Rest: restore all HP, spell slots, hit dice, and class resources"}>
       <i className="fas fa-bed"></i> Long Rest{hasTrance ? ' (4 hours)' : ''}
     </button>
    );
 }

export default LongRestButton;
