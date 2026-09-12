import { Fragment } from 'react';
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

function TacticalMindAdjudicationPanel({ tacticalUsed, tacticalResult, tacticalDeclared, onDeclare }) {
    if (!tacticalUsed || tacticalResult === null) return null;
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-hand"></i> Tactical Mind: +{tacticalResult.bonus} → <strong>{tacticalResult.total}</strong>
            {tacticalDeclared === null && (
                <div className="dice-roll-save-info">Second Wind use is expended only if the boosted total succeeds the DC.</div>
            )}
            {tacticalDeclared === true && (
                <div className="dice-roll-save-info">Check succeeded — Second Wind use expended.</div>
            )}
            {tacticalDeclared === false && (
                <div className="dice-roll-save-info">Check still failed — Second Wind use not expended.</div>
            )}
            {tacticalDeclared === null && (
                <div className="dice-roll-reroll">
                    <button className="dice-roll-reroll-btn" onClick={() => onDeclare(true)} type="button">
                        <i className="fa-solid fa-check"></i> Succeeded
                    </button>
                    <button className="dice-roll-reroll-btn" onClick={() => onDeclare(false)} type="button">
                        <i className="fa-solid fa-xmark"></i> Still Failed
                    </button>
                </div>
            )}
        </div>
    );
}

function headerIconClass(type, isSaveDamageType, isHealType) {
    if (type === 'd20') return 'fa-dice-d20';
    if (type === 'attack') return 'fa-crosshairs';
    if (type === 'save' || isSaveDamageType) return 'fa-shield-halved';
    if (type === 'initiative') return 'fa-gavel';
    if (isHealType) return 'fa-heart';
    return 'fa-bolt';
}

function RollHeader({ props, state }) {
    if (props.type === 'damage_type_choice') return null;
    return (
        <div className="dice-roll-header">
            <i className={`fa-solid ${headerIconClass(props.type, state.isSaveDamageType, state.isHealType)}`}></i>
            {props.name}
        </div>
    );
}

function rollDiceSpan(props, state) {
    const { luckyRerolled, luckyRerollValue } = props;
    const { strokeResult, rerollResult, bardicInspirationResult, isD20, mode, safeRolls, finalRoll } = state;
    if (strokeResult !== null) {
        return <span className="dice-rolled">20 (Stroke of Luck)</span>;
    }
    if (luckyRerolled) {
        return <span className="dice-rolled">{luckyRerollValue} (Lucky reroll)</span>;
    }
    if (rerollResult !== null) {
        return <span className="dice-rolled">{rerollResult.roll} (reroll)</span>;
    }
    if (bardicInspirationResult !== null) {
        return <span className="dice-rolled">{bardicInspirationResult.d20Roll}</span>;
    }
    if (isD20 && mode !== 'normal' && safeRolls.length === 2) {
        return <span className="dice-rolled">{safeRolls[0]}, {safeRolls[1]} → {finalRoll}</span>;
    }
    const critDiceRolls = state.isCritDamage && props.rolls ? props.rolls.map((r, i) => {
        const label = props.critLabels?.[i] || null;
        return label ? `${r}*2 [${label}]` : `${r}*2`;
    }) : null;
    return (
        <span className="dice-rolled">
            {isD20
                ? (mode === 'normal' ? safeRolls[0] || 0 : finalRoll)
                : (critDiceRolls ? critDiceRolls.join(', ') : safeRolls.join(', '))
            }
        </span>
    );
}

function rollModifierText(props, state) {
    const { bonus = 0, bonusDetail, modifier = 0 } = props;
    const { strokeResult, rerollResult, bardicInspirationResult, strReplaceApplied, finalDisplayTotal, isCritDamage } = state;
    if (strokeResult !== null) return ` +${20 + bonus + modifier - 20}`;
    if (rerollResult !== null) return ` +${rerollResult.total - rerollResult.roll}`;
    if (bardicInspirationResult !== null) return ` +${bardicInspirationResult.total - bardicInspirationResult.d20Roll}`;
    if (strReplaceApplied) return ` → ${finalDisplayTotal} (Indomitable Might)`;
    if (isCritDamage) return ` +${modifier}${bonusDetail && bonus > 0 ? ' ' + bonusDetail : ''}`;
    if ((bonus + modifier) >= 0 && (bonus + modifier) !== 0) return ` +${(bonus + modifier)}${bonusDetail ? ' ' + bonusDetail : ''}`;
    if ((bonus + modifier) < 0) return ` ${(bonus + modifier)}${bonusDetail ? ' ' + bonusDetail : ''}`;
    return '';
}

