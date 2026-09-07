import './DiceRollResult.css';
import { useDiceRollState } from './DiceRollResult.computed.js';
import { createDiceRollHandlers } from './DiceRollResult.handlers.js';

function AutoDamageActionButton({ autoDamage, computedHit, onDone }) {
    if (autoDamage.damageTypeChoices?.length > 0) {
        return (
            <div className="lunar-radiance-choice">
                <div className="lunar-radiance-choice-label">Choose damage type:</div>
                {autoDamage.damageTypeChoices.map((choice) => (
                    <button
                        key={choice}
                        className="dice-roll-reroll-btn lunar-radiance-choice-btn"
                        onClick={() => onDone?.(computedHit, choice)}
                        type="button"
                    >
                        {choice}
                    </button>
                ))}
            </div>
        );
    }
    return (
        <button className="dice-roll-reroll-btn" onClick={() => onDone?.(computedHit)} type="button">
            <i className="fa-solid fa-check"></i> Done
        </button>
    );
}

function PsiBolsteredKnackPanel({ psiBolsteredKnack, psiBolsteredKnackDieSize, success, rollType, psiKnackClicked, psiKnackConsumed, psiKnackResult, onKnackClick, onSucceeded, onFailed }) {
    if (!psiBolsteredKnack || (rollType !== 'check' && rollType !== 'skill')) return null;

    if (psiKnackClicked && psiKnackResult !== null) {
        return (
            <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-brain"></i> Psi-Bolstered Knack: +{psiKnackResult.dieValue} (d{psiKnackResult.dieSize}) → <strong>{psiKnackResult.newTotal}</strong>
                {!psiKnackConsumed && (
                    <div className="dice-roll-save-info">Check declared failed — Psionic Energy die is expended only if the boosted total succeeds.</div>
                )}
                {!psiKnackConsumed && (
                    <div className="dice-roll-reroll" style={{ marginTop: '8px' }}>
                        <button className="dice-roll-reroll-btn" onClick={onSucceeded} type="button">
                            <i className="fa-solid fa-check"></i> Succeeded
                        </button>
                        <button className="dice-roll-reroll-btn" onClick={onFailed} type="button">
                            <i className="fa-solid fa-xmark"></i> Still Failed
                        </button>
                    </div>
                )}
            </div>
        );
    }

    if (!psiKnackClicked && success !== true) {
        return (
            <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={onKnackClick} type="button">
                    <i className="fa-solid fa-brain"></i> Psi-Bolstered Knack (d{psiBolsteredKnackDieSize || 6}) — failed proficient check?
                </button>
            </div>
        );
    }

    return null;
}

