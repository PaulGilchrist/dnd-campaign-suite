
import React from 'react'
import { getRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js'
import { getClassFeatures } from '../../../services/character/classFeatures.js'
import './FontOfMagicModal.css'

const COSTS_2024 = [0, 2, 3, 4, 5, 6];

function getSlotCosts(playerStats) {
  if (playerStats.rules === '2024') return COSTS_2024;
  const classLevel = playerStats.class?.class_levels?.find(cl => cl.level === playerStats.level);
  const costs = classLevel?.class_specific?.creating_spell_slots || [];
  const byLevel = [0, 0, 0, 0, 0, 0];
  costs.forEach(c => { if (c.spell_slot_level <= 5) byLevel[c.spell_slot_level] = c.sorcery_point_cost; });
  return byLevel;
}

function FontOfMagicModal({ playerStats, campaignName, onClose }) {
  const name = playerStats.name;
  const maxSlots = {
    1: playerStats.spellAbilities?.spell_slots_level_1 || 0,
    2: playerStats.spellAbilities?.spell_slots_level_2 || 0,
    3: playerStats.spellAbilities?.spell_slots_level_3 || 0,
    4: playerStats.spellAbilities?.spell_slots_level_4 || 0,
    5: playerStats.spellAbilities?.spell_slots_level_5 || 0,
  };
  const slotCosts = getSlotCosts(playerStats);

  const maxSP = getClassFeatures(playerStats)?.maxSorceryPoints || 0;
  const currentSP = (() => {
    const stored = getRuntimeValue(name, 'sorceryPoints');
    return stored != null ? Number(stored) : maxSP;
  })();
  const currentSlots = (() => {
    const slots = {};
    for (let lvl = 1; lvl <= 5; lvl++) {
      const stored = getRuntimeValue(name, `spell_slots_level_${lvl}`);
      slots[lvl] = stored != null ? Math.min(maxSlots[lvl], Number(stored)) : maxSlots[lvl];
    }
    return slots;
  })();
  const [toSP, setToSP] = React.useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [toSlots, setToSlots] = React.useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  const totalSPGained = Object.entries(toSP).reduce((sum, [lvl, count]) => sum + Number(lvl) * count, 0);
  const totalSPCost = Object.entries(toSlots).reduce((sum, [lvl, count]) => sum + slotCosts[Number(lvl)] * count, 0);
  const netSPChange = totalSPGained - totalSPCost;
  const finalSP = currentSP + netSPChange;

  const finalSlots = {};
  for (let lvl = 1; lvl <= 5; lvl++) {
    finalSlots[lvl] = currentSlots[lvl] - (toSP[lvl] || 0) + (toSlots[lvl] || 0);
  }

  const canApply = netSPChange !== 0 && finalSP >= 0 &&
    [1,2,3,4,5].every(lvl => toSP[lvl] <= currentSlots[lvl]) &&
    [1,2,3,4,5].every(lvl => finalSlots[lvl] >= 0 && finalSlots[lvl] <= maxSlots[lvl]);

  const handleApply = () => {
    if (!canApply) return;
    const updates = { sorceryPoints: finalSP };
    for (let lvl = 1; lvl <= 5; lvl++) {
      updates[`spell_slots_level_${lvl}`] = finalSlots[lvl];
    }
    setRuntimeBatch(name, updates, campaignName);
    window.dispatchEvent(new CustomEvent('sorcery-points-updated'));
    onClose();
  };

  React.useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="font-of-magic-overlay no-print" onClick={onClose}>
      <div className="font-of-magic-modal" onClick={(e) => e.stopPropagation()}>
        <h3><i className="fas fa-fire"></i> Font of Magic</h3>
        <p className="font-of-magic-subtitle">Bonus Action &mdash; Convert between spell slots and sorcery points</p>

        <div className="font-of-magic-summary">
          <span><b>Sorcery Points:</b> {currentSP} &rarr; <span className={finalSP >= 0 ? 'stat--buffed' : 'stat--penalized'}>{finalSP}</span></span>
        </div>

        <div className="font-of-magic-section">
          <h4>Convert Spell Slots to Sorcery Points</h4>
          <p className="font-of-magic-hint">Gain SP equal to the slot&rsquo;s level per slot expended.</p>
          <table className="font-of-magic-table">
            <thead>
              <tr><th>Level</th><th>Available</th><th>Convert</th><th>SP Gained</th></tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(lvl => (
                <tr key={`toSP-${lvl}`}>
                  <td>{lvl}</td>
                  <td>{currentSlots[lvl]} / {maxSlots[lvl]}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max={currentSlots[lvl]}
                      value={toSP[lvl]}
                      onChange={e => {
                        const raw = Math.max(0, Math.min(currentSlots[lvl], Number(e.target.value) || 0));
                        setToSP(prev => ({ ...prev, [lvl]: raw }));
                      }}
                    />
                  </td>
                  <td>+{toSP[lvl] * lvl}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="font-of-magic-total"><b>Total SP gained:</b> +{totalSPGained}</div>
        </div>

        <div className="font-of-magic-section">
          <h4>Convert Sorcery Points to Spell Slots</h4>
          <p className="font-of-magic-hint">Cost per slot shown. Created slots vanish after a Long Rest.</p>
          <table className="font-of-magic-table">
            <thead>
              <tr><th>Level</th><th>SP Cost</th><th>Create</th><th>SP Cost</th></tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map(lvl => (
                <tr key={`toSlots-${lvl}`}>
                  <td>{lvl}</td>
                  <td>{slotCosts[lvl]} SP</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      max={maxSlots[lvl]}
                      value={toSlots[lvl]}
                      onChange={e => {
                        const raw = Math.max(0, Math.min(maxSlots[lvl], Number(e.target.value) || 0));
                        setToSlots(prev => ({ ...prev, [lvl]: raw }));
                      }}
                    />
                  </td>
                  <td>-{toSlots[lvl] * slotCosts[lvl]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="font-of-magic-total"><b>Total SP cost:</b> -{totalSPCost}</div>
        </div>

        <div className="font-of-magic-actions">
          <button className="char-btn" onClick={handleApply} disabled={!canApply}>
            <i className="fa-solid fa-check"></i> Apply Conversion
          </button>
          <button className="char-btn" onClick={onClose}>
            <i className="fa-solid fa-times"></i> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default FontOfMagicModal;
