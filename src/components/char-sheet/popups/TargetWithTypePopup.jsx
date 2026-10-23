import { useState, useCallback } from 'react';
import TargetPopupBase from './TargetPopupBase';
import './TargetWithTypePopup.css';

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
          <div className="target-with-type-list">
            {creatureTargets.map(name => {
              const isSelected = selectedTarget === name;
              return (
                <div
                  key={name}
                  onClick={() => handleSelect(name)}
                  className="target-with-type-option"
                  /* backgroundColor/border are dynamic (derived from isSelected state) — dynamic-data exception, stays inline */
                  style={{
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
      <div className="metamagic-twin-target target-with-type-section-spaced">
        <label>
          <strong>Damage Type:</strong>
          <div className="target-with-type-list">
            {damageTypes.map(type => {
              const isSelected = selectedDamageType === type;
              return (
                <div
                  key={type}
                  onClick={() => handleSelectDamageType(type)}
                  className="target-with-type-option"
                  /* backgroundColor/border are dynamic (derived from isSelected state) — dynamic-data exception, stays inline */
                  style={{
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