function DiceRollResult(props) {
    const {
        name, type, rolls, rollType, bonus = 0, bonusDetail, formula = '', modifier = 0,
        targetName, targetAc, hit, isAutoMiss, rangeReason, coverReason, coverLevel, coverAcBonus,
        defensiveDuelistBonus, baitAndSwitchBonus, shieldAcBonus, shieldOfFaithAcBonus, slowAcPenalty, unerringStrikeApplied, interceptedFeature,
        isCrit, isAutoCrit,
        dc, success, dcType, dcSuccess, waitingForPlayerSave, saveDc, saveType, saveResult, holyAuraSaveResult,
        finalDamage, damageApplied, targetCurrentHp, damageReduced, damageType, autoDamage,
        secondaryFormula, secondaryRolls, secondaryTotal, secondaryModifier, secondaryDamageType,
        secondaryFinalDamage, secondarySaveResult,
        finalHeal, healReduced, bonusHeal, bonusHealDetail, types,
        baseFormula, baseTotal, baseRolls, bonusFormula, bonusTotal, bonusRolls,
        rayOfEnfeebleReduction, rayOfEnfeebleRoll, resistanceReduction, resistanceRoll,
        elementalAdeptBonus, isPotentCantrip,
        reliableTalent, tacticalMind, tacticalMindBonus, darkOnesLuck, strokeOfLuck,
        luckyAdvantage, luckyDisadvantage,
        bardicInspiration, bardicInspirationDie, bardicInspirationDefense, bardicInspirationDefenseDieSize,
        bardicInspirationOffense, bardicInspirationOffenseDieSize,
        availableSuperiorityManeuvers, psiBolsteredKnack, psiBolsteredKnackDieSize,
        empoweredSpell, savageAttacker, piercerPuncture,
        autoReroll, autoRerollBonus, autoRerollCondition, autoRerollForAttack,
        tavernBrawlerRerolls, d20Floor10, starryDragonFloor,
        luckyRerolled, luckyRerollValue,
        homingStrikesUsed, homingStrikesBonus,
        healingRerollOriginalRolls, healingRerollDisplayRolls,
        gwfApplied, gwfOriginalRolls, gwfDisplayRolls,
        critLabels,
        onQuickRoll, onStrokeOfLuck, onLuckyAdvantage, onLuckyDisadvantage,
        onPsiBolsteredKnack,
        onSavageAttackerChoice,
        onDone,
        resistanceNotice, hunterLoreNotice, advantageReason, forcedMode,
    } = props;

    const state = useDiceRollState(props);
    const handlers = createDiceRollHandlers(props, state);
    const {
        mode, setMode,
        rerollUsed, rerollResult,
        tacticalUsed, tacticalResult,
        strokeUsed, strokeResult, setStrokeResult, setStrokeUsed,
        bardicInspirationUsed, bardicInspirationResult,
        bardicInspirationDefenseUsed, bardicInspirationDefenseResult,
        bardicInspirationOffenseUsed, bardicInspirationOffenseResult,
        superiorityUsed, superiorityResult,
        psiKnackClicked, psiKnackResult, psiKnackConsumed, setPsiKnackResult, setPsiKnackClicked, setPsiKnackConsumed,
        empoweredSpellUsed, empoweredSpellResult,
        darkOnesLuckUsed, darkOnesLuckResult,
        boonUsed, setBoonUsed,
        punctureUsed, punctureResult,
        savageAttackerUsed, savageAttackerResult,
        isD20, isDamageType, isHealType, isCritDamage, isSaveDamageType,
        safeRolls, finalRoll, originalTotal, displayRoll, displayTotal,
        strReplaceApplied, finalDisplayTotal,
        finalTotal, showFumble,
        computedHit, homingStrikesApplied, effectiveAc, d20TestFailed,
    } = state;

    const hitMissTotal = homingStrikesApplied ? finalTotal : displayTotal;
    const acBuffLabels = [];
    if (shieldOfFaithAcBonus > 0) acBuffLabels.push(`+${shieldOfFaithAcBonus} Shield of Faith`);
    if (shieldAcBonus > 0) acBuffLabels.push(`+${shieldAcBonus} Shield`);
    if (slowAcPenalty > 0) acBuffLabels.push(`−${slowAcPenalty} Slow`);
    const acDisplay = `${effectiveAc ?? targetAc ?? '—'}${acBuffLabels.length ? ` (${acBuffLabels.join(', ')})` : ''}`;

    const {
        handleReroll, handleTacticalMind, handleDarkOnesLuck,
        handleBardicInspiration, handleBardicInspirationDefense, handleBardicInspirationOffense,
        handleEmpoweredSpell, handlePuncture, handleSavageAttacker, handleSavageAttackerKeep, handleSuperiorityManeuver,
    } = handlers;

    const critDiceRolls = isCritDamage && rolls ? rolls.map((r, i) => {
        const label = critLabels?.[i] || null;
        return label ? `${r}*2 [${label}]` : `${r}*2`;
    }) : null;
    const displayFormula = formula;
    const saveAbilityLabel = saveType ? saveType.toUpperCase() : '';

    const handlePsiKnackClick = () => {
        const dieSize = psiBolsteredKnackDieSize || 6;
        const dieValue = Math.floor(Math.random() * dieSize) + 1;
        const currentTotal = strokeResult !== null ? 20 + bonus + modifier : (rerollResult !== null ? rerollResult.total : (finalRoll + bonus + modifier));
        setPsiKnackResult({ dieValue, dieSize, newTotal: currentTotal + dieValue });
        setPsiKnackClicked(true);
    };

    const handlePsiKnackSucceeded = () => {
        setPsiKnackConsumed(true);
        if (onPsiBolsteredKnack) onPsiBolsteredKnack({ dieValue: psiKnackResult.dieValue, dieSize: psiKnackResult.dieSize, success: true });
    };

    const handlePsiKnackFailed = () => {
        setPsiKnackConsumed(true);
        if (onPsiBolsteredKnack) onPsiBolsteredKnack({ dieValue: psiKnackResult.dieValue, dieSize: psiKnackResult.dieSize, success: false });
    };

    const handleStrokeOfLuck = () => {
        setStrokeResult({ roll: 20, total: 20 + bonus + modifier });
        setStrokeUsed(true);
        if (onStrokeOfLuck) onStrokeOfLuck('strokeOfLuck');
    };

    const handleBoonOfCombatProwess = () => {
        setBoonUsed(true);
        if (onStrokeOfLuck) onStrokeOfLuck('boonOfCombatProwess');
    };

    const handleLuckyAdvantage = () => {
        setMode('advantage');
        if (onLuckyAdvantage) onLuckyAdvantage();
    };

    const handleLuckyDisadvantage = () => {
        setMode('disadvantage');
        if (onLuckyDisadvantage) onLuckyDisadvantage();
    };

    return (
        <div className="dice-roll-result">
            {type !== 'damage_type_choice' && (
                <div className="dice-roll-header">
                    <i className={`fa-solid ${
                        type === 'd20' ? 'fa-dice-d20' :
                        type === 'attack' ? 'fa-crosshairs' :
                        type === 'save' || isSaveDamageType ? 'fa-shield-halved' :
                        type === 'initiative' ? 'fa-gavel' :
                        isHealType ? 'fa-heart' : 'fa-bolt'
                    }`}></i>
                    {name}
                </div>
            )}
            {type !== 'damage_type_choice' && !((isSaveDamageType || rollType === 'save-damage') && finalDamage !== undefined && finalDamage <= 0) && <div className="dice-roll-total">{finalTotal}</div>}
            {type !== 'damage_type_choice' && !((isSaveDamageType || rollType === 'save-damage') && finalDamage !== undefined && finalDamage <= 0) && (
                <div className="dice-roll-breakdown">
                    {displayFormula ? `${displayFormula}: ` : type === 'd20' ? 'd20 ' : ''}
                    {strokeResult !== null ? (
                      <span className="dice-rolled">
                        20 (Stroke of Luck)
                      </span>
                    ) : luckyRerolled ? (
                      <span className="dice-rolled">
                        {luckyRerollValue} (Lucky reroll)
                      </span>
                    ) : rerollResult !== null ? (
                      <span className="dice-rolled">
                        {rerollResult.roll} (reroll)
                      </span>
                    ) : bardicInspirationResult !== null ? (
                      <span className="dice-rolled">
                        {bardicInspirationResult.d20Roll}
                      </span>
                    ) : isD20 && mode !== 'normal' && safeRolls.length === 2 ? (
                      <span className="dice-rolled">
                        {safeRolls[0]}, {safeRolls[1]} → {finalRoll}
                      </span>
                    ) : (
                      <span className="dice-rolled">
                        {isD20
                            ? (mode === 'normal' ? safeRolls[0] || 0 : finalRoll)
                            : (critDiceRolls ? critDiceRolls.join(', ') : safeRolls.join(', '))
                        }
                      </span>
                    )}
                    {strokeResult !== null ? (
                       ` +${20 + bonus + modifier - 20}`
                    ) : rerollResult !== null ? (
                       ` +${rerollResult.total - rerollResult.roll}`
                    ) : bardicInspirationResult !== null ? (
                       ` +${bardicInspirationResult.total - bardicInspirationResult.d20Roll}`
                    ) : strReplaceApplied ? (
                       ` → ${finalDisplayTotal} (Indomitable Might)`
                    ) : isCritDamage ? ` +${modifier}${bonusDetail && bonus > 0 ? ' ' + bonusDetail : ''}` : (bonus + modifier) >= 0 && (bonus + modifier) !== 0 ? ` +${(bonus + modifier)}${bonusDetail ? ' ' + bonusDetail : ''}` :
                      (bonus + modifier) < 0 ? ` ${(bonus + modifier)}${bonusDetail ? ' ' + bonusDetail : ''}` : ''}
                </div>
            )}

            {reliableTalent && (rollType === 'check' || rollType === 'skill') && safeRolls[0] <= 9 && (
              <div className="dice-roll-reliable-talent">
                <i className="fa-solid fa-star"></i> Reliable Talent: d20 {safeRolls[0]} → 10
              </div>
            )}

            {d20Floor10 && safeRolls[0] <= 9 && (
              <div className="dice-roll-reliable-talent">
                <i className="fa-solid fa-clock"></i> Trance of Order: d20 {safeRolls[0]} → 10
              </div>
            )}

            {starryDragonFloor && safeRolls[0] <= 9 && (
              <div className="dice-roll-reliable-talent">
                <i className="fa-solid fa-star"></i> Starry Form (Dragon): d20 {safeRolls[0]} → 10
              </div>
            )}

            {gwfApplied && gwfOriginalRolls && (
              <div className="dice-roll-gwf">
                <i className="fa-solid fa-shield-halved"></i> Great Weapon Fighting: {gwfOriginalRolls.join(', ')} → {(gwfDisplayRolls || safeRolls).join(', ')}
              </div>
            )}

            {rayOfEnfeebleReduction > 0 && (
              <div className="dice-roll-ray-enfeeblement">
                <i className="fa-solid fa-hand-fist"></i> -1d8 [Enfeeblement]: -{rayOfEnfeebleRoll}
              </div>
            )}
            {resistanceReduction > 0 && (
              <div className="dice-roll-resistance">
                <i className="fa-solid fa-shield-halved"></i> -1d4 [Resistance]: -{resistanceRoll}
              </div>
            )}

            {healingRerollOriginalRolls && (
              <div className="dice-roll-healing-reroll">
                <i className="fa-solid fa-heart"></i> Healing Rerolls: {healingRerollOriginalRolls.join(', ')} → {(healingRerollDisplayRolls || safeRolls).join(', ')}
              </div>
            )}

            {elementalAdeptBonus > 0 && rolls && Array.isArray(rolls) && (
              <div className="dice-roll-elemental-adept">
                <i className="fa-solid fa-fire"></i> Elemental Adept: {rolls.filter(r => r === 1).length}× 1 → 2 (+{elementalAdeptBonus})
              </div>
            )}

            {tavernBrawlerRerolls && tavernBrawlerRerolls.length > 0 && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-fist-raised"></i> Tavern Brawler: {tavernBrawlerRerolls.map(r => r.original).join(', ')} → {tavernBrawlerRerolls.map(r => r.rerolled).join(', ')}
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
                        {forcedMode && forcedMode !== 'normal' && (
                           <span className="badge-toggle forced-mode-badge" title={advantageReason || rangeReason || "Automatically set by active conditions"}>
                             <i className="fa-solid fa-asterisk"></i> {forcedMode === 'advantage' ? 'Adv' : 'Disadv'} ({advantageReason || rangeReason || 'conditions'})
                           </span>
                         )}
                  </div>
              )}

            {(isCritDamage || isCrit || isAutoCrit) && <div className="dice-roll-crit">Critical Hit! — damage dice doubled</div>}
            {(isD20 && !isCrit && !isAutoCrit && displayRoll === 20) && <div className="dice-roll-crit">Natural 20!</div>}
            {showFumble && <div className="dice-roll-crit dice-roll-crit-miss">Critical Miss!</div>}
               {targetName && computedHit !== undefined && !isSaveDamageType && rollType === 'attack' && (
                    <div className={`dice-roll-hit-miss ${computedHit ? 'hit' : 'miss'}`}>
                       {isAutoMiss ? `✗ AUTO-MISS (${coverReason || rangeReason || 'out of range'})` : (computedHit ? `✓ HIT (${hitMissTotal} vs AC ${acDisplay}${(defensiveDuelistBonus > 0 || (baitAndSwitchBonus || 0) > 0) ? ` + ${Math.max(0, defensiveDuelistBonus || 0) + Math.max(0, baitAndSwitchBonus || 0)} reaction` : ''})` : `✗ MISS (${hitMissTotal} vs AC ${acDisplay}${(defensiveDuelistBonus > 0 || (baitAndSwitchBonus || 0) > 0) ? ` + ${Math.max(0, defensiveDuelistBonus || 0) + Math.max(0, baitAndSwitchBonus || 0)} reaction` : ''})`)}
                    </div>
                  )}

            {unerringStrikeApplied && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-shield-halved"></i> Unerring Strike: missed weapon attack turned into a hit
              </div>
            )}

            {homingStrikesApplied && homingStrikesUsed !== false && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-brain"></i> Soul Blades (Homing Strikes): psionic die +{Number(homingStrikesBonus)} → {finalTotal} vs AC {acDisplay} — miss converted into a hit, 1 Psionic Energy expended
              </div>
            )}

            {coverAcBonus > 0 && (
              <div className="dice-roll-cover">
                {coverLevel === 'threeQuarter' ? '3/4' : '1/2'} Cover (+{coverAcBonus} AC)
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
                <span className="dice-roll-save-detail"> (d20 {saveResult.roll} + {saveResult.bonus})</span>
                {mode === 'disadvantage' && <span className="dice-roll-save-detail"> [Disadvantage]</span>}
                {mode === 'advantage' && <span className="dice-roll-save-detail"> [Advantage]</span>}
              </div>
            )}

            {rollType === 'save' && saveDc == null && (
              <div className="dice-roll-save-info">
                <i className="fa-solid fa-triangle-exclamation"></i> DC Unknown — no success or failure
              </div>
            )}

            {dc !== undefined && success === undefined && !waitingForPlayerSave && !isSaveDamageType && (
              <div className="dice-roll-save-info">
                Save DC {dc} {dcType}: {dcSuccess === 'half' ? 'half damage on save' : 'no damage on save'}
              </div>
            )}

            {rollType === 'condition-save' && success !== undefined && (
              <div className={`dice-roll-save-result ${success ? 'save-success' : 'save-failure'}`}>
                {success ? '✓ SAVE SUCCESS' : '✗ SAVE FAILURE'} ({finalTotal} vs DC {dc})
                <span className="dice-roll-save-detail"> (d20 {safeRolls[0] || 0} + {bonus})</span>
                {mode === 'disadvantage' && <span className="dice-roll-save-detail"> [Disadvantage]</span>}
                {mode === 'advantage' && <span className="dice-roll-save-detail"> [Advantage]</span>}
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

            {isDamageType && interceptedFeature && (
              <div className="dice-roll-intercepted">
                <i className="fa-solid fa-shield-halved"></i> {interceptedFeature}: damage intercepted, {targetName} survives!
              </div>
            )}

            {isHealType && (
              <div className="dice-roll-heal-applied">
                {finalHeal <= 0 ? (
                  <span><strong>{targetName}</strong> is already at full HP</span>
                ) : healReduced ? (
                  <span><strong>{finalHeal}</strong> healing applied to <strong>{targetName}</strong> (reduced from {originalTotal}){targetCurrentHp !== undefined ? ` — HP: ${targetCurrentHp + finalHeal} → ${targetCurrentHp}` : ''}</span>
                ) : (
                  <span><strong>{finalHeal}</strong> healing applied to <strong>{targetName}</strong>{targetCurrentHp !== undefined ? ` — HP: ${targetCurrentHp + finalHeal} → ${targetCurrentHp}` : ''}</span>
                )}
                {bonusHeal > 0 && (
                  <div className="dice-roll-heal-bonus">
                    <i className="fa-solid fa-sparkles"></i> Bonus: +{bonusHeal} ({bonusHealDetail})
                  </div>
                )}
              </div>
            )}

            {isPotentCantrip && (
              <div className="dice-roll-potent-cantrip">
                <i className="fa-solid fa-wand-magic-sparkles"></i> Potent Cantrip: half damage on miss
              </div>
            )}

            {luckyRerolled && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-star"></i> Lucky (Halfling): rerolled natural 1 → {luckyRerollValue}
              </div>
            )}

            {autoReroll && !rerollUsed && (isD20 || type === 'save-damage') && autoRerollCondition !== 'roll_equals_1' && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleReroll} type="button">
                  <i className="fa-solid fa-rotate"></i> Reroll{autoRerollBonus ? ` (+${autoRerollBonus})` : ''}
                </button>
              </div>
            )}

            {strokeOfLuck && !strokeUsed && isD20 && d20TestFailed && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleStrokeOfLuck} type="button">
                  <i className="fa-solid fa-star"></i> Stroke of Luck
                </button>
              </div>
            )}

            {autoRerollForAttack && !boonUsed && isD20 && !hit && !isAutoMiss && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleBoonOfCombatProwess} type="button">
                  <i className="fa-solid fa-shield-halved"></i> Boon of Combat Prowess
                </button>
              </div>
            )}

            {bardicInspiration && !bardicInspirationUsed && isD20 && (rollType === 'check' || rollType === 'skill' || rollType === 'save') && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleBardicInspiration} type="button">
                  <i className="fa-solid fa-music"></i> Bardic Inspiration (d{bardicInspirationDie})
                </button>
              </div>
            )}

            {luckyAdvantage && isD20 && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleLuckyAdvantage} type="button">
                  <i className="fa-solid fa-eye"></i> Lucky: Advantage (1 LP)
                </button>
              </div>
            )}

            {luckyDisadvantage && isD20 && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleLuckyDisadvantage} type="button">
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

            {darkOnesLuck && !darkOnesLuckUsed && isD20 && (rollType === 'check' || rollType === 'skill' || rollType === 'save') && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleDarkOnesLuck} type="button">
                  <i className="fa-solid fa-fire"></i> Dark One's Own Luck (1d10)
                </button>
              </div>
            )}

            {availableSuperiorityManeuvers && availableSuperiorityManeuvers.length > 0 && !superiorityUsed && (
              <div className="dice-roll-reroll">
                {availableSuperiorityManeuvers.map(m => (
                  <button key={m.name} className="dice-roll-reroll-btn" onClick={() => handleSuperiorityManeuver(m)} type="button">
                    <i className="fa-solid fa-bolt"></i> {m.name} (Superiority Die)
                  </button>
                ))}
              </div>
            )}

            <PsiBolsteredKnackPanel
                psiBolsteredKnack={psiBolsteredKnack}
                psiBolsteredKnackDieSize={psiBolsteredKnackDieSize}
                success={success}
                rollType={rollType}
                psiKnackClicked={psiKnackClicked}
                psiKnackConsumed={psiKnackConsumed}
                psiKnackResult={psiKnackResult}
                onKnackClick={handlePsiKnackClick}
                onSucceeded={handlePsiKnackSucceeded}
                onFailed={handlePsiKnackFailed}
            />

            {bardicInspirationDefense && !bardicInspirationDefenseUsed && computedHit && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleBardicInspirationDefense} type="button">
                  <i className="fa-solid fa-music"></i> Bardic Inspiration - Defense (d{bardicInspirationDefenseDieSize})
                </button>
              </div>
            )}

            {bardicInspirationOffense && !bardicInspirationOffenseUsed && isDamageType && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={() => handleBardicInspirationOffense()} type="button">
                  <i className="fa-solid fa-music"></i> Bardic Inspiration - Offense (d{bardicInspirationOffenseDieSize})
                </button>
              </div>
            )}

            {empoweredSpell && !empoweredSpellUsed && isDamageType && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleEmpoweredSpell} type="button">
                  <i className="fa-solid fa-wand-magic-sparkles"></i> Empowered Spell (1 SP)
                </button>
              </div>
            )}

            {piercerPuncture && !punctureUsed && isDamageType && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handlePuncture} type="button">
                  <i className="fa-solid fa-bolt"></i> Piercer - Puncture
                </button>
              </div>
            )}

            {savageAttacker && !savageAttackerUsed && isDamageType && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handleSavageAttacker} type="button">
                  <i className="fa-solid fa-arrows-spin"></i> Savage Attacker
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

            {boonUsed && autoRerollForAttack && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-shield-halved"></i> Boon of Combat Prowess: Miss converted to Hit
              </div>
            )}

            {bardicInspirationUsed && bardicInspirationResult !== null && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-music"></i> Bardic Inspiration: 1d{bardicInspirationResult.dieSize} → {bardicInspirationResult.dieValue} + <strong>{bardicInspirationResult.total}</strong>
              </div>
            )}

            {bardicInspirationDefenseUsed && bardicInspirationDefenseResult !== null && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-music"></i> Bardic Inspiration - Defense: 1d{bardicInspirationDefenseResult.dieSize} → {bardicInspirationDefenseResult.dieValue} → AC {bardicInspirationDefenseResult.newAc} ({bardicInspirationDefenseResult.willMiss ? 'Attack misses!' : 'Attack still hits'})
              </div>
            )}

            {bardicInspirationOffenseUsed && bardicInspirationOffenseResult !== null && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-music"></i> Bardic Inspiration - Offense: 1d{bardicInspirationOffenseResult.dieSize} → +{bardicInspirationOffenseResult.dieValue} → <strong>{bardicInspirationOffenseResult.bonusTotal}</strong>
              </div>
            )}

            {empoweredSpellUsed && empoweredSpellResult && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-wand-magic-sparkles"></i> Empowered Spell: rerolled {empoweredSpellResult.rerollCount} dice ({empoweredSpellResult.originalDice?.join(', ')} → {empoweredSpellResult.newDice?.join(', ')}) → <strong>{empoweredSpellResult.newTotal}</strong>{empoweredSpellResult.damageDifference > 0 ? ` (+${empoweredSpellResult.damageDifference})` : empoweredSpellResult.damageDifference < 0 ? ` (${empoweredSpellResult.damageDifference})` : ''}
                {empoweredSpellResult.damageDifference === 0 && !empoweredSpellResult.message ? '' : empoweredSpellResult.message ? ` — ${empoweredSpellResult.message}` : ''}
              </div>
            )}

            {punctureUsed && punctureResult && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-bolt"></i> Piercer - Puncture: {punctureResult.originalDice?.join(', ')} → {punctureResult.newDice?.join(', ')}
              </div>
            )}

            {savageAttackerUsed && savageAttackerResult && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-arrows-spin"></i> Savage Attacker: {savageAttackerResult.original} → {savageAttackerResult.rerolled}
                {savageAttackerResult.awaitingChoice ? ` — choose which total to keep (${savageAttackerResult.originalTotal} or ${savageAttackerResult.newTotal})` : savageAttackerResult.kept === 'reroll' ? ` — Reroll kept (+${savageAttackerResult.newTotal - savageAttackerResult.originalTotal})` : ' — Original kept'}
                {savageAttackerResult.awaitingChoice && onSavageAttackerChoice && (
                  <div className="dice-roll-reroll">
                    <button className="dice-roll-reroll-btn" onClick={() => handleSavageAttackerKeep('original')} type="button">
                      <i className="fa-solid fa-check"></i> Keep First ({savageAttackerResult.originalTotal})
                    </button>
                    <button className="dice-roll-reroll-btn" onClick={() => handleSavageAttackerKeep('reroll')} type="button">
                      <i className="fa-solid fa-dice"></i> Keep Reroll ({savageAttackerResult.newTotal})
                    </button>
                  </div>
                )}
              </div>
            )}

            {tacticalUsed && tacticalResult !== null && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-hand"></i> Tactical Mind: +{tacticalResult.bonus} → <strong>{tacticalResult.total}</strong>
              </div>
            )}

            {darkOnesLuckUsed && darkOnesLuckResult !== null && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-fire"></i> Dark One's Own Luck: +{darkOnesLuckResult.dieValue} (d10) → <strong>{darkOnesLuckResult.total}</strong>
              </div>
            )}

            {superiorityUsed && superiorityResult !== null && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-bolt"></i> {superiorityResult.maneuverName}: d12 {superiorityResult.dieValue} → <strong>{superiorityResult.total}</strong> (+{superiorityResult.dieValue})
              </div>
            )}

            {secondaryFormula && (
              <div className="dice-roll-secondary-damage">
                <div className="dice-roll-secondary-label">Secondary Damage:</div>
                <div className="dice-roll-secondary-formula">
                  {secondaryFormula}: {secondaryRolls ? secondaryRolls.join(', ') : ''}{secondaryModifier !== undefined && secondaryModifier !== 0 ? ` +${secondaryModifier}` : ''} = {secondaryTotal}
                </div>
                {secondarySaveResult && (
                  <div className={`dice-roll-secondary-save-result ${secondarySaveResult.success ? 'save-success' : 'save-failure'}`}>
                    {secondarySaveResult.success ? '✓ SAVE SUCCESS' : '✗ SAVE FAILURE'} ({secondarySaveResult.total} vs DC {saveDc})
                  </div>
                )}
                {secondaryFinalDamage !== undefined && finalDamage !== undefined && (
                  <div className="dice-roll-secondary-total">
                    {finalDamage} {damageType || ''} damage + {secondaryFinalDamage} {secondaryDamageType || ''} damage = <strong>{finalDamage + secondaryFinalDamage} total damage</strong>
                  </div>
                )}
                {finalDamage !== undefined && damageApplied && secondaryFinalDamage !== undefined && (
                  <div className="dice-roll-damage-applied">
                    <span><strong>{finalDamage + secondaryFinalDamage}</strong> damage applied to <strong>{targetName}</strong>{targetCurrentHp !== undefined ? ` — HP: ${targetCurrentHp + finalDamage + secondaryFinalDamage} → ${targetCurrentHp}` : ''}</span>
                  </div>
                )}
              </div>
            )}

            {type === 'damage_type_choice' && (
                <div className="dice-roll-damage-type-choice">
                    <div className="dice-roll-header">
                        <i className="fa-solid fa-bolt"></i> {name}
                    </div>
                    <p>Choose the damage type for this hit:</p>
                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <div className="dice-roll-breakdown">
                            <strong>Weapon Damage:</strong> {baseFormula}: {baseRolls?.join(', ')} = {baseTotal}
                        </div>
                        <div className="dice-roll-breakdown">
                            <strong>Divine Strike:</strong> {bonusFormula}: {bonusRolls?.join(', ')} = {bonusTotal}
                        </div>
                        <div style={{ marginTop: '12px' }}>
                            <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Choose bonus damage type:</div>
                            {types?.map((typeChoice) => (
                                <button
                                    key={typeChoice}
                                    className="sp-roll-btn"
                                    style={{ margin: '0 6px 8px 6px' }}
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('damage-type-choice', { detail: { chosenType: typeChoice } }));
                                    }}
                                >
                                    {typeChoice}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="sp-actions">
                        <button className="sp-dismiss-btn" onClick={() => {
                            window.dispatchEvent(new CustomEvent('damage-type-skip'));
                        }}>Skip</button>
                    </div>
                </div>
            )}

            {autoDamage && computedHit && (
              <div className="dice-roll-reroll">
                <AutoDamageActionButton autoDamage={autoDamage} computedHit={computedHit} onDone={onDone} />
              </div>
            )}

            {holyAuraSaveResult && (
              <div className="dice-roll-holy-aura-save">
                <i className="fa-solid fa-shield-halved"></i>
                <strong>— Holy Aura Save:</strong>
                <span className="dice-roll-breakdown">
                  d20 {holyAuraSaveResult.roll} + {holyAuraSaveResult.modifier} = {holyAuraSaveResult.total} vs DC {holyAuraSaveResult.dc}
                </span>
                <span className={`dice-roll-save-result ${holyAuraSaveResult.success ? 'save-success' : 'save-failure'}`}>
                  {holyAuraSaveResult.success ? 'SAVE SUCCESSFUL' : 'SAVE FAILED'}
                </span>
                {!holyAuraSaveResult.success && <span className="dice-roll-save-effect">Fiend/Undead blinded!</span>}
              </div>
            )}

            <div className="dice-roll-hint">click to dismiss</div>
        </div>
    );
}

export default DiceRollResult;
