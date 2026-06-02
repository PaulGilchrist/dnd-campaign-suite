import { useState, useEffect, useCallback } from 'react';
import { getPreCastOptions, getMaxMetamagicPerSpell } from '../../services/metamagicRules.js';
import './MetamagicPopup.css';

function getCombatSummary() {
  try {
    const stored = localStorage.getItem('combatSummary');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function getCreatureTargets(excludeName) {
  const cs = getCombatSummary();
  if (!cs?.creatures) return [];
  return cs.creatures
    .filter(c => c.name !== excludeName)
    .map(c => c.name);
}

export default function MetamagicPopup({ spell, playerStats, campaignName, onConfirm, onSkip }) {
  const spellLevel = spell?.level || 0;
  const currentSP = Number(playerStats._metamagicCurrentSP) || 0;
  const options = getPreCastOptions(playerStats, currentSP, spellLevel);
  const maxPerSpell = getMaxMetamagicPerSpell(playerStats);

  const [selected, setSelected] = useState([]);
  const [twinTarget, setTwinTarget] = useState('');
  const creatureTargets = getCreatureTargets(playerStats?.name);

  const totalCost = selected.reduce((sum, name) => {
    const opt = options.find(o => o.name === name);
    return sum + (opt?.resolvedCost || 0);
  }, 0);

  const remainingAfter = currentSP - totalCost;
  const canAffordTotal = remainingAfter >= 0;
  const canSelectMore = selected.length < maxPerSpell;

  const hasTwinned = selected.includes('Twinned Spell');
  const needsTwinTarget = hasTwinned && !twinTarget;

  const toggleOption = useCallback((name, affordable) => {
    if (!affordable) return;
    setSelected(prev => {
      if (prev.includes(name)) {
        return prev.filter(n => n !== name);
      }
      if (!canSelectMore) return prev;
      return [...prev, name];
    });
  }, [canSelectMore]);

  const handleConfirm = useCallback(() => {
    if (needsTwinTarget) return;
    onConfirm({
      options: selected,
      totalCost,
      twinTarget: hasTwinned ? twinTarget : null,
    });
  }, [selected, totalCost, twinTarget, hasTwinned, needsTwinTarget, onConfirm]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onSkip]);

  if (options.length === 0) {
    return (
      <div className="popup-overlay" onClick={onSkip}>
        <div className="popup-modal metamagic-popup" onClick={e => e.stopPropagation()}>
          <div className="metamagic-popup-inner">
            <h3>Metamagic</h3>
            <p>Your character is not a Sorcerer with available Metamagic options.</p>
            <button className="btn" onClick={onSkip}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const isAffordable = (opt) => {
    const costSoFar = selected
      .filter(n => n !== opt.name)
      .reduce((sum, name) => {
        const o = options.find(x => x.name === name);
        return sum + (o?.resolvedCost || 0);
      }, 0);
    return (currentSP - costSoFar) >= opt.resolvedCost;
  };

  return (
    <div className="popup-overlay" onClick={onSkip}>
      <div className="popup-modal metamagic-popup" onClick={e => e.stopPropagation()}>
        <div className="metamagic-popup-inner">
          <h3><i className="fa-solid fa-wand-magic-sparkles"></i> Metamagic</h3>
          <p className="metamagic-spell-name">
            <strong>{spell?.name || 'Spell'}</strong> (Level {spellLevel})
          </p>
          <p className="metamagic-sp-remaining">
            Sorcery Points: <strong>{currentSP}</strong> available — <strong>{totalCost}</strong> selected — <strong className={remainingAfter >= 0 ? '' : 'metamagic-insufficient'}>{remainingAfter}</strong> remaining
          </p>
          {maxPerSpell > 1 && (
            <p className="metamagic-incarnate-note">
              <i className="fa-solid fa-star"></i> Sorcery Incarnate: you can use up to {maxPerSpell} Metamagic options per spell.
            </p>
          )}
          <div className="metamagic-options">
            {options.map(opt => {
              const checked = selected.includes(opt.name);
              const affordable = isAffordable(opt);
              const disabled = !checked && (!canSelectMore || !affordable || (!canAffordTotal && !checked));
              return (
                <label
                  key={opt.name}
                  className={`metamagic-option ${checked ? 'metamagic-option-selected' : ''} ${disabled ? 'metamagic-option-disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleOption(opt.name, !disabled)}
                  />
                  <span className="metamagic-option-name">{opt.name}</span>
                  <span className="metamagic-option-cost">{opt.resolvedCost} SP</span>
                  <span className="metamagic-option-desc">{opt.description}</span>
                </label>
              );
            })}
          </div>

          {hasTwinned && (
            <div className="metamagic-twin-target">
              <label>
                <strong>Twinned Spell — Second Target:</strong>
                <select value={twinTarget} onChange={e => setTwinTarget(e.target.value)}>
                  <option value="">-- Select target --</option>
                  {creatureTargets.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="metamagic-actions">
            <button className="btn btn-secondary" onClick={onSkip}>
              Cast Without Metamagic
            </button>
            <button
              className="btn"
              onClick={handleConfirm}
              disabled={needsTwinTarget || totalCost === 0}
            >
              Apply &amp; Cast ({totalCost} SP)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
