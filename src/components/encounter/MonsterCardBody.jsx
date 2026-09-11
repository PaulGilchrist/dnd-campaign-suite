import { useMemo } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';
import { resolveMonsterIRV } from '../../services/npcs/monsterIrvUtils.js';
import { EFFECT_DESCRIPTIONS } from '../../services/combat/conditions/effectDescriptions.js';
import { MonsterAction } from './MonsterAction.jsx';
import { hasEntries, hasSenseEntries, saveAbilityAbbr, parseInitiativeBonus, formatSenses } from './MonsterCardHelpers.js';

export function MonsterCardBody({ monster, monsterName, onClose, creatureTempHp, shieldOfFaithBonus, handleInitiative, handleAbilityCheck, handleSaveThrow, handleSkillCheck, attackerCannotAct, attackerActionBlocked = attackerCannotAct, handleAttack, handleDamage, handleSaveRoll, handleAllyModalOpen, currentAllies, monsterTargetEffects, inspiringMoveNoOA, remarkableNoOA, speedyOpportunityDisadvantage, speedyDifficultTerrainIgnore, getAttackerCreature, campaignName }) {
  const content = useMemo(() => {
    if (!monster) return null;

    const creature = getAttackerCreature();
    const monsterConditions = creature?.conditions || [];
    const condKeys = monsterConditions.map(c => c.key);
    const condEffects = computeConditionEffects(condKeys, [], monsterTargetEffects, false, false, false, false, null, false, null, false, false, false, false, false, false, false);
    const condEffectBadges = buildCondEffectBadges(condEffects, {
      inspiringMoveNoOA,
      remarkableNoOA,
      speedyOpportunityDisadvantage,
      speedyDifficultTerrainIgnore,
    });

    const actionSections = [
      { key: 'traits', title: null, actions: monster.traits, blocked: attackerActionBlocked },
      { key: 'actions', title: 'Actions', actions: monster.actions, blocked: attackerActionBlocked },
      { key: 'reactions', title: 'Reactions', actions: monster.reactions, blocked: attackerCannotAct },
      { key: 'legendary_actions', title: 'Legendary Actions', actions: monster.legendary_actions, blocked: attackerActionBlocked },
    ].filter(s => s.actions?.length > 0);

    const lairActions = getLairActions(monster);
    const regionalEffects = getRegionalEffects(monster);

    return (
      <div className="mc-card" onClick={(e) => e.stopPropagation()}>
        <MonsterCardHeader monster={monster} monsterName={monsterName} onClose={onClose} />
        <div className="mc-body">
          <MonsterCardStats monster={monster} creatureTempHp={creatureTempHp} shieldOfFaithBonus={shieldOfFaithBonus} condEffects={condEffects} handleInitiative={handleInitiative} />
          {monsterConditions.length > 0 && (
            <MonsterCardConditionsSection monsterConditions={monsterConditions} condEffectBadges={condEffectBadges} />
          )}
          <hr />
          <MonsterCardAbilities monster={monster} handleAbilityCheck={handleAbilityCheck} />
          <hr />
          <MonsterCardDefenses monster={monster} monsterName={monsterName} campaignName={campaignName} handleSaveThrow={handleSaveThrow} handleSkillCheck={handleSkillCheck} />
          {actionSections.map(s => (
            <MonsterActionSection key={s.key} title={s.title} actions={s.actions} attackerCannotAct={s.blocked} handleAttack={handleAttack} handleDamage={handleDamage} handleSaveRoll={handleSaveRoll} />
          ))}
          {lairActions && (
            <MonsterNamedEffectSection title="Lair Actions" items={lairActions} renderItem={(la, i) => <MonsterLairAction key={i} la={la} />} />
          )}
          {regionalEffects && (
            <MonsterNamedEffectSection title="Regional Effects" items={regionalEffects} renderItem={(re, i) => <MonsterRegionalEffect key={i} re={re} />} />
          )}
          <MonsterCardDescription monster={monster} />
        </div>
        <div className="mc-footer no-print">
          <span className="mc-ally-badge clickable" onClick={(e) => { e.stopPropagation(); handleAllyModalOpen(); }} title="Manage allies">
            <i className="fa-solid fa-users"></i> Allies ({currentAllies.length})
          </span>
        </div>
      </div>
    );
  }, [monster, onClose, creatureTempHp, shieldOfFaithBonus, handleInitiative, handleAbilityCheck, handleSaveThrow, handleSkillCheck, attackerCannotAct, attackerActionBlocked, handleAttack, handleDamage, handleSaveRoll, handleAllyModalOpen, currentAllies, monsterTargetEffects, inspiringMoveNoOA, remarkableNoOA, speedyOpportunityDisadvantage, speedyDifficultTerrainIgnore, getAttackerCreature, campaignName, monsterName]);

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
                <span className="mc-dice-link" onClick={() => handleInitiative(initBonus)} role="button" tabIndex={0}>
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

function MonsterCardAbilities({ monster, handleAbilityCheck }) {
  return (
    <div className="mc-abilities">
      {(['str', 'dex', 'con', 'int', 'wis', 'cha']).map(ab => (
        <div key={ab} className="mc-ability">
          <div className="mc-ability-name">{ab.toUpperCase()}</div>
          <div className="mc-ability-score">{monster.ability_scores?.[ab] ?? '-'}</div>
          <div
            className="mc-ability-mod mc-dice-link"
            onClick={() => handleAbilityCheck(ab, monster.ability_score_modifiers?.[ab] ?? 0)}
            role="button"
            tabIndex={0}
          >
            {monster.ability_score_modifiers?.[ab] != null
              ? (monster.ability_score_modifiers[ab] >= 0 ? '+' : '') + monster.ability_score_modifiers[ab]
              : '-'}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonsterActionSection({ title, actions, attackerCannotAct, handleAttack, handleDamage, handleSaveRoll }) {
  return (
    <>
      <hr />
      {title && <h5 className="mc-section-title">{title}</h5>}
      <div className="mc-section">
        {actions.map((a, i) => (
          <MonsterAction key={i} action={a} index={i} attackerCannotAct={attackerCannotAct} onAttack={handleAttack} onDamage={handleDamage} onSaveRoll={handleSaveRoll} />
        ))}
      </div>
    </>
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

function MonsterCardDefenses({ monster, monsterName, campaignName, handleSaveThrow, handleSkillCheck }) {
  const currentCs = getCombatSummary(campaignName);
  const summaryCreature = currentCs?.creatures?.find(c => c.name === monsterName);
  const irv = resolveMonsterIRV(monster);
  const saves = summaryCreature?.saving_throws && hasEntries(summaryCreature.saving_throws)
    ? summaryCreature.saving_throws
    : monster.saving_throws;

  return (
    <div className="mc-defenses">
      {hasEntries(saves) && (
        <div className="mc-defense-row">
          <span className="mc-defense-label">Saving Throws</span>
          <span>
            {Object.entries(saves).map(([ab, s], idx) => (
              <span key={ab}>
                {idx > 0 && ', '}
                <span className="mc-dice-link" onClick={() => handleSaveThrow(ab, s.modifier)} role="button" tabIndex={0}>
                  {saveAbilityAbbr(ab)} {s.modifier >= 0 ? '+' : ''}{s.modifier}
                </span>
              </span>
            ))}
          </span>
        </div>
      )}
      {hasEntries(monster.skills) && (
        <div className="mc-defense-row">
          <span className="mc-defense-label">Skills</span>
          <span>
            {Object.entries(monster.skills).map(([name, s], idx) => (
              <span key={name}>
                {idx > 0 && ', '}
                <span className="mc-dice-link" onClick={() => handleSkillCheck(name, s.modifier)} role="button" tabIndex={0}>
                  {name} {s.modifier >= 0 ? '+' : ''}{s.modifier}
                </span>
              </span>
            ))}
          </span>
        </div>
      )}
      {hasSenseEntries(monster.senses) && (
        <div className="mc-defense-row">
          <span className="mc-defense-label">Senses</span>
          <span>{formatSenses(monster.senses)}</span>
        </div>
      )}
      {monster.languages && (
        <div className="mc-defense-row">
          <span className="mc-defense-label">Languages</span>
          <span>{Array.isArray(monster.languages) ? monster.languages.join(', ') : monster.languages}</span>
        </div>
      )}
      {hasEntries(irv.vulnerabilities) && (
        <div className="mc-defense-row">
          <span className="mc-defense-label">Damage Vuln.</span>
          <span>{irv.vulnerabilities.join(', ')}</span>
        </div>
      )}
      {hasEntries(irv.resistances) && (
        <div className="mc-defense-row">
          <span className="mc-defense-label">Damage Resist.</span>
          <span>{irv.resistances.join(', ')}</span>
        </div>
      )}
      {hasEntries(irv.immunities) && (
        <div className="mc-defense-row">
          <span className="mc-defense-label">Damage Imm</span>
          <span>{irv.immunities.join(', ')}</span>
        </div>
      )}
      {hasEntries(irv.conditionImmunities) && (
        <div className="mc-defense-row">
          <span className="mc-defense-label">Condition Imm</span>
          <span>{irv.conditionImmunities.join(', ')}</span>
        </div>
      )}
      <div className="mc-defense-row mc-defense-cr">
        <span className="mc-defense-label">CR</span>
        <span>{monster.challenge_rating} ({monster.xp?.toLocaleString()} XP)</span>
      </div>
      {monster.legendary_resistance != null && (
        <div className="mc-defense-row">
          <span className="mc-defense-label">Legendary Resist.</span>
          <span>{monster.legendary_resistance}/day</span>
        </div>
      )}
    </div>
  );
}

function MonsterLairAction({ la }) {
  return (
    <div className="mc-action">
      {typeof la === 'string' ? (
        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(la) }} />
      ) : (
        <>
          <strong>{la.name}.</strong>{' '}
          <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(la.description) }} />
        </>
      )}
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
