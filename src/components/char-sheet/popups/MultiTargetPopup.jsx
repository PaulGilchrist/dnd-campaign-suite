import { useState, useCallback } from 'react';
import TargetPopupBase from './TargetPopupBase';

export default function MultiTargetPopup({ spell, _playerStats, _campaignName, range, creatureTargets, onConfirm, onSkip }) {
  void _campaignName;
  const [secondTarget, setSecondTarget] = useState('');
  const needsTarget = !secondTarget;

  const handleConfirm = useCallback(() => {
    if (needsTarget) return;
    onConfirm({ secondTarget });
  }, [secondTarget, needsTarget, onConfirm]);

  return (
    <TargetPopupBase
      icon="fa-solid fa-users"
      title="Words of Creation"
      spell={spell}
      spellSubtitle={'\u2014 Spread to Second Target'}
      description={<span>Select a second creature within <strong>{range}</strong> of the first target:</span>}
      confirmDisabled={needsTarget}
      confirmLabel="Cast on Both Targets"
      cancelLabel="Cast on First Target Only"
      onConfirm={handleConfirm}
      onSkip={onSkip}
    >
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
    </TargetPopupBase>
  );
}
