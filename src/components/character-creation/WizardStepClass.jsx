import { useState } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import './WizardStepClass.css';

function WizardStepClass({ formData, errors, allClassesData, ruleset, onInputChange }) {
  const [expanded, setExpanded] = useState(false);

  const selectedClassName = formData.class?.name || '';
  const fullClassData = allClassesData.find(c => c.name === selectedClassName);

  const isCleric2024 = ruleset === '2024' && selectedClassName === 'Cleric';
  const isDruid2024 = ruleset === '2024' && selectedClassName === 'Druid';

  const divineOrderOptions = isCleric2024 ? ['Protector', 'Thaumaturge'] : [];
  const primalOrderOptions = isDruid2024 ? ['Magician', 'Warden'] : [];

  const handleClassChange = (e) => {
    const name = e.target.value;
    const cls = allClassesData.find(c => c.name === name);
    const hasSubs = (cls?.subclasses || cls?.majors || []).length > 0;
    onInputChange('class', {
      name: name,
      subclass: hasSubs ? { name: '' } : { name: '' },
      divineOrder: '',
      primalOrder: ''
    });
  };

  return (
    <div className="wizard-step wizard-step-class">
      <h2>Step 6: Class</h2>

      <div className="form-group">
        <label>Class *</label>
        <select
          value={selectedClassName}
          onChange={handleClassChange}
          className={errors.class ? 'error' : ''}
        >
          <option value="">Select a class</option>
          {allClassesData.map(cls => (
            <option key={cls.index || cls.name} value={cls.name}>{cls.name}</option>
          ))}
        </select>
        {errors.class && <span className="error-message">{errors.class}</span>}
      </div>

      {isCleric2024 && (
        <div className="form-group">
          <label>Divine Order *</label>
          <select
            value={formData.class?.divineOrder || ''}
            onChange={(e) => onInputChange('class', { ...formData.class, divineOrder: e.target.value })}
            className={errors.divineOrder ? 'error' : ''}
          >
            <option value="">Select a Divine Order</option>
            {divineOrderOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors.divineOrder && <span className="error-message">{errors.divineOrder}</span>}
        </div>
      )}

      {isDruid2024 && (
        <div className="form-group">
          <label>Primal Order *</label>
          <select
            value={formData.class?.primalOrder || ''}
            onChange={(e) => onInputChange('class', { ...formData.class, primalOrder: e.target.value })}
            className={errors.primalOrder ? 'error' : ''}
          >
            <option value="">Select a Primal Order</option>
            {primalOrderOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors.primalOrder && <span className="error-message">{errors.primalOrder}</span>}
        </div>
      )}

      {fullClassData && (
        <div className="class-detail-card">
          <div className="detail-card-header" onClick={() => setExpanded(!expanded)}>
            <h3>
              <i className="fa-solid fa-hat-wizard" />
              {fullClassData.name} Details
            </h3>
            <button className="toggle-details-btn" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
              {expanded ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {expanded && (
            <div className="detail-card-body">
              {fullClassData.class_description && (
                <div className="detail-section">
                  <h4>Description</h4>
                  <div
                    className="detail-content"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(fullClassData.class_description) }}
                  />
                </div>
              )}

              {!fullClassData.class_description && fullClassData.description && (
                <div className="detail-section">
                  <h4>Description</h4>
                  <div className="detail-content">{fullClassData.description}</div>
                </div>
              )}

              <div className="detail-section">
                <h4>Core Information</h4>
                <div className="info-grid">
                  {fullClassData.primary_ability && (
                    <div className="info-item">
                      <span className="info-label">Primary Ability</span>
                      <span className="info-value">{fullClassData.primary_ability}</span>
                    </div>
                  )}
                  {fullClassData.hit_point_die && (
                    <div className="info-item">
                      <span className="info-label">Hit Point Die</span>
                      <span className="info-value">{fullClassData.hit_point_die}</span>
                    </div>
                  )}
                  {fullClassData.hit_die && (
                    <div className="info-item">
                      <span className="info-label">Hit Die</span>
                      <span className="info-value">d{fullClassData.hit_die}</span>
                    </div>
                  )}
                  {fullClassData.saving_throw_proficiencies && (
                    <div className="info-item">
                      <span className="info-label">Saving Throws</span>
                      <span className="info-value">{fullClassData.saving_throw_proficiencies.join(', ')}</span>
                    </div>
                  )}
                  {fullClassData.saving_throws && (
                    <div className="info-item">
                      <span className="info-label">Saving Throws</span>
                      <span className="info-value">{fullClassData.saving_throws.join(', ')}</span>
                    </div>
                  )}
                  {fullClassData.weapon_proficiencies && (
                    <div className="info-item">
                      <span className="info-label">Weapon Proficiencies</span>
                      <span className="info-value">{fullClassData.weapon_proficiencies}</span>
                    </div>
                  )}
                  {fullClassData.armor_training && (
                    <div className="info-item">
                      <span className="info-label">Armor Training</span>
                      <span className="info-value">{fullClassData.armor_training}</span>
                    </div>
                  )}
                  {fullClassData.proficiencies && (
                    <div className="info-item">
                      <span className="info-label">Weapon Proficiencies</span>
                      <span className="info-value">{fullClassData.proficiencies.join(', ')}</span>
                    </div>
                  )}
                  {fullClassData.tool_proficiencies && (
                    <div className="info-item full-width">
                      <span className="info-label">Tool Proficiencies</span>
                      <span className="info-value">{fullClassData.tool_proficiencies}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WizardStepClass;
