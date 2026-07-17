import { useCallback, useEffect } from 'react';
import './PsionicChoicePopup.css';

export default function PsionicChoicePopup({ spellName, spellLevel, sorceryPointsAvailable, onConfirm, onCancel }) {
  const handleSlot = useCallback(() => {
    onConfirm({ choice: 'spellSlot' });
  }, [onConfirm]);

  const handleSorceryPoints = useCallback(() => {
    onConfirm({ choice: 'sorceryPoints' });
  }, [onConfirm]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div className="popup-overlay" onClick={onCancel}>
      <div className="popup-modal psionic-choice-popup" onClick={e => e.stopPropagation()}>
        <div className="psionic-choice-inner">
          <h3><i className="fa-solid fa-brain"></i> Psionic Sorcery</h3>
          <p className="psionic-choice-spell">
            <strong>{spellName}</strong> (Level {spellLevel})
          </p>
          <p className="psionic-choice-description">
            Psionic Sorcery allows you to cast this spell using sorcery points instead of a spell slot.
            When cast using sorcery points, the spell has no Verbal or Somatic components, and no Material components unless consumed or have a cost.
          </p>
          <div className="psionic-choice-options">
            <label
              className={`psionic-choice-option ${sorceryPointsAvailable === 0 ? 'psionic-choice-option-disabled' : ''}`}
              onClick={sorceryPointsAvailable > 0 ? handleSorceryPoints : undefined}
            >
              <span className="psionic-choice-option-icon"><i className="fa-solid fa-brain"></i></span>
              <div className="psionic-choice-option-content">
                <span className="psionic-choice-option-name">Consume Sorcery Points</span>
                <span className="psionic-choice-option-cost">{spellLevel} SP</span>
                <span className="psionic-choice-option-desc">No Verbal or Somatic components. No Material components unless consumed or have cost.</span>
              </div>
            </label>
            <label className="psionic-choice-option" onClick={handleSlot}>
              <span className="psionic-choice-option-icon"><i className="fa-solid fa-circle-dot"></i></span>
              <div className="psionic-choice-option-content">
                <span className="psionic-choice-option-name">Consume Spell Slot</span>
                <span className="psionic-choice-option-cost">Level {spellLevel}</span>
                <span className="psionic-choice-option-desc">Standard spell slot expenditure. Verbal, Somatic, and Material components apply normally.</span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
