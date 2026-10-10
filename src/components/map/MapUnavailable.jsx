// @improved-by-ai

import './MapUnavailable.css';

function MapUnavailable({ onRetry }) {
  return (
    <div className="ct-container map-unavailable">
      <div className="ct-empty-state">
        <i className="fa-solid fa-map" aria-hidden="true"></i>
        <span>Waiting for the GM to open a map…</span>
        <button type="button" className="ct-btn ct-btn-primary map-unavailable-retry-btn" onClick={onRetry}>
          Check Again
        </button>
      </div>
    </div>
  );
}

export default MapUnavailable;
