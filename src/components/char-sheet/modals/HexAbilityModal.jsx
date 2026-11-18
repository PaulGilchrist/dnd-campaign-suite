import React from 'react';
import './HexAbilityModal.css';
import { useOverlayEntranceFocus } from '../../../hooks/ui/useOverlayEntranceFocus.js';

function HexAbilityModal({
  onAbilitySelected,
  onCancel,
  abilities,
  title,
  prompt,
  icon,
}) {
  // Entrance focus + stranded-close restore (backlog 2026-11-17 sp-overlay adoption).
  const overlayRef = React.useRef(null);
  useOverlayEntranceFocus(overlayRef);
  const defaultAbilities = [
    { key: 'STR', label: 'Strength' },
    { key: 'DEX', label: 'Dexterity' },
    { key: 'CON', label: 'Constitution' },
    { key: 'INT', label: 'Intelligence' },
    { key: 'WIS', label: 'Wisdom' },
    { key: 'CHA', label: 'Charisma' },
  ];
  const abilityOptions = abilities || defaultAbilities;
  const modalTitle = title || 'Hex — Choose Ability';
  const modalPrompt = prompt || 'Choose an ability check for the target to have disadvantage on:';
  const iconClass = icon ?? 'fa-eye';

  return (
    <div className="sp-overlay" ref={overlayRef}>
      <div className="sp-modal">
        <div className="sp-header">
          <i className={`fa-solid ${iconClass}`}></i> {modalTitle}
        </div>
        <div className="sp-body">
          <p>{modalPrompt}</p>
          <div className="hex-ability-buttons">
            {abilityOptions.map(({ key, label }) => (
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
