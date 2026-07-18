import { useState, useEffect, useCallback } from 'react';
import './FlurryOfBlowsTargetPopup.css';

export default function FlurryOfBlowsTargetPopup({ totalAttacks, creatureTargets, currentTargetName, onConfirm, onSkip }) {
  const [distribution, setDistribution] = useState(() => {
    const initial = {};
    creatureTargets.forEach(name => { initial[name] = 0; });
    return initial;
  });

  useEffect(() => {
    if (currentTargetName && creatureTargets.includes(currentTargetName)) {
      setDistribution(prev => {
        const hasAnyAssigned = Object.values(prev).some(v => v > 0);
        if (!hasAnyAssigned && (prev[currentTargetName] === undefined || prev[currentTargetName] === 0)) {
          return { ...prev, [currentTargetName]: totalAttacks };
        }
        return prev;
      });
    }
  }, [currentTargetName, totalAttacks, creatureTargets]);

  const totalAssigned = Object.values(distribution).reduce((sum, val) => sum + val, 0);
  const needsTargets = totalAssigned !== totalAttacks;

  const handleSetTarget = useCallback((targetName, value) => {
    const num = Math.max(0, Math.min(totalAttacks, parseInt(value) || 0));
    setDistribution(prev => {
      const updated = { ...prev, [targetName]: num };
      const currentTotal = Object.values(updated).reduce((sum, val) => sum + val, 0);
      if (currentTotal > totalAttacks) {
        let excess = currentTotal - totalAttacks;
        const names = Object.keys(updated);
        const idx = names.indexOf(targetName);
        for (let i = idx + 1; i < names.length && excess > 0; i++) {
          const otherName = names[i];
          const reduce = Math.min(updated[otherName], excess);
          updated[otherName] -= reduce;
          excess -= reduce;
        }
      }
      return updated;
    });
  }, [totalAttacks]);

  const handleConfirm = useCallback(() => {
    if (needsTargets) return;
    onConfirm({ distribution });
  }, [distribution, needsTargets, onConfirm]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onSkip]);

  return (
    <div className="popup-overlay" onClick={onSkip}>
      <div className="popup-modal flurry-of-blows-popup" onClick={e => e.stopPropagation()}>
        <div className="flurry-popup-inner">
          <h3><i className="fa-solid fa-hand-fist"></i> Distribute Flurry of Blows Attacks</h3>
          <p className="metamagic-spell-name">
            <strong>Heightened Flurry of Blows</strong> — {totalAttacks} Attack{totalAttacks !== 1 ? 's' : ''} to Assign
          </p>
          <p>
            Each attack is an Unarmed Strike. Assign all {totalAttacks} attack{totalAttacks !== 1 ? 's' : ''} across targets:
          </p>
          <div className="flurry-distribution">
            {creatureTargets.map(name => {
              const count = distribution[name] || 0;
              return (
                <div key={name} className={`flurry-target-row ${name === currentTargetName ? 'flurry-current-target' : ''}`}>
                  <label className="flurry-target-label">
                    <span className="flurry-target-name">{name}{name === currentTargetName ? ' (Current)' : ''}</span>
                    <input
                      type="number"
                      min="0"
                      max={totalAttacks}
                      value={count}
                      onChange={e => handleSetTarget(name, e.target.value)}
                      onInput={e => handleSetTarget(name, e.target.value)}
                      className="flurry-target-input"
                    />
                  </label>
                </div>
              );
            })}
          </div>
          <div className="flurry-summary">
            Assigned: <strong>{totalAssigned}</strong> / {totalAttacks}
          </div>
          <div className="metamagic-actions">
            <button className="btn btn-secondary" onClick={onSkip}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={handleConfirm}
              disabled={needsTargets}
            >
              <i className="fa-solid fa-hand-fist"></i> Strike All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