function RollSummary({ props, state }) {
    const { type, rollType, formula = '', finalDamage } = props;
    if (type === 'damage_type_choice') return null;
    if ((state.isSaveDamageType || rollType === 'save-damage') && finalDamage !== undefined && finalDamage <= 0) return null;
    return (
        <>
            <div className="dice-roll-total">{state.finalTotal}</div>
            <div className="dice-roll-breakdown">
                {formula ? `${formula}: ` : type === 'd20' ? 'd20 ' : ''}
                {rollDiceSpan(props, state)}
                {rollModifierText(props, state)}
            </div>
        </>
    );
}

function FloorNotices({ props, state }) {
    const { reliableTalent, rollType, d20Floor10, starryDragonFloor } = props;
    const { safeRolls } = state;
    return (
        <>
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
        </>
    );
}

function RollAdjustmentNotices({ props, state }) {
    const { rayOfEnfeebleReduction, rayOfEnfeebleRoll, resistanceReduction, resistanceRoll,
        healingRerollOriginalRolls, healingRerollDisplayRolls, elementalAdeptBonus, rolls,
        gwfApplied, gwfOriginalRolls, gwfDisplayRolls, tavernBrawlerRerolls } = props;
    const { safeRolls } = state;
    return (
        <>
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
        </>
    );
}

function RollModeToggles({ props, state }) {
    const { forcedMode, advantageReason, rangeReason } = props;
    const { isD20, mode, setMode } = state;
    if (!isD20) return null;
    return (
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
    );
}

function CritNotices({ props, state }) {
    const { isCrit, isAutoCrit } = props;
    const { isCritDamage, displayRoll, showFumble } = state;
    return (
        <>
            {(isCritDamage || isCrit || isAutoCrit) && <div className="dice-roll-crit">Critical Hit! — damage dice doubled</div>}
            {(state.isD20 && !isCrit && !isAutoCrit && displayRoll === 20) && <div className="dice-roll-crit">Natural 20!</div>}
            {showFumble && <div className="dice-roll-crit dice-roll-crit-miss">Critical Miss!</div>}
        </>
    );
}

function HitMissLine({ props, state, acDisplay, hitMissTotal }) {
    const { targetName, isAutoMiss, coverReason, rangeReason, rollType,
        defensiveDuelistBonus, baitAndSwitchBonus } = props;
    const { computedHit, isSaveDamageType } = state;
    if (!targetName || computedHit === undefined || isSaveDamageType || rollType !== 'attack') return null;
    const reactionBonus = (defensiveDuelistBonus > 0 || (baitAndSwitchBonus || 0) > 0)
        ? ` + ${Math.max(0, defensiveDuelistBonus || 0) + Math.max(0, baitAndSwitchBonus || 0)} reaction`
        : '';
    const outcome = isAutoMiss
        ? `✗ AUTO-MISS (${coverReason || rangeReason || 'out of range'})`
        : `${computedHit ? '✓ HIT' : '✗ MISS'} (${hitMissTotal} vs AC ${acDisplay}${reactionBonus})`;
    return (
        <div className={`dice-roll-hit-miss ${computedHit ? 'hit' : 'miss'}`}>
            {outcome}
        </div>
    );
}

