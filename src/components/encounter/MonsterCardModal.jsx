import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { normalizeSaveType } from '../../services/rules/combat/applyDamage.js';
import { extractDamageTypes, formatDamageTypes, getTargetFromAttacker, getResistanceNotice } from '../../services/rules/combat/damageUtils.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { findCreatureByName } from '../../services/rules/combat/damageUtils.js';
import { computeConditionEffects, combineAttackModes, CONDITIONS_THAT_CANNOT_ACT } from '../../services/combat/conditions/conditionEffects.js';
import { isProtectionFromEvilAndGoodActive, isCreatureWarded } from '../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js';
import { resolveCreatureType } from '../../services/combat/creatureTypeResolver.js';
import { computeRangeEffect, getDistanceFeet, getNearestPlacedItem, rangeToFeet } from '../../services/rules/combat/rangeValidation.js';
import { isDistanceInRange } from '../../services/rules/combat/rangeCheck.js';
import * as mapsService from '../../services/maps/mapsService.js';
import { useRuntimeValue, getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import AttackResultPopup from '../common/AttackResultPopup.jsx';
import AllySelectionModal from '../common/AllySelectionModal.jsx';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { addEntry } from '../../services/ui/logService.js';
import { MonsterCardBody } from './MonsterCardBody.jsx';
import { MonsterEvasionModal } from './MonsterEvasionModal.jsx';
import { saveAbilityAbbr, abilityNameMap, extractConditionsFromSaveEffect, getSaveModifierForSaveType, toAbbr } from './MonsterCardHelpers.js';
import './MonsterCardModal.css';

function getDamageTypeChoices(action) {
  return action?.damage_type_choices?.length > 0 ? action.damage_type_choices : undefined;
}

// eslint-disable-next-line react-refresh/only-export-components
export function extractDamageDiceFromDescription(description, existingDamageDice) {
  if (existingDamageDice) return existingDamageDice;
  if (!description) return null;
  const hitMatch = description.match(/(?:Hit|Failure|Success):\s*\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/i);
  return hitMatch ? hitMatch[1].replace(/\s+/g, ' ').trim() : null;
}

function MonsterCardModal({ monster, onClose, campaignName, creatures, creatureName, mapName, characters }) {
  const monsterName = creatureName || monster?.name || 'Monster';
  const creatureTempHp = getRuntimeValue(monsterName, 'tempHp', campaignName) || 0;
  const fallbackCsRef = useRef(null);
  const [mapData, setMapData] = useState(null);
  const [evasionSelection, setEvasionSelection] = useState(null);
  const [showAllyModal, setShowAllyModal] = useState(false);
  const [allyModalCreatures, setAllyModalCreatures] = useState([]);
  const storedAllies = useRuntimeValue(monsterName, 'selectedAllies', campaignName);
  const currentAllies = Array.isArray(storedAllies) && storedAllies.length > 0 ? storedAllies : [monsterName];
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

  const allTargetEffects = useRuntimeValue('campaign', 'targetEffects') ?? [];
  const monsterTargetEffects = allTargetEffects.filter(te => te.target === (creatureName || monster?.name));
  const inspiringMoveNoOA = useRuntimeValue(monsterName, 'inspiringMovementNoOA', campaignName);
  const remarkableNoOA = useRuntimeValue(monsterName, 'remarkableAthleteNoOA', campaignName);
  const monsterCharacter = characters?.find(c => c.name === monsterName);
  const speedyOpportunityDisadvantage = monsterCharacter?.computedStats?.automation?.passives?.some(p => p.type === 'passive_rule' && p.effect === 'opportunity_attacks_disadvantage');
  const speedyDifficultTerrainIgnore = monsterCharacter?.computedStats?.automation?.passives?.some(p => p.type === 'passive_rule' && p.effect === 'ignore_difficult_terrain_on_dash');
  const monsterActiveBuffs = getRuntimeValue(monsterName, 'activeBuffs') || [];
  const shieldOfFaithBonus = Array.isArray(monsterActiveBuffs) && monsterActiveBuffs.some(b => b.effect === 'shield_of_faith') ? 2 : 0;

  const monsterSensesArray = useMemo(() => {
    if (!monster?.senses) return null;
    const senses = [];
    const senseMap = {
      blindsight: 'Blindsight',
      darkvision: 'Darkvision',
      truesight: 'Truesight',
      tremorsense: 'Tremorsense',
    };
    for (const [key, value] of Object.entries(monster.senses)) {
      const label = senseMap[key];
      if (label && value != null) {
        senses.push({ name: label, value: `${value} ft.` });
      }
    }
    return senses.length > 0 ? senses : null;
  }, [monster]);

  const handleAllyModalOpen = () => {
    const combatSummary = getCombatSummary(campaignName);
    const targets = combatSummary?.creatures?.map(c => ({
      name: c.name,
      type: c.type,
      currentHp: c.currentHp,
      maxHp: c.maxHp,
    })) || [];
    setAllyModalCreatures(targets);
    setShowAllyModal(true);
  };

  const handleAllyModalConfirm = async (selectedAllies) => {
    setShowAllyModal(false);
    setRuntimeValue(monsterName, 'selectedAllies', selectedAllies, campaignName);
    await addEntry(campaignName, {
      type: 'ability_use',
      characterName: monsterName,
      abilityName: 'Ally Selection',
      description: `${monsterName} selected allies: ${selectedAllies.join(', ')}`,
      timestamp: Date.now(),
    }).catch((e) => { console.error('[MonsterCardModal] Error logging ally selection:', e); });
  };

  const handleAllyModalCancel = () => {
    setShowAllyModal(false);
  };

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
    if (name === 'Psychic Strike') {
      const target = getTarget();
      if (!target) {
        alert('Psychic Strike requires a target to be selected.');
        return;
      }
      const hexEffect = allTargetEffects.find(te => te.target === target.name && te.effect === 'hex_ability_check_disadvantage');
      if (!hexEffect) {
        alert('Psychic Strike can only be used on a creature under the warlock\'s Hex spell.');
        return;
      }
    }

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

    const targetSaveModifiers = target?.type === 'player' ? targetComputed?.saveModifiers : (target?.saveModifiers || []);

    const attackerEffects = computeConditionEffects(attackerConditions, targetSaveModifiers, monsterTargetEffects, false, false, false, false, null, false, null, false, false, false, false, false, false, false, monsterSensesArray)
    const cloudActionBlock = monsterTargetEffects.some(te => te.effect === 'no_action_and_bonus_action')
    const attackerCannotAct = attackerConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c)) || cloudActionBlock
    if (attackerCannotAct) {
        if (cloudActionBlock) {
            addEntry(campaignName, {
                type: 'automation blocked',
                characterName: monsterName,
                abilityName: name,
                description: `${monsterName} is Poisoned by Stinking Cloud and can't take an Action or Bonus Action — ${name} refused.`,
                timestamp: Date.now(),
            }).catch((e) => { console.error('[MonsterCardModal] Error:', e); });
        }
        return
    }

    const targetRiderForTarget = allTargetEffects.filter(te => te.target === target?.name)
    const targetEffectData = computeConditionEffects(targetConditions, targetSaveModifiers, targetRiderForTarget, false, false, false, false, null, false, null, false, false, false, false, false, false, false, null)

    const riderAttackBonus = targetEffectData.riderAttackBonus || 0;
    const effectiveBonus = bonus + riderAttackBonus;

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

    if (isProtectionFromEvilAndGoodActive(target?.name, campaignName)) {
      const attackerCreature = getAttackerCreature();
      if (attackerCreature && isCreatureWarded(resolveCreatureType(attackerCreature), target?.name, campaignName)) {
        targetEffectData.targetDisadvantageCount = (targetEffectData.targetDisadvantageCount || 0) + 1;
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
        const auraRange = playerStats?.automation?.passives?.some(p => p.name === 'Aura Expansion') ? 30 : 10;
        if (isDistanceInRange(getDistanceFeet(paladinPos, targetPlayer), auraRange)) {
          coverAcBonus = 2;
          coverLevel = 'half';
          coverReason = 'Smite of Protection';
          break;
        }
      }
    }

    rollAttack(name, effectiveBonus, {
      damageType: formatDamageTypes(primaryDamageType),
      damageTypeChoices: getDamageTypeChoices(action),
      resistanceNotice,
      forcedMode: rangeForcedMode || (forcedMode !== 'normal' ? forcedMode : undefined),
      isMelee,
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
      saveConditions: extractConditionsFromSaveEffect(action?.save_effect),
      // CLA-324: spell-origin marker for monster spell attacks (against_spell gates).
      isSpellDamage: action?.spell_attack_bonus != null || action?.spell_save_dc != null || /spell attack/i.test(action?.description || ''),
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
    const isStr = abbr === 'str';
    const rayDebuffOnMonster = monsterTargetEffects?.some(te => te.target === monsterName && te.effect === 'ray_of_enfeeble_debuff');
    const context = isStr && rayDebuffOnMonster ? { forcedMode: 'disadvantage' } : undefined;
    rollAbilityCheck(fullName, mod, context);
  };

  const handleSaveThrow = (ability, mod) => rollSavingThrow(saveAbilityAbbr(ability), mod);

  const handleSkillCheck = (name, mod) => {
    const rayDebuffOnMonster = monsterTargetEffects?.some(te => te.target === monsterName && te.effect === 'ray_of_enfeeble_debuff');
    const isAthletics = name === 'Athletics';
    const context = isAthletics && rayDebuffOnMonster ? { forcedMode: 'disadvantage' } : undefined;
    rollSkillCheck(name, mod, context);
  };

  const handleInitiative = (bonus) => rollInitiative(bonus);

  const handleSaveRoll = useCallback((action, saveDamageFormula, saveConditions) => {
    const target = getTarget();
    console.debug(`[saveDebug] MonsterCardModal.handleSaveRoll`, {
      monsterName, actionName: action.name, saveDc: action.save_dc, saveType: action.save_type,
      target: target ? { name: target.name, type: target.type } : null,
      creaturesAvailable: Array.isArray(creatures),
    });
    const saveMod = getSaveModifierForSaveType(action.save_type, target, characters, creatures);
    rollSavingThrow(saveAbilityAbbr(action.save_type), saveMod, {
      attackerName: monsterName,
      targetName: target?.name,
      actionName: action.name,
      saveDc: action.save_dc,
      saveType: action.save_type,
      dcSuccess: action.save_dc != null ? 'half' : null,
      autoDamageFormula: saveDamageFormula,
      autoDamageDamageType: saveDamageFormula ? (getDamageTypesForAction(action)[0] ? formatDamageTypes([getDamageTypesForAction(action)[0]]) : null) : null,
      autoDamageName: action.name,
      saveConditions: saveConditions,
    });
  }, [getTarget, characters, creatures, rollSavingThrow, monsterName, getDamageTypesForAction]);

  const attackerCannotAct = useMemo(() => {
    const creature = getAttackerCreature();
    if (!creature) return false;
    return (creature.conditions || []).some(c => CONDITIONS_THAT_CANNOT_ACT.has(c.key));
  }, [getAttackerCreature]);

  // SP-111: Stinking Cloud's "can't take an Action or Bonus Action" rider —
  // blocks Actions/Traits/Legendary rows but NOT Reactions (those stay
  // gated solely by the condition-based attackerCannotAct above).
  const attackerActionBlocked = attackerCannotAct
    || monsterTargetEffects.some(te => te.effect === 'no_action_and_bonus_action');

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

  if (!monster) return null;

  return (
    <>
    <div className={`mc-overlay${evasionSelection !== null ? ' mc-overlay--dimmed' : ''}`} onClick={onClose}>
      <MonsterCardBody
        monster={monster}
        monsterName={monsterName}
        onClose={onClose}
        creatureTempHp={creatureTempHp}
        shieldOfFaithBonus={shieldOfFaithBonus}
        handleInitiative={handleInitiative}
        handleAbilityCheck={handleAbilityCheck}
        handleSaveThrow={handleSaveThrow}
        handleSkillCheck={handleSkillCheck}
        attackerCannotAct={attackerCannotAct}
        attackerActionBlocked={attackerActionBlocked}
        handleAttack={handleAttack}
        handleDamage={handleDamage}
        handleSaveRoll={handleSaveRoll}
        handleAllyModalOpen={handleAllyModalOpen}
        currentAllies={currentAllies}
        monsterTargetEffects={monsterTargetEffects}
        inspiringMoveNoOA={inspiringMoveNoOA}
        remarkableNoOA={remarkableNoOA}
        speedyOpportunityDisadvantage={speedyOpportunityDisadvantage}
        speedyDifficultTerrainIgnore={speedyDifficultTerrainIgnore}
        getAttackerCreature={getAttackerCreature}
        campaignName={campaignName}
        characters={characters}
        creatures={creatures}
      />
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
      <MonsterEvasionModal
        evasionSelection={evasionSelection}
        setEvasionSelection={setEvasionSelection}
        creatures={creatures}
        monsterName={monsterName}
        handleEvasionConfirm={handleEvasionConfirm}
        handleEvasionSkip={handleEvasionSkip}
      />
    )}
    {showAllyModal && (
      <AllySelectionModal
        creatures={allyModalCreatures}
        currentAllies={currentAllies}
        onConfirm={handleAllyModalConfirm}
        onCancel={handleAllyModalCancel}
      />
    )}
    </>
  );
}

export default MonsterCardModal;
