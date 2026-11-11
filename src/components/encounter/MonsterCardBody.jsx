import { useMemo } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';
import { resolveMonsterIRV } from '../../services/npcs/monsterIrvUtils.js';
import { EFFECT_DESCRIPTIONS } from '../../services/combat/conditions/effectDescriptions.js';
import { MonsterAction } from './MonsterAction.jsx';
import { legendaryHeaderAction, legendaryUsesRemaining, legendaryCheckRow, legendaryCheckBonus } from '../../services/encounters/monsterLegendaryUses.js';
import { isLairRowClickable, lairRowAffordance } from '../../services/encounters/monsterLairActions.js';
import { hasEntries, hasSenseEntries, saveAbilityAbbr, parseInitiativeBonus, formatSenses, legendarySpellCastMaster } from './MonsterCardHelpers.js';
import { useSpellNameIndex } from '../../hooks/ui/useSpellNameIndex.js';
import { useMonsterPendingOa } from './useMonsterPendingOa.js';

// MA-1883: legendary child render-stamp (mirrors the MA-0051 checkBonus
// stamp at the same seam) — a child delegating to a live Spellcasting master
// carries `legendarySpellRow` so MonsterAction arms gated spell chips
// (press = spend the row's RAW cost, then cast the named spell through the
// MA-1879 live lane) instead of collapsing into a zero-payload save. Stamp
// lives on the render copy only — monsters.json is never mirrored (MA-1881).
function stampLegendaryChildRow(monster, action) {
  const row = legendaryCheckRow(action) ? { ...action, checkBonus: legendaryCheckBonus(monster, action) } : action;
  const spellRow = legendarySpellCastMaster(monster, row);
  return spellRow ? { ...row, legendarySpellRow: spellRow } : row;
}

