import { useState } from 'react';
import './diceRollResult.css';

function DiceRollResult({ name, type, rolls, bonus = 0, bonusDetail, formula = '', modifier = 0, targetName, targetAc, hit, resistanceNotice, forcedMode, isAutoMiss, rangeReason, isAutoCrit, isCrit, dc, success, dcType, dcSuccess, waitingForPlayerSave, saveDc, saveType, saveResult, finalDamage, damageApplied, targetCurrentHp, damageReduced, onQuickRoll, autoDamage, coverLevel, coverAcBonus }) {
    const [mode, setMode] = useState(forcedMode || 'normal');

    const isD20 = type === 'd20';

    let finalRoll = 0;
    const safeRolls = Array.isArray(rolls) ? rolls : [];

    if (isD20) {
        const r1 = safeRolls[0] || 0;
        const r2 = safeRolls[1] || 0;

        if (mode === 'advantage') {
            finalRoll = Math.max(r1, r2);
        } else if (mode === 'disadvantage') {
            finalRoll = Math.min(r1, r2);
        } else {
            finalRoll = r1;
        }
    } else {
         finalRoll = safeRolls.reduce((sum, r) => sum + r, 0);
      }

    const total = finalRoll + bonus + modifier;
    const showCrit = isCrit || isAutoCrit || (isD20 && finalRoll === 20);

    const saveAbilityLabel = saveType ? saveType.toUpperCase() : '';

    const isSaveDamageType = type === 'save-damage';

    return (
        <div className="dice-roll-result">
            <div className="dice-roll-header">
                <i className={`fa-solid ${
                    type === 'd20' ? 'fa-dice-d20' :
                    type === 'attack' ? 'fa-crosshairs' :
                    type === 'save' || isSaveDamageType ? 'fa-shield-halved' :
                    type === 'initiative' ? 'fa-gavel' : 'fa-bolt'
                }`}></i>
                {name}
            </div>
            <div className="dice-roll-total">{total}</div>
            <div className="dice-roll-breakdown">
                {formula ? `${formula}: ` : type === 'd20' ? 'd20 ' : ''}
                <span className="dice-rolled">
                  {isD20
                      ? (mode === 'normal' ? safeRolls[0] || 0 : finalRoll)
                      : safeRolls.join(', ')
                  }
                </span>
                {(bonus + modifier) >= 0 && (bonus + modifier) !== 0 ? ` +${(bonus + modifier)}${bonusDetail ? ' ' + bonusDetail : ''}` :
                 (bonus + modifier) < 0 ? ` ${(bonus + modifier)}${bonusDetail ? ' ' + bonusDetail : ''}` : ''}
            </div>

              {isD20 && (
                  <div className="dice-roll-toggles">
                      <label className={`badge-toggle ${mode === 'advantage' ? 'active' : ''}`}>
                          <input
                             type="checkbox"
                             checked={mode === 'advantage'}
                             onChange={() => setMode(mode === 'advantage' ? 'normal' : 'advantage')}
                              style={{ display: 'none' }}
                          />
                          Advantage
                      </label>
                      <label className={`badge-toggle ${mode === 'disadvantage' ? 'active' : ''}`}>
                          <input
                             type="checkbox"
                             checked={mode === 'disadvantage'}
                             onChange={() => setMode(mode === 'disadvantage' ? 'normal' : 'disadvantage')}
                              style={{ display: 'none' }}
                          />
                          Disadvantage
                      </label>
                      {forcedMode && (
                         <span className="badge-toggle forced-mode-badge" title={rangeReason || "Automatically set by active conditions"}>
                           <i className="fa-solid fa-asterisk"></i> {forcedMode === 'advantage' ? 'Adv' : 'Disadv'} ({rangeReason || 'conditions'})
                         </span>
                       )}
                  </div>
              )}

            {showCrit && <div className="dice-roll-crit">{isAutoCrit ? 'AUTO-CRIT (target condition)' : 'Critical Hit!'} — damage dice doubled</div>}
             {targetName && hit !== undefined && !isSaveDamageType && (
               <div className={`dice-roll-hit-miss ${hit ? 'hit' : 'miss'}`}>
                 {isAutoMiss ? '✗ AUTO-MISS' : (hit ? '✓ HIT' : '✗ MISS')} {isAutoMiss ? `(${rangeReason || 'out of range'})` : `(${total} vs AC ${targetAc})`}
               </div>
              )}

            {coverAcBonus > 0 && (
              <div className="dice-roll-cover">
                {coverLevel === 'threeQuarter' ? '3/4' : '1/2'} Cover (+{coverAcBonus} AC)
              </div>
            )}

            {autoDamage && hit && (
              <div className="dice-roll-auto-damage">
                <i className="fa-solid fa-spinner fa-spin"></i> Rolling damage...
              </div>
            )}

            {waitingForPlayerSave && (
              <div className="dice-roll-save-waiting">
                <i className="fa-solid fa-spinner fa-spin"></i> Waiting for <strong>{targetName}</strong> to roll {saveAbilityLabel} save (DC {saveDc})...
                {onQuickRoll && (
                  <button className="dice-roll-quick-roll" onClick={() => onQuickRoll()} type="button">
                    <i className="fa-solid fa-dice-d20"></i> Quick Roll (Local)
                  </button>
                )}
              </div>
            )}

            {saveResult !== undefined && saveResult !== null && (
              <div className={`dice-roll-save-result ${saveResult.success ? 'save-success' : 'save-failure'}`}>
                {saveResult.success ? '✓ SAVE SUCCESS' : '✗ SAVE FAILURE'} ({saveResult.total} vs DC {saveDc})
                {saveResult.bonus !== 0 && (
                  <span className="dice-roll-save-detail"> (d20 {saveResult.roll} + {saveResult.bonus})</span>
                )}
              </div>
            )}

            {dc !== undefined && success === undefined && !waitingForPlayerSave && !isSaveDamageType && (
              <div className="dice-roll-save-info">
                Save DC {dc} {dcType}: {dcSuccess === 'half' ? 'half damage on save' : 'no damage on save'}
              </div>
            )}

            {resistanceNotice && (
              <div className="dice-roll-resistance">{resistanceNotice}</div>
            )}

            {finalDamage !== undefined && damageApplied && (
              <div className="dice-roll-damage-applied">
                {damageReduced ? (
                  <span><strong>{finalDamage}</strong> damage applied to <strong>{targetName}</strong> (reduced from {total}){targetCurrentHp !== undefined ? ` — HP: ${targetCurrentHp + finalDamage} → ${targetCurrentHp}` : ''}</span>
                ) : (
                  <span><strong>{finalDamage}</strong> damage applied to <strong>{targetName}</strong>{targetCurrentHp !== undefined ? ` — HP: ${targetCurrentHp + finalDamage} → ${targetCurrentHp}` : ''}</span>
                )}
              </div>
            )}

            <div className="dice-roll-hint">click to dismiss</div>
        </div>
    );
}

export default DiceRollResult;
