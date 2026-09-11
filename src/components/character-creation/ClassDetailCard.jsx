import { useState } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import './WizardStepClass.css';

const INFO_ITEMS = [
  { key: 'primary_ability', label: 'Primary Ability' },
  { key: 'hit_point_die', label: 'Hit Point Die' },
  { key: 'hit_die', label: 'Hit Die', format: (value) => `d${value}` },
  { key: 'saving_throw_proficiencies', label: 'Saving Throws', join: true },
  { key: 'saving_throws', label: 'Saving Throws', join: true },
  { key: 'weapon_proficiencies', label: 'Weapon Proficiencies' },
  { key: 'armor_training', label: 'Armor Training' },
  { key: 'proficiencies', label: 'Weapon Proficiencies', join: true },
  { key: 'tool_proficiencies', label: 'Tool Proficiencies', fullWidth: true },
];

const renderInfoItem = (fullClassData, item) => {
  const value = fullClassData[item.key];
  if (!value) return null;
  const display = item.join ? value.join(', ') : (item.format ? item.format(value) : value);
  return (
    <div key={item.key} className={`info-item${item.fullWidth ? ' full-width' : ''}`}>
      <span className="info-label">{item.label}</span>
      <span className="info-value">{display}</span>
    </div>
  );
};

function ClassDetailCard({ fullClassData }) {
  const [expanded, setExpanded] = useState(false);

  return (
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
              {INFO_ITEMS.map(item => renderInfoItem(fullClassData, item))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassDetailCard;