export function MonsterCardBody({ monster, monsterName, onClose, creatureTempHp, shieldOfFaithBonus, handleInitiative, handleAbilityCheck, handleSaveThrow, handleSkillCheck, attackerCannotAct, attackerActionBlocked = attackerCannotAct, handleAttack, handleDamage, handleSaveRoll, handleSpellCast, handleAllyModalOpen, currentAllies, monsterTargetEffects, inspiringMoveNoOA, remarkableNoOA, speedyOpportunityDisadvantage, speedyDifficultTerrainIgnore, getAttackerCreature, campaignName, monsterSpellUses = {}, monsterReactionUses = {}, monsterLegendaryUses = {}, handleGatedReaction, handleLegendaryRow, handleLairRow, handleZoneAuraRow, handleSummonRow, handleSelfBuffRow, handleGrantReactionRow, handleShapeShiftRow, handleZonePickerRow, handleAdvisoryRow, monsterRecharge = {}, creatures = null }) {
  // MA-1014: spells.json name index for the spell_save_dc-only utility-row
  // chip arm (Ice Devil "Ice Wall") — resolved here so every card gets it
  // without threading state through the modal (§158 resolvable-name guard).
  const spellNameIndex = useSpellNameIndex();
  // Pending-trigger OA lane (bug-monster-oa-resolution-auto-missed-by-melee-
  // range-gate): the Reactions-area resolution row naming the mover renders
  // ONLY while the trigger marker is live (hook owns marker read/liveness/
  // stale-eviction/single-press latch) and disappears once consumed or dropped.
  const { pendingOaMover, pendingOaHasMelee, onResolveOpportunityAttack } =
    useMonsterPendingOa({ campaignName, monsterName, monster, creatures, handleAttack });
  const content = useMemo(() => {
    if (!monster) return null;

    const creature = getAttackerCreature();
    const monsterConditions = creature?.conditions || [];
    const condKeys = monsterConditions.map(c => c.key);
    const condEffects = computeConditionEffects({ conditions: condKeys, saveModifiers: [], targetEffects: monsterTargetEffects });
    const condEffectBadges = buildCondEffectBadges(condEffects, {
      inspiringMoveNoOA,
      remarkableNoOA,
      speedyOpportunityDisadvantage,
      speedyDifficultTerrainIgnore,
    });

    // Pending-trigger OA resolution row (bug-monster-oa-resolution-auto-missed-
    // by-melee-range-gate): the token-move trigger armed a marker naming the
    // mover — the ONLY resolution lane a monster had was a generic melee chip
    // gated on the mover's post-move position (guaranteed auto-miss). This row
    // renders in the Reactions area while the marker is live and disappears
    // once consumed or dropped.
    const pendingOaRow = pendingOaMover ? (
      <PendingOpportunityAttackRow mover={pendingOaMover} hasMelee={pendingOaHasMelee} blocked={attackerCannotAct} onResolve={onResolveOpportunityAttack} />
    ) : null;

    const actionSections = [
      { key: 'traits', title: null, actions: monster.traits, blocked: attackerActionBlocked },
      { key: 'actions', title: 'Actions', actions: monster.actions, blocked: attackerActionBlocked },
      { key: 'reactions', title: 'Reactions', actions: monster.reactions, blocked: attackerCannotAct, sectionRow: pendingOaRow },
      { key: 'legendary_actions', title: 'Legendary Actions', actions: monster.legendary_actions, blocked: attackerActionBlocked },
    ].filter(s => s.actions?.length > 0 || s.sectionRow);

    const lairActions = getLairActions(monster);
    const regionalEffects = getRegionalEffects(monster);
    // MA-1451: drained-ability overlay — the ability_score_drain te ledger
    // (te {ability, score, drained}) re-stamps the ability cell + modifier
    // so the card is honest while the drain stands (long-rest restore via
    // the LR te filter; byte-identical cells for every undrained ability).
    const drainedAbilities = {};
    for (const te of monsterTargetEffects || []) {
      if (te.effect === 'ability_score_drain' && Number.isInteger(te.score) && Number.isInteger(te.baseScore)) {
        drainedAbilities[te.ability] = { score: te.score, baseScore: te.baseScore, drained: Number(te.drained) || 0, source: te.source || '' };
      }
    }
    // MA-0021: header row authors `uses` → the section becomes a gated
    // legendary economy (counter + clickable gated rows).
    const legendaryHeader = legendaryHeaderAction(monster);
    const legendaryRemaining = legendaryUsesRemaining(legendaryHeader, monsterLegendaryUses);

    return (
      <div className="mc-card" onClick={(e) => e.stopPropagation()}>
        <MonsterCardHeader monster={monster} monsterName={monsterName} onClose={onClose} />
        <div className="mc-body">
          <MonsterCardStats monster={monster} creatureTempHp={creatureTempHp} shieldOfFaithBonus={shieldOfFaithBonus} condEffects={condEffects} handleInitiative={handleInitiative} />
          {monsterConditions.length > 0 && (
            <MonsterCardConditionsSection monsterConditions={monsterConditions} condEffectBadges={condEffectBadges} />
          )}
          <hr />
          <MonsterCardAbilities monster={monster} handleAbilityCheck={handleAbilityCheck} drainedAbilities={drainedAbilities} />
          <hr />
          <MonsterCardDefenses monster={monster} monsterName={monsterName} campaignName={campaignName} handleSaveThrow={handleSaveThrow} handleSkillCheck={handleSkillCheck} />
          {actionSections.map(s => (
            s.key === 'legendary_actions' && legendaryHeader ? (
              <MonsterActionSection key={s.key} title={s.title} actions={s.actions.slice(1).map(a => stampLegendaryChildRow(monster, a))} attackerCannotAct={s.blocked} handleAttack={handleAttack} handleDamage={handleDamage} handleSaveRoll={handleSaveRoll} handleSpellCast={handleSpellCast} spellUsesUsed={monsterSpellUses} reactionUsesUsed={monsterReactionUses} onGatedReaction={handleGatedReaction} legendaryGate={handleLegendaryRow} rechargeState={monsterRecharge} handleZoneAuraRow={handleZoneAuraRow} handleSummonRow={handleSummonRow} handleSelfBuffRow={handleSelfBuffRow} handleGrantReactionRow={handleGrantReactionRow} handleShapeShiftRow={handleShapeShiftRow} handleZonePickerRow={handleZonePickerRow} handleAdvisoryRow={handleAdvisoryRow} spellNameIndex={spellNameIndex} headerRow={<MonsterLegendaryHeaderRow header={legendaryHeader} remaining={legendaryRemaining} />} sectionRow={s.sectionRow} />
            ) : (
              <MonsterActionSection key={s.key} title={s.title} actions={s.actions} attackerCannotAct={s.blocked} handleAttack={handleAttack} handleDamage={handleDamage} handleSaveRoll={handleSaveRoll} handleSpellCast={handleSpellCast} spellUsesUsed={monsterSpellUses} reactionUsesUsed={monsterReactionUses} onGatedReaction={handleGatedReaction} rechargeState={monsterRecharge} handleZoneAuraRow={handleZoneAuraRow} handleSummonRow={handleSummonRow} handleSelfBuffRow={handleSelfBuffRow} handleGrantReactionRow={handleGrantReactionRow} handleShapeShiftRow={handleShapeShiftRow} handleZonePickerRow={handleZonePickerRow} handleAdvisoryRow={handleAdvisoryRow} spellNameIndex={spellNameIndex} sectionRow={s.sectionRow} />
            )
          ))}
          {lairActions && (
            <MonsterNamedEffectSection title="Lair Actions" items={lairActions} renderItem={(la, i) => <MonsterLairAction key={i} la={la} attackerCannotAct={attackerActionBlocked} handleLairRow={handleLairRow} />} />
          )}
          {regionalEffects && (
            <MonsterNamedEffectSection title="Regional Effects" items={regionalEffects} renderItem={(re, i) => <MonsterRegionalEffect key={i} re={re} />} />
          )}
          <MonsterCardDescription monster={monster} />
          <MonsterCombatStrategy monster={monster} />
        </div>
        <div className="mc-footer no-print">
          {/* CI 2026-11-03 a11y sibling parity: real <button> with the sheet
              trigger (Tab-focusable, Enter/Space actuates, text accessible name). */}
          <button type="button" className="mc-ally-badge clickable" onClick={(e) => { e.stopPropagation(); handleAllyModalOpen(); }} title="Manage allies">
            <i className="fa-solid fa-users" aria-hidden="true"></i> Allies ({currentAllies.length})
          </button>
        </div>
      </div>
    );
  }, [monster, onClose, creatureTempHp, shieldOfFaithBonus, handleInitiative, handleAbilityCheck, handleSaveThrow, handleSkillCheck, attackerCannotAct, attackerActionBlocked, handleAttack, handleDamage, handleSaveRoll, handleSpellCast, handleAllyModalOpen, currentAllies, monsterTargetEffects, inspiringMoveNoOA, remarkableNoOA, speedyOpportunityDisadvantage, speedyDifficultTerrainIgnore, getAttackerCreature, campaignName, monsterName, monsterSpellUses, monsterReactionUses, monsterLegendaryUses, monsterRecharge, spellNameIndex, handleGatedReaction, handleLegendaryRow, handleLairRow, handleZoneAuraRow, handleSummonRow, handleSelfBuffRow, handleGrantReactionRow, handleShapeShiftRow, handleZonePickerRow, handleAdvisoryRow, pendingOaMover, pendingOaHasMelee, onResolveOpportunityAttack]);

  return content;
}