function AttackOutcomeNotices({ props, state, acDisplay }) {
    const { unerringStrikeApplied, homingStrikesUsed, homingStrikesBonus, coverAcBonus, coverLevel } = props;
    if (!unerringStrikeApplied && !(state.homingStrikesApplied && homingStrikesUsed !== false) && !(coverAcBonus > 0)) return null;
    return (
        <>
            {unerringStrikeApplied && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-shield-halved"></i> Unerring Strike: missed weapon attack turned into a hit
              </div>
            )}
            {state.homingStrikesApplied && homingStrikesUsed !== false && (
              <div className="dice-roll-reroll-result">
                <i className="fa-solid fa-brain"></i> Soul Blades (Homing Strikes): psionic die +{Number(homingStrikesBonus)} → {state.finalTotal} vs AC {acDisplay} — miss converted into a hit, 1 Psionic Energy expended
              </div>
            )}
            {coverAcBonus > 0 && (
              <div className="dice-roll-cover">
                {coverLevel === 'threeQuarter' ? '3/4' : '1/2'} Cover (+{coverAcBonus} AC)
              </div>
            )}
        </>
    );
}

function SaveResultLine({ success, total, dc, roll, bonus, mode }) {
    return (
        <div className={`dice-roll-save-result ${success ? 'save-success' : 'save-failure'}`}>
            {success ? '✓ SAVE SUCCESS' : '✗ SAVE FAILURE'} ({total} vs DC {dc})
            <span className="dice-roll-save-detail"> (d20 {roll} + {bonus})</span>
            {mode === 'disadvantage' && <span className="dice-roll-save-detail"> [Disadvantage]</span>}
            {mode === 'advantage' && <span className="dice-roll-save-detail"> [Advantage]</span>}
        </div>
    );
}

function SaveRollNotices({ props, state }) {
    const { waitingForPlayerSave, saveType, saveDc, onQuickRoll, saveResult, rollType,
        dc, success, dcType, dcSuccess } = props;
    const { finalTotal, safeRolls, mode } = state;
    const saveAbilityLabel = saveType ? saveType.toUpperCase() : '';
    return (
        <>
            {waitingForPlayerSave && (
              <div className="dice-roll-save-waiting">
                <i className="fa-solid fa-spinner fa-spin"></i> Waiting for <strong>{props.targetName}</strong> to roll {saveAbilityLabel} save (DC {saveDc})...
                {onQuickRoll && (
                  <button className="dice-roll-quick-roll" onClick={() => onQuickRoll()} type="button">
                    <i className="fa-solid fa-dice-d20"></i> Quick Roll (Local)
                  </button>
                )}
              </div>
            )}
            {saveResult !== undefined && saveResult !== null && (
              <SaveResultLine success={saveResult.success} total={saveResult.total} dc={saveDc} roll={saveResult.roll} bonus={saveResult.bonus} mode={mode} />
            )}
            {rollType === 'save' && saveDc == null && (
              <div className="dice-roll-save-info">
                <i className="fa-solid fa-triangle-exclamation"></i> DC Unknown — no success or failure
              </div>
            )}
            {dc !== undefined && success === undefined && !waitingForPlayerSave && !state.isSaveDamageType && (
              <div className="dice-roll-save-info">
                Save DC {dc} {dcType}: {dcSuccess === 'half' ? 'half damage on save' : 'no damage on save'}
              </div>
            )}
            {rollType === 'condition-save' && success !== undefined && (
              <SaveResultLine success={success} total={finalTotal} dc={dc} roll={safeRolls[0] || 0} bonus={props.bonus} mode={mode} />
            )}
        </>
    );
}

function HitOutcomeDetails({ props, state }) {
    const { resistanceNotice, hunterLoreNotice, finalDamage, damageApplied, damageReduced,
        targetName, targetCurrentHp, interceptedFeature } = props;
    return (
        <>
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
                  <span><strong>{finalDamage}</strong> damage applied to <strong>{targetName}</strong> (reduced from {state.originalTotal}){targetCurrentHp !== undefined ? ` — HP: ${targetCurrentHp + finalDamage} → ${targetCurrentHp}` : ''}</span>
                ) : (
                  <span><strong>{finalDamage}</strong> damage applied to <strong>{targetName}</strong>{targetCurrentHp !== undefined ? ` — HP: ${targetCurrentHp + finalDamage} → ${targetCurrentHp}` : ''}</span>
                )}
              </div>
            )}
            {state.isDamageType && interceptedFeature && (
              <div className="dice-roll-intercepted">
                <i className="fa-solid fa-shield-halved"></i> {interceptedFeature}: damage intercepted, {targetName} survives!
              </div>
            )}
        </>
    );
}

