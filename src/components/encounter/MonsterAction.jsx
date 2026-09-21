import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { formatDamageTypes } from '../../services/rules/combat/damageUtils.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';
import { extractDamageDiceFromDescription, saveChipPlan } from './MonsterCardModal.jsx';
import { attackRowMissingToHit, extractConditionsFromSaveEffect, extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, getGatedMonsterReaction, monsterReactionUsesRemaining, formatActionUsage } from './MonsterCardHelpers.js';
import { monsterAbilitySaveUsesGate } from '../../services/encounters/monsterAbilityUses.js';
import { legendaryCheckRow, legendaryCheckLabel } from '../../services/encounters/monsterLegendaryUses.js';
import { monsterRechargeGate, rechargeDisplayText } from '../../services/encounters/monsterRecharge.js';
import { isSelfAuraRow } from '../../services/encounters/monsterSelfAura.js';
import { isMonsterSummonRow } from '../../services/encounters/monsterSummon.js';
import { isMonsterSelfBuffRow } from '../../services/encounters/monsterSelfBuff.js';

function formatDamageTypeList(types) {
  return types.length > 0 ? formatDamageTypes(types) : '';
}

function rechargeSpent(gateInfo) {
  return !!gateInfo && !gateInfo.available;
}

// MA-0294: a spent attack-row chip mirrors the save-chip precedent
// (mc-dice-link-spell-spent) but stays clickable — the click routes to
// handleAttack's honest refusal popup/log.
function attackChipClass(rechargeOut) {
  return `mc-dice-link${rechargeOut ? ' mc-dice-link-spell-spent' : ''}`;
}

// MA-0031: recharge label — a spent row reads "(Recharge 6 — unavailable)".
// MA-0049: structured usage {recharge on roll, min_value 5} reads
// "(Recharge 5+)" — the rechargeDisplayText helper covers both shapes.
function RechargeNote({ action, rechargeOut }) {
  const rechargeText = rechargeDisplayText(action);
  if (rechargeText == null) return null;
  if (!rechargeOut) return <em> ({rechargeText})</em>;
  const label = /^recharge\b/i.test(rechargeText) ? rechargeText : `Recharge ${rechargeText}`;
  return <em> ({`${label} — unavailable`})</em>;
}

// MA-0014: unroll­able formulas (e.g. "1d8+3+spell level") must render as
// plain description text only — never a clickable chip that dies silently.
// MA-0286: attack rows with no authored attack_bonus must also render text
// only — a damage chip on an attack row is an auto-hit (no to-hit roll).
function ActionDamageLinks({ action, actionDamageFormula, actionDamageTypeLabel, onDamage }) {
  if (action.save_dc != null || action.attack_bonus != null || attackRowMissingToHit(action)) return null;
  const rollablePrimary = actionDamageFormula && canRollExpression(actionDamageFormula);
  const rollableSecondary = action.damage_dice_secondary != null && canRollExpression(action.damage_dice_secondary);
  if (!rollablePrimary && !rollableSecondary) return null;
  return (
    <>
      {rollablePrimary && (
        <span className="mc-dice-link" onClick={() => onDamage(action.name, actionDamageFormula, actionDamageTypeLabel, action)} role="button" tabIndex={0}>
          <i className="fa-solid fa-dice" /> {actionDamageFormula}
        </span>
      )}
      {rollableSecondary && (
        <span className="mc-dice-link" onClick={() => onDamage(action.name, action.damage_dice_secondary, actionDamageTypeLabel, action)} role="button" tabIndex={0}>
          <i className="fa-solid fa-dice" /> {action.damage_dice_secondary}
        </span>
      )}
    </>
  );
}

function SpellCastLinks({ action, spellUsesUsed, attackerCannotAct, onSpellCast }) {
  const spellNames = extractSpellNamesFromSpellcasting(action.description);
  if (spellNames.length === 0) return null;
  const spellUses = extractSpellcastingSpellUses(action.description);
  const clickable = !attackerCannotAct;
  return (
    <>
      {spellNames.map(spellName => {
        const usesMax = spellUses[spellName] ?? null;
        const remaining = usesMax == null ? null : Math.max(0, usesMax - (Number(spellUsesUsed?.[spellName]) || 0));
        return (
          <span
            key={spellName}
            className={`mc-dice-link mc-dice-link-spell${remaining === 0 ? ' mc-dice-link-spell-spent' : ''}`}
            onClick={clickable ? () => onSpellCast(action, spellName) : undefined}
            role="button"
            tabIndex={0}
          >
            <i className="fa-solid fa-hurricane" /> {spellName}{remaining != null && <em> ({usesMax}/Day · {remaining} left)</em>}
          </span>
        );
      })}
    </>
  );
}

