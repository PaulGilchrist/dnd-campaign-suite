import { useMemo, useCallback } from 'react';
import { sanitizeHtml } from '../../services/sanitize.js';
import { rollExpression, rollExpressionDoubled } from '../../services/diceRoller.js';
import useLoggedDiceRoll from '../../hooks/useLoggedDiceRoll.js';
import Popup from '../common/Popup.jsx';
import DiceRollResult from '../char-sheet/DiceRollResult.jsx';
import { extractDamageTypes, formatDamageTypes, getTargetFromAttacker, getResistanceNotice } from '../../services/damageUtils.js';
import { getCombatContext } from '../../services/damageUtils.js';
import { findCreatureByName } from '../../services/damageUtils.js';
import { computeConditionEffects, combineAttackModes, CONDITIONS_THAT_CANNOT_ACT } from '../../services/conditionEffects.js';
import './MonsterCardModal.css';

const ABBR_MAP = { Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha', str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha' };

function toAbbr(name) {
  return ABBR_MAP[name] || name?.substring(0, 3).toLowerCase();
}

function MonsterCardModal({ monster, onClose, campaignName, creatures }) {
  const monsterName = monster?.name || 'Monster';
  const { popupHtml, setPopupHtml, rollAttack, rollDamage, rollAbilityCheck, rollSavingThrow, rollSkillCheck, rollInitiative, quickRollPlayerSave } = useLoggedDiceRoll(
    monsterName,
    campaignName,
    {
      autoDamageRoll: (autoDamage, isCrit) => {
        const result = isCrit ? rollExpressionDoubled(autoDamage.formula) : rollExpression(autoDamage.formula);
        if (result) {
          const context = {
            damageType: autoDamage.damageType,
            targetId: autoDamage.targetId,
            targetName: autoDamage.targetName,
            attackerName: autoDamage.attackerName,
          };
          if (autoDamage.saveDc) {
            context.saveDc = autoDamage.saveDc;
            context.saveType = autoDamage.saveType;
            context.dcSuccess = autoDamage.dcSuccess;
          }
          rollDamage(autoDamage.name, autoDamage.formula, result.total, result.rolls, result.modifier, context);
        }
      },
    }
  );

  const getAttackerCreature = useCallback(() => {
    if (creatures) {
      return findCreatureByName({ creatures }, monsterName);
    }
    const cs = getCombatContext();
    return cs ? findCreatureByName(cs, monsterName) : null;
  }, [creatures, monsterName]);

  const getCombatTarget = useCallback(() => {
    if (!creatures) {
      const cs = getCombatContext();
      return cs ? getTargetFromAttacker(cs, monsterName) : null;
    }
    const attacker = findCreatureByName({ creatures }, monsterName);
    if (!attacker || !attacker.targetId) return null;
    return creatures.find(c => c.id === attacker.targetId) || null;
  }, [creatures, monsterName]);

  const getDamageTypesForAction = useCallback((action) => {
    const types = [];
    if (action.damage_dice) {
      types.push(...extractDamageTypes(action.description));
    }
    return types;
  }, []);

  const handleAttack = (name, bonus, action) => {
    const target = getCombatTarget();
    const damageTypes = action ? getDamageTypesForAction(action) : [];
    const resistanceNotice = target ? getResistanceNotice(damageTypes, target.resistances, target.immunities, target.name) : null;

    const attacker = getAttackerCreature();
    const attackerConditions = (attacker?.conditions || []).map(c => c.key)
    const targetConditions = (target?.conditions || []).map(c => c.key)

    const attackerEffects = computeConditionEffects(attackerConditions)
    const attackerCannotAct = attackerConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c))
    if (attackerCannotAct) return

    const targetEffects = computeConditionEffects(targetConditions)

    const attackRange = action?.range?.type === 'reach' || action?.range?.type === 'melee' ? 5 : 30
    const forcedMode = combineAttackModes(attackerEffects, targetEffects, attackRange)

    const isMelee = attackRange <= 5
    const isAutoCrit = isMelee && targetEffects.autoCritWithin5ft

    rollAttack(name, bonus, {
      damageType: formatDamageTypes(damageTypes),
      resistanceNotice,
      forcedMode: forcedMode !== 'normal' ? forcedMode : undefined,
      isAutoCrit,
      autoDamageFormula: action?.damage_dice || null,
      autoDamageName: name,
      targetId: target?.id,
      targetName: target?.name,
      attackerName: monsterName,
      saveDc: action?.save_dc || null,
      saveType: action?.save_type ? toAbbr(action.save_type) : null,
      dcSuccess: action?.save_dc != null ? 'half' : null,
    });
  };

  const handleDamage = (name, formula, damageType, action) => {
    const target = getCombatTarget();
    const wasCrit = popupHtml?.isCrit;
    if (wasCrit && setPopupHtml) setPopupHtml(null);
    const result = wasCrit ? rollExpressionDoubled(formula) : rollExpression(formula);
    if (result) {
      const context = {
        damageType,
        targetName: target?.name,
        targetId: target?.id,
        attackerName: monsterName,
      };
      if (action?.save_dc != null) {
        context.saveDc = action.save_dc;
        context.saveType = toAbbr(action.save_type);
        context.dcSuccess = 'half';
      }
      rollDamage(name, formula, result.total, result.rolls, result.modifier, context);
    }
  };

  const handleAbilityCheck = (abbr, mod) => {
    const fullName = abilityNameMap[abbr] || abbr.toUpperCase();
    rollAbilityCheck(fullName, mod);
  };

  const handleSaveThrow = (ability, mod) => rollSavingThrow(saveAbilityAbbr(ability), mod);

  const handleSkillCheck = (name, mod) => rollSkillCheck(name, mod);

  const handleInitiative = (bonus) => rollInitiative(bonus);

  const renderAction = (action, i) => {
    const target = getCombatTarget();
    const damageTypes = getDamageTypesForAction(action);

    return (
    <div key={i} className={`mc-action ${attackerCannotAct ? 'mc-action-disabled' : ''}`}>
      <strong>{action.name}.</strong>{' '}
      {attackerCannotAct && <span className="mc-incapacitated-label">(Incapacitated)</span>}
      {action.attack_bonus != null && !attackerCannotAct && (
        <span className="mc-dice-link" onClick={() => handleAttack(action.name, action.attack_bonus, action)} role="button" tabIndex={0}>
          <i className="fa-solid fa-dice-d20" /> +{action.attack_bonus}
        </span>
      )}
      {action.damage_dice && (
        <span className="mc-dice-link" onClick={() => handleDamage(action.name, action.damage_dice, formatDamageTypes(damageTypes), action)} role="button" tabIndex={0}>
          <i className="fa-solid fa-dice" /> {action.damage_dice}
        </span>
      )}
      {parseExtraDamageDice(action.damage, action.damage_dice).map((formula, idx) => (
        <span key={idx} className="mc-dice-link" onClick={() => handleDamage(action.name, formula, formatDamageTypes(damageTypes), action)} role="button" tabIndex={0}>
          <i className="fa-solid fa-dice" /> {formula}
        </span>
      ))}
      {action.save_dc != null && (
        <span className="mc-dice-link mc-dice-link-save">
          DC {action.save_dc} {action.save_type}
        </span>
      )}
      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.description) }} />
      {action.usage && <em> ({action.usage})</em>}
      {action.recharge && <em> ({action.recharge})</em>}
    </div>
  );
  };

  const attackerCannotAct = useMemo(() => {
    const creature = getAttackerCreature();
    if (!creature) return false;
    return (creature.conditions || []).some(c => CONDITIONS_THAT_CANNOT_ACT.has(c.key));
  }, [getAttackerCreature]);

  const content = useMemo(() => {
    if (!monster) return null;

    const creature = getAttackerCreature();
    const monsterConditions = creature?.conditions || [];
    const condKeys = monsterConditions.map(c => c.key);
    const condEffects = condKeys.length > 0 ? computeConditionEffects(condKeys) : null;
    const condEffectBadges = [];
    if (condEffects) {
      if (condEffects.cannotAct) condEffectBadges.push({ label: "Can't Act", cls: 'effect-cannot-act', icon: 'fa-hand' });
      if (condEffects.speedZero) condEffectBadges.push({ label: 'Speed 0', cls: 'effect-speed-zero', icon: 'fa-stop' });
      if (condEffects.autoCritWithin5ft) condEffectBadges.push({ label: 'Auto-Crit', cls: 'effect-auto-crit', icon: 'fa-bolt' });
      if (condEffects.concentrationBroken) condEffectBadges.push({ label: 'No Conc.', cls: 'effect-no-conc', icon: 'fa-spinner' });
      if (condEffects.autoFailSaves.length > 0) condEffectBadges.push({ label: `Auto-Fail ${condEffects.autoFailSaves.join('/').toUpperCase()}`, cls: 'effect-auto-fail', icon: 'fa-shield' });
      if (condEffects.resistantToAll) condEffectBadges.push({ label: 'Resist All', cls: 'effect-resist', icon: 'fa-shield-halved' });
      if (condEffects.attackDisadvantageCount > 0 || condEffects.abilityCheckDisadvantage) condEffectBadges.push({ label: 'Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down' });
      if (condEffects.targetAdvantageCount > 0) condEffectBadges.push({ label: 'Adv vs', cls: 'effect-target-adv', icon: 'fa-arrow-up' });
    }

    return (
      <div className="mc-card" onClick={(e) => e.stopPropagation()}>
        <div className="mc-header" onClick={onClose}>
          <div className="mc-header-info">
            <div className="mc-name">{monster.name}</div>
            <div className="mc-type-line">
              {monster.size} {monster.type}
              {monster.subtype ? ` (${monster.subtype})` : ''}, {monster.alignment}
            </div>
          </div>
          <button className="mc-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="mc-body">
          <div className="mc-stats">
            <div className="mc-stat">
              <span className="mc-stat-label">Armor Class</span>
              <span className="mc-stat-value">{monster.armor_class}</span>
            </div>
            <div className="mc-stat">
              <span className="mc-stat-label">Hit Points</span>
              <span className="mc-stat-value">
                {monster.hit_points}{monster.hit_dice ? ` (${monster.hit_dice})` : ''}
              </span>
            </div>
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

          {monsterConditions.length > 0 && (
            <div className="mc-conditions-section">
              <div className="mc-conditions-labels">
                {monsterConditions.map(cond => (
                  <span key={cond.id || cond.key} className="mc-condition-label-badge">{cond.label}</span>
                ))}
              </div>
              <div className="mc-conditions-effects">
                {condEffectBadges.map(b => (
                  <span key={b.label} className={`mc-effect-badge ${b.cls}`}>
                    <i className={`fa-solid ${b.icon}`}></i> {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <hr />

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

          <hr />

          <div className="mc-defenses">
            {hasEntries(monster.saving_throws) && (
              <div className="mc-defense-row">
                <span className="mc-defense-label">Saving Throws</span>
                <span>
                  {Object.entries(monster.saving_throws).map(([ab, s], idx) => (
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
                <span>{monster.languages}</span>
              </div>
            )}
            {hasEntries(monster.damage_vulnerabilities) && (
              <div className="mc-defense-row">
                <span className="mc-defense-label">Damage Vuln.</span>
                <span>{monster.damage_vulnerabilities.join(', ')}</span>
              </div>
            )}
            {hasEntries(monster.damage_resistances) && (
              <div className="mc-defense-row">
                <span className="mc-defense-label">Damage Resist.</span>
                <span>{monster.damage_resistances.join(', ')}</span>
              </div>
            )}
            {hasEntries(monster.damage_immunities) && (
              <div className="mc-defense-row">
                <span className="mc-defense-label">Damage Imm</span>
                <span>{monster.damage_immunities.join(', ')}</span>
              </div>
            )}
            {hasEntries(monster.condition_immunities) && (
              <div className="mc-defense-row">
                <span className="mc-defense-label">Condition Imm</span>
                <span>{monster.condition_immunities.join(', ')}</span>
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

          {monster.traits?.length > 0 && (
            <>
              <hr />
              <div className="mc-section">
                {monster.traits.map((t, i) => (
                  renderAction(t, i)
                ))}
              </div>
            </>
          )}

          {monster.actions?.length > 0 && (
            <>
              <hr />
              <h5 className="mc-section-title">Actions</h5>
              <div className="mc-section">
                {monster.actions.map((a, i) => (
                  renderAction(a, i)
                ))}
              </div>
            </>
          )}

          {monster.reactions?.length > 0 && (
            <>
              <hr />
              <h5 className="mc-section-title">Reactions</h5>
              <div className="mc-section">
                {monster.reactions.map((r, i) => (
                  renderAction(r, i)
                ))}
              </div>
            </>
          )}

          {monster.legendary_actions?.length > 0 && (
            <>
              <hr />
              <h5 className="mc-section-title">Legendary Actions</h5>
              <div className="mc-section">
                {monster.legendary_actions.map((la, i) => (
                  renderAction(la, i)
                ))}
              </div>
            </>
          )}

          {(Array.isArray(monster.lair_actions) ? monster.lair_actions.length > 0 : monster.lair_actions?.actions?.length > 0) && (
            <>
              <hr />
              <h5 className="mc-section-title">Lair Actions</h5>
              <div className="mc-section">
                {(Array.isArray(monster.lair_actions) ? monster.lair_actions : monster.lair_actions.actions).map((la, i) => (
                  <div key={i} className="mc-action">
                    {typeof la === 'string' ? (
                      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(la) }} />
                    ) : (
                      <>
                        <strong>{la.name}.</strong>{' '}
                        <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(la.description) }} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {(monster.regional_effects?.effects?.length > 0 || (Array.isArray(monster.regional_effects) && monster.regional_effects.length > 0)) && (
            <>
              <hr />
              <h5 className="mc-section-title">Regional Effects</h5>
              <div className="mc-section">
                {(Array.isArray(monster.regional_effects) ? monster.regional_effects : monster.regional_effects.effects).map((re, i) => (
                  <div key={i} className="mc-action">
                    {typeof re === 'string' ? (
                      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(re) }} />
                    ) : (
                      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(re.description) }} />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {monster.desc && (
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
          )}
        </div>
      </div>
    );
      }, [monster, onClose, handleAttack, handleDamage, handleAbilityCheck, handleSaveThrow, handleSkillCheck, handleInitiative, attackerCannotAct]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!monster) return null;

  return (
    <div className="mc-overlay" onClick={onClose}>
      {content}
      {popupHtml && (
        <div onClick={(e) => e.stopPropagation()}>
          <Popup onClickOrKeyDown={() => setPopupHtml(null)}>
            {typeof popupHtml === 'string'
              ? <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(popupHtml) }} />
              : <DiceRollResult {...popupHtml} onQuickRoll={popupHtml.waitingForPlayerSave ? () => quickRollPlayerSave(popupHtml.promptId, popupHtml.targetName, popupHtml.saveType, popupHtml.saveDc) : undefined} />}
          </Popup>
        </div>
      )}
    </div>
  );
}

function hasEntries(obj) {
  return obj && Object.keys(obj).length > 0;
}

function hasSenseEntries(senses) {
  if (!senses) return false;
  return senses.blindsight || senses.darkvision || senses.truesight || senses.tremorsense || senses.passive_perception;
}

function saveAbilityAbbr(full) {
  const map = { Strength: 'STR', Dexterity: 'DEX', Constitution: 'CON', Intelligence: 'INT', Wisdom: 'WIS', Charisma: 'CHA' };
  return map[full] || full?.substring(0, 3).toUpperCase();
}

const abilityNameMap = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

function parseInitiativeBonus(initStr) {
  if (!initStr) return null;
  const match = initStr.match(/^([+-]\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function parseExtraDamageDice(damageStr, excludeFormula) {
  if (!damageStr) return [];
  const re = /(\d+d\d+(?:\s*\+\s*\d+)?)/g;
  const matches = [];
  let m;
  const exclude = (excludeFormula || '').replace(/\s+/g, '');
  while ((m = re.exec(damageStr)) !== null) {
    const formula = m[1].trim();
    if (formula.replace(/\s+/g, '') !== exclude) {
      matches.push(formula);
    }
  }
  return matches;
}

function formatSenses(senses) {
  const parts = [];
  if (senses.blindsight) parts.push(`blindsight ${senses.blindsight}`);
  if (senses.darkvision) parts.push(`darkvision ${senses.darkvision}`);
  if (senses.truesight) parts.push(`truesight ${senses.truesight}`);
  if (senses.tremorsense) parts.push(`tremorsense ${senses.tremorsense}`);
  if (senses.passive_perception) parts.push(`passive Perception ${senses.passive_perception}`);
  return parts.join(', ');
}

export default MonsterCardModal;
