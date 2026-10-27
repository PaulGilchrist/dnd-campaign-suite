import { useRef } from 'react';
import { TRAVEL_PACES, formatTravelTime, getHexTravelTime } from '../../services/campaign/travelService.js';
import { EVENT_FREQUENCIES } from '../../services/campaign/randomEventService.js';

function TravelExhaustedBanner({ exhausted, partyHasMaxExhaustion, onForceCamp, onForcedMarch }) {
  if (!exhausted) return null;
  return (
    <div className="travel-panel-exhausted">
      <i className="fa-solid fa-tent"></i>
      <span>Travel budget exhausted — camp or forced march?</span>
      <button onClick={onForceCamp} className="travel-btn-camp">
        <i className="fa-solid fa-campground"></i> Camp
      </button>
      <button
        onClick={onForcedMarch}
        className="travel-btn-march"
        disabled={partyHasMaxExhaustion}
        title={forcedMarchTitle(partyHasMaxExhaustion)}
      >
        <i className="fa-solid fa-person-running"></i> Forced March
      </button>
    </div>
  );
}

// Extreme-weather camp affordance (bug 2026-10-27-G): the impossible-travel
// prompt says "Camp and wait it out", but the exhausted banner gates on
// dayExhausted which is structurally UNREACHABLE under extreme weather (every
// advance rejects in the cost-null branch BEFORE the budget check, and the
// mount flag finds no affordable neighbor to compare). Render the camp row
// directly from the blocking condition; it wires to the same forceCamp seam
// (rolls the new day's weather, refreshes the budget from the NEW roll).
// Hidden while the exhausted banner is up — it already carries Camp.
function TravelExtremeWeatherBanner({ travelBlocked, onForceCamp }) {
  if (!travelBlocked) return null;
  return (
    <div className="travel-panel-exhausted">
      <i className="fa-solid fa-tent"></i>
      <span>Extreme weather makes travel impossible — camp and wait it out</span>
      <button onClick={onForceCamp} className="travel-btn-camp">
        <i className="fa-solid fa-campground"></i> Camp
      </button>
    </div>
  );
}

function TravelForcedMarchStatus({ forcedMarchHours, exhaustionMultiplier }) {
  if (!(forcedMarchHours > 0)) return null;
  return (
    <div className="travel-panel-exhaustion">
      <span className="travel-exhaustion-label">
        <i className="fa-solid fa-heart-pulse"></i> Forced March
      </span>
      <span className="travel-exhaustion-value">{forcedMarchHours} / 6 stacks</span>
      <span className="travel-exhaustion-speed">
        <i className="fa-solid fa-gauge"></i> Speed: {exhaustionMultiplier}%
      </span>
    </div>
  );
}

function TravelWeatherSection({ weather, onReRollWeather }) {
  if (!weather) return null;
  return (
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
  );
}

// Max-exhaustion travel gate copy (backlog 2026-10-26-C). The hook's
// forcedMarch() refusal uses the same wording (FM_MAX_EXHAUSTION_TITLE) so the
// tooltip, hint lane, and any programmatic refusal agree.
const MAX_EXHAUSTION_HINT = 'A party member is at maximum exhaustion — rest required';
const FM_MAX_EXHAUSTION_TITLE = 'Cannot forced march — a party member has reached maximum exhaustion';

// Active-frequency readout (backlog 2026-10-26-D): the chip row's `.active`
// styling is too subtle to predict interruption rate, so the Events row mirrors
// the Weather row — label + bold active value + chance description.
const frequencyChance = (f) => `${Math.round((f ? f.chance : 0) * 100)}% chance per hex`;
const lookupFrequency = (key) => EVENT_FREQUENCIES[key] || EVENT_FREQUENCIES.none;

// Advance-button label + disabled tooltip (backlog 2026-10-26-E): a fresh tool
// mount has an EMPTY path, and `pathIndex >= path.length` is vacuously true —
// so without the empty-path branch the button falsely read "Arrived" before a
// destination was ever chosen. Hoisted to keep TravelPanel under the
// complexity cap.
const NO_DESTINATION_TITLE = 'Select a destination hex on the map to plan a route';
const advanceLabel = (path, pathIndex) => {
  if (path.length === 0) return 'Select a destination';
  return pathIndex >= path.length ? 'Arrived' : 'Advance One Hex';
};
// Disabled-button explanations (hover tooltips); undefined leaves the button
// bare when the gate is not what blocks it.
const advanceTitle = (maxed, noDestination) =>
  (maxed ? MAX_EXHAUSTION_HINT : (noDestination ? NO_DESTINATION_TITLE : undefined));