function ActionSaveRoll({ action, attackerCannotAct, onSaveRoll, spellUsesUsed, rechargeOut = false }) {
  if (action.save_dc == null) return null;
  // MA-0560: rider-only composite rows (Death Dog Bite) arm NO damage on the
  // DC chip — the fixed primary pays full on the attack chip (MA-0551 fork);
  // the save adjudicates the condition rider alone. Other rows byte-identical.
  const plan = saveChipPlan(action, attackerCannotAct);
  const saveDamageFormula = plan.formula;
  const saveConditions = extractConditionsFromSaveEffect(action?.save_effect);
  const usesGate = monsterAbilitySaveUsesGate(action, spellUsesUsed);
  const usesNote = usesGate ? <em> ({usesGate.maxUses}/Day · {usesGate.remaining} left)</em> : null;
  const spentClass = (usesGate && usesGate.remaining === 0) || rechargeOut ? ' mc-dice-link-spell-spent' : '';
  const handleSaveRoll = () => {
    onSaveRoll(action, saveDamageFormula, saveConditions);
  };
  if (plan.rollable) {
    // MA-0035: the dice chip stays its clean formula text (existing exact-text
    // selectors intact); the labelled "DC N <Type>" save affordance renders as
    // a sibling clickable span (same handleSaveRoll), no per-row fork.
    return (
      <>
        <span className={`mc-dice-link${spentClass}`} role="button" tabIndex={0} onClick={handleSaveRoll}>
          <i className="fa-solid fa-dice" /> {saveDamageFormula}{usesNote}
        </span>{' '}
        <span className={`mc-dice-link mc-dice-link-save mc-dice-link-save-clickable${spentClass}`} role="button" tabIndex={0} onClick={handleSaveRoll}>
          DC {action.save_dc} {action.save_type}{usesNote}
        </span>
      </>
    );
  }
  return (
    <span className={`mc-dice-link ${plan.clickable ? 'mc-dice-link-save mc-dice-link-save-clickable' : 'mc-dice-link-save'}${spentClass}`} onClick={plan.clickable ? handleSaveRoll : undefined} role="button" tabIndex={0}>
      DC {action.save_dc} {action.save_type}{usesNote}
    </span>
  );
}

function GatedReactionLink({ def, remaining, attackerCannotAct, onClick }) {
  const clickable = !attackerCannotAct;
  return (
    <span
      className={`mc-dice-link${remaining === 0 ? ' mc-dice-link-spell-spent' : ''}`}
      onClick={clickable ? onClick : undefined}
      role="button"
      tabIndex={0}
    >
      <i className={`fa-solid ${def.icon}`} /> {def.label}{remaining != null && <em> ({remaining} left)</em>}
    </span>
  );
}

function GatedReactionSlot({ action, attackerCannotAct, reactionUsesUsed, onGatedReaction }) {
  const def = getGatedMonsterReaction(action);
  if (!def) return null;
  return <GatedReactionLink def={def} remaining={monsterReactionUsesRemaining(action, reactionUsesUsed)} attackerCannotAct={attackerCannotAct} onClick={() => onGatedReaction(action)} />;
}

// MA-0021: legendary rows carry no numeric affordance (Lash/Psychic Drain) —
// the gated spend click lives on the row name so the economy can't be bypassed.
// MA-0051: an authored ability_check row ("Detect") gets a labelled skill-check
// chip instead of the generic expend — same gated click (spend first, MA-0021),
// and the click rolls d20+stat-block-mod via the modal's rollSkillCheck seam.
function LegendaryCheckLink({ action, attackerCannotAct, legendaryGate }) {
  const label = legendaryCheckLabel(action);
  const bonus = action.checkBonus;
  const sign = bonus != null && bonus < 0 ? '−' : '+';
  const modText = bonus != null ? `${sign}${Math.abs(bonus)}` : 'Roll';
  return (
    <span className={`mc-dice-link mc-dice-link-legendary mc-dice-link-check${attackerCannotAct ? ' mc-dice-link-spell-spent' : ''}`} onClick={attackerCannotAct ? undefined : () => legendaryGate(action)} role="button" tabIndex={0} title={`Expend 1 legendary use — ${label} check d20 ${modText}`}>
      <i className="fa-solid fa-eye" /> {label} {modText}
    </span>
  );
}

