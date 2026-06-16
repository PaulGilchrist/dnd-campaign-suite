import { useState } from 'react';
import './diceRollResult.css';

function DiceRollResult({ name, type, rolls, rollType, bonus = 0, bonusDetail, formula = '', modifier = 0, targetName, targetAc, hit, resistanceNotice, hunterLoreNotice, forcedMode, isAutoMiss, rangeReason, coverReason, isAutoCrit, isCrit, dc, success, dcType, dcSuccess, waitingForPlayerSave, saveDc, saveType, saveResult, finalDamage, damageApplied, targetCurrentHp, damageReduced, onQuickRoll, autoDamage, coverLevel, coverAcBonus, autoReroll, autoRerollBonus, strSaveReplace, strCheckReplace, strScore, wisCheckReplace, wisCheckMinBonus, reliableTalent, onReroll, tacticalMind, tacticalMindBonus, gloriousDefenseBonus, onCounterAttack, strokeOfLuck, onStrokeOfLuck, defensiveDuelistBonus, isPotentCantrip, luckyAdvantage, luckyDisadvantage, onLuckyAdvantage, onLuckyDisadvantage }) {
    const [mode, setMode] = useState(forcedMode || 'normal');
    const [rerollUsed, setRerollUsed] = useState(false);
    const [rerollResult, setRerollResult] = useState(null);
    const [tacticalUsed, setTacticalUsed] = useState(false);
    const [tacticalResult, setTacticalResult] = useState(null);
    const [strokeUsed, setStrokeUsed] = useState(false);
    const [strokeResult, setStrokeResult] = useState(null);
    const [luckyAdvantageUsed, setLuckyAdvantageUsed] = useState(false);
    const [luckyDisadvantageUsed, setLuckyDisadvantageUsed] = useState(false);

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

    const originalTotal = finalRoll + bonus + modifier;
    const displayRoll = strokeResult !== null ? 20 : (rerollResult !== null ? rerollResult.roll : finalRoll);
    const displayTotal = strokeResult !== null ? 20 + bonus + modifier : (rerollResult !== null ? rerollResult.total : originalTotal);
    const appliesReplace = (strSaveReplace && rollType === 'save') || (strCheckReplace && (rollType === 'check' || rollType === 'skill'));
    const finalDisplayTotal = appliesReplace && displayTotal < (strScore || 10) ? strScore : displayTotal;
    const wisBonus = wisCheckReplace ? (wisCheckMinBonus || 1) : bonus;
    const wisDisplayTotal = wisCheckReplace && (rollType === 'check' || rollType === 'skill') ? finalRoll + wisBonus + modifier : displayTotal;
    const reliableTalentTotal = reliableTalent && (rollType === 'check' || rollType === 'skill') && displayRoll <= 9 ? 10 + bonus + modifier : null;
    const finalTotal = reliableTalentTotal !== null ? reliableTalentTotal : (wisCheckReplace && (rollType === 'check' || rollType === 'skill') ? wisDisplayTotal : finalDisplayTotal);
    const showCrit = isCrit || isAutoCrit || (isD20 && displayRoll === 20) || (strokeResult !== null && isD20);

    const handleTacticalMind = () => {
        const tacticalBonus = tacticalMindBonus || 0;
        const newTotal = finalRoll + bonus + modifier + tacticalBonus;
        setTacticalResult({ bonus: tacticalBonus, total: newTotal });
        setTacticalUsed(true);
    };

    const saveAbilityLabel = saveType ? saveType.toUpperCase() : '';

    const isSaveDamageType = type === 'save-damage';

    const handleReroll = () => {
        const newRoll = Math.floor(Math.random() * 20) + 1;
        const rerollBonus = autoRerollBonus || 0;
        setRerollResult({ roll: newRoll, total: newRoll + bonus + rerollBonus });
        setRerollUsed(true);
        if (onReroll) onReroll();
    };

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
            <div className="dice-roll-total">{finalTotal}</div>
            <div className="dice-roll-breakdown">
                {formula ? `${formula}: ` : type === 'd20' ? 'd20 ' : ''}
                {strokeResult !== null ? (
                  <span className="dice-rolled">
                    20 (Stroke of Luck)
                  </span>
                ) : rerollResult !== null ? (
                  <span className="dice-rolled">
                    {rerollResult.roll} (reroll)
                  </span>
                ) : isD20 && mode !== 'normal' && safeRolls.length === 2 ? (
                  <span className="dice-rolled">
                    {safeRolls[0]}, {safeRolls[1]} → {finalRoll}
                  </span>
                ) : (
                  <span className="dice-rolled">
                    {isD20
                        ? (mode === 'normal' ? safeRolls[0] || 0 : finalRoll)
                        : safeRolls.join(', ')
                    }
                  </span>
                )}
                {strokeResult !== null ? (
                  ` +${20 + bonus + modifier - 20}`
                ) : rerollResult !== null ? (
                  ` +${rerollResult.total - rerollResult.roll}`
                ) : (bonus + modifier) >= 0 && (bonus + modifier) !== 0 ? ` +${(bonus + modifier)}${bonusDetail ? ' ' + bonusDetail : ''}` :
                 (bonus + modifier) < 0 ? ` ${(bonus + modifier)}${bonusDetail ? ' ' + bonusDetail : ''}` : ''}
            </div>

            {reliableTalent && (rollType === 'check' || rollType === 'skill') && safeRolls[0] <= 9 && (
              <div className="dice-roll-reliable-talent">
                <i className="fa-solid fa-star"></i> Reliable Talent: d20 {safeRolls[0]} → 10
              </div>
            )}

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
              {targetName && hit !== undefined && !isSaveDamageType && rollType === 'attack' && (
                  <div className={`dice-roll-hit-miss ${hit ? 'hit' : 'miss'}`}>
                    {isAutoMiss ? `✗ AUTO-MISS (${coverReason || rangeReason || 'out of range'})` : (hit ? `✓ HIT (${displayTotal} vs AC ${targetAc ?? '—'}${(gloriousDefenseBonus > 0 || defensiveDuelistBonus > 0) ? ` + ${Math.max(0, gloriousDefenseBonus) + Math.max(0, defensiveDuelistBonus)} reaction` : ''})` : `✗ MISS (${displayTotal} vs AC ${targetAc ?? '—'}${(gloriousDefenseBonus > 0 || defensiveDuelistBonus > 0) ? ` + ${Math.max(0, gloriousDefenseBonus) + Math.max(0, defensiveDuelistBonus)} reaction` : ''})`)}
                  </div>
                )}

             {targetName && gloriousDefenseBonus > 0 && onCounterAttack && !hit && !isAutoMiss && (
                 <div className="dice-roll-glorious-defense">
                     <button className="dice-roll-reroll-btn" onClick={onCounterAttack} type="button">
                         <i className="fa-solid fa-swords"></i> Glorious Defense Counter-Attack
                     </button>
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

            {hunterLoreNotice && (
              <div className="dice-roll-hunter-lore">
                <i className="fa-solid fa-eye"></i> {hunterLoreNotice.split('\n').map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </div>
            )}

            {finalDamage !== undefined && damageApplied && (
              <div className="dice-roll-damage-applied">
                {damageReduced ? (
                  <span><strong>{finalDamage}</strong> damage applied to <strong>{targetName}</strong> (reduced from {originalTotal}){targetCurrentHp !== undefined ? ` — HP: ${targetCurrentHp + finalDamage} → ${targetCurrentHp}` : ''}</span>
                ) : (
                  <span><strong>{finalDamage}</strong> damage applied to <strong>{targetName}</strong>{targetCurrentHp !== undefined ? ` — HP: ${targetCurrentHp + finalDamage} → ${targetCurrentHp}` : ''}</span>
                )}
              </div>
            )}

            {isPotentCantrip && (
              <div className="dice-roll-potent-cantrip">
                <i className="fa-solid fa-wand-magic-sparkles"></i> Potent Cantrip: half damage on miss
              </div>
            )}

            {autoReroll && !rerollUsed && isD20 && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleReroll} type="button">
                  <i className="fa-solid fa-rotate"></i> Reroll{autoRerollBonus ? ` (+${autoRerollBonus})` : ''}
                </button>
              </div>
            )}

            {strokeOfLuck && !strokeUsed && isD20 && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={() => { setStrokeResult({ roll: 20, total: 20 + bonus + modifier }); setStrokeUsed(true); if (onStrokeOfLuck) onStrokeOfLuck(); }} type="button">
                  <i className="fa-solid fa-star"></i> Stroke of Luck
                </button>
              </div>
            )}

            {luckyAdvantage && !luckyAdvantageUsed && isD20 && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={() => { setMode('advantage'); setLuckyAdvantageUsed(true); if (onLuckyAdvantage) onLuckyAdvantage(); }} type="button">
                  <i className="fa-solid fa-eye"></i> Lucky: Advantage (1 LP)
                </button>
              </div>
            )}

            {luckyDisadvantage && !luckyDisadvantageUsed && isD20 && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={() => { setMode('disadvantage'); setLuckyDisadvantageUsed(true); if (onLuckyDisadvantage) onLuckyDisadvantage(); }} type="button">
                  <i className="fa-solid fa-eye-slash"></i> Lucky: Disadvantage (1 LP)
                </button>
              </div>
            )}

            {tacticalMind && !tacticalUsed && (rollType === 'check' || rollType === 'skill') && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleTacticalMind} type="button">
                  <i className="fa-solid fa-hand"></i> Tactical Mind{tacticalMindBonus ? ` (+${tacticalMindBonus})` : ''}
                </button>
              </div>
            )}

            {rerollUsed && rerollResult !== null && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-rotate"></i> Rerolled: {rerollResult.roll} + {rerollResult.total - rerollResult.roll} = <strong>{rerollResult.total}</strong>
              </div>
            )}

            {strokeUsed && strokeResult !== null && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-star"></i> Stroke of Luck: d20 → 20 + {strokeResult.total - 20} = <strong>{strokeResult.total}</strong>
              </div>
            )}

            {tacticalUsed && tacticalResult !== null && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-hand"></i> Tactical Mind: +{tacticalResult.bonus} = <strong>{tacticalResult.total}</strong>
              </div>
            )}

            <div className="dice-roll-hint">click to dismiss</div>
        </div>
    );
}

export default DiceRollResult;