function buildCondEffectBadges(condEffects, { inspiringMoveNoOA, remarkableNoOA, speedyOpportunityDisadvantage, speedyDifficultTerrainIgnore }) {
  const badges = [];
  if (!condEffects) return badges;
  if (condEffects.noAdvantageAgainst) badges.push({ label: 'No Adv vs', cls: 'effect-target-disadv', icon: 'fa-arrow-down' });
  if (condEffects.targetDisadvantageCount > 0 && !condEffects.noAdvantageAgainst) badges.push({ label: 'Disadv vs', cls: 'effect-target-disadv', icon: 'fa-arrow-down' });
  if (condEffects.riderSaveDisadvantage) badges.push({ label: 'Save Disadv', cls: 'effect-disadvantage', icon: 'fa-shield' });
  if (condEffects.riderAttackBonus > 0) badges.push({ label: `+${condEffects.riderAttackBonus} to hit`, cls: 'effect-target-adv', icon: 'fa-bullseye' });
  if (condEffects.riderCannotOpportunityAttack) badges.push({ label: 'No OA', cls: 'effect-cannot-act', icon: 'fa-ban' });
  if (inspiringMoveNoOA) badges.push({ label: 'Insp. Move', cls: 'effect-cannot-act', icon: 'fa-person-walking' });
  if (remarkableNoOA) badges.push({ label: 'No OA (Crit)', cls: 'effect-cannot-act', icon: 'fa-ban' });
  if (speedyOpportunityDisadvantage) badges.push({ label: 'OA Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down' });
  if (speedyDifficultTerrainIgnore) badges.push({ label: 'No Difficult Terrain on Dash', cls: 'effect-cannot-act', icon: 'fa-person-walking' });
  return badges;
}

