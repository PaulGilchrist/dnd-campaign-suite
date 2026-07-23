import { useState } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import './WizardStepSubrace.css';

function WizardStepSubrace({ formData, errors, racesData, onInputChange }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedTraits, setExpandedTraits] = useState({});

  const selectedRaceName = formData.race?.name || '';
  const selectedRace = racesData.find(r => r.name === selectedRaceName);

  const subraces = selectedRace?.subraces || [];
  const hasSubraces = subraces.length > 0;
  const selectedSubraceName = formData.race?.subrace?.name || '';
  const selectedSubrace = hasSubraces
    ? subraces.find(s => s.name === selectedSubraceName)
    : null;

  const getSubraceTraits = () => {
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
  };

  const subraceTraits = getSubraceTraits();

  const toggleTrait = (traitIndex) => {
    setExpandedTraits(prev => ({
      ...prev,
      [traitIndex]: !prev[traitIndex]
    }));
  };

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
            <div className="subrace-detail-card">
              <div className="detail-card-header" onClick={() => setExpanded(!expanded)}>
                <h3>
                  <i className="fa-solid fa-dragon" />
                  {selectedSubrace.name} Details
                </h3>
                <button className="toggle-details-btn" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
                  {expanded ? 'Hide Details' : 'Show Details'}
                </button>
              </div>

              {expanded && (
                <div className="detail-card-body">
                  {selectedSubrace.description && (
                    <div className="detail-section">
                      <h4>Description</h4>
                      <div
                        className="detail-content"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedSubrace.description) }}
                      />
                    </div>
                  )}

                  {subraceTraits.length > 0 && (
                    <div className="detail-section">
                      <h4>Subrace Traits</h4>
                      {subraceTraits.map((trait, index) => (
                        <div key={index} className="trait-item">
                          <div
                            className="trait-header"
                            onClick={() => toggleTrait(index)}
                          >
                            <span className="trait-name">{trait.name}</span>
                            <span className="trait-toggle-icon">
                              <i className={`fa-solid ${expandedTraits[index] ? 'fa-chevron-up' : 'fa-chevron-down'}`} />
                            </span>
                          </div>
                          {expandedTraits[index] && trait.description && (
                            <div className="trait-description">
                              {trait.description.includes('<') ? (
                                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(trait.description) }} />
                              ) : (
                                trait.description
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default WizardStepSubrace;
