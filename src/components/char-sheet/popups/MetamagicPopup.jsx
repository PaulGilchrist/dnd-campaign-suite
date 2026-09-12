import { useState, useEffect, useCallback } from 'react';
import { getPreCastOptions, getMaxMetamagicPerSpell, computeMetamagicCost, hasArcaneApotheosis } from '../../../services/rules/spells/metamagicRules.js';
import { getCombatSummary } from '../../../services/encounters/combatData.js';
import './MetamagicPopup.css';

function getCreatureTargets(campaignName) {
  const cs = getCombatSummary(campaignName);
  if (!cs?.creatures) return [];
  return cs.creatures.map(c => c.name);
}

function NoOptionsView({ onSkip }) {
  return (
    <div className="popup-overlay" onClick={(e) => {
      if (e.target.closest('.popup-modal')) return;
      onSkip?.();
    }}>
      <div className="popup-modal metamagic-popup">
        <div className="metamagic-popup-inner">
          <h3>Metamagic</h3>
          <p>Your character is not a Sorcerer with available Metamagic options.</p>
          <button className="btn" onClick={onSkip}>Close</button>
        </div>
      </div>
    </div>
  );
}

function PsionicOptionRow({ psionicActive, psionicAffordable, psionicCost, onToggle }) {
  return (
    <label className={`metamagic-option ${psionicActive ? 'metamagic-option-selected' : ''} ${!psionicAffordable ? 'metamagic-option-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={psionicActive}
        disabled={!psionicAffordable}
        onChange={onToggle}
      />
      <span className="metamagic-option-name">Psionic Sorcery</span>
      <span className="metamagic-option-cost">{psionicCost} SP</span>
      <span className="metamagic-option-desc">Cast without Verbal or Somatic components. No Material components unless consumed or have cost.</span>
    </label>
  );
}

function TwinTargetSelector({ twinTarget, creatureTargets, onChange }) {
  return (
    <div className="metamagic-twin-target">
      <label>
        <strong>Twinned Spell — Second Target:</strong>
        <select value={twinTarget} onChange={e => onChange(e.target.value)}>
          <option value="">-- Select target --</option>
          {creatureTargets.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function computePsionicState({ psionicActive, psionicCost, totalCost, currentSP }) {
  const psionicTotalCost = psionicActive ? psionicCost : 0;
  const grandTotalCost = totalCost + psionicTotalCost;
  const remainingAfter = currentSP - grandTotalCost;
  return {
    grandTotalCost,
    remainingAfter,
    canAffordGrand: remainingAfter >= 0,
    psionicAffordable: !psionicActive && (currentSP - totalCost) >= psionicCost,
  };
}

function computeNeedsTwinTarget(hasTwinned, creatureTargets, twinTarget) {
  return hasTwinned && creatureTargets.length > 0 && !twinTarget;
}

export default function MetamagicPopup({ spell, playerStats, campaignName, onConfirm, onSkip }) {
  const spellLevel = spell?.level || 0;
  const currentSP = Number(playerStats._metamagicCurrentSP) || 0;
  const options = getPreCastOptions(playerStats, currentSP, spellLevel);
  const maxPerSpell = getMaxMetamagicPerSpell(playerStats, playerStats?.name);
  const isPsionicSpell = !!playerStats._isPsionicSpell;
  const psionicCost = Number(playerStats._psionicCost) || 0;

  const [selected, setSelected] = useState([]);
  const [twinTarget, setTwinTarget] = useState('');
  const [psionicActive, setPsionicActive] = useState(false);
  const creatureTargets = getCreatureTargets(campaignName);

  const apotheosisActive = hasArcaneApotheosis(playerStats, playerStats?.name);
  const { totalCost, waivedName } = computeMetamagicCost(selected, options, playerStats, playerStats?.name);

  const { grandTotalCost, remainingAfter, canAffordGrand, psionicAffordable } = computePsionicState({ psionicActive, psionicCost, totalCost, currentSP });
  const canSelectMore = selected.length < maxPerSpell;

  const hasTwinned = selected.includes('Twinned Spell');
  const needsTwinTarget = computeNeedsTwinTarget(hasTwinned, creatureTargets, twinTarget);

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

  const togglePsionic = useCallback(() => {
    if (psionicActive) {
      setPsionicActive(false);
    } else {
      const nextCost = totalCost + psionicCost;
      if (currentSP >= nextCost) {
        setPsionicActive(true);
      }
    }
  }, [psionicActive, psionicCost, totalCost, currentSP]);

  const handleConfirm = useCallback(() => {
    if (needsTwinTarget) return;
    // CLA-271: confirmed totalCost is the Metamagic-options cost ONLY — the
    // Psionic Sorcery SP payment is paid downstream (prepareSpellCast pays + skips
    // the slot + logs psionic_sorcery; the Actions-bar confirm handler pays when
    // psionicActive). Including it here caused a double charge when re-added.
    onConfirm({
      options: selected,
      totalCost,
      twinTarget: hasTwinned && creatureTargets.length > 0 ? twinTarget : null,
      psionicActive,
    });
  }, [selected, totalCost, twinTarget, hasTwinned, needsTwinTarget, creatureTargets.length, onConfirm, psionicActive]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onSkip();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onSkip]);

  if (options.length === 0) {
    return <NoOptionsView onSkip={onSkip} />;
  }

  const isAffordable = (opt) => {
       if (apotheosisActive) {
           const nextSelection = selected.includes(opt.name) ? [...selected] : [...selected, opt.name];
           return computeMetamagicCost(nextSelection, options, playerStats, playerStats?.name).totalCost + (psionicActive ? psionicCost : 0) <= currentSP;
         }
    const costSoFar = selected
       .filter(n => n !== opt.name)
       .reduce((sum, name) => {
        const o = options.find(x => x.name === name);
        return sum + (o?.resolvedCost || 0);
       }, 0);
    return (currentSP - costSoFar - (psionicActive ? psionicCost : 0)) >= opt.resolvedCost;
   };


   return (
      <div className="popup-overlay" onClick={(e) => {
        if (e.target.closest('.popup-modal')) return;
        onSkip?.();
      }}>
        <div className="popup-modal metamagic-popup">
         <div className="metamagic-popup-inner">
           <h3><i className="fa-solid fa-wand-magic-sparkles"></i> Metamagic</h3>
           <p className="metamagic-spell-name">
             <strong>{spell?.name || 'Spell'}</strong> (Level {spellLevel})
           </p>
           <p className="metamagic-sp-remaining">
             Sorcery Points: <strong>{currentSP}</strong> available — <strong>{grandTotalCost}</strong> selected — <strong className={remainingAfter >= 0 ? '' : 'metamagic-insufficient'}>{remainingAfter}</strong> remaining
           </p>
            {isPsionicSpell && (
              <PsionicOptionRow
                psionicActive={psionicActive}
                psionicAffordable={psionicAffordable}
                psionicCost={psionicCost}
                onToggle={togglePsionic}
              />
            )}
            <div className="metamagic-options">
              {options.map(opt => {
                const checked = selected.includes(opt.name);
               const affordable = isAffordable(opt);
               const disabled = !checked && (!canSelectMore || !affordable || (!canAffordGrand && !checked));
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
                   <span className="metamagic-option-cost">
    {waivedName === opt.name ? '0 (waived)' : `${opt.resolvedCost} SP`}
</span>
                   <span className="metamagic-option-desc">{opt.description}</span>
                 </label>
               );
             })}
           </div>

           {maxPerSpell > 1 && (
             <p className="metamagic-incarnate-note">
               <i className="fa-solid fa-star"></i> Sorcery Incarnate: you can use up to {maxPerSpell} Metamagic options per spell.
             </p>
           )}

            {hasTwinned && (
              <TwinTargetSelector twinTarget={twinTarget} creatureTargets={creatureTargets} onChange={setTwinTarget} />
            )}

           <div className="metamagic-actions">
             <button className="btn btn-secondary" onClick={onSkip}>
               Cast Without Metamagic
             </button>
              <button
                className="btn"
                onClick={handleConfirm}
                disabled={needsTwinTarget || (grandTotalCost === 0 && selected.length === 0)}
              >
                Apply &amp; Cast ({grandTotalCost} SP)
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