function getLairActions(monster) {
  if (Array.isArray(monster.lair_actions)) return monster.lair_actions.length > 0 ? monster.lair_actions : null;
  return monster.lair_actions?.actions?.length > 0 ? monster.lair_actions.actions : null;
}

function getRegionalEffects(monster) {
  if (Array.isArray(monster.regional_effects)) return monster.regional_effects.length > 0 ? monster.regional_effects : null;
  return monster.regional_effects?.effects?.length > 0 ? monster.regional_effects.effects : null;
}

function MonsterCardHeader({ monster, monsterName, onClose }) {
  return (
    <div className="mc-header" onClick={onClose}>
      <div className="mc-header-info">
        <div className="mc-name">{monsterName}</div>
        <div className="mc-type-line">
          {monster.size} {monster.type}
          {monster.subtype ? ` (${monster.subtype})` : ''}, {monster.alignment}
        </div>
      </div>
      <button className="mc-close" onClick={onClose} aria-label="Close">&times;</button>
    </div>
  );
}

function MonsterCardStats({ monster, creatureTempHp, shieldOfFaithBonus, condEffects, handleInitiative }) {
  return (
    <div className="mc-stats">
      <div className="mc-stat">
        <span className="mc-stat-label">Armor Class</span>
        <span className="mc-stat-value">{monster.armor_class + shieldOfFaithBonus}{shieldOfFaithBonus > 0 && ' (+' + shieldOfFaithBonus + ' Shield of Faith)'}</span>
      </div>
      <div className="mc-stat">
        <span className="mc-stat-label">Hit Points</span>
        <span className="mc-stat-value">
          {monster.hit_points}{monster.hit_dice ? ` (${monster.hit_dice})` : ''}
        </span>
      </div>
      {creatureTempHp > 0 && (
        <div className="mc-stat">
          <span className="mc-stat-label">Temp HP</span>
          <span className="mc-stat-value mc-stat-temp-hp"><i className="fa-solid fa-shield"></i> {creatureTempHp}</span>
        </div>
      )}
      <div className="mc-stat mc-stat-speed">
        <span className="mc-stat-label">Speed</span>
        <span className={'mc-stat-value' + (condEffects?.speedZero ? ' mc-stat-penalized' : '')}>
          {condEffects?.speedZero ? '0 ft.' : Object.entries(monster.speed || {}).map(([k, v]) => `${k} ${v}`).join(', ')}
        </span>
      </div>
      {monster.initiative_details && (
        <div className="mc-stat">
          <span className="mc-stat-label">Initiative</span>
          <span className="mc-stat-value">
            {(() => {
              const initBonus = parseInitiativeBonus(monster.initiative_details);
              return initBonus != null ? (
                <span className="mc-dice-link" data-kind="initiative" onClick={() => handleInitiative(initBonus)} role="button" tabIndex={0}>
                  {monster.initiative_details}
                </span>
              ) : (
                monster.initiative_details
              );
            })()}
          </span>
        </div>
      )}
    </div>
  );
}

