import { useState, useEffect, useCallback } from 'react';
import './MetamagicPopup.css';

export default function MultiTargetPopup({ spell, _playerStats, _campaignName, range, creatureTargets, onConfirm, onSkip }) {
  void _campaignName;
  const [secondTarget, setSecondTarget] = useState('');
  const needsTarget = !secondTarget;

  const handleConfirm = useCallback(() => {
    if (needsTarget) return;
    onConfirm({ secondTarget });
  }, [secondTarget, needsTarget, onConfirm]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onSkip]);

  return (
    <div className="popup-overlay" onClick={onSkip}>
      <div className="popup-modal metamagic-popup" onClick={e => e.stopPropagation()}>
        <div className="metamagic-popup-inner">
          <h3><i className="fa-solid fa-users"></i> Words of Creation</h3>
          <p className="metamagic-spell-name">
            <strong>{spell?.name || 'Spell'}</strong> — Spread to Second Target
          </p>
          <p>
            Select a second creature within <strong>{range}</strong> of the first target:
          </p>
          <div className="metamagic-twin-target">
            <label>
              <strong>Second Target:</strong>
              <select value={secondTarget} onChange={e => setSecondTarget(e.target.value)}>
                <option value="">-- Select target --</option>
                {creatureTargets.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="metamagic-actions">
            <button className="btn btn-secondary" onClick={onSkip}>
              Cast on First Target Only
            </button>
            <button
              className="btn"
              onClick={handleConfirm}
              disabled={needsTarget}
            >
              Cast on Both Targets
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
