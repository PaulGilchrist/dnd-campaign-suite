import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import Popup from '../common/Popup.jsx';
import DiceRollResult from '../char-sheet/DiceRollResult.jsx';
import { extractDamageTypes, formatDamageTypes, getTargetFromAttacker, getResistanceNotice } from '../../services/rules/combat/damageUtils.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { findCreatureByName } from '../../services/rules/combat/damageUtils.js';
import { computeConditionEffects, combineAttackModes, CONDITIONS_THAT_CANNOT_ACT } from '../../services/combat/conditions/conditionEffects.js';
import { computeRangeEffect, getDistanceFeet, getNearestPlacedItem, rangeToFeet } from '../../services/rules/combat/rangeValidation.js';
import * as mapsService from '../../services/maps/mapsService.js';
import { useRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import './MonsterCardModal.css';

const ABBR_MAP = { Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha', str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha' };

function toAbbr(name) {
  return ABBR_MAP[name] || name?.substring(0, 3).toLowerCase();
}

function MonsterCardModal({ monster, onClose, campaignName, creatures, creatureName, mapName, characters }) {
  const monsterName = creatureName || monster?.name || 'Monster';
  const fallbackCsRef = useRef(null);
  const [mapData, setMapData] = useState(null);

  useEffect(() => {
    if (creatures) return;
    getCombatContext(campaignName).then(cs => {
      if (cs) fallbackCsRef.current = cs;
    });
  }, [creatures, campaignName]);

  useEffect(() => {
    if (!mapName) {
      setMapData(null);
      return;
    }
    mapsService.loadMapData(campaignName, mapName).then(data => {
      setMapData(data);
    }).catch(() => {
      setMapData(null);
    });
  }, [campaignName, mapName]);

  const allTargetEffects = useRuntimeValue(campaignName, 'targetEffects') ?? [];
  const monsterTargetEffects = allTargetEffects.filter(te => te.target === (creatureName || monster?.name));
  const inspiringMoveNoOA = useRuntimeValue(monsterName, 'inspiringMovementNoOA', campaignName);
  const remarkableNoOA = useRuntimeValue(monsterName, 'remarkableAthleteNoOA', campaignName);
  const monsterCharacter = characters?.find(c => c.name === monsterName);
  const speedyOpportunityDisadvantage = monsterCharacter?.computedStats?.automation?.passives?.some(p => p.type === 'passive_rule' && p.effect === 'opportunity_attacks_disadvantage');
  const speedyDifficultTerrainIgnore = monsterCharacter?.computedStats?.automation?.passives?.some(p => p.type === 'passive_rule' && p.effect === 'ignore_difficult_terrain_on_dash');

  const { popupHtml, setPopupHtml, rollAttack, rollDamage, rollAbilityCheck, rollSavingThrow, rollSkillCheck, rollInitiative, quickRollPlayerSave } = useLoggedDiceRoll(
    monsterName,
    campaignName,
    {
      autoDamageRoll: (autoDamage, isCrit) => {
        const result = isCrit ? rollExpressionDoubled(autoDamage.formula) : rollExpression(autoDamage.formula);
        if (result) {
         const context = {
             damageType: autoDamage.damageType,
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
      characters,
    }
  );

  const getAttackerCreature = useCallback(() => {
    if (creatures) {
      return findCreatureByName({ creatures }, monsterName);
    }
    const cs = fallbackCsRef.current;
    return cs ? findCreatureByName(cs, monsterName) : null;
  }, [creatures, monsterName]);

  const getTarget = useCallback(() => {
    if (!creatures) {
      const cs = fallbackCsRef.current;
      return cs ? getTargetFromAttacker(cs, monsterName) : null;
    }
    const attacker = findCreatureByName({ creatures }, monsterName);
    if (!attacker || !attacker.targetName) return null;
    return creatures.find(c => c.name === attacker.targetName) || null;
  }, [creatures, monsterName]);

  const getDamageTypesForAction = useCallback((action) => {
    const types = [];
    if (action.damage_dice) {
      types.push(...extractDamageTypes(action.description));
    }
    return types;
  }, []);

  const handleAttack = (name, bonus, action) => {
    const target = getTarget();
    const actionDamageTypes = action ? getDamageTypesForAction(action) : [];
    const targetStats = target?.type === 'player'
      ? (creatures || []).find(c => c.name === target.name)
      : null;
    const targetComputed = targetStats?.computedStats || targetStats;
    const resistanceNotice = target ? getResistanceNotice(
      actionDamageTypes,
      target.type === 'player' ? (targetComputed?.resistances || []) : (target.resistances || []),
      target.type === 'player' ? (targetComputed?.immunities || []) : (target.immunities || []),
      target.name
    ) : null;

    const attacker = getAttackerCreature();
    const attackerConditions = (attacker?.conditions || []).map(c => c.key)
    const targetConditions = (target?.conditions || []).map(c => c.key)

    const attackerEffects = computeConditionEffects(attackerConditions)
    const attackerCannotAct = attackerConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c))
    if (attackerCannotAct) return

    const targetRiderForTarget = allTargetEffects.filter(te => te.target === target?.name)
    const targetEffectData = computeConditionEffects(targetConditions, [], targetRiderForTarget)

    // Elusive: No attack roll can have Advantage against you unless you have the Incapacitated condition
    const targetIsPlayer = target?.type === 'player'
    if (targetIsPlayer && targetComputed) {
      const hasElusive = [
        ...(targetComputed.actions || []),
        ...(targetComputed.bonusActions || []),
        ...(targetComputed.reactions || []),
        ...(targetComputed.specialActions || [])
      ].some(a => a.name === 'Elusive')
      const isIncapacitated = targetConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c))
      if (hasElusive && !isIncapacitated) {
        targetEffectData.targetDisadvantageCount = (targetEffectData.targetDisadvantageCount || 0) + 1
      }
    }

    const attackRange = action?.reach ? rangeToFeet(action.reach) : (action?.range ? rangeToFeet(action.range) : 30);
    const forcedMode = combineAttackModes(attackerEffects, targetEffectData, attackRange)

    const isMelee = attackRange <= 5
    const isAutoCrit = isMelee && targetEffectData.autoCritWithin5ft

    let isAutoMiss = false;
    let rangeReason = null;
    let rangeForcedMode = null;
    if (mapData && target) {
      const attackerPlaced = (mapData?.placedItems || []).find(i => i.name === monsterName) || null;
      let targetPos = null;
      const targetPlayer = mapData?.players?.find(p => p.name === target.name);
      const targetNpc = mapData?.placedItems?.length
        ? getNearestPlacedItem(mapData.placedItems, target.name, attackerPlaced ? { gridX: attackerPlaced.gridX, gridY: attackerPlaced.gridY } : null)
        : null;
      if (targetPlayer) {
        targetPos = { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY };
      } else if (targetNpc) {
        targetPos = { gridX: targetNpc.gridX, gridY: targetNpc.gridY };
      }
      if (attackerPlaced && targetPos) {
        const distanceFt = getDistanceFeet(
          { gridX: attackerPlaced.gridX, gridY: attackerPlaced.gridY },
          targetPos
        );
        const rangeResult = computeRangeEffect(attackRange, distanceFt);
        if (rangeResult.mode === 'disadvantage') {
          rangeForcedMode = 'disadvantage';
          rangeReason = rangeResult.reason;
        } else if (rangeResult.mode === 'miss') {
          isAutoMiss = true;
          rangeReason = rangeResult.reason;
        }
      }
    }

    rollAttack(name, bonus, {
      damageType: formatDamageTypes(actionDamageTypes),
      resistanceNotice,
      forcedMode: rangeForcedMode || (forcedMode !== 'normal' ? forcedMode : undefined),
      isAutoCrit,
      isAutoMiss,
      rangeReason,
      autoDamageFormula: action?.damage_dice || null,
      autoDamageName: name,
      targetName: target?.name,
      attackerName: monsterName,
      saveDc: action?.save_dc || null,
      saveType: action?.save_type ? toAbbr(action.save_type) : null,
      dcSuccess: action?.save_dc != null ? 'half' : null,
    });
  };

  const handleDamage = (name, formula, damageType, action) => {
    const target = getTarget();
    const wasCrit = popupHtml?.isCrit;
    if (wasCrit && setPopupHtml) setPopupHtml(null);
    const result = wasCrit ? rollExpressionDoubled(formula) : rollExpression(formula);
    if (result) {
      const context = {
        damageType,
        targetName: target?.name,
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
    const condEffects = computeConditionEffects(condKeys, [], monsterTargetEffects);
    const condEffectBadges = [];
    if (condEffects) {
      if (condEffects.cannotAct) condEffectBadges.push({ label: "Can't Act", cls: 'effect-cannot-act', icon: 'fa-hand' });
      if (condEffects.speedZero) condEffectBadges.push({ label: 'Speed 0', cls: 'effect-speed-zero', icon: 'fa-stop' });
      if (condEffects.autoCritWithin5ft) condEffectBadges.push({ label: 'Auto-Crit', cls: 'effect-auto-crit', icon: 'fa-bolt' });
      if (condEffects.concentrationBroken) condEffectBadges.push({ label: 'No Conc.', cls: 'effect-no-conc', icon: 'fa-spinner' });
      if (condEffects.autoFailSaves.length > 0) condEffectBadges.push({ label: `Auto-Fail ${condEffects.autoFailSaves.join('/').toUpperCase()}`, cls: 'effect-auto-fail', icon: 'fa-shield' });
      if (condEffects.resistantToAll) condEffectBadges.push({ label: 'Resist All', cls: 'effect-resist', icon: 'fa-shield-halved' });
      if (condEffects.attackDisadvantageCount > 0 || condEffects.abilityCheckDisadvantage) condEffectBadges.push({ label: 'Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down' });
      if (condEffects.strCheckDisadvantage) condEffectBadges.push({ label: 'STR Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down' });
      if (condEffects.rayOfEnfeebleDamageReduction) condEffectBadges.push({ label: '-1d8 dmg', cls: 'effect-damage-reduction', icon: 'fa-burst' });
      if (condEffects.targetAdvantageCount > 0) condEffectBadges.push({ label: 'Adv vs', cls: 'effect-target-adv', icon: 'fa-arrow-up' });
      if (condEffects.riderSaveDisadvantage) condEffectBadges.push({ label: 'Save Disadv', cls: 'effect-disadvantage', icon: 'fa-shield' });
      if (condEffects.riderAttackBonus > 0) condEffectBadges.push({ label: `+${condEffects.riderAttackBonus} to hit`, cls: 'effect-target-adv', icon: 'fa-bullseye' });
      if (condEffects.riderCannotOpportunityAttack) condEffectBadges.push({ label: 'No OA', cls: 'effect-cannot-act', icon: 'fa-ban' });
      if (inspiringMoveNoOA) condEffectBadges.push({ label: 'Insp. Move', cls: 'effect-cannot-act', icon: 'fa-person-walking' });
      if (remarkableNoOA) condEffectBadges.push({ label: 'No OA (Crit)', cls: 'effect-cannot-act', icon: 'fa-ban' });
      if (speedyOpportunityDisadvantage) condEffectBadges.push({ label: 'OA Disadv', cls: 'effect-disadvantage', icon: 'fa-arrow-down' });
      if (speedyDifficultTerrainIgnore) condEffectBadges.push({ label: 'No Difficult Terrain on Dash', cls: 'effect-cannot-act', icon: 'fa-person-walking' });
    }

    return (
      <div className="mc-card" onClick={(e) => e.stopPropagation()}>
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
      }, [monster, onClose, handleAttack, handleDamage, handleAbilityCheck, handleSaveThrow, handleSkillCheck, handleInitiative, attackerCannotAct, monsterTargetEffects]); // eslint-disable-line react-hooks/exhaustive-deps

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
