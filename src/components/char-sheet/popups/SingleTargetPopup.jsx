import { useState, useCallback } from 'react';
import TargetPopupBase from './TargetPopupBase';

export default function SingleTargetPopup({
  spell, creatureTargets, onConfirm, onSkip,
  icon, title, school, defaultLevel, description, confirmLabel, cancelLabel,
}) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const needsTarget = !selectedTarget;

  const handleSelect = useCallback((targetName) => {
    setSelectedTarget(targetName);
  }, []);

  const handleConfirm = useCallback(() => {
    if (needsTarget) return;
    onConfirm([selectedTarget]);
  }, [selectedTarget, needsTarget, onConfirm]);

  return (
    <TargetPopupBase
      icon={icon}
      title={title}
      spell={spell}
      school={school}
      defaultLevel={defaultLevel}
      description={description}
      confirmDisabled={needsTarget}
      confirmLabel={confirmLabel || `Cast ${title}`}
      cancelLabel={cancelLabel || 'Cancel'}
      onConfirm={handleConfirm}
      onSkip={onSkip}
    >
      <div className="metamagic-twin-target">
        <label>
          <strong>Target:</strong>
          <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {creatureTargets.map(name => {
              const isSelected = selectedTarget === name;
              return (
                <div
                  key={name}
                  onClick={() => handleSelect(name)}
                  style={{
                    padding: '6px 10px',
                    margin: '4px 0',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    backgroundColor: isSelected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    border: isSelected ? '1px solid #4CAF50' : '1px solid transparent',
                  }}
                >
                  {isSelected ? '\u2713 ' : ''}{name}
                </div>
              );
            })}
          </div>
        </label>
      </div>
    </TargetPopupBase>
  );
}
