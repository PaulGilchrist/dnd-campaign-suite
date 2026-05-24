import React from 'react';
import './EncounterBuilder.css';

const DIFFICULTY_VALUE_CLASSES = ['summary-value-easy', 'summary-value-medium', 'summary-value-hard', 'summary-value-deadly'];

function EncounterSummaryPanel({
  totalMonsterXP,
  monsterCount,
  difficultyMultiplier,
  effectiveXP,
  difficultyIndex,
  difficultyLabels,
  difficultyColors,
  selectedMonsters,
  onClearMonsters,
}) {
  const difficultyLabel = difficultyLabels && difficultyLabels[difficultyIndex]
     ? difficultyLabels[difficultyIndex]
     : 'Unknown';

  const valueClass = DIFFICULTY_VALUE_CLASSES[difficultyIndex] || '';
  const difficultyName = ['easy', 'medium', 'hard', 'deadly'][difficultyIndex] || 'easy';
  const backgroundClass = `summary-item-difficulty-${difficultyName}`;

  return (
     <div className="encounter-summary">
       <div className="summary-grid">
         <div className="summary-item">
           <span className="summary-label">Total XP</span>
           <span className="summary-value">{totalMonsterXP.toLocaleString()}</span>
         </div>
         <div className="summary-item">
           <span className="summary-label">Monster Count</span>
           <span className="summary-value">{monsterCount}</span>
         </div>
         <div className="summary-item">
           <span className="summary-label">Multiplier</span>
           <span className="summary-value">&times;{difficultyMultiplier}</span>
         </div>
         <div className="summary-item">
           <span className="summary-label">Effective XP</span>
           <span className="summary-value">{effectiveXP.toLocaleString()}</span>
         </div>
         <div className={`summary-item summary-item-highlight ${backgroundClass}`}>
           <span className="summary-label">Difficulty</span>
           <span className={`summary-value ${valueClass}`}>
             {difficultyLabel}
           </span>
         </div>
       </div>

      {selectedMonsters && selectedMonsters.length > 0 && (
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            className="encounter-btn encounter-btn-danger"
            onClick={onClearMonsters}
          >
            <i className="fa-solid fa-trash-can" /> Clear All
          </button>
        </div>
      )}
    </div>
  );
}

export default EncounterSummaryPanel;
