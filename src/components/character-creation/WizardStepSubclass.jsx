import { useState } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import './WizardStepSubclass.css';

function WizardStepSubclass({ formData, errors, classSubtypes, ruleset, onInputChange, allClassesData }) {
  const [expanded, setExpanded] = useState(false);

  const selectedClassName = formData.class?.name || '';
  const selectedClass = classSubtypes.find(c => c.className === selectedClassName);
  const subclasses = selectedClass?.subtypes || [];
  const hasSubclasses = subclasses.length > 0;

  const selectedSubclassName = formData.class?.subclass?.name || '';
  const selectedSubclass = hasSubclasses
    ? subclasses.find(s => s.name === selectedSubclassName)
    : null;

  const fullClassData = allClassesData.find(c => c.name === selectedClassName);

  const getSubclassFeatures = () => {
    if (!selectedSubclass) return [];

    if (ruleset === '2024') {
      const major = fullClassData?.majors?.find(m => m.name === selectedSubclassName);
      if (major?.features) {
        return major.features.map(f => ({
          name: f.name,
          description: f.description,
          level: f.level,
          type: f.type
        }));
      }
    }

    if (ruleset === '5e') {
      if (selectedSubclass.class_levels) {
        const features = [];
        selectedSubclass.class_levels.forEach(levelData => {
          (levelData.features || []).forEach(feature => {
            features.push({
              name: feature.name,
              description: feature.description,
              level: feature.level,
              type: feature.type
            });
          });
        });
        return features;
      }

      const fullSubclass = fullClassData?.subclasses?.find(s => s.name === selectedSubclassName);
      if (fullSubclass?.class_levels) {
        const features = [];
        fullSubclass.class_levels.forEach(levelData => {
          (levelData.features || []).forEach(feature => {
            features.push({
              name: feature.name,
              description: feature.description,
              level: feature.level,
              type: feature.type
            });
          });
        });
        return features;
      }
    }

    return [];
  };

  const features = getSubclassFeatures();

  return (
    <div className="wizard-step wizard-step-subclass">
      <h2>Step 7: Subclass / Major</h2>

      {!hasSubclasses ? (
        <div className="no-subclass-message">
          <i className="fa-solid fa-circle-info" />
          <p>Your selected class ({selectedClassName}) has no subclasses/majors. You can proceed to the next step.</p>
        </div>
      ) : (
        <>
          <div className="form-group">
            <label>Subclass / Major *</label>
            <select
              value={selectedSubclassName}
              onChange={(e) => {
                onInputChange('class', {
                  ...formData.class,
                  subclass: { name: e.target.value }
                });
              }}
              className={errors.subclass ? 'error' : ''}
            >
              <option value="">Select a subclass / major</option>
              {subclasses.map(sub => (
                <option key={sub.name} value={sub.name}>{sub.name}</option>
              ))}
            </select>
            {errors.subclass && <span className="error-message">{errors.subclass}</span>}
          </div>

          {selectedSubclass && (
            <div className="subclass-detail-card">
              <div className="detail-card-header" onClick={() => setExpanded(!expanded)}>
                <h3>
                  <i className="fa-solid fa-star" />
                  {selectedSubclass.name} Details
                </h3>
                <button className="toggle-details-btn" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
                  {expanded ? 'Hide Details' : 'Show Details'}
                </button>
              </div>

              {expanded && (
                <div className="detail-card-body">
                  {selectedSubclass.description && (
                    <div className="detail-section">
                      <h4>Description</h4>
                      <div
                        className="detail-content"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedSubclass.description) }}
                      />
                    </div>
                  )}

                  {selectedSubclass.subclass_flavor && (
                    <div className="detail-section">
                      <h4>Flavor</h4>
                      <div className="detail-content">{selectedSubclass.subclass_flavor}</div>
                    </div>
                  )}

                  {features.length > 0 && (
                    <div className="detail-section">
                      <h4>Features</h4>
                      {features.map((feature, index) => (
                        <div key={index} className="feature-item">
                          <div className="feature-header">
                            <span className="feature-name">{feature.name}</span>
                            <span className="feature-level-badge">Level {feature.level}</span>
                          </div>
                          <div className="feature-description">
                            {feature.description.includes('<') ? (
                              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(feature.description) }} />
                            ) : (
                              feature.description
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
        </>
      )}
    </div>
  );
}

export default WizardStepSubclass;
