import { useState } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import './WizardStepSubrace.css';

function getSubraceTraits(selectedSubrace) {
  if (!selectedSubrace) return [];
  const traits = [];
  if (selectedSubrace.damage_resistance) {
    traits.push({
      name: 'Damage Resistance',
      description: `You have resistance to ${selectedSubrace.damage_resistance} damage.`
    });
  }
  if (selectedSubrace.traits) {
    traits.push(...selectedSubrace.traits);
  }
  return traits;
}

function TraitDescription({ description }) {
  if (description.includes('<')) {
    return <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }} />;
  }
  return description;
}

function SubraceDetailCard({ subrace, traits, expanded, onToggle }) {
  return (
    <div className="subrace-detail-card">
      <div className="detail-card-header" onClick={onToggle}>
        <h3>
          <i className="fa-solid fa-dragon" />
          {subrace.name} Details
        </h3>
        <button className="toggle-details-btn" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {expanded && (
        <div className="detail-card-body">
          {subrace.description && (
            <div className="detail-section">
              <h4>Description</h4>
              <div
                className="detail-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(subrace.description) }}
              />
            </div>
          )}

          {traits.length > 0 && (
            <div className="detail-section">
              <h4>Subrace Traits</h4>
              {traits.map((trait, index) => (
                <div key={index} className="trait-item">
                  <div className="trait-header">
                    <span className="trait-name">{trait.name}</span>
                  </div>
                  <div className="trait-description">
                    <TraitDescription description={trait.description} />
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

function WizardStepSubrace({ formData, errors, racesData, onInputChange }) {
  const [expanded, setExpanded] = useState(false);

  const selectedRaceName = formData.race?.name || '';
  const selectedRace = racesData.find(r => r.name === selectedRaceName);

  const subraces = selectedRace?.subraces || [];
  const hasSubraces = subraces.length > 0;
  const selectedSubraceName = formData.race?.subrace?.name || '';
  const selectedSubrace = hasSubraces
    ? subraces.find(s => s.name === selectedSubraceName)
    : null;

  const subraceTraits = getSubraceTraits(selectedSubrace);

  return (
    <div className="wizard-step wizard-step-subrace">
      <h2>Step 4: Subrace</h2>

      {!hasSubraces ? (
        <div className="no-subrace-message">
          <i className="fa-solid fa-circle-info" />
          <p>Your selected race ({selectedRaceName}) has no subraces. You can proceed to the next step.</p>
        </div>
      ) : (
        <>
          <div className="form-group">
            <label>Subrace *</label>
            <select
              value={selectedSubraceName}
              onChange={(e) => {
                onInputChange('race', {
                  ...formData.race,
                  subrace: { name: e.target.value }
                });
              }}
              className={errors.subrace ? 'error' : ''}
            >
              <option value="">Select a subrace</option>
              {subraces.map(subrace => (
                <option key={subrace.name} value={subrace.name}>{subrace.name}</option>
              ))}
            </select>
            {errors.subrace && <span className="error-message">{errors.subrace}</span>}
          </div>

          {selectedSubrace && (
            <SubraceDetailCard
              subrace={selectedSubrace}
              traits={subraceTraits}
              expanded={expanded}
              onToggle={() => setExpanded(!expanded)}
            />
          )}
        </>
      )}
    </div>
  );
}

export default WizardStepSubrace;
