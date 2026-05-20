import React from 'react';
import './EncounterBuilder.css';

function EncounterSelectedMonsters({ selectedMonsters, onRemoveMonster }) {
  if (!selectedMonsters || selectedMonsters.length === 0) {
    return null;
  }

  return (
    <div className="encounter-selected">
      <div className="encounter-selected-title">
        Selected Monsters ({selectedMonsters.length})
      </div>
      <div className="selected-list">
        {selectedMonsters.map((monster) => (
          <div key={monster.index} className="selected-item">
            <span className="selected-name">{monster.name}</span>
            <span className="selected-cr">CR {monster.challenge_rating}</span>
            <span className="selected-xp">{monster.xp.toLocaleString()} XP</span>
            <button
              type="button"
              className="remove-btn"
              onClick={() => onRemoveMonster(monster.index)}
              aria-label={`Remove ${monster.name}`}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EncounterSelectedMonsters;
