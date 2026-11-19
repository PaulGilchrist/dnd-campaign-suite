import { influenceTierClass } from '../../services/campaign/influenceTierDisplay.js';
import './InfluenceBadge.css';

/**
 * The faction influence badge — numeric chip colored by the shared 1–10 tier
 * canon (influenceTierDisplay.js). Rendered by the GM Factions planner rows
 * and the player quest board's standing strip; the badge never sets
 * `influence` (write paths stay in the planner form).
 */
function InfluenceBadge({ influence }) {
  return (
    <span
      className={`influence-badge ${influenceTierClass(influence)}`}
      title={`Influence: ${influence}`}
    >
      {influence}
    </span>
  );
}

export default InfluenceBadge;
