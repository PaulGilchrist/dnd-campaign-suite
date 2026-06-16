import { useState, useEffect, useCallback } from 'react';
import './MagicMissileTargetPopup.css';

export default function MagicMissileTargetPopup({ spell, playerStats, campaignName, totalMissiles, missileDamage, creatureTargets, currentTargetName, onConfirm, onSkip }) {
  void campaignName;
  void playerStats;

  const [distribution, setDistribution] = useState(() => {
    const initial = {};
    creatureTargets.forEach(name => { initial[name] = 0; });
    return initial;
  });

  useEffect(() => {
    if (currentTargetName && creatureTargets.includes(currentTargetName)) {
      setDistribution(prev => {
        if (prev[currentTargetName] === undefined || prev[currentTargetName] === 0) {
          return { ...prev, [currentTargetName]: totalMissiles };
        }
        return prev;
      });
    }
  }, [currentTargetName, totalMissiles, creatureTargets]);

  const totalAssigned = Object.values(distribution).reduce((sum, val) => sum + val, 0);
  const needsTargets = totalAssigned !== totalMissiles;

  const handleSetTarget = useCallback((targetName, value) => {
    const num = Math.max(0, Math.min(totalMissiles, parseInt(value) || 0));
    setDistribution(prev => ({ ...prev, [targetName]: num }));
  }, [totalMissiles]);

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
      <div className="popup-modal magic-missile-popup" onClick={e => e.stopPropagation()}>
        <div className="magic-missile-popup-inner">
          <h3><i className="fa-solid fa-bolt"></i> Distribute Magic Missiles</h3>
          <p className="metamagic-spell-name">
            <strong>{spell?.name || 'Spell'}</strong> — {totalMissiles} Missile{totalMissiles !== 1 ? 's' : ''} to Assign
          </p>
          <p>
            Each missile deals <strong>{missileDamage}</strong> Force damage. Assign all {totalMissiles} missile{totalMissiles !== 1 ? 's' : ''} across targets:
          </p>
          <div className="magic-missile-distribution">
            {creatureTargets.map(name => {
              const count = distribution[name] || 0;
              return (
                <div key={name} className={`magic-missile-target-row ${name === currentTargetName ? 'magic-missile-current-target' : ''}`}>
                  <label className="magic-missile-target-label">
                    <span className="magic-missile-target-name">{name}{name === currentTargetName ? ' (Current)' : ''}</span>
                    <input
                      type="number"
                      min="0"
                      max={totalMissiles}
                      value={count}
                      onChange={e => handleSetTarget(name, e.target.value)}
                      className="magic-missile-target-input"
                    />
                  </label>
                </div>
              );
            })}
          </div>
          <div className="magic-missile-summary">
            Assigned: <strong>{totalAssigned}</strong> / {totalMissiles}
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
              <i className="fa-solid fa-bolt"></i> Cast All Missiles
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
