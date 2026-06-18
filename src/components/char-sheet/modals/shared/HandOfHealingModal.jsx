import React, { useCallback } from 'react'
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js'
import utils from '../../../../services/ui/utils.js'
import storage from '../../../../services/ui/storage.js'
import { getCombatSummary } from '../../../../services/encounters/combatData.js'
import '../../CharSheet.css'

const CUREABLE_CONDITIONS = ['Blinded', 'Deafened', 'Paralyzed', 'Poisoned', 'Stunned'];

function conditionMatches(c, targetCondition) {
    return (typeof c === 'string' ? c.toLowerCase() : '').trim() === (typeof targetCondition === 'string' ? targetCondition.toLowerCase() : '').trim();
}

function HandOfHealingModal({ healName, formula, rolls, bonus, healAmount, monkName, targetName, targetCurrentHp, targetMaxHp, hasPhysiciansTouch, campaignName, onClose }) {
    const [curedCondition, setCureCondition] = React.useState(null);
    const curedOnMount = React.useRef(false);

    const getTargetConditions = useCallback(() => {
         // Get conditions from runtime state (where Stunning Strike writes them)
        const runtimeConditions = getRuntimeValue(targetName, 'activeConditions') || [];

         // Also check combat summary for conditions stored on NPCs
        try {
            const combatSummary = getCombatSummary(campaignName);
            if (combatSummary) {
                const creature = combatSummary.creatures?.find(c => utils.getName(c.name) === utils.getName(targetName));
                if (creature && Array.isArray(creature.conditions)) {
                    const csKeys = creature.conditions.map(c => c.key);
                    // Merge both sources, deduplicate case-insensitively
                    const seen = new Set(runtimeConditions.map(c => String(c).toLowerCase()));
                    const merged = [...runtimeConditions];
                    for (const key of csKeys) {
                        if (!seen.has(key.toLowerCase())) {
                            merged.push(key);
                            seen.add(key.toLowerCase());
                        }
                    }
                    return merged;
                  }
              }
          } catch { /* ignore */ }

        return runtimeConditions;
    }, [targetName, campaignName]);

    const getCureableForTarget = useCallback(() => {
        const conditions = getTargetConditions();
        if (!Array.isArray(conditions)) return [];
        return CUREABLE_CONDITIONS.filter(cc =>
            conditions.some(c => conditionMatches(c, cc))
           );
    }, [getTargetConditions]);

    const removeCondition = useCallback((conditionName) => {
         // Remove from runtime state (primary source - where Stunning Strike writes)
        const conditions = getTargetConditions();
        const filtered = conditions.filter(c => !conditionMatches(String(c).toLowerCase(), conditionName.toLowerCase()));
        setRuntimeValue(targetName, 'activeConditions', filtered, campaignName);

         // Also remove from combat summary if present
        try {
            const combatSummary = getCombatSummary(campaignName);
            if (combatSummary) {
                const creature = combatSummary.creatures?.find(c => utils.getName(c.name) === utils.getName(targetName));
                if (creature && Array.isArray(creature.conditions)) {
                    creature.conditions = creature.conditions.filter(c => !conditionMatches(String(c.key).toLowerCase(), conditionName.toLowerCase()));
                    storage.set('combatSummary', combatSummary, campaignName);
                    window.dispatchEvent(new CustomEvent('combat-summary-updated'));
                 }
             }
         } catch { /* ignore */ }

        fetch(`/api/campaigns/${encodeURIComponent(campaignName)}/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'condition',
                characterName: targetName,
                condition: conditionName,
                action: 'broken',
                sourceName: `${monkName} (${healName}`,
                timestamp: Date.now(),
                })
            }).catch((e) => { console.error("[HandOfHealingModal] Error:", e); throw e; });

        setCureCondition(conditionName);
     }, [campaignName, getTargetConditions, targetName, healName, monkName]);

    const cureableConditions = getCureableForTarget();

    React.useEffect(() => {
        if (!curedOnMount.current && cureableConditions.length === 1 && hasPhysiciansTouch) {
            removeCondition(cureableConditions[0]);
            curedOnMount.current = true;
           }
       }, [cureableConditions, hasPhysiciansTouch, removeCondition]);

    React.useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
          };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const rollValues = Array.isArray(rolls) ? rolls : [];

    return (
          <div className="short-rest-overlay no-print" onClick={onClose}>
              <div className="short-rest-modal" onClick={(e) => e.stopPropagation()}>
                  <h3><i className="fas fa-hand-sparkles"></i> {healName}</h3>

                  <div className="short-rest-section">
                      <h4>Healing{'\u2014'}{targetName} ({targetCurrentHp} / {targetMaxHp} HP)</h4>
                      <div className="healing-roll-details">
                          <span className="healing-formula">{formula}: </span>
                          <span className="healing-dice-rolled">{rollValues.join(' + ')}</span>
                          {bonus !== 0 && <span className="healing-bonus"> {bonus >= 0 ? '+' : ''}{bonus}</span>}
                          <span className="healing-total">= <strong>{healAmount}</strong> HP restored</span>
                      </div>
                  </div>

                  {curedCondition && (
                       <div className="short-rest-section healing-cured-condition">
                        <h4><i className="fas fa-shield-virus"></i> Condition Cleared</h4>
                           <div>
                                <i className="fas fa-check-circle"></i> {curedCondition} removed from {targetName} (Physician&apos;s Touch)
                            </div>
                        </div>
                    )}

                  {!curedCondition && cureableConditions.length > 1 && (
                       <div className="short-rest-section">
                           <h4><i className="fas fa-shield-virus"></i> Physician&apos;s Touch</h4>
                           <p>Target has multiple conditions. Select one to remove:</p>
                           <div className="healing-cure-options">
                               {cureableConditions.map((condition) => (
                                   <button key={condition} className="char-btn" onClick={() => removeCondition(condition)}>
                                       <i className="fas fa-check-circle"></i> Remove {condition}
                                   </button>
                               ))}
                           </div>
                       </div>
                   )}

                  <div className="short-rest-actions">
                      <button className="char-btn" onClick={onClose}>
                          <i className="fa-solid fa-check"></i> Done
                      </button>
                  </div>
              </div>
          </div>
       );
 }

export default HandOfHealingModal;