function HealOutcomeNotice({ props, state }) {
    const { finalHeal, healReduced, bonusHeal, bonusHealDetail, targetName, targetCurrentHp } = props;
    if (!state.isHealType) return null;
    const originalTotal = state.originalTotal;
    return (
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
    );
}

const TRIGGER_BUTTON_SPECS = [
    {
        key: 'reroll',
        show: (p, s) => p.autoReroll && !s.rerollUsed && (s.isD20 || p.type === 'save-damage') && p.autoRerollCondition !== 'roll_equals_1',
        icon: 'fa-rotate',
        handler: 'handleReroll',
        label: (p) => `Reroll${p.autoRerollBonus ? ` (+${p.autoRerollBonus})` : ''}`,
    },
    {
        key: 'strokeOfLuck',
        show: (p, s) => p.strokeOfLuck && !s.strokeUsed && s.isD20 && s.d20TestFailed,
        icon: 'fa-star',
        handler: 'handleStrokeOfLuck',
        label: () => 'Stroke of Luck',
    },
    {
        key: 'boonOfCombatProwess',
        show: (p, s) => p.autoRerollForAttack && !s.boonUsed && s.isD20 && !p.hit && !p.isAutoMiss,
        icon: 'fa-shield-halved',
        handler: 'handleBoonOfCombatProwess',
        label: () => 'Boon of Combat Prowess',
    },
    {
        key: 'bardicInspiration',
        show: (p, s) => p.bardicInspiration && !s.bardicInspirationUsed && s.isD20 && (p.rollType === 'check' || p.rollType === 'skill' || p.rollType === 'save'),
        icon: 'fa-music',
        handler: 'handleBardicInspiration',
        label: (p) => `Bardic Inspiration (d${p.bardicInspirationDie})`,
    },
    {
        key: 'luckyAdvantage',
        show: (p, s) => p.luckyAdvantage && s.isD20,
        icon: 'fa-eye',
        handler: 'handleLuckyAdvantage',
        label: () => 'Lucky: Advantage (1 LP)',
    },
    {
        key: 'luckyDisadvantage',
        show: (p, s) => p.luckyDisadvantage && s.isD20,
        icon: 'fa-eye-slash',
        handler: 'handleLuckyDisadvantage',
        label: () => 'Lucky: Disadvantage (1 LP)',
    },
    {
        key: 'tacticalMind',
        show: (p, s) => p.tacticalMind && !s.tacticalUsed && s.isD20 && (p.rollType === 'check' || p.rollType === 'skill') && s.d20TestFailed && s.displayRoll !== 20,
        icon: 'fa-hand',
        handler: 'handleTacticalMind',
        label: (p) => `Tactical Mind${p.tacticalMindBonus ? ` (+${p.tacticalMindBonus})` : ''}`,
    },
    {
        key: 'darkOnesLuck',
        show: (p, s) => p.darkOnesLuck && !s.darkOnesLuckUsed && s.isD20 && (p.rollType === 'check' || p.rollType === 'skill' || p.rollType === 'save'),
        icon: 'fa-fire',
        handler: 'handleDarkOnesLuck',
        label: () => 'Dark One\'s Own Luck (1d10)',
    },
];

