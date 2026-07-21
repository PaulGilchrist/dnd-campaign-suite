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
    <div className="hex-ability-modal">
      <div className="hex-ability-modal-content">
        <h3 className="hex-ability-modal-title">Choose an ability for Hex</h3>
        <div className="hex-ability-buttons">
          {abilities.map(({ key, label }) => (
            <button
              key={key}
              className="char-btn"
              onClick={() => onAbilitySelected(key)}
            >
              {label} ({key})
            </button>
          ))}
        </div>
        <div className="hex-ability-modal-actions">
          <button className="char-btn char-btn-secondary" onClick={onCancel}>
            <i className="fa-solid fa-times"></i> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default HexAbilityModal;
