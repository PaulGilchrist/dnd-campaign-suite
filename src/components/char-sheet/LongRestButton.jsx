
import { applyLongRest } from '../../services/restRules.js'

function LongRestButton({ playerStats, campaignName, onLongRest }) {
  const handleLongRest = () => {
    applyLongRest(playerStats, campaignName)
    onLongRest && onLongRest()
   };

  return (
     <button className="char-btn" onClick={handleLongRest} title="Long Rest: restore all HP, spell slots, hit dice, and class resources">
       <i className="fas fa-bed"></i> Long Rest
     </button>
    );
 }

export default LongRestButton;