function LegendarySpendLink({ action, attackerCannotAct, legendaryGate }) {
  if (!legendaryGate) return null;
  const formula = extractDamageDiceFromDescription(action?.description, action?.damage_dice_primary);
  const numericAffordance = action.attack_bonus != null || action.save_dc != null || canRollExpression(formula);
  if (numericAffordance) return null;
  if (legendaryCheckRow(action)) return <LegendaryCheckLink action={action} attackerCannotAct={attackerCannotAct} legendaryGate={legendaryGate} />;
  return (
    <span className={`mc-dice-link mc-dice-link-legendary${attackerCannotAct ? ' mc-dice-link-spell-spent' : ''}`} onClick={attackerCannotAct ? undefined : () => legendaryGate(action)} role="button" tabIndex={0} title={`Expend 1 legendary use — ${action.name}`}>
      <i className="fa-solid fa-bolt" /> Expend Legendary
    </span>
  );
}

// MA-0554: save-less self-origin zone row (Darkmantle Darkness Aura) arms a
// te on the monster itself via resolveSelfAuraRow — the lair zone picker
// excludes the caster so it can never model self-auras. 1/Day counter rides
// the monsterSpellUses map (same note shape as SpellCastLinks); exhausted
// chips stay clickable and route the honest refusal.
function ZoneAuraLink({ action, spellUsesUsed, attackerCannotAct, onZoneAuraRow }) {
  if (!isSelfAuraRow(action)) return null;
  const radiusFt = Number(action.zone.radius_ft);
  const gate = monsterAbilitySaveUsesGate(action, spellUsesUsed);
  const usesNote = gate ? <em> ({gate.maxUses}/Day · {gate.remaining} left)</em> : null;
  const spentClass = gate && gate.remaining === 0 ? ' mc-dice-link-spell-spent' : '';
  const clickable = !attackerCannotAct && !!onZoneAuraRow;
  return (
    <span className={`mc-dice-link mc-dice-link-aura${spentClass}`} onClick={clickable ? () => onZoneAuraRow(action) : undefined} role="button" tabIndex={0} title={`Self aura — ${action.name}: ${action.zone.effect_key || 'lair_darkness'} on self, radius ${radiusFt} ft, no save`}>
      <i className="fa-solid fa-moon" /> {radiusFt}-ft Aura{usesNote}
    </span>
  );
}

// MA-0648: monster-side summon row (Drow Mage "Summon Demon") — automation
// {type:"monster_summon", options:[...]} arms a clickable summon chip that
// routes the coin-flip adjudication + combatSummary spawn in the modal.
// 1/Day counter rides the MA-0020 monsterSpellUses gate (numeric uses/
// maxUses); exhausted chips stay clickable and route the honest refusal.
function SummonLink({ action, spellUsesUsed, attackerCannotAct, onSummonRow }) {
  if (!isMonsterSummonRow(action)) return null;
  const gate = monsterAbilitySaveUsesGate(action, spellUsesUsed);
  const usesNote = gate ? <em> ({gate.maxUses}/Day · {gate.remaining} left)</em> : null;
  const spentClass = gate && gate.remaining === 0 ? ' mc-dice-link-spell-spent' : '';
  const clickable = !attackerCannotAct && !!onSummonRow;
  return (
    <span className={`mc-dice-link mc-dice-link-summon${spentClass}`} onClick={clickable ? () => onSummonRow(action) : undefined} role="button" tabIndex={0} title={`Summon a demon — coin flip: ${action.automation.options.map(o => `${o.monster}${o.chance != null ? ` (${Math.round(o.chance * 100)}%)` : ''}`).join(' or ')}, ${action.automation.range_ft || 60} ft, ${action.automation.duration_minutes || 10} min`}>
      <i className="fa-solid fa-hat-wizard" /> Summon{usesNote}
    </span>
  );
}

