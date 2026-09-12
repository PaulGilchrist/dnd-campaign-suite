import { sanitizeHtml } from '../../services/ui/sanitize.js';
import './WizardStepRace.css';

function RaceDetailCard({ selectedRace, fullRaceData, ruleset, expanded, onToggle }) {
  const traits = selectedRace.traits || [];
  const showLanguages = (ruleset === '5e' || ruleset === '2024') && selectedRace.languages;

  return (
    <div className="race-detail-card">
      <div className="detail-card-header" onClick={onToggle}>
        <h3>
          <i className="fa-solid fa-dragon" />
          {selectedRace.name} Details
        </h3>
        <button className="toggle-details-btn" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {expanded && (
        <div className="detail-card-body">
          {fullRaceData?.description && (
            <div className="detail-section">
              <h4>Description</h4>
              <div
                className="detail-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(fullRaceData.description) }}
              />
            </div>
          )}

          <div className="detail-section">
            <h4>Core Information</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Speed</span>
                <span className="info-value">{selectedRace.speed} ft.</span>
              </div>
              <div className="info-item">
                <span className="info-label">Size</span>
                <span className="info-value">{selectedRace.size}</span>
              </div>
              {showLanguages && (
                <div className="info-item">
                  <span className="info-label">Languages</span>
                  <span className="info-value">{selectedRace.languages.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {traits.length > 0 && (
            <div className="detail-section">
              <h4>Racial Traits</h4>
              {traits.map((trait, index) => (
                <div key={index} className="trait-item">
                  <div className="trait-header">
                    <span className="trait-name">{trait.name}</span>
                  </div>
                  <div className="trait-description">
                    {trait.description.includes('<') ? (
                      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(trait.description) }} />
                    ) : (
                      trait.description
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RaceDetailCard;