function FeatureTriggerButtons({ props, state, handlers }) {
    const { availableSuperiorityManeuvers } = props;
    const { superiorityUsed } = state;
    return (
        <>
            {TRIGGER_BUTTON_SPECS.map((spec) => {
                if (!spec.show(props, state)) return null;
                return (
                  <div key={spec.key} className="dice-roll-reroll">
                    <button className="dice-roll-reroll-btn" onClick={handlers[spec.handler]} type="button">
                      <i className={`fa-solid ${spec.icon}`}></i> {spec.label(props)}
                    </button>
                  </div>
                );
            })}
            {availableSuperiorityManeuvers && availableSuperiorityManeuvers.length > 0 && !superiorityUsed && (
              <div className="dice-roll-reroll">
                {availableSuperiorityManeuvers.map(m => (
                  <button key={m.name} className="dice-roll-reroll-btn" onClick={() => handlers.handleSuperiorityManeuver(m)} type="button">
                    <i className="fa-solid fa-bolt"></i> {m.name} (Superiority Die)
                  </button>
                ))}
              </div>
            )}
        </>
    );
}

function DamageFeatureTriggers({ props, state, handlers }) {
    const { bardicInspirationDefense, bardicInspirationDefenseDieSize, bardicInspirationOffense,
        bardicInspirationOffenseDieSize, empoweredSpell, piercerPuncture, savageAttacker } = props;
    return (
        <>
            {bardicInspirationDefense && !state.bardicInspirationDefenseUsed && state.computedHit && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handlers.handleBardicInspirationDefense} type="button">
                  <i className="fa-solid fa-music"></i> Bardic Inspiration - Defense (d{bardicInspirationDefenseDieSize})
                </button>
              </div>
            )}
            {bardicInspirationOffense && !state.bardicInspirationOffenseUsed && state.isDamageType && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={() => handlers.handleBardicInspirationOffense()} type="button">
                  <i className="fa-solid fa-music"></i> Bardic Inspiration - Offense (d{bardicInspirationOffenseDieSize})
                </button>
              </div>
            )}
            {empoweredSpell && !state.empoweredSpellUsed && state.isDamageType && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handlers.handleEmpoweredSpell} type="button">
                  <i className="fa-solid fa-wand-magic-sparkles"></i> Empowered Spell (1 SP)
                </button>
              </div>
            )}
            {piercerPuncture && !state.punctureUsed && state.isDamageType && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handlers.handlePuncture} type="button">
                  <i className="fa-solid fa-bolt"></i> Piercer - Puncture
                </button>
              </div>
            )}
            {savageAttacker && !state.savageAttackerUsed && state.isDamageType && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={handlers.handleSavageAttacker} type="button">
                  <i className="fa-solid fa-arrows-spin"></i> Savage Attacker
                </button>
              </div>
            )}
        </>
    );
}

function SavageAttackerResult({ savageAttackerResult, onKeep, onSavageAttackerChoice }) {
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-arrows-spin"></i> Savage Attacker: {savageAttackerResult.original} → {savageAttackerResult.rerolled}
            {savageAttackerResult.awaitingChoice ? ` — choose which total to keep (${savageAttackerResult.originalTotal} or ${savageAttackerResult.newTotal})` : savageAttackerResult.kept === 'reroll' ? ` — Reroll kept (+${savageAttackerResult.newTotal - savageAttackerResult.originalTotal})` : ' — Original kept'}
            {savageAttackerResult.awaitingChoice && onSavageAttackerChoice && (
              <div className="dice-roll-reroll">
                <button className="dice-roll-reroll-btn" onClick={() => onKeep('original')} type="button">
                  <i className="fa-solid fa-check"></i> Keep First ({savageAttackerResult.originalTotal})
                </button>
                <button className="dice-roll-reroll-btn" onClick={() => onKeep('reroll')} type="button">
                  <i className="fa-solid fa-dice"></i> Keep Reroll ({savageAttackerResult.newTotal})
                </button>
              </div>
            )}
        </div>
    );
}

function BardicInspirationDefenseRow({ bardicInspirationDefenseResult }) {
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-music"></i> Bardic Inspiration - Defense: 1d{bardicInspirationDefenseResult.dieSize} → {bardicInspirationDefenseResult.dieValue} → AC {bardicInspirationDefenseResult.newAc} ({bardicInspirationDefenseResult.willMiss ? 'Attack misses!' : 'Attack still hits'})
        </div>
    );
}

