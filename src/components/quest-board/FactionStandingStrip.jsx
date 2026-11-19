import InfluenceBadge from '../common/InfluenceBadge.jsx';
import { influenceTierClass } from '../../services/campaign/influenceTierDisplay.js';

// Influence is authored 1–10 by the planner's range slider; the meter paints
// one segment per point so a standing reads across the room at a glance.
const INFLUENCE_SCALE = 10;

function StandingRow({ faction }) {
  const influence = typeof faction.influence === 'number' ? faction.influence : null;
  const tierClass = influence === null ? '' : ` ${influenceTierClass(influence)}`;
  return (
    <li className={`quest-board-standing${tierClass}`}>
      <span className="quest-board-standing-name">{faction.name}</span>
      {influence !== null && (
        <>
          {/* Decorative — the numeric badge + title carry the accessible value. */}
          <span className="quest-board-influence-meter" aria-hidden="true">
            {Array.from({ length: INFLUENCE_SCALE }, (_, index) => (
              <span
                key={index}
                className={`quest-board-influence-seg${index < influence ? ' quest-board-influence-seg--filled' : ''}`}
              />
            ))}
          </span>
          <InfluenceBadge influence={influence} />
        </>
      )}
    </li>
  );
}

/**
 * Compact faction standing strip above the quest groups. Read-only: rows are
 * the /factions/standings whitelist ({ id, name, influence }) — goals and
 * notes never arrive. Tier colors ride the shared InfluenceBadge.css tokens.
 */
function FactionStandingStrip({ factions, error }) {
  if (error) {
    return (
      <div className="quest-board-error" role="alert">
        <i className="fa-solid fa-triangle-exclamation" /> {error}
      </div>
    );
  }
  if (!factions || factions.length === 0) return null;
  return (
    <section className="quest-board-standings" aria-label="Faction standings">
      <h3 className="quest-board-standings-title">
        <i className="fa-solid fa-handshake" /> Faction Standings
      </h3>
      <ul className="quest-board-standings-list">
        {factions.map(faction => (
          <StandingRow key={faction.id} faction={faction} />
        ))}
      </ul>
    </section>
  );
}

export default FactionStandingStrip;
