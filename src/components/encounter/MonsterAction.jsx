import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { formatDamageTypes } from '../../services/rules/combat/damageUtils.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';
import { extractDamageDiceFromDescription, saveChipPlan } from './MonsterCardModal.jsx';
import { attackRowMissingToHit, extractConditionsFromSaveEffect, extractSpellNamesFromSpellcasting, extractSpellcastingSpellUses, getGatedMonsterReaction, monsterReactionUsesRemaining, formatActionUsage, isUtilitySpellCastRow, isZonePickerRow } from './MonsterCardHelpers.js';
import { monsterAbilitySaveUsesGate } from '../../services/encounters/monsterAbilityUses.js';
import { legendaryCheckRow, legendaryCheckLabel } from '../../services/encounters/monsterLegendaryUses.js';
import { monsterRechargeGate, rechargeDisplayText } from '../../services/encounters/monsterRecharge.js';
import { isSelfAuraRow } from '../../services/encounters/monsterSelfAura.js';
import { isMonsterSummonRow } from '../../services/encounters/monsterSummon.js';
import { isMonsterSelfBuffRow } from '../../services/encounters/monsterSelfBuff.js';
import { isMonsterGrantReactionRow } from '../../services/encounters/monsterGrantReaction.js';
import { isMonsterShapeShiftRow } from '../../services/encounters/monsterShapeShift.js';

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
// MA-1071: save_dc:0 empty-noise decoy (household monsters.json authoring, MA-1021
// family) is NOT a save — mirror the MA-0551 Number(save_dc) > 0 convention so the
// DC0 row falls to this plain flat-damage lane instead of the save chip (Modal
// handleDamage stays save-inert at DC0 too). save_dc>0 rows byte-identical.
function ActionDamageLinks({ action, actionDamageFormula, actionDamageTypeLabel, onDamage }) {
  if (Number(action.save_dc) > 0 || action.attack_bonus != null || attackRowMissingToHit(action)) return null;
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

// MA-1016: utility-row chips (Ice Mephit "Fog Cloud") ride the MA-0020
// numeric uses/maxUses gate for the counter (row-level, no description
// "N/Day:" tier); rowUsesGate=null (every Spellcasting row) keeps the
// description-tier counter byte-identical.
function chipUsesFor(spellName, spellUses, spellUsesUsed, rowUsesGate) {
  const usesMax = spellUses[spellName] ?? (rowUsesGate ? rowUsesGate.maxUses : null);
  if (usesMax == null) return null;
  const used = spellUses[spellName] != null ? (Number(spellUsesUsed?.[spellName]) || 0) : rowUsesGate.used;
  return { usesMax, remaining: Math.max(0, usesMax - used) };
}

function SpellCastLinks({ action, spellUsesUsed, attackerCannotAct, onSpellCast, spellNames = null, rechargeOut = false, rowUsesGate = null }) {
  const names = spellNames ?? extractSpellNamesFromSpellcasting(action.description);
  if (names.length === 0) return null;
  const spellUses = extractSpellcastingSpellUses(action.description);
  const clickable = !attackerCannotAct;
  return (
    <>
      {names.map(spellName => {
        const chipUses = chipUsesFor(spellName, spellUses, spellUsesUsed, rowUsesGate);
        const remaining = chipUses ? chipUses.remaining : null;
        const usesMax = chipUses ? chipUses.usesMax : null;
        const spentClass = remaining === 0 || rechargeOut ? ' mc-dice-link-spell-spent' : '';
        return (
          <span
            key={spellName}
            className={`mc-dice-link mc-dice-link-spell${spentClass}`}
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
  // MA-1071: the DC0 decoy (save_dc:0/save_type:"" empty-noise authoring, MA-1021
  // family) must NEVER arm the save lane — 0 ≠ null admitted every DC0 row, wiring
  // the rollable-dice branch chip to handleSaveRoll so each hit adjudicated vs a
  // guaranteed-success DC 0 and HALVED flat "Hit: X" damage (Pincer Staff). Mirror
  // the MA-0551 Number(save_dc) > 0 convention: DC<=0 renders no chip at all.
  if (action.save_dc == null || Number(action.save_dc) <= 0) return null;
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
  // MA-1071 twin: a DC0 decoy is not a numeric affordance (MA-0551 >0 convention).
  const numericAffordance = action.attack_bonus != null || Number(action.save_dc) > 0 || canRollExpression(formula);
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
// MA-1215: recharge-economy summon rows (Myconid Sovereign "Animating Spores"
// Recharge 3, no uses/maxUses) show the spent class from the live recharge
// map and stay clickable so the click routes the honest "Not Recharged"
// refusal; the RAW 24h/weeks clocks ride the advisory title text (§70) —
// rows WITHOUT duration_minutes never print a fabricated "10 min".
function SummonLink({ action, spellUsesUsed, attackerCannotAct, onSummonRow, rechargeOut = false }) {
  if (!isMonsterSummonRow(action)) return null;
  const gate = monsterAbilitySaveUsesGate(action, spellUsesUsed);
  const usesNote = gate ? <em> ({gate.maxUses}/Day · {gate.remaining} left)</em> : null;
  const spentClass = (gate && gate.remaining === 0) || rechargeOut ? ' mc-dice-link-spell-spent' : '';
  const clickable = !attackerCannotAct && !!onSummonRow;
  const durationText = action.automation.duration_minutes != null ? `${action.automation.duration_minutes} min` : 'GM-adjudicated';
  return (
    <span className={`mc-dice-link mc-dice-link-summon${spentClass}`} onClick={clickable ? () => onSummonRow(action) : undefined} role="button" tabIndex={0} title={`Summon ${action.automation.options.map(o => `${o.monster}${o.chance != null ? ` (${Math.round(o.chance * 100)}%)` : ''}`).join(' or ')} — ${action.automation.count != null ? `count ${action.automation.count}, ` : ''}${action.automation.range_ft || 60} ft, ${durationText}`}>
      <i className="fa-solid fa-hat-wizard" /> Summon{usesNote}
    </span>
  );
}

// MA-0655: monster-side self-buff row (Duergar "Enlarge") — automation
// {type:"monster_self_buff", effect:"enlarge", rounds:N} arms a clickable
// self-grant chip routed to resolveMonsterSelfBuffRow in the modal (te on
// self + one merged expiry clock + spend). Uses counter rides the MA-0020
// monsterSpellUses gate; exhausted chips stay clickable and refuse honestly.
// MA-0694: a legendary gated child (Empyrean "Bolster") must NOT arm this
// ungated chip too — the shared legendary economy rides the single
// "Expend Legendary" chip (LegendarySpendLink → handleLegendaryRow: gate →
// already-bolstered refusal → spend → self-buff mechanic). Non-legendary
// self-buff rows (Duergar Enlarge/Invisibility) stay byte-identical.
function SelfBuffLink({ action, spellUsesUsed, attackerCannotAct, onSelfBuffRow, legendaryGate }) {
  if (!isMonsterSelfBuffRow(action) || legendaryGate) return null;
  const gate = monsterAbilitySaveUsesGate(action, spellUsesUsed);
  const usesNote = gate ? <em> ({gate.maxUses}/Day · {gate.remaining} left)</em> : null;
  const spentClass = gate && gate.remaining === 0 ? ' mc-dice-link-spell-spent' : '';
  const clickable = !attackerCannotAct && !!onSelfBuffRow;
  const label = action.name || action.automation.effect;
  const icon = action.automation.effect === 'invisible' ? 'fa-eye-slash' : action.automation.effect === 'ethereal' ? 'fa-ghost' : 'fa-up-right-and-down-left-from-center';
  return (
    <span className={`mc-dice-link mc-dice-link-selfbuff${spentClass}`} onClick={clickable ? () => onSelfBuffRow(action) : undefined} role="button" tabIndex={0} title={`Self buff — ${action.name}: te ${action.automation.effect} on self, ${action.automation.rounds || 10} rounds`}>
      <i className={`fa-solid ${icon}`} /> {label}{usesNote}
    </span>
  );
}

// MA-0882: monster-side grant-reaction row (Gnoll Pack Lord "Incite Rampage") —
// automation {type:"monster_grant_reaction", effect:"incite_rampage", range_ft:60}
// arms a clickable chip routed to resolveMonsterGrantReactionRow in the modal
// (te on the GM-armed target + ONE rounds:1 clock). Recharge 5-6 rides the live
// MA-0031 monsterRecharge map: a spent row gets the existing mc-dice-link-spell-
// spent class and its click routes the honest "Not Recharged" refusal. Rampage
// prerequisite stays §70 advisory on the grant log.
function GrantReactionLink({ action, attackerCannotAct, rechargeState, onGrantReactionRow }) {
  if (!isMonsterGrantReactionRow(action)) return null;
  const rechargeOut = rechargeSpent(monsterRechargeGate(action, rechargeState));
  const spentClass = rechargeOut ? ' mc-dice-link-spell-spent' : '';
  const clickable = !attackerCannotAct && !!onGrantReactionRow;
  return (
    <span className={`mc-dice-link mc-dice-link-grantreaction${spentClass}`} onClick={clickable ? () => onGrantReactionRow(action) : undefined} role="button" tabIndex={0} title={`Grant Reaction — ${action.name}: te ${action.automation.effect} on an armed target within ${action.automation.range_ft || 60} ft, Recharge ${action.recharge || '5-6'} (Rampage prerequisite GM-checked)`}>
      <i className="fa-solid fa-fire" /> Incite
    </span>
  );
}

// MA-1020: monster-side shape-shift row (Imp "Shape-Shift") — automation
// {type:"monster_shape_shift", effect:"shape_shift", forms:[...]} arms a
// clickable chip that opens the modal's form chooser (ShapeShiftModal,
// MA-0275 mc-overlay/sp-modal chrome); ONE form-row click stamps the form's
// Speed dict onto the combatSummary combatant (runMonster → card Speed row
// consumer). At Will — no uses gate (MA-0020 gate null §230); already-in-
// form refusals route through the resolver with zero writes.
function ShapeShiftLink({ action, attackerCannotAct, onShapeShiftRow }) {
  if (!isMonsterShapeShiftRow(action)) return null;
  const clickable = !attackerCannotAct && !!onShapeShiftRow;
  const formsText = action.automation.forms.map(f => f.name).join(' / ');
  return (
    <span className="mc-dice-link mc-dice-link-shapeshift" onClick={clickable ? () => onShapeShiftRow(action) : undefined} role="button" tabIndex={0} title={`Shape-Shift — ${action.name}: choose ${formsText}; Speed swaps on self, At Will`}>
      <i className="fa-solid fa-shuffle" /> Shape-Shift
    </span>
  );
}

// MA-1212: monster-side save-less zone-grant row (Myconid Adult "Rapport Spores") —
// the ACTION-category twin of the MA-0043/MA-0595/MA-0596 lair zone rows:
// zone:{radius_ft,no_save:true,effect_key,noun,advisory} arms a clickable chip
// that opens the modal's zoneOnly area picker (handleLairZone — picker multi-selects
// creatures in the area, confirm registers the pre-registered te on each picker-
// SELECTED target with NO save and NO damage; §42 selection advisory gridless).
// NOT self-origin (MA-0554 self-aura grants on the monster itself — the picker
// excludes the caster) and never a save DC (the MA-1071 DC0 decoy gate stays).
function ZonePickerLink({ action, attackerCannotAct, onZonePickerRow }) {
  if (!isZonePickerRow(action)) return null;
  const radiusFt = Number(action.zone.radius_ft);
  const clickable = !attackerCannotAct && !!onZonePickerRow;
  return (
    <span className="mc-dice-link mc-dice-link-zone" onClick={clickable ? () => onZonePickerRow(action) : undefined} role="button" tabIndex={0} title={`Zone grant — ${action.name}: te ${action.zone.effect_key} on creatures in the ${radiusFt}-ft ${action.zone.noun || 'area'}, no save; picker selects targets (selection advisory)`}>
      <i className="fa-solid fa-cloud" /> {radiusFt}-ft Zone
    </span>
  );
}

// MA-1014: the spell-save_dc-only utility-row chip fork (Ice Devil "Ice
// Wall"). Hoisted out of MonsterAction to hold the complexity ceiling — the
// three-way choice (Spellcasting markup → spells.json-resolved utility names
// → generic save-shell) lives here, byte-inert for every non-utility row.
function SpellOrSaveLinks({ action, isSpellcastingRow, utilityNames, attackerCannotAct, onSpellCast, onSaveRoll, spellUsesUsed, rechargeOut }) {
  if (isSpellcastingRow) {
    return <SpellCastLinks action={action} spellUsesUsed={spellUsesUsed} attackerCannotAct={attackerCannotAct} onSpellCast={onSpellCast} />;
  }
  if (utilityNames.length > 0) {
    // MA-1014: chip "Wall of Ice" routes the modal's recharge-gated
    // advisory cast (resolveUtilitySpellCastRow) on the formerly inert
    // spell_save_dc-only row; spent recharge gets the existing
    // mc-dice-link-spell-spent class and its click routes the honest
    // "Not Recharged" refusal (MA-0031/MA-0963 precedents).
    // MA-1016: row-level numeric uses/maxUses (Ice Mephit "Fog Cloud"
    // 1/Day) ride the same chip as a "(1/Day · N left)" counter + spent
    // class via the MA-0020 gate; exhausted chips stay clickable and the
    // resolver refuses honestly (MA-0633 byte-shape).
    const rowUsesGate = monsterAbilitySaveUsesGate(action, spellUsesUsed);
    return <SpellCastLinks action={action} spellUsesUsed={spellUsesUsed} attackerCannotAct={attackerCannotAct} onSpellCast={onSpellCast} spellNames={utilityNames} rechargeOut={rechargeOut} rowUsesGate={rowUsesGate} />;
  }
  // MA-1071: DC0 decoy never arms the save shell (MA-0551 >0 convention twin).
  if (Number(action.save_dc) > 0) {
    return <ActionSaveRoll action={action} attackerCannotAct={attackerCannotAct} onSaveRoll={onSaveRoll} spellUsesUsed={spellUsesUsed} rechargeOut={rechargeOut} />;
  }
  return null;
}

// MA-1014: spell_save_dc-only zone/utility row (Ice Devil "Ice Wall") —
// markup-marked spell names pre-filtered against the modal's spells.json
// name index, so mid-prose emphasis (§161) and unresolvable names (§158)
// never arm a fake chip. Null index (not yet loaded / tests) = zero chips.
function utilitySpellNamesFor(action, spellNameIndex) {
  if (!spellNameIndex || !isUtilitySpellCastRow(action)) return [];
  return extractSpellNamesFromSpellcasting(action.description).filter(name => spellNameIndex.has(name));
}

export function MonsterAction({ action, index, attackerCannotAct, onAttack, onDamage, onSaveRoll, onSpellCast, spellUsesUsed = {}, reactionUsesUsed, onGatedReaction, legendaryGate, rechargeState = {}, onZoneAuraRow, onSummonRow, onSelfBuffRow, onGrantReactionRow, onShapeShiftRow, onZonePickerRow, spellNameIndex = null }) {
  const actionHasAttack = action.attack_bonus != null;
  // MA-0031: recharge rows track spend/recharge state in the monsterRecharge
  // runtime map; a spent row reads "(Recharge 6 — unavailable)" and refuses.
  const rechargeOut = rechargeSpent(monsterRechargeGate(action, rechargeState));
  const actionDamageFormula = extractDamageDiceFromDescription(action?.description, action?.damage_dice_primary);
  const actionDamageType = action?.damage_type_primary ? [action.damage_type_primary] : [];
  const actionDamageTypeLabel = formatDamageTypeList(actionDamageType);
  const isSpellcastingRow = /^spellcasting$/i.test(action.name || '');
  // MA-1014: the utility-spell arm excludes legendary-gated rows — those
  // ride the single "Expend Legendary" chip economy (MA-0694 precedent).
  const utilityNames = legendaryGate ? [] : utilitySpellNamesFor(action, spellNameIndex);
  const usageText = formatActionUsage(action.usage);

  return (
    <div key={index} className={`mc-action ${attackerCannotAct ? 'mc-action-disabled' : ''}`}>
      <strong>{action.name}.</strong>{' '}
      <LegendarySpendLink action={action} attackerCannotAct={attackerCannotAct} legendaryGate={legendaryGate} />
      <ZoneAuraLink action={action} spellUsesUsed={spellUsesUsed} attackerCannotAct={attackerCannotAct} onZoneAuraRow={onZoneAuraRow} />
      <ZonePickerLink action={action} attackerCannotAct={attackerCannotAct} onZonePickerRow={onZonePickerRow} />
      <SummonLink action={action} spellUsesUsed={spellUsesUsed} attackerCannotAct={attackerCannotAct} onSummonRow={onSummonRow} rechargeOut={rechargeOut} />
      <SelfBuffLink action={action} spellUsesUsed={spellUsesUsed} attackerCannotAct={attackerCannotAct} onSelfBuffRow={onSelfBuffRow} legendaryGate={legendaryGate} />
      <GrantReactionLink action={action} attackerCannotAct={attackerCannotAct} rechargeState={rechargeState} onGrantReactionRow={onGrantReactionRow} />
      <ShapeShiftLink action={action} attackerCannotAct={attackerCannotAct} onShapeShiftRow={onShapeShiftRow} />
      {attackerCannotAct && <span className="mc-incapacitated-label">(Incapacitated)</span>}
      {actionHasAttack && !attackerCannotAct && (
        <span className={attackChipClass(rechargeOut)} onClick={() => onAttack(action.name, action.attack_bonus, action)} role="button" tabIndex={0}>
          <i className="fa-solid fa-dice-d20" /> +{action.attack_bonus}
        </span>
      )}
      <ActionDamageLinks action={action} actionDamageFormula={actionDamageFormula} actionDamageTypeLabel={actionDamageTypeLabel} onDamage={onDamage} />
      <SpellOrSaveLinks action={action} isSpellcastingRow={isSpellcastingRow} utilityNames={utilityNames} attackerCannotAct={attackerCannotAct} onSpellCast={onSpellCast} onSaveRoll={onSaveRoll} spellUsesUsed={spellUsesUsed} rechargeOut={rechargeOut} />
      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.description) }} />
      <GatedReactionSlot action={action} attackerCannotAct={attackerCannotAct} reactionUsesUsed={reactionUsesUsed} onGatedReaction={onGatedReaction} />
      {usageText && <em> ({usageText})</em>}
      <RechargeNote action={action} rechargeOut={rechargeOut} />
    </div>
  );
}