function EmpoweredSpellResult({ empoweredSpellResult }) {
    const diff = empoweredSpellResult.damageDifference;
    const diffSuffix = diff > 0 ? ` (+${diff})` : diff < 0 ? ` (${diff})` : '';
    const messageSuffix = diff === 0 && !empoweredSpellResult.message ? '' : empoweredSpellResult.message ? ` — ${empoweredSpellResult.message}` : '';
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-wand-magic-sparkles"></i> Empowered Spell: rerolled {empoweredSpellResult.rerollCount} dice ({empoweredSpellResult.originalDice?.join(', ')} → {empoweredSpellResult.newDice?.join(', ')}) → <strong>{empoweredSpellResult.newTotal}</strong>{diffSuffix}{messageSuffix}
        </div>
    );
}

function PunctureResultRow({ punctureResult }) {
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-bolt"></i> Piercer - Puncture: {punctureResult.originalDice?.join(', ')} → {punctureResult.newDice?.join(', ')}
        </div>
    );
}

function RerollResultRow({ rerollResult }) {
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-rotate"></i> Rerolled: {rerollResult.roll} + {rerollResult.total - rerollResult.roll} = <strong>{rerollResult.total}</strong>
        </div>
    );
}

function StrokeOfLuckResultRow({ strokeResult }) {
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-star"></i> Stroke of Luck: d20 → 20 + {strokeResult.total - 20} = <strong>{strokeResult.total}</strong>
        </div>
    );
}

function BoonOfCombatProwessRow() {
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-shield-halved"></i> Boon of Combat Prowess: Miss converted to Hit
        </div>
    );
}

function BardicInspirationResultRow({ bardicInspirationResult }) {
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-music"></i> Bardic Inspiration: 1d{bardicInspirationResult.dieSize} → {bardicInspirationResult.dieValue} + <strong>{bardicInspirationResult.total}</strong>
        </div>
    );
}

function BardicInspirationOffenseRow({ bardicInspirationOffenseResult }) {
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-music"></i> Bardic Inspiration - Offense: 1d{bardicInspirationOffenseResult.dieSize} → +{bardicInspirationOffenseResult.dieValue} → <strong>{bardicInspirationOffenseResult.bonusTotal}</strong>
        </div>
    );
}

function DarkOnesLuckRow({ darkOnesLuckResult }) {
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-fire"></i> Dark One's Own Luck: +{darkOnesLuckResult.dieValue} (d10) → <strong>{darkOnesLuckResult.total}</strong>
        </div>
    );
}

function SuperiorityResultRow({ superiorityResult }) {
    return (
        <div className="dice-roll-reroll-result">
            <i className="fa-solid fa-bolt"></i> {superiorityResult.maneuverName}: d12 {superiorityResult.dieValue} → <strong>{superiorityResult.total}</strong> (+{superiorityResult.dieValue})
        </div>
    );
}

