import { useState, useCallback } from 'react';
import TargetPopupBase from './TargetPopupBase';

export default function MultiTargetCountPopup({
  spell, creatureTargets, maxTargets, onConfirm, onSkip,
  icon, title, school, defaultLevel, description, confirmLabel, cancelLabel,
}) {
  const [selectedTargets, setSelectedTargets] = useState([]);
  const needsTargets = selectedTargets.length === 0;

  const toggleTarget = useCallback((targetName) => {
    setSelectedTargets(prev => {
      if (prev.includes(targetName)) {
        return prev.filter(t => t !== targetName);
      }
      if (prev.length >= maxTargets) return prev;
      return [...prev, targetName];
    });
  }, [maxTargets]);

  const handleConfirm = useCallback(() => {
    if (needsTargets) return;
    onConfirm(selectedTargets);
  }, [selectedTargets, needsTargets, onConfirm]);

  return (
    <TargetPopupBase
      icon={icon}
      title={title}
      spell={spell}
      school={school}
      defaultLevel={defaultLevel}
      description={description}
      confirmDisabled={needsTargets}
      confirmLabel={confirmLabel || `Cast ${title}`}
      cancelLabel={cancelLabel || 'Cancel'}
      onConfirm={handleConfirm}
      onSkip={onSkip}
    >
      <div className="metamagic-twin-target">
        <label>
          <strong>Targets ({selectedTargets.length}/{maxTargets}):</strong>
          <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {creatureTargets.map(name => {
              const isSelected = selectedTargets.includes(name);
              return (
                <div
                  key={name}
                  onClick={() => toggleTarget(name)}
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
