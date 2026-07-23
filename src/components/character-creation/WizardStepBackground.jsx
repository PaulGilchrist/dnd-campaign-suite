import { useState } from 'react';
import './WizardStepBackground.css';

function WizardStepBackground({ formData, errors, backgrounds, ruleset, onInputChange }) {
  const [expanded, setExpanded] = useState(false);

  const selectedBackgroundName = formData.background || '';
  const selectedBackground = backgrounds.find(b => b.name === selectedBackgroundName);

  if (ruleset !== '2024') {
    return (
      <div className="wizard-step wizard-step-background">
        <h2>Step 5: Background</h2>
        <div className="background-not-available">
          <i className="fa-solid fa-circle-info" />
          <p>Backgrounds are only available for 2024 (Essentials) ruleset characters. For 5e characters, backgrounds are purely narrative and do not grant mechanical benefits.</p>
        </div>
      </div>
    );
  }

  if (backgrounds.length === 0) {
    return (
      <div className="wizard-step wizard-step-background">
        <h2>Step 5: Background</h2>
        <div className="no-results-found">Background data not yet loaded. Please try again.</div>
      </div>
    );
  }

  return (
    <div className="wizard-step wizard-step-background">
      <h2>Step 5: Background</h2>

      <div className="form-group">
        <label>Background *</label>
        <select
          value={selectedBackgroundName}
          onChange={(e) => onInputChange('background', e.target.value)}
          className={errors.background ? 'error' : ''}
        >
          <option value="">Select a background</option>
          {backgrounds.map(background => (
            <option key={background.index} value={background.name}>{background.name}</option>
          ))}
        </select>
        {errors.background && <span className="error-message">{errors.background}</span>}
      </div>

      {selectedBackground && (
        <div className="background-detail-card">
          <div className="detail-card-header" onClick={() => setExpanded(!expanded)}>
            <h3>
              <i className="fa-solid fa-scroll" />
              {selectedBackground.name} Details
            </h3>
            <button className="toggle-details-btn" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
              {expanded ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {expanded && (
            <div className="detail-card-body">
              {selectedBackground.description && (
                <div className="detail-section">
                  <h4>Description</h4>
                  <div className="detail-content">{selectedBackground.description}</div>
                </div>
              )}

              <div className="detail-section">
                <h4>Ability Scores</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-value">{selectedBackground.ability_scores}</span>
                  </div>
                </div>
              </div>

              {selectedBackground.feat && (
                <div className="detail-section">
                  <h4>Feat</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-value">{selectedBackground.feat}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedBackground.skill_proficiencies && (
                <div className="detail-section">
                  <h4>Skill Proficiencies</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-value">{selectedBackground.skill_proficiencies}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedBackground.tool_proficiencies && (
                <div className="detail-section">
                  <h4>Tool Proficiencies</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-value">{selectedBackground.tool_proficiencies}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WizardStepBackground;