function FeatureResultSummary({ props, state, handlers }) {
    const sections = [
        { key: 'reroll', when: () => state.rerollUsed && state.rerollResult !== null, render: () => <RerollResultRow rerollResult={state.rerollResult} /> },
        { key: 'stroke', when: () => state.strokeUsed && state.strokeResult !== null, render: () => <StrokeOfLuckResultRow strokeResult={state.strokeResult} /> },
        { key: 'boon', when: () => state.boonUsed && props.autoRerollForAttack, render: () => <BoonOfCombatProwessRow /> },
        { key: 'bardic', when: () => state.bardicInspirationUsed && state.bardicInspirationResult !== null, render: () => <BardicInspirationResultRow bardicInspirationResult={state.bardicInspirationResult} /> },
        { key: 'bardicDefense', when: () => state.bardicInspirationDefenseUsed && state.bardicInspirationDefenseResult !== null, render: () => <BardicInspirationDefenseRow bardicInspirationDefenseResult={state.bardicInspirationDefenseResult} /> },
        { key: 'bardicOffense', when: () => state.bardicInspirationOffenseUsed && state.bardicInspirationOffenseResult !== null, render: () => <BardicInspirationOffenseRow bardicInspirationOffenseResult={state.bardicInspirationOffenseResult} /> },
        { key: 'empowered', when: () => state.empoweredSpellUsed && state.empoweredSpellResult, render: () => <EmpoweredSpellResult empoweredSpellResult={state.empoweredSpellResult} /> },
        { key: 'puncture', when: () => state.punctureUsed && state.punctureResult, render: () => <PunctureResultRow punctureResult={state.punctureResult} /> },
        { key: 'savage', when: () => state.savageAttackerUsed && state.savageAttackerResult, render: () => <SavageAttackerResult savageAttackerResult={state.savageAttackerResult} onKeep={handlers.handleSavageAttackerKeep} onSavageAttackerChoice={props.onSavageAttackerChoice} /> },
        { key: 'tactical', when: () => true, render: () => <TacticalMindAdjudicationPanel tacticalUsed={state.tacticalUsed} tacticalResult={state.tacticalResult} tacticalDeclared={state.tacticalDeclared} onDeclare={handlers.handleTacticalDeclare} /> },
        { key: 'darkOnesLuck', when: () => state.darkOnesLuckUsed && state.darkOnesLuckResult !== null, render: () => <DarkOnesLuckRow darkOnesLuckResult={state.darkOnesLuckResult} /> },
        { key: 'superiority', when: () => state.superiorityUsed && state.superiorityResult !== null, render: () => <SuperiorityResultRow superiorityResult={state.superiorityResult} /> }
    ];
    return (
        <>
            {sections.map(section => section.when() ? <Fragment key={section.key}>{section.render()}</Fragment> : null)}
        </>
    );
}

function SecondaryDamageSection({ props }) {
    const { secondaryFormula, secondaryRolls, secondaryModifier, secondaryTotal, secondarySaveResult,
        saveDc, secondaryFinalDamage, finalDamage, damageType, secondaryDamageType,
        damageApplied, targetName, targetCurrentHp } = props;
    if (!secondaryFormula) return null;
    return (
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
    );
}

function DamageTypeChoiceSection({ props }) {
    const { name, baseFormula, baseRolls, baseTotal, bonusFormula, bonusRolls, bonusTotal, types } = props;
    if (props.type !== 'damage_type_choice') return null;
    return (
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
    );
}

function HolyAuraSaveNotice({ props }) {
    const holyAuraSaveResult = props.holyAuraSaveResult;
    if (!holyAuraSaveResult) return null;
    return (
        <div className="dice-roll-holy-aura-save">
            <i className="fa-solid fa-shield-halved"></i>
            <strong>— Holy Aura Save:</strong>
            <span className="dice-roll-save-detail">
              d20 {holyAuraSaveResult.roll} + {holyAuraSaveResult.modifier} = {holyAuraSaveResult.total} vs DC {holyAuraSaveResult.dc}
            </span>
            <span className={`dice-roll-save-result ${holyAuraSaveResult.success ? 'save-success' : 'save-failure'}`}>
              {holyAuraSaveResult.success ? 'SAVE SUCCESSFUL' : 'SAVE FAILED'}
            </span>
            {!holyAuraSaveResult.success && <span className="dice-roll-save-effect">Fiend/Undead blinded!</span>}
        </div>
    );
}