const forcedMarchTitle = (maxed) => (maxed ? FM_MAX_EXHAUSTION_TITLE : undefined);
// Camp row visibility (bug 2026-10-27-G): a null moveCostMod is the blocking
// condition itself (weatherService "extreme"). Hoisted to keep TravelPanel
// under the complexity cap; hidden while the exhausted banner is up, which
// already carries its own Camp button.
const extremeWeatherBlocked = (weather, dayExhausted) =>
  !dayExhausted && weather?.moveCostMod === null;

function TravelMaxExhaustionHint({ visible }) {
  if (!visible) return null;
  // Advance is hard-blocked while any PC sits at exhaustion 6 (useTravelManagement
  // partyHasMaxExhaustion) — without this line the button just greys out with no
  // explanation, and the exhausted banner (which needs an advance to fire) never
  // appears mid-day. Pure derived render state — no new flags, no timers.
  return (
    <div className="travel-panel-hint">
      <i className="fa-solid fa-circle-info"></i>
      <span>{MAX_EXHAUSTION_HINT}</span>
    </div>
  );
}

function TravelOwnHexHint({ visible }) {
  if (!visible) return null;
  // Own-hex dead-click hint (backlog 2026-10-26): the destination click on
  // the party's current hex is a silent no-op — guide the GM to a valid hex.
  // Pure display flag owned by HexMap (never game state).
  return (
    <div className="travel-panel-hint">
      <i className="fa-solid fa-circle-info"></i>
      <span>Select a hex away from the party to set your destination</span>
    </div>
  );
}

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
  showOwnHexHint,
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
  forcedMarchHours,
  exhaustionMultiplier,
  partyHasMaxExhaustion,
}) {
  const panelRef = useRef(null);
  // eslint-disable-next-line server-first/no-local-game-state
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

  const advanceDisabled = dayExhausted || pathIndex >= path.length || !!pendingEvent || partyHasMaxExhaustion;
  const travelBlocked = extremeWeatherBlocked(weather, dayExhausted);

  const currentHex = path[pathIndex];
  const currentTerrain = currentHex ? terrain[`${currentHex.q},${currentHex.r}`] || 'plains' : null;
  const currentTravelTime = currentTerrain ? getHexTravelTime(currentTerrain, travelPace, horseback) : null;
  const activeFrequency = lookupFrequency(eventFrequency);

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

      <TravelMaxExhaustionHint visible={partyHasMaxExhaustion} />
      <TravelOwnHexHint visible={showOwnHexHint} />

      <TravelExhaustedBanner
        exhausted={dayExhausted}
        partyHasMaxExhaustion={partyHasMaxExhaustion}
        onForceCamp={onForceCamp}
        onForcedMarch={onForcedMarch}
      />

      <TravelExtremeWeatherBanner
        travelBlocked={travelBlocked}
        onForceCamp={onForceCamp}
      />

      <TravelForcedMarchStatus
        forcedMarchHours={forcedMarchHours}
        exhaustionMultiplier={exhaustionMultiplier}
      />

      {/* Weather section */}
      <TravelWeatherSection weather={weather} onReRollWeather={onReRollWeather} />

      <div className="travel-panel-frequency">
        <span className="travel-panel-label">Events:</span>
        <span className="travel-frequency-active">{activeFrequency.label}</span>
        <span className="travel-frequency-desc">{frequencyChance(activeFrequency)}</span>
        <div className="travel-frequency-buttons">
          {Object.entries(EVENT_FREQUENCIES).map(([key, f]) => (
            <button
              key={key}
              className={`travel-frequency-btn ${eventFrequency === key ? 'active' : ''}`}
              onClick={() => onSetEventFrequency(key)}
              title={`${f.label}: ${frequencyChance(f)}`}
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
          title={advanceTitle(partyHasMaxExhaustion, path.length === 0)}
        >
          <i className="fa-solid fa-person-walking"></i>
          {advanceLabel(path, pathIndex)}
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