function MonsterCardConditionsSection({ monsterConditions, condEffectBadges }) {
  return (
    <div className="mc-conditions-section">
      <div className="mc-conditions-labels">
        {monsterConditions.map(cond => (
          <span key={cond.id || cond.key} className="mc-condition-label-badge">{cond.label || String(cond)}</span>
        ))}
      </div>
      <div className="mc-conditions-effects">
        {condEffectBadges.map((b, i) => (
          <span key={`${b.label}-${i}`} className={`mc-effect-badge ${b.cls}`} title={EFFECT_DESCRIPTIONS[b.label] || b.label}>
            <i className={`fa-solid ${b.icon}`}></i> {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function MonsterCardAbilities({ monster, handleAbilityCheck, drainedAbilities = {} }) {
  return (
    <div className="mc-abilities">
      {(['str', 'dex', 'con', 'int', 'wis', 'cha']).map(ab => {
        const drained = drainedAbilities[ab];
        const score = drained ? drained.score : (monster.ability_scores?.[ab] ?? '-');
        const mod = drained ? Math.floor((drained.score - 10) / 2) : (monster.ability_score_modifiers?.[ab] ?? null);
        return (
          <div key={ab} className="mc-ability">
            <div className="mc-ability-name">{ab.toUpperCase()}</div>
            <div className={`mc-ability-score${drained ? ' mc-ability-drained' : ''}`} title={drained ? `${ab.toUpperCase()} ${drained.baseScore} \u2212${drained.drained} drained by ${drained.source} \u2014 returns on a long rest` : undefined}>{score}</div>
            <div
              className="mc-ability-mod mc-dice-link"
              data-kind="ability"
              onClick={() => handleAbilityCheck(ab, mod ?? 0)}
              role="button"
              tabIndex={0}
            >
              {mod != null ? (mod >= 0 ? '+' : '') + mod : '-'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonsterActionSection({ title, actions, attackerCannotAct, handleAttack, handleDamage, handleSaveRoll, handleSpellCast, spellUsesUsed, reactionUsesUsed, onGatedReaction, legendaryGate, headerRow, sectionRow, rechargeState = {}, handleZoneAuraRow, handleSummonRow, handleSelfBuffRow, handleGrantReactionRow, handleShapeShiftRow, handleZonePickerRow, handleAdvisoryRow, spellNameIndex = null }) {
  const atk = legendaryGate ? (name, bonus, action) => legendaryGate(action) : handleAttack;
  const dmg = legendaryGate ? (_name, _formula, _type, action) => legendaryGate(action) : handleDamage;
  const save = legendaryGate ? (action) => legendaryGate(action) : handleSaveRoll;
  const cast = legendaryGate ? (action) => legendaryGate(action) : handleSpellCast;
  return (
    <>
      <hr />
      {title && <h5 className="mc-section-title">{title}</h5>}
      <div className="mc-section">
        {headerRow}
        {sectionRow}
        {actions.map((a, i) => (
          <MonsterAction key={i} action={a} index={i} attackerCannotAct={attackerCannotAct} onAttack={atk} onDamage={dmg} onSaveRoll={save} onSpellCast={cast} spellUsesUsed={spellUsesUsed} reactionUsesUsed={reactionUsesUsed} onGatedReaction={onGatedReaction} legendaryGate={legendaryGate} rechargeState={rechargeState} onZoneAuraRow={handleZoneAuraRow} onSummonRow={handleSummonRow} onSelfBuffRow={handleSelfBuffRow} onGrantReactionRow={handleGrantReactionRow} onShapeShiftRow={handleShapeShiftRow} onZonePickerRow={handleZonePickerRow} onAdvisoryRow={handleAdvisoryRow} spellNameIndex={spellNameIndex} />
        ))}
      </div>
    </>
  );
}

// Pending-trigger OA resolution row (bug-monster-oa-resolution-auto-missed-by-
// melee-range-gate). Chip press resolves the melee attack against the MARKED
// MOVER — the marker proves trigger-time adjacency, so the reaction the
// trigger charged is never spent on a click-time range auto-miss. A stat block
// with no melee attack row degrades to an honest advisory note (no automated
// OA to press); the marker still drops by the trigger drop law.
function PendingOpportunityAttackRow({ mover, hasMelee, blocked, onResolve }) {
  const clickable = !blocked && hasMelee && !!onResolve;
  return (
    <div className={`mc-action${blocked ? ' mc-action-disabled' : ''}`}>
      <strong>Opportunity Attack.</strong>{' '}
      {hasMelee ? (
        <span
          className={`mc-dice-link${clickable ? '' : ' mc-dice-link-spell-spent'}`}
          data-kind="oa"
          role="button"
          tabIndex={0}
          onClick={clickable ? onResolve : undefined}
          title={`${mover} left your reach — resolve your melee attack against them now (the attack happens at the instant they provoke).`}
        >
          {/* GC 2026-11-10: label is ONE expression child — a JSX text node
              after the icon carried a leading space into textContent
              (" Opportunity Attack on …"), tripping strict-text harnesses
              (§67 leading-space family). Icon gap stays CSS-owned
              (.mc-dice-link i margin-right), so the raw text is byte-exact. */}
          <i className="fa-solid fa-bolt" />{`Opportunity Attack on ${mover}`}
        </span>
      ) : (
        <span data-kind="oa">Opportunity Attack on {mover}</span>
      )}{' '}
      <span>{mover} left your reach — this reaction attack resolves against them the instant they provoke. {hasMelee ? '' : 'This stat block has no melee attack row — adjudicate the attack manually.'}</span>
    </div>
  );
}

function MonsterNamedEffectSection({ title, items, renderItem }) {
  return (
    <>
      <hr />
      <h5 className="mc-section-title">{title}</h5>
      <div className="mc-section">
        {items.map(renderItem)}
      </div>
    </>
  );
}

// MA-0021: legendary-uses economy header row — "(N left)" counter reads the
// monsterLegendaryUses runtime map (max from the header row's authored uses).
function MonsterLegendaryHeaderRow({ header, remaining }) {
  const spent = remaining === 0;
  return (
    <div className={`mc-action mc-legendary-header-row${spent ? ' mc-dice-link-spell-spent' : ''}`} title="Legendary action uses — regain at the start of this creature's turn">
      <strong>{header.name}</strong>{' '}
      <span className="mc-legendary-counter">({remaining ?? header.uses} left)</span>{' '}
      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(header.description) }} />
    </div>
  );
}

function MonsterCardDescription({ monster }) {
  if (!monster.desc) return null;
  return (
    <>
      <hr />
      <div className="mc-section">
        <h5 className="mc-section-title">Description</h5>
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(monster.desc) }} />
        {monster.book && (
          <div className="mc-source"><em>{monster.book}{monster.page ? ` (page ${monster.page})` : ''}</em></div>
        )}
      </div>
    </>
  );
}

function MonsterCombatStrategy({ monster }) {
  const strategy = monster['combat-strategy'];
  if (!strategy) return null;
  return (
    <>
      <hr />
      <div className="mc-section mc-combat-strategy">
        <h5 className="mc-section-title"><i className="fa-solid fa-chess"></i> Combat Strategy</h5>
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(strategy) }} />
      </div>
    </>
  );
}

function DefenseTextRow({ label, value }) {
  return (
    <div className="mc-defense-row">
      <span className="mc-defense-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// A11y/automation anchor (EO 2026-11-08 backlog): `kind` stamps data-kind on
// each clickable chip so `[data-kind="save"]`/`"skill"` queries anchor exactly
// the right row's chips (the shared .mc-dice-link class made index-presses
// ambiguous). Purely additive — class and click behavior byte-unchanged.
function DefenseModifierRow({ label, entries, kind, labelFor, onSelect }) {
  return (
    <div className="mc-defense-row">
      <span className="mc-defense-label">{label}</span>
      <span>
        {Object.entries(entries).map(([name, s], idx) => (
          <span key={name}>
            {idx > 0 && ', '}
            <span className="mc-dice-link" data-kind={kind} onClick={() => onSelect(name, s.modifier)} role="button" tabIndex={0}>
              {labelFor ? labelFor(name) : name} {s.modifier >= 0 ? '+' : ''}{s.modifier}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

function formatLanguages(languages) {
  return Array.isArray(languages) ? languages.join(', ') : languages;
}

function MonsterDamageTraits({ irv }) {
  return (
    <>
      {hasEntries(irv.vulnerabilities) && <DefenseTextRow label="Damage Vuln." value={irv.vulnerabilities.join(', ')} />}
      {hasEntries(irv.resistances) && <DefenseTextRow label="Damage Resist." value={irv.resistances.join(', ')} />}
      {hasEntries(irv.immunities) && <DefenseTextRow label="Damage Imm" value={irv.immunities.join(', ')} />}
      {hasEntries(irv.conditionImmunities) && <DefenseTextRow label="Condition Imm" value={irv.conditionImmunities.join(', ')} />}
    </>
  );
}

function MonsterCardDefenses({ monster, monsterName, campaignName, handleSaveThrow, handleSkillCheck }) {
  const currentCs = getCombatSummary(campaignName);
  const summaryCreature = currentCs?.creatures?.find(c => c.name === monsterName);
  const irv = resolveMonsterIRV(monster);
  const saves = summaryCreature?.saving_throws && hasEntries(summaryCreature.saving_throws)
    ? summaryCreature.saving_throws
    : monster.saving_throws;

  return (
    <div className="mc-defenses">
      {hasEntries(saves) && <DefenseModifierRow label="Saving Throws" entries={saves} kind="save" labelFor={saveAbilityAbbr} onSelect={handleSaveThrow} />}
      {hasEntries(monster.skills) && <DefenseModifierRow label="Skills" entries={monster.skills} kind="skill" onSelect={handleSkillCheck} />}
      {hasSenseEntries(monster.senses) && <DefenseTextRow label="Senses" value={formatSenses(monster.senses)} />}
      {monster.languages && <DefenseTextRow label="Languages" value={formatLanguages(monster.languages)} />}
      <MonsterDamageTraits irv={irv} />
      <div className="mc-defense-row mc-defense-cr">
        <span className="mc-defense-label">CR</span>
        <span>{monster.challenge_rating} ({monster.xp?.toLocaleString()} XP)</span>
      </div>
      {monster.legendary_resistance != null && <DefenseTextRow label="Legendary Resist." value={`${monster.legendary_resistance}/day`} />}
    </div>
  );
}

// MA-0024: legacy plain-string rows (and nameless dicts, MV-24) keep the
// static render untouched (~600 monsters regression-protected). Structured
// rows with an authored mechanic route through the SAME gated affordance as
// legendary rows — one click = one adjudicated effect (save prompt at the
// authored DC/type, damage chip, or CLA-325 advisory record).
function MonsterLairAction({ la, attackerCannotAct, handleLairRow }) {
  if (typeof la === 'string' || !isLairRowClickable(la)) {
    return (
      <div className="mc-action">
        {typeof la === 'string' ? (
          <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(la) }} />
        ) : (
          <>
            {la.name ? <><strong>{la.name}.</strong>{' '}</> : null}
            <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(la.description) }} />
          </>
        )}
      </div>
    );
  }
  const affordance = lairRowAffordance(la);
  const label = affordance === 'save'
    ? `DC ${la.save_dc} ${la.save_type || ''}`.trim()
    : affordance === 'damage' ? la.damage_dice_primary : la.name;
  const clickable = !attackerCannotAct && !!handleLairRow;
  return (
    <div className={`mc-action${attackerCannotAct ? ' mc-action-disabled' : ''}`}>
      <strong>{la.name}.</strong>{' '}
      <span
        className={`mc-dice-link mc-dice-link-lair${clickable ? '' : ' mc-dice-link-spell-spent'}`}
        data-kind="lair"
        onClick={clickable ? () => handleLairRow(la) : undefined}
        role="button"
        tabIndex={0}
        title={`Lair action — ${label}. Chosen on initiative 20, GM-enforced.`}
      >
        <i className="fa-solid fa-hurricane" /> {label}
      </span>{' '}
      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(la.description) }} />
    </div>
  );
}

function MonsterRegionalEffect({ re }) {
  return (
    <div className="mc-action">
      {typeof re === 'string' ? (
        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(re) }} />
      ) : (
        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(re.description) }} />
      )}
    </div>
  );
}
