import { useState, useEffect } from 'react';
import './UpcastPopup.css';

export default function UpcastPopup({ spell, levels, onConfirm, onCancel }) {
  const defaultLevel = (() => {
    const firstAvailable = levels.find(l => l.availableSlots > 0);
    return firstAvailable ? String(firstAvailable.level) : String(levels[0]?.level || spell.level);
  })();
  const [selectedLevel, setSelectedLevel] = useState(defaultLevel);
  const selected = levels.find(l => l.level === Number(selectedLevel));
  const canCast = selected && selected.availableSlots > 0;

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div className="popup-overlay" onClick={onCancel}>
      <div className="popup-modal upcast-popup" onClick={e => e.stopPropagation()}>
        <div className="upcast-popup-inner">
          <h3><i className="fa-solid fa-arrow-up"></i> Upcast {spell.name}?</h3>
          <p>This spell can be cast using a higher-level spell slot. Select the level to cast at.</p>
          <div className="upcast-levels">
            {levels.map(({ level, formula, availableSlots }) => {
              const isSelected = selectedLevel === String(level);
              const isDisabled = availableSlots <= 0;
              return (
                <label
                  key={level}
                  className={`upcast-level ${isSelected ? 'upcast-level-selected' : ''} ${isDisabled ? 'upcast-level-disabled' : ''}`}
                >
                  <input
                    type="radio"
                    name="upcastLevel"
                    value={level}
                    checked={isSelected}
                    onChange={() => setSelectedLevel(String(level))}
                    disabled={isDisabled}
                  />
                  <span className="upcast-level-number">Level {level}</span>
                  <span className="upcast-level-formula">{formula}</span>
                  <span className="upcast-level-slots">{availableSlots} slot{availableSlots !== 1 ? 's' : ''} remaining</span>
                </label>
              );
            })}
          </div>
          <div className="upcast-actions">
            <button className="char-btn char-btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="char-btn"
              onClick={() => onConfirm(Number(selectedLevel))}
              disabled={!canCast}
            >
              <i className="fa-solid fa-wand-magic"></i> Cast at Level {selectedLevel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