// MA-0655: monster-side self-buff row (Duergar "Enlarge") — automation
// {type:"monster_self_buff", effect:"enlarge", rounds:N} arms a clickable
// self-grant chip routed to resolveMonsterSelfBuffRow in the modal (te on
// self + one merged expiry clock + spend). Uses counter rides the MA-0020
// monsterSpellUses gate; exhausted chips stay clickable and refuse honestly.
function SelfBuffLink({ action, spellUsesUsed, attackerCannotAct, onSelfBuffRow }) {
  if (!isMonsterSelfBuffRow(action)) return null;
  const gate = monsterAbilitySaveUsesGate(action, spellUsesUsed);
  const usesNote = gate ? <em> ({gate.maxUses}/Day · {gate.remaining} left)</em> : null;
  const spentClass = gate && gate.remaining === 0 ? ' mc-dice-link-spell-spent' : '';
  const clickable = !attackerCannotAct && !!onSelfBuffRow;
  const label = action.name || action.automation.effect;
  const icon = action.automation.effect === 'invisible' ? 'fa-eye-slash' : 'fa-up-right-and-down-left-from-center';
  return (
    <span className={`mc-dice-link mc-dice-link-selfbuff${spentClass}`} onClick={clickable ? () => onSelfBuffRow(action) : undefined} role="button" tabIndex={0} title={`Self buff — ${action.name}: te ${action.automation.effect} on self, ${action.automation.rounds || 10} rounds`}>
      <i className={`fa-solid ${icon}`} /> {label}{usesNote}
    </span>
  );
}

export function MonsterAction({ action, index, attackerCannotAct, onAttack, onDamage, onSaveRoll, onSpellCast, spellUsesUsed = {}, reactionUsesUsed, onGatedReaction, legendaryGate, rechargeState = {}, onZoneAuraRow, onSummonRow, onSelfBuffRow }) {
  const actionHasSave = action.save_dc != null;
  const actionHasAttack = action.attack_bonus != null;
  // MA-0031: recharge rows track spend/recharge state in the monsterRecharge
  // runtime map; a spent row reads "(Recharge 6 — unavailable)" and refuses.
  const rechargeOut = rechargeSpent(monsterRechargeGate(action, rechargeState));
  const actionDamageFormula = extractDamageDiceFromDescription(action?.description, action?.damage_dice_primary);
  const actionDamageType = action?.damage_type_primary ? [action.damage_type_primary] : [];
  const actionDamageTypeLabel = formatDamageTypeList(actionDamageType);
  const isSpellcastingRow = /^spellcasting$/i.test(action.name || '');
  const usageText = formatActionUsage(action.usage);

  return (
    <div key={index} className={`mc-action ${attackerCannotAct ? 'mc-action-disabled' : ''}`}>
      <strong>{action.name}.</strong>{' '}
      <LegendarySpendLink action={action} attackerCannotAct={attackerCannotAct} legendaryGate={legendaryGate} />
      <ZoneAuraLink action={action} spellUsesUsed={spellUsesUsed} attackerCannotAct={attackerCannotAct} onZoneAuraRow={onZoneAuraRow} />
      <SummonLink action={action} spellUsesUsed={spellUsesUsed} attackerCannotAct={attackerCannotAct} onSummonRow={onSummonRow} />
      <SelfBuffLink action={action} spellUsesUsed={spellUsesUsed} attackerCannotAct={attackerCannotAct} onSelfBuffRow={onSelfBuffRow} />
      {attackerCannotAct && <span className="mc-incapacitated-label">(Incapacitated)</span>}
      {actionHasAttack && !attackerCannotAct && (
        <span className={attackChipClass(rechargeOut)} onClick={() => onAttack(action.name, action.attack_bonus, action)} role="button" tabIndex={0}>
          <i className="fa-solid fa-dice-d20" /> +{action.attack_bonus}
        </span>
      )}
      <ActionDamageLinks action={action} actionDamageFormula={actionDamageFormula} actionDamageTypeLabel={actionDamageTypeLabel} onDamage={onDamage} />
      {isSpellcastingRow ? (
        <SpellCastLinks action={action} spellUsesUsed={spellUsesUsed} attackerCannotAct={attackerCannotAct} onSpellCast={onSpellCast} />
      ) : (
        actionHasSave && <ActionSaveRoll action={action} attackerCannotAct={attackerCannotAct} onSaveRoll={onSaveRoll} spellUsesUsed={spellUsesUsed} rechargeOut={rechargeOut} />
      )}
      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.description) }} />
      <GatedReactionSlot action={action} attackerCannotAct={attackerCannotAct} reactionUsesUsed={reactionUsesUsed} onGatedReaction={onGatedReaction} />
      {usageText && <em> ({usageText})</em>}
      <RechargeNote action={action} rechargeOut={rechargeOut} />
    </div>
  );
}
