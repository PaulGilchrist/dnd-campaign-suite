import { useState, useCallback } from 'react';
import TargetPopupBase from './TargetPopupBase';

export default function TargetWithTypePopup({
  spell, creatureTargets, damageTypes, onConfirm, onSkip,
  icon, title, school, defaultLevel, description, confirmLabel, cancelLabel,
}) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [selectedDamageType, setSelectedDamageType] = useState(null);
  const needsTarget = !selectedTarget;
  const needsDamageType = !selectedDamageType;

  const handleSelect = useCallback((targetName) => {
    setSelectedTarget(targetName);
  }, []);

  const handleSelectDamageType = useCallback((damageType) => {
    setSelectedDamageType(damageType);
  }, []);

  const handleConfirm = useCallback(() => {
    if (needsTarget || needsDamageType) return;
    onConfirm({ targetName: selectedTarget, damageType: selectedDamageType });
  }, [selectedTarget, selectedDamageType, needsTarget, needsDamageType, onConfirm]);

  return (
    <TargetPopupBase
      icon={icon}
      title={title}
      spell={spell}
      school={school}
      defaultLevel={defaultLevel}
      description={description}
      confirmDisabled={needsTarget || needsDamageType}
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
      <div className="metamagic-twin-target" style={{ marginTop: '16px' }}>
        <label>
          <strong>Damage Type:</strong>
          <div style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {damageTypes.map(type => {
              const isSelected = selectedDamageType === type;
              return (
                <div
                  key={type}
                  onClick={() => handleSelectDamageType(type)}
                  style={{
                    padding: '6px 10px',
                    margin: '4px 0',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    backgroundColor: isSelected ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    border: isSelected ? '1px solid #4CAF50' : '1px solid transparent',
                  }}
                >
                  {isSelected ? '\u2713 ' : ''}{type}
                </div>
              );
            })}
          </div>
        </label>
      </div>
    </TargetPopupBase>
  );
}
