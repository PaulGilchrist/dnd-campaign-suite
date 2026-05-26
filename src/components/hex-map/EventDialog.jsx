
const EVENT_ICONS = {
  combat: 'fa-solid fa-crosshairs',
  discovery: 'fa-solid fa-gem',
  hazard: 'fa-solid fa-triangle-exclamation',
  npc: 'fa-solid fa-handshake',
  weatherChange: 'fa-solid fa-cloud-rain',
  navigation: 'fa-solid fa-compass',
};

const EVENT_COLORS = {
  combat: '#c44',
  discovery: '#FFD700',
  hazard: '#e87040',
  npc: '#5ba0d9',
  weatherChange: '#8ab',
  navigation: '#b99',
};

const EVENT_TYPE_NAMES = {
  combat: 'Combat Encounter',
  discovery: 'Discovery',
  hazard: 'Hazard',
  npc: 'NPC Encounter',
  weatherChange: 'Weather Change',
  navigation: 'Navigation',
};

function EventDialog({ event, rerollsRemaining, onAccept, onSkip, onReroll }) {
  if (!event) return null;

  const icon = EVENT_ICONS[event.type] || 'fa-solid fa-circle';
  const color = EVENT_COLORS[event.type] || '#888';
  const typeName = EVENT_TYPE_NAMES[event.type] || 'Event';

  return (
    <div className="event-dialog-overlay">
      <div className="event-dialog">
        <div className="event-dialog-header" style={{ borderLeftColor: color }}>
          <span className="event-dialog-icon" style={{ color }}>
            <i className={icon}></i>
          </span>
          <div className="event-dialog-title-group">
            <span className="event-dialog-type">{typeName}</span>
            <span className="event-dialog-title">{event.title}</span>
          </div>
        </div>

        <div className="event-dialog-body">
          <p className="event-dialog-description">{event.description}</p>
          {event.encounter && (
            <div className="event-encounter-info">
              <div className="event-encounter-header">
                <span className="event-encounter-difficulty" data-difficulty={event.encounter.difficultyLabel}>
                  <i className="fa-solid fa-shield-halved"></i> {event.encounter.difficultyLabel}
                </span>
                <span className="event-encounter-xp">{event.encounter.totalXP} XP</span>
              </div>
              <ul className="event-monster-list">
                {event.encounter.monsters.map((m, i) => (
                  <li key={i} className="event-monster-item">
                    <i className="fa-solid fa-skull"></i>
                    <span className="event-monster-qty">{m.qty}x</span>
                    <span className="event-monster-name">{m.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <span className="event-dialog-terrain">Terrain: {event.terrain}</span>
        </div>

        <div className="event-dialog-actions">
          <button
            className="event-btn event-btn-accept"
            onClick={onAccept}
          >
            <i className="fa-solid fa-check"></i> Accept
          </button>
          <button
            className="event-btn event-btn-skip"
            onClick={onSkip}
          >
            <i className="fa-solid fa-xmark"></i> Skip
          </button>
          <button
            className="event-btn event-btn-reroll"
            onClick={onReroll}
            disabled={rerollsRemaining <= 0}
            title={rerollsRemaining > 0 ? `Re-roll (${rerollsRemaining} remaining)` : 'No re-rolls remaining'}
          >
            <i className="fa-solid fa-dice"></i> Re-roll
            {rerollsRemaining > 0 && <span className="reroll-count">({rerollsRemaining})</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EventDialog;