function DiceRollResult(props) {
    const {
        bonus = 0, modifier = 0,
        targetAc,
        shieldAcBonus, shieldOfFaithAcBonus, wardingBondAcBonus, slowAcPenalty,
        success,
        autoDamage,
        luckyRerolled, luckyRerollValue,
        isPotentCantrip,
        psiBolsteredKnack, psiBolsteredKnackDieSize,
        onStrokeOfLuck, onLuckyAdvantage, onLuckyDisadvantage,
        onPsiBolsteredKnack,
        onDone,
    } = props;

    const state = useDiceRollState(props);
    const handlers = createDiceRollHandlers(props, state);
    const {
        setMode,
        strokeResult, setStrokeResult, setStrokeUsed,
        setBoonUsed,
        psiKnackClicked, psiKnackResult, psiKnackConsumed, setPsiKnackResult, setPsiKnackClicked, setPsiKnackConsumed,
        effectiveAc,
        finalTotal, displayTotal, homingStrikesApplied, rerollResult,
    } = state;

    const hitMissTotal = homingStrikesApplied ? finalTotal : displayTotal;
    const acBuffLabels = [];
    if (shieldOfFaithAcBonus > 0) acBuffLabels.push(`+${shieldOfFaithAcBonus} Shield of Faith`);
    if (wardingBondAcBonus > 0) acBuffLabels.push(`+${wardingBondAcBonus} Warding Bond`);
    if (shieldAcBonus > 0) acBuffLabels.push(`+${shieldAcBonus} Shield`);
    if (slowAcPenalty > 0) acBuffLabels.push(`−${slowAcPenalty} Slow`);
    const acDisplay = `${effectiveAc ?? targetAc ?? '—'}${acBuffLabels.length ? ` (${acBuffLabels.join(', ')})` : ''}`;

    const handlePsiKnackClick = () => {
        const dieSize = psiBolsteredKnackDieSize || 6;
        const dieValue = Math.floor(Math.random() * dieSize) + 1;
        const currentTotal = strokeResult !== null ? 20 + bonus + modifier : (rerollResult !== null ? rerollResult.total : (state.finalRoll + bonus + modifier));
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

    const handleStrokeOfLuckClick = () => {
        setStrokeResult({ roll: 20, total: 20 + bonus + modifier });
        setStrokeUsed(true);
        if (onStrokeOfLuck) onStrokeOfLuck('strokeOfLuck');
    };

    const handleBoonOfCombatProwessClick = () => {
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

    const triggerHandlers = {
        ...handlers,
        handleStrokeOfLuck: handleStrokeOfLuckClick,
        handleBoonOfCombatProwess: handleBoonOfCombatProwessClick,
        handleLuckyAdvantage,
        handleLuckyDisadvantage,
    };

    return (
        <div className="dice-roll-result">
            <RollHeader props={props} state={state} />
            <RollSummary props={props} state={state} />

            <FloorNotices props={props} state={state} />
            <RollAdjustmentNotices props={props} state={state} />

            <RollModeToggles props={props} state={state} />

            <CritNotices props={props} state={state} />
            <HitMissLine props={props} state={state} acDisplay={acDisplay} hitMissTotal={hitMissTotal} />
            <AttackOutcomeNotices props={props} state={state} acDisplay={acDisplay} />

            <SaveRollNotices props={props} state={state} />

            <HitOutcomeDetails props={props} state={state} />

            <HealOutcomeNotice props={props} state={state} />

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

            <FeatureTriggerButtons props={props} state={state} handlers={triggerHandlers} />

            <PsiBolsteredKnackPanel
                psiBolsteredKnack={psiBolsteredKnack}
                psiBolsteredKnackDieSize={psiBolsteredKnackDieSize}
                success={success}
                rollType={props.rollType}
                psiKnackClicked={psiKnackClicked}
                psiKnackConsumed={psiKnackConsumed}
                psiKnackResult={psiKnackResult}
                onKnackClick={handlePsiKnackClick}
                onSucceeded={handlePsiKnackSucceeded}
                onFailed={handlePsiKnackFailed}
            />

            <DamageFeatureTriggers props={props} state={state} handlers={handlers} />

            <FeatureResultSummary props={props} state={state} handlers={handlers} />

            <SecondaryDamageSection props={props} />

            <DamageTypeChoiceSection props={props} />

            {autoDamage && state.computedHit && (
              <div className="dice-roll-reroll">
                <AutoDamageActionButton autoDamage={autoDamage} computedHit={state.computedHit} onDone={onDone} />
              </div>
            )}

            <HolyAuraSaveNotice props={props} />

            <div className="dice-roll-hint">click to dismiss</div>
        </div>
    );
}

export default DiceRollResult;
