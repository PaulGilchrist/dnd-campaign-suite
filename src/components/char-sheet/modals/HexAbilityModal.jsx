import React from 'react';
import './HexAbilityModal.css';

function HexAbilityModal({ onAbilitySelected, onCancel }) {
  const abilities = [
    { key: 'STR', label: 'Strength' },
    { key: 'DEX', label: 'Dexterity' },
    { key: 'CON', label: 'Constitution' },
    { key: 'INT', label: 'Intelligence' },
    { key: 'WIS', label: 'Wisdom' },
    { key: 'CHA', label: 'Charisma' },
  ];

  return (
    <div className="sp-overlay" onClick={onCancel}>
      <div className="sp-modal sp-modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="sp-header">
          <i className="fa-solid fa-eye"></i> Hex — Choose Ability
        </div>
        <div className="sp-body">
          <p>Choose an ability check for the target to have disadvantage on:</p>
          <div className="hex-ability-buttons">
            {abilities.map(({ key, label }) => (
              <button
                key={key}
                className="hex-ability-btn"
                onClick={() => onAbilitySelected(key)}
              >
                {label} ({key})
              </button>
            ))}
          </div>
        </div>
        <div className="sp-actions">
          <button className="sp-dismiss-btn" onClick={onCancel}>
            <i className="fa-solid fa-times"></i> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default HexAbilityModal;
