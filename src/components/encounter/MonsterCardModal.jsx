import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { sanitizeHtml } from '../../services/ui/sanitize.js';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { normalizeSaveType } from '../../services/rules/combat/applyDamage.js';
import { extractDamageTypes, formatDamageTypes, getTargetFromAttacker, getResistanceNotice } from '../../services/rules/combat/damageUtils.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { findCreatureByName } from '../../services/rules/combat/damageUtils.js';
import { getAbilitySaveModifier } from '../../services/shared/abilityLookup.js';
import { computeConditionEffects, combineAttackModes, CONDITIONS_THAT_CANNOT_ACT } from '../../services/combat/conditions/conditionEffects.js';
import { computeRangeEffect, getDistanceFeet, getNearestPlacedItem, rangeToFeet } from '../../services/rules/combat/rangeValidation.js';
import * as mapsService from '../../services/maps/mapsService.js';
import { useRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import AttackResultPopup from '../common/AttackResultPopup.jsx';
import { EFFECT_DESCRIPTIONS } from '../../services/combat/conditions/effectDescriptions.js';
import './MonsterCardModal.css';

const ABBR_MAP = { Strength: 'str', Dexterity: 'dex', Constitution: 'con', Intelligence: 'int', Wisdom: 'wis', Charisma: 'cha', str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha' };

function toAbbr(name) {
  return ABBR_MAP[name] || name?.substring(0, 3).toLowerCase();
}

// eslint-disable-next-line react-refresh/only-export-components
export function extractDamageDiceFromDescription(description, existingDamageDice) {
  if (existingDamageDice) return existingDamageDice;
  if (!description) return null;
  const hitMatch = description.match(/(?:Hit|Failure|Success):\s*\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/i);
  return hitMatch ? hitMatch[1].replace(/\s+/g, ' ').trim() : null;
}

const CONDITIONS = ['blinded', 'charmed', 'cursed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];

function extractConditionsFromDescription(description) {
  if (!description || typeof description !== 'string') return [];
  const found = [];
  for (const condition of CONDITIONS) {
    const regex = new RegExp(`\\b${condition}\\b`, 'i');
    if (regex.test(description)) {
      found.push(condition);
    }
  }
  return found;
}

function MonsterCardModal({ monster, onClose, campaignName, creatures, creatureName, mapName, characters }) {
  const monsterName = creatureName || monster?.name || 'Monster';
  const fallbackCsRef = useRef(null);
  const [mapData, setMapData] = useState(null);
  const [evasionSelection, setEvasionSelection] = useState(null);
  const pendingSaveRef = useRef(null);

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
  const monsterActiveBuffs = getRuntimeValue(monsterName, 'activeBuffs') || [];
  const shieldOfFaithBonus = Array.isArray(monsterActiveBuffs) && monsterActiveBuffs.some(b => b.effect === 'shield_of_faith') ? 2 : 0;

  const { popupHtml, setPopupHtml, rollAttack, rollDamage, rollAbilityCheck, rollSavingThrow, rollSkillCheck, rollInitiative, quickRollPlayerSave } = useLoggedDiceRoll(
    monsterName,
    campaignName,
    {
        autoDamageSource: monsterName,
        autoDamageRoll: async (autoDamage, isCrit) => {
          if (!autoDamage) {
            setPopupHtml(null);
            return;
          }
          const target = getTarget();
          const wasCrit = isCrit || autoDamage.isAutoCrit;
          const result = wasCrit ? rollExpressionDoubled(autoDamage.formula) : rollExpression(autoDamage.formula);
          if (result) {
            const context = {
              damageType: autoDamage.damageType,
              targetName: target?.name,
              attackerName: autoDamage.attackerName || monsterName,
              isAutoCrit: wasCrit,
            };
            if (autoDamage.saveDc != null) {
              context.saveDc = autoDamage.saveDc;
              context.saveType = autoDamage.saveType;
              context.dcSuccess = autoDamage.dcSuccess;
            }
            if (autoDamage.secondaryFormula) {
              context.autoDamageSecondaryFormula = autoDamage.secondaryFormula;
              context.autoDamageSecondaryName = autoDamage.secondaryName || autoDamage.name;
              context.autoDamageSecondaryDamageType = autoDamage.secondaryDamageType;
            }
            if (autoDamage.overchannelActive) {
              context.overchannelActive = autoDamage.overchannelActive;
              context.overchannelUseCount = autoDamage.overchannelUseCount;
              context.overchannelSpellLevel = autoDamage.overchannelSpellLevel;
            }
            rollDamage(autoDamage.name, autoDamage.formula, result.total, result.rolls, result.modifier, context);
          }
          setPopupHtml(null);
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
    if (action.damage_type_primary) {
      types.push(action.damage_type_primary);
    }
    if (action.damage_type_secondary) {
      types.push(action.damage_type_secondary);
    }
    if (types.length === 0) {
      types.push(...extractDamageTypes(action.description));
    }
    return types;
  }, []);

  const handleAttack = (name, bonus, action) => {
    const target = getTarget();
    const primaryDamageType = action?.damage_type_primary ? [action.damage_type_primary] : [];

    const isMeleeAttack = (action?.reach ? rangeToFeet(action.reach) : (action?.range ? rangeToFeet(action.range) : 30)) <= 5;
    let grazeDamage = false;
    let grazeAbilityMod = 0;
    if (isMeleeAttack && monsterCharacter?.computedStats) {
      const weaponMastery = monsterCharacter.computedStats.automation?.passives?.find(p => p.type === 'weapon_mastery_choice');
      const chosenMastery = weaponMastery?.chosenMastery;
      if (chosenMastery === 'Graze') {
        grazeDamage = true;
        const strAbility = monsterCharacter.computedStats.abilities?.find(a => a.name === 'Strength');
        grazeAbilityMod = strAbility?.bonus || 0;
      }
    }
    const targetStats = target?.type === 'player'
      ? (creatures || []).find(c => c.name === target.name)
      : null;
    const targetComputed = targetStats?.computedStats || targetStats;
    const resistanceNotice = target ? getResistanceNotice(
      primaryDamageType,
      target.type === 'player' ? (targetComputed?.resistances || []) : (target.resistances || []),
      target.type === 'player' ? (targetComputed?.immunities || []) : (target.immunities || []),
      target.name
    ) : null;

    const attacker = getAttackerCreature();
    const attackerConditions = (attacker?.conditions || []).map(c => c.key)
    const targetConditions = (target?.conditions || []).map(c => c.key)

    const attackerEffects = computeConditionEffects(attackerConditions, [], monsterTargetEffects)
    const attackerCannotAct = attackerConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c))
    if (attackerCannotAct) return

    const targetRiderForTarget = allTargetEffects.filter(te => te.target === target?.name)
    const targetEffectData = computeConditionEffects(targetConditions, [], targetRiderForTarget)

    const riderAttackBonus = targetEffectData.riderAttackBonus || 0;
    const effectiveBonus = bonus + riderAttackBonus;

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
        targetEffectData.noAdvantageAgainst = true
      }
    }

    const attackRange = action?.reach ? rangeToFeet(action.reach) : (action?.range ? rangeToFeet(action.range) : 30);

    // Check Improved Duplicity advantage for monster attackers
    let duplicityAdvantage = false;
    const clericNames = (characters || []).filter(c => c.computedStats?.automation?.passives?.some(p => p.effect === 'enhanced_distraction_and_healing'));
    for (const cleric of clericNames) {
      const clericBuffs = getRuntimeValue(cleric.name, 'activeBuffs', campaignName) || [];
      const hasBuff = Array.isArray(clericBuffs) && clericBuffs.some(b => b.effect === 'create_illusion' && b.isImprovedDuplicity);
      if (!hasBuff) continue;
      const advantageTargets = getRuntimeValue(cleric.name, 'invokeDuplicityAdvantageTargets', campaignName) || [];
      if (advantageTargets.includes(monsterName)) {
        duplicityAdvantage = true;
        break;
      }
    }

    const forcedMode = combineAttackModes(attackerEffects, targetEffectData, attackRange, target?.name);

    const isMelee = attackRange <= 5
    const isAutoCrit = isMelee && targetEffectData.autoCritWithin5ft

    let isAutoMiss = false;
    let rangeReason = null;
    let rangeForcedMode = null;
    let coverAcBonus = 0;
    let coverLevel = null;
    let coverReason = null;
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

    // Check Bulwark of Force half cover — applies to all attacks, independent of map data
    if (!isAutoMiss && characters) {
      for (const player of characters) {
        const bulwarkActive = getRuntimeValue(player.name, 'bulwarkOfForceActive');
        if (bulwarkActive) {
          const bulwarkTargets = getRuntimeValue(player.name, 'bulwarkOfForceTargets') || [];
          if (bulwarkTargets.includes(target?.name) && coverAcBonus < 2) {
            coverAcBonus = 2;
            coverLevel = 'half';
            coverReason = 'Bulwark of Force';
            break;
          }
        }
      }
    }

    // Check Nature's Sanctuary half cover — any creature in the sanctuary list
    if (!isAutoMiss && coverAcBonus < 2 && characters && target) {
      for (const player of characters) {
        const sanctuaryCreatures = getRuntimeValue(player.name, 'naturesSanctuaryCreatures', campaignName) || [];
        if (sanctuaryCreatures.includes(target.name)) {
          coverAcBonus = 2;
          coverLevel = 'half';
          coverReason = 'Nature\'s Sanctuary';
          break;
        }
      }
    }

    // Check Smite of Protection half cover — allies within Aura of Protection of a paladin with the buff
    if (!isAutoMiss && coverAcBonus < 2 && characters && target && mapData) {
      for (const player of characters) {
        const smiteCoverActive = getRuntimeValue(player.name, 'smiteOfProtectionActive', campaignName);
        if (!smiteCoverActive) continue;
        const playerStats = player.computedStats;
        const hasAura = playerStats?.automation?.passives?.some(p => p.name === 'Aura of Protection');
        if (!hasAura) continue;
        const paladinPos = mapData.players?.find(p => p.name === player.name);
        const targetPlayer = mapData.players?.find(p => p.name === target.name);
        if (!paladinPos || !targetPlayer) continue;
        const dist = getDistanceFeet(paladinPos, targetPlayer);
        const auraRange = playerStats?.automation?.passives?.some(p => p.name === 'Aura Expansion') ? 30 : 10;
        if (dist != null && dist <= auraRange) {
          coverAcBonus = 2;
          coverLevel = 'half';
          coverReason = 'Smite of Protection';
          break;
        }
      }
    }

    rollAttack(name, effectiveBonus, {
      damageType: formatDamageTypes(primaryDamageType),
      resistanceNotice,
      forcedMode: rangeForcedMode || (forcedMode !== 'normal' ? forcedMode : (duplicityAdvantage ? 'advantage' : undefined)),
      isAutoCrit,
      isAutoMiss,
      rangeReason,
      coverAcBonus,
      coverLevel,
      coverReason,
      autoDamageFormula: extractDamageDiceFromDescription(action?.description, action?.damage_dice_primary) || null,
      autoDamageName: name,
      autoDamageSecondaryFormula: action?.damage_dice_secondary || null,
      autoDamageSecondaryName: name,
      autoDamageSecondaryDamageType: action?.damage_type_secondary ? formatDamageTypes([action.damage_type_secondary]) : null,
      targetName: target?.name,
      attackerName: monsterName,
      grazeDamage,
      grazeAbilityMod,
      grazeAbilityName: 'STR',
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
    const actionHasSave = action.save_dc != null;
    const actionHasAttack = action.attack_bonus != null;
    const actionDamageFormula = extractDamageDiceFromDescription(action?.description, action?.damage_dice_primary);
    const actionDamageType = getDamageTypesForAction(action)[0] || null;
    const actionHasSecondaryDamage = action.damage_dice_secondary != null;

    return (
    <div key={i} className={`mc-action ${attackerCannotAct ? 'mc-action-disabled' : ''}`}>
      <strong>{action.name}.</strong>{' '}
      {attackerCannotAct && <span className="mc-incapacitated-label">(Incapacitated)</span>}
      {actionHasAttack && !attackerCannotAct && (
        <span className="mc-dice-link" onClick={() => handleAttack(action.name, action.attack_bonus, action)} role="button" tabIndex={0}>
          <i className="fa-solid fa-dice-d20" /> +{action.attack_bonus}
        </span>
      )}
      {!actionHasAttack && !actionHasSave && (actionDamageFormula || actionHasSecondaryDamage) && (
        <>
          {actionDamageFormula && (
            <span className="mc-dice-link" onClick={() => handleDamage(action.name, actionDamageFormula, actionDamageType ? formatDamageTypes([actionDamageType]) : '', action)} role="button" tabIndex={0}>
              <i className="fa-solid fa-dice" /> {actionDamageFormula}
            </span>
          )}
          {actionHasSecondaryDamage && (
            <span className="mc-dice-link" onClick={() => handleDamage(action.name, action.damage_dice_secondary, action.damage_type_primary ? formatDamageTypes([action.damage_type_primary]) : '', action)} role="button" tabIndex={0}>
              <i className="fa-solid fa-dice" /> {action.damage_dice_secondary}
            </span>
          )}
        </>
      )}
      {actionHasSave && (() => {
        const saveDamageFormula = extractDamageDiceFromDescription(action?.description, action?.damage_dice_primary);
        const saveDamageType = getDamageTypesForAction(action)[0] || null;
        const saveConditions = extractConditionsFromDescription(action?.description);
        const handleSaveRoll = () => {
          const target = getTarget();
          const saveMod = getSaveModifierForSaveType(action.save_type, target, characters, creatures);
          rollSavingThrow(saveAbilityAbbr(action.save_type), saveMod, {
            attackerName: monsterName,
            targetName: target?.name,
            actionName: action.name,
            saveDc: action.save_dc,
            saveType: action.save_type,
            dcSuccess: action.save_dc != null ? 'half' : null,
            autoDamageFormula: saveDamageFormula,
            autoDamageDamageType: saveDamageType ? formatDamageTypes([saveDamageType]) : null,
            autoDamageName: action.name,
            saveConditions: saveConditions,
          });
        };
        return (
          saveDamageFormula ? (
            <span className="mc-dice-link" role="button" tabIndex={0} onClick={handleSaveRoll}>
              <i className="fa-solid fa-dice" /> {saveDamageFormula}
            </span>
          ) : (
            <span className={`mc-dice-link ${!action.attack_bonus && !attackerCannotAct ? 'mc-dice-link-save mc-dice-link-save-clickable' : 'mc-dice-link-save'}`} onClick={!action.attack_bonus && !attackerCannotAct ? handleSaveRoll : undefined} role="button" tabIndex={0}>
              DC {action.save_dc} {action.save_type}
            </span>
          )
        );
      })()}
      <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(action.description) }} />
      {action.usage && <em> ({String(action.usage)})</em>}
      {action.recharge && <em> ({String(action.recharge)})</em>}
    </div>
  );
  };

  const attackerCannotAct = useMemo(() => {
    const creature = getAttackerCreature();
    if (!creature) return false;
    return (creature.conditions || []).some(c => CONDITIONS_THAT_CANNOT_ACT.has(c.key));
  }, [getAttackerCreature]);

  const hasShareableEvasionForSave = useCallback((saveType) => {
    if (!saveType || !characters) return false;
    const normalizedSaveType = normalizeSaveType(saveType);
    return characters.some(c => {
      const ev = c?.computedStats?.evasionEffects;
      return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
    });
  }, [characters]);

  const handleQuickRollWithEvasion = useCallback((promptId, targetName, saveType, saveDc) => {
    const pendingSave = { promptId, targetName, saveType, saveDc };
    const hasEvasion = hasShareableEvasionForSave(saveType);
    if (hasEvasion) {
      pendingSaveRef.current = pendingSave;
      setEvasionSelection([]);
    } else {
      quickRollPlayerSave(promptId, targetName, saveType, saveDc);
    }
  }, [hasShareableEvasionForSave, quickRollPlayerSave]);

  const handleEvasionConfirm = useCallback((selectedNames) => {
    if (!pendingSaveRef.current) return;
    const { promptId, targetName, saveType, saveDc } = pendingSaveRef.current;
    const selectedAllies = new Set(selectedNames);
    quickRollPlayerSave(promptId, targetName, saveType, saveDc, selectedAllies);
    setEvasionSelection(null);
    pendingSaveRef.current = null;
  }, [quickRollPlayerSave]);

  const handleEvasionSkip = useCallback(() => {
    if (!pendingSaveRef.current) return;
    const { promptId, targetName, saveType, saveDc } = pendingSaveRef.current;
    quickRollPlayerSave(promptId, targetName, saveType, saveDc);
    setEvasionSelection(null);
    pendingSaveRef.current = null;
  }, [quickRollPlayerSave]);

  const content = useMemo(() => {
    if (!monster) return null;

    const creature = getAttackerCreature();
    const monsterConditions = creature?.conditions || [];
    const condKeys = monsterConditions.map(c => c.key);
    const condEffects = computeConditionEffects(condKeys, [], monsterTargetEffects);
    const condEffectBadges = [];
    if (condEffects) {
      if (condEffects.noAdvantageAgainst) condEffectBadges.push({ label: 'No Adv vs', cls: 'effect-target-disadv', icon: 'fa-arrow-down' });
      if (condEffects.targetDisadvantageCount > 0 && !condEffects.noAdvantageAgainst) condEffectBadges.push({ label: 'Disadv vs', cls: 'effect-target-disadv', icon: 'fa-arrow-down' });
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
              <span className="mc-stat-value">{monster.armor_class + shieldOfFaithBonus}{shieldOfFaithBonus > 0 && ' (+' + shieldOfFaithBonus + ' Shield of Faith)'}</span>
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
                  <span key={cond.id || cond.key} className="mc-condition-label-badge">{cond.label || String(cond)}</span>
                ))}
              </div>
              <div className="mc-conditions-effects">
                {condEffectBadges.map(b => (
                  <span key={b.label} className={`mc-effect-badge ${b.cls}`} title={EFFECT_DESCRIPTIONS[b.label] || b.label}>
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
    <>
    <div className={`mc-overlay${evasionSelection !== null ? ' mc-overlay--dimmed' : ''}`} onClick={onClose}>
      {content}
      {popupHtml && (
        <div onClick={(e) => e.stopPropagation()}>
          <AttackResultPopup
            popupHtml={popupHtml}
            onClose={() => setPopupHtml(null)}
            campaignName={campaignName}
            attackerName={monsterName}
            setPopupHtml={setPopupHtml}
            onQuickRoll={popupHtml.waitingForPlayerSave ? () => handleQuickRollWithEvasion(popupHtml.promptId, popupHtml.targetName, popupHtml.saveType, popupHtml.saveDc) : undefined}
          />
        </div>
      )}
    </div>
    {evasionSelection !== null && pendingSaveRef.current && (
        <div className="mc-overlay mc-overlay--evasion" onClick={handleEvasionSkip}>
          <div className="sp-modal" onClick={e => e.stopPropagation()}>
            <div className="sp-header">
              <i className="fa-solid fa-shield-halved"></i> Leading Evasion — Choose Allies
            </div>
            <div className="sp-body">
              <p>Which creatures should benefit from <strong>Leading Evasion</strong>?</p>
              <p className="sp-note">Select all allies within 5 feet of the Bard. On a successful save, selected allies take no damage. On a failure, they take half damage.</p>
              <div className="secondary-target-list">
                {(creatures || []).filter(c => c.name !== monsterName).map((creature, i) => {
                  const isSelected = evasionSelection.includes(creature.name);
                  return (
                    <label
                      key={i}
                      className={`secondary-target-row ${isSelected ? 'secondary-target-selected' : ''}`}
                      onClick={() => {
                        const currentSelection = evasionSelection;
                        const isSelected = currentSelection.includes(creature.name);
                        setEvasionSelection(
                          isSelected
                            ? currentSelection.filter(n => n !== creature.name)
                            : [...currentSelection, creature.name]
                        );
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={evasionSelection.includes(creature.name)}
                        onChange={() => {}}
                      />
                      <span className="secondary-target-name">
                        <strong>{creature.name}</strong>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="sp-actions">
              <button
                className="sp-roll-btn"
                onClick={() => handleEvasionConfirm(evasionSelection)}
                disabled={evasionSelection.length === 0}
                type="button"
              >
                <i className="fa-solid fa-shield-halved"></i> Apply Evasion ({evasionSelection.length})
              </button>
              <button className="sp-dismiss-btn" onClick={handleEvasionSkip} type="button">
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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

function getSaveModifierForSaveType(saveType, target, characters, creatures) {
  const abilityKey = toAbbr(saveType);
  if (!abilityKey) return 0;

  if (!target) return 0;

  if (target.type === 'player') {
    const playerChar = characters?.find(c => c.name === target.name);
    if (playerChar?.abilities) {
      return getAbilitySaveModifier(playerChar.abilities, abilityKey);
    }
    const creature = creatures?.find(c => c.name === target.name);
    if (creature?.saving_throws?.[abilityKey]) {
      return creature.saving_throws[abilityKey].modifier;
    }
    if (creature?.ability_score_modifiers?.[abilityKey] != null) {
      return creature.ability_score_modifiers[abilityKey];
    }
    return 0;
  }

  if (target.saving_throws?.[abilityKey] != null) {
    return target.saving_throws[abilityKey].modifier;
  }
  if (target.ability_score_modifiers?.[abilityKey] != null) {
    return target.ability_score_modifiers[abilityKey];
  }

  const creature = creatures?.find(c => c.name === target.name);
  if (creature?.saving_throws?.[abilityKey]) {
    return creature.saving_throws[abilityKey].modifier;
  }
  if (creature?.ability_score_modifiers?.[abilityKey] != null) {
    return creature.ability_score_modifiers[abilityKey];
  }

  return 0;
}

function parseInitiativeBonus(initStr) {
  if (!initStr) return null;
  const match = initStr.match(/^([+-]\d+)/);
  return match ? parseInt(match[1], 10) : null;
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
