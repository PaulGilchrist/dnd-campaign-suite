import { useState } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import './WizardStepRace.css';

function WizardStepRace({ formData, errors, allRacesData, racesData, ruleset, onInputChange }) {
  const [expanded, setExpanded] = useState(false);

  const selectedRaceName = formData.race?.name || '';
  const selectedRace = racesData.find(r => r.name === selectedRaceName);
  const fullRaceData = allRacesData.find(r => r.name === selectedRaceName);

  const traits = ruleset === '2024'
    ? (selectedRace?.traits || [])
    : (selectedRace?.traits || []);

  return (
    <div className="wizard-step wizard-step-race">
      <h2>Step 3: Race</h2>

      <div className="form-group">
        <label>Race *</label>
        <select
          value={selectedRaceName}
          onChange={(e) => {
            const name = e.target.value;
            const race = racesData.find(r => r.name === name);
            const hasSubraces = (race?.subraces || []).length > 0;
            onInputChange('race', {
              name: name,
              subrace: hasSubraces ? { name: '' } : { name: '' }
            });
          }}
          className={errors.race ? 'error' : ''}
        >
          <option value="">Select a race</option>
          {racesData.map(race => (
            <option key={race.name} value={race.name}>{race.name}</option>
          ))}
        </select>
        {errors.race && <span className="error-message">{errors.race}</span>}
      </div>

      {selectedRace && (
        <div className="race-detail-card">
          <div className="detail-card-header" onClick={() => setExpanded(!expanded)}>
            <h3>
              <i className="fa-solid fa-dragon" />
              {selectedRace.name} Details
            </h3>
            <button className="toggle-details-btn" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
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
                    <span className="info-value">{ruleset === '5e' ? selectedRace.size : selectedRace.size}</span>
                  </div>
                  {ruleset === '5e' && selectedRace.languages && (
                    <div className="info-item">
                      <span className="info-label">Languages</span>
                      <span className="info-value">{selectedRace.languages.join(', ')}</span>
                    </div>
                  )}
                  {ruleset === '2024' && selectedRace.languages && (
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
      )}
    </div>
  );
}

export default WizardStepRace;
