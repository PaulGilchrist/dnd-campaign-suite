import { useRef } from 'react';
import { TRAVEL_PACES, formatTravelTime, getHexTravelTime } from '../../services/travelService.js';
import { EVENT_FREQUENCIES } from '../../services/randomEventService.js';

function TravelPanel({
  travelPace,
  path,
  pathIndex,
  accruedCost,
  dailyBudget,
  dayExhausted,
  lastMessage,
  hexesRemaining,
  isTravelActive,
  pendingEvent,
  terrain,
  eventFrequency,
  onChangePace,
  onAdvance,
  onCancel,
  onForceCamp,
  onForcedMarch,
  weather,
  onReRollWeather,
  onSetEventFrequency,
  horseback,
  onToggleHorseback,
}) {
  const panelRef = useRef(null);
  const dragState = useRef(null);

  const handleHeaderPointerDown = (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origLeft: panel.offsetLeft,
      origTop: panel.offsetTop,
    };
    panel.style.cursor = 'grabbing';

    const handleMove = (ev) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      panel.style.left = `${dragState.current.origLeft + dx}px`;
      panel.style.top = `${dragState.current.origTop + dy}px`;
      panel.style.bottom = 'auto';
      panel.style.transform = 'none';
    };

    const handleUp = () => {
      dragState.current = null;
      if (panel) panel.style.cursor = '';
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  };

  if (!isTravelActive) return null;

  const budgetPct = dailyBudget > 0 ? Math.min(100, (accruedCost / dailyBudget) * 100) : 0;
  const budgetRemaining = Math.max(0, dailyBudget - accruedCost);

  const advanceDisabled = dayExhausted || pathIndex >= path.length || !!pendingEvent;

  const currentHex = path[pathIndex];
  const currentTerrain = currentHex ? terrain[`${currentHex.q},${currentHex.r}`] || 'plains' : null;
  const currentTravelTime = currentTerrain ? getHexTravelTime(currentTerrain, travelPace, horseback) : null;

  return (
    <div className="travel-panel" ref={panelRef}>
      <div className="travel-panel-header" onPointerDown={handleHeaderPointerDown}>
        <span className="travel-panel-title">
          <i className="fa-solid fa-route"></i> Travel Mode
        </span>
        {lastMessage && (
          <span className="travel-panel-message">{lastMessage}</span>
        )}
        <button className="travel-panel-close" onClick={onCancel} title="Cancel travel">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {dayExhausted && (
        <div className="travel-panel-exhausted">
          <i className="fa-solid fa-tent"></i>
          <span>Travel budget exhausted — camp or forced march?</span>
          <button onClick={onForceCamp} className="travel-btn-camp">
            <i className="fa-solid fa-campground"></i> Camp
          </button>
          <button onClick={onForcedMarch} className="travel-btn-march">
            <i className="fa-solid fa-person-running"></i> Forced March
          </button>
        </div>
      )}

      {/* Weather section */}
      {weather && (
        <div className="travel-panel-weather">
          <span className="travel-panel-label">Weather:</span>
          <span className="travel-weather-icon">
            <i className={`fa-solid fa-${weather.icon}`}></i>
          </span>
          <span className="travel-weather-label">{weather.label}</span>
          <span className="travel-weather-desc">{weather.description}</span>
          <button className="travel-weather-reroll" onClick={onReRollWeather} title="Re-roll weather">
            <i className="fa-solid fa-dice"></i>
          </button>
        </div>
      )}

      <div className="travel-panel-frequency">
        <span className="travel-panel-label">Events:</span>
        <div className="travel-frequency-buttons">
          {Object.entries(EVENT_FREQUENCIES).map(([key, f]) => (
            <button
              key={key}
              className={`travel-frequency-btn ${eventFrequency === key ? 'active' : ''}`}
              onClick={() => onSetEventFrequency(key)}
              title={`${f.label}: ${Math.round(f.chance * 100)}% chance per hex`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="travel-panel-pace">
        <span className="travel-panel-label">Pace:</span>
        <div className="travel-pace-buttons">
          {TRAVEL_PACES.map(pace => (
            <button
              key={pace.id}
              className={`travel-pace-btn ${travelPace === pace.id ? 'active' : ''}`}
              onClick={() => onChangePace(pace.id)}
              title={pace.description}
            >
              {pace.name}
            </button>
          ))}
        </div>
      </div>

      <div className="travel-panel-horseback">
        <span className="travel-panel-label">Mount:</span>
        <button
          className={`travel-horseback-btn ${horseback ? 'active' : ''}`}
          onClick={onToggleHorseback}
          title={horseback ? 'Riding horses — double travel speed' : 'Not riding — normal travel speed'}
        >
          <i className="fa-solid fa-horse"></i>
          {horseback ? 'Horseback' : 'Walking'}
        </button>
      </div>

      <div className="travel-panel-stats">
        <div className="travel-stat">
          <span className="travel-stat-label">Remaining</span>
          <span className="travel-stat-value">{hexesRemaining} hexes</span>
        </div>
        {currentTravelTime !== null && (
          <div className="travel-stat">
            <span className="travel-stat-label">Next hex</span>
            <span className="travel-stat-value">{formatTravelTime(currentTravelTime)}</span>
          </div>
        )}
        <div className="travel-stat">
          <span className="travel-stat-label">Budget</span>
          <span className="travel-stat-value">{budgetRemaining.toFixed(1)} left</span>
        </div>
      </div>

      <div className="travel-panel-budget-bar">
        <div className="travel-budget-fill" style={{ width: `${budgetPct}%` }}></div>
        <span className="travel-budget-text">{accruedCost.toFixed(1)} / {dailyBudget}</span>
      </div>

      <div className="travel-panel-controls">
        <button
          className="travel-btn-advance"
          onClick={onAdvance}
          disabled={advanceDisabled}
        >
          <i className="fa-solid fa-person-walking"></i>
          {pathIndex >= path.length ? 'Arrived' : 'Advance One Hex'}
        </button>
        <button className="travel-btn-cancel" onClick={onCancel}>
          <i className="fa-solid fa-ban"></i>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default TravelPanel;
