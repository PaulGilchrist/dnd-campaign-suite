import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { rollExpression, rollExpressionDoubled, canRollExpression } from '../../services/dice/diceRoller.js';
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
import { saveAbilityAbbr, abilityNameMap, extractConditionsFromSaveEffect, getSaveModifierForSaveType, toAbbr, spellHasDamage, spellDamageFormulaAtBaseLevel, extractSpellcastingSpellUses, getGatedMonsterReaction, resolveMonsterGatedReaction, MONSTER_REACTION_USES_KEY, buildChargeBonusOffer, buildChargeBonusGrantLog, buildChargeBonusDeclineLog, buildHitConditionClause, evaluateTargetPrerequisiteGate } from './MonsterCardHelpers.js';
import { loadSpells } from '../../services/ui/dataLoader.js';
import { MONSTER_SPELL_USES_KEY, monsterAbilitySaveUsesGate, buildAbilitySaveRefusalLog, buildAbilitySaveRefusalPopup, extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';
import { expendLegendaryUse, legendaryDelegateAction, legendaryDelegateAttackName, buildLegendaryRefusalPopup, buildLegendaryRefusalLog } from '../../services/encounters/monsterLegendaryUses.js';
import './MonsterCardModal.css';

function getDamageTypeChoices(action) {
  return action?.damage_type_choices?.length > 0 ? action.damage_type_choices : undefined;
}

// MA-0021: legendary-row numeric mechanic resolved after a use is spent —
// routes to the same handlers the numeric chips already use (MA-0014 intact).
// MA-0022: a non-numeric row that names another action via `delegates_to`
// resolves using THAT row's attack_bonus/damage through the identical attack
// seam (Lash → Tentacle +9 / 2d6+5), logs "Lash (Tentacle attack)".
function legendaryRowHasNumericMechanic(action) {
  if (action.attack_bonus != null || action.save_dc != null) return true;
  const formula = extractDamageDiceFromDescription(action.description, action.damage_dice_primary);
  return !!(formula && canRollExpression(formula));
}

function resolveLegendaryRowMechanic(action, { monsterName, handledActionName, handleAttack, handleSaveRoll, handleDamage }) {
  if (action.attack_bonus != null) handleAttack(handledActionName ?? action.name, action.attack_bonus, action);
  else if (action.save_dc != null) handleSaveRoll(action, extractDamageDiceFromDescription(action.description, action.damage_dice_primary), extractConditionsFromSaveEffect(action.save_effect));
  else {
    const formula = extractDamageDiceFromDescription(action.description, action.damage_dice_primary);
    if (formula && canRollExpression(formula)) handleDamage(handledActionName ?? action.name, formula, action.damage_type_primary ? formatDamageTypes([action.damage_type_primary]) : '', action);
    else console.error(`[MonsterCardModal] legendary action "${action.name}" delegates_to "${action.delegates_to}" — no resolvable mechanic on "${monsterName}"`);
  }
}

// MA-0021: legendary-row gated click — expend 1 use (round+turn latch, refusal
// popup + legendary_use_refused zero-spend log), then resolve the row's own
// mechanic (numeric chips roll as today, MA-0014 gate intact). MA-0022: rows
// with no own numbers delegate to the named row before spending.
async function resolveLegendaryRow({ action, monsterName, monster, campaignName, setPopupHtml, handleAttack, handleSaveRoll, handleDamage }) {
  let mechanicAction = action;
  let actionName = action.name;
  if (!legendaryRowHasNumericMechanic(action) && action.delegates_to) {
    const delegate = legendaryDelegateAction(monster, action);
    if (!delegate) {
      setPopupHtml(buildLegendaryRefusalPopup({ monsterName, actionName: action.name, reason: 'no-delegate' }));
      addEntry(campaignName, buildLegendaryRefusalLog({ monsterName, actionName: action.name, reason: 'no-delegate' }))
        .catch((e) => { console.error('[MonsterCardModal] Error logging legendary delegate refusal:', e); });
      return;
    }
    mechanicAction = delegate;
    actionName = legendaryDelegateAttackName(action, delegate);
  }
  const result = await expendLegendaryUse({ monsterName, monster, actionName, campaignName });
  if (!result.spent) {
    setPopupHtml(result.popupHtml);
    return;
  }
  resolveLegendaryRowMechanic(mechanicAction, { monsterName, handledActionName: actionName, handleAttack, handleSaveRoll, handleDamage });
}

// eslint-disable-next-line react-refresh/only-export-components
export function extractDamageDiceFromDescription(description, existingDamageDice) {
  if (existingDamageDice) return existingDamageDice;
  if (!description) return null;
  const hitMatch = description.match(/(?:Hit|Failure|Success):\s*\d+\s*\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)/i);
  return hitMatch ? hitMatch[1].replace(/\s+/g, ' ').trim() : null;
}

function psychicStrikePreconditionFailed(name, target, allTargetEffects) {
  if (name !== 'Psychic Strike') return false;
  if (!target) {
    alert('Psychic Strike requires a target to be selected.');
    return true;
  }
  const hexEffect = allTargetEffects.find(te => te.target === target.name && te.effect === 'hex_ability_check_disadvantage');
  if (!hexEffect) {
    alert('Psychic Strike can only be used on a creature under the warlock\'s Hex spell.');
    return true;
  }
  return false;
}

function computeGrazeSettings(isMeleeAttack, monsterCharacter) {
  if (!isMeleeAttack || !monsterCharacter?.computedStats) return { grazeDamage: false, grazeAbilityMod: 0 };
  const weaponMastery = monsterCharacter.computedStats.automation?.passives?.find(p => p.type === 'weapon_mastery_choice');
  if (weaponMastery?.chosenMastery !== 'Graze') return { grazeDamage: false, grazeAbilityMod: 0 };
  const strAbility = monsterCharacter.computedStats.abilities?.find(a => a.name === 'Strength');
  return { grazeDamage: true, grazeAbilityMod: strAbility?.bonus || 0 };
}

function resolveTargetDefense(target, creatures, primaryDamageType) {
  if (!target) return { targetComputed: null, resistanceNotice: null };
  const targetStats = target.type === 'player'
    ? (creatures || []).find(c => c.name === target.name)
    : null;
  const targetComputed = targetStats?.computedStats || targetStats;
  const resistanceNotice = getResistanceNotice(
    primaryDamageType,
    target.type === 'player' ? (targetComputed?.resistances || []) : (target.resistances || []),
    target.type === 'player' ? (targetComputed?.immunities || []) : (target.immunities || []),
    target.name
  );
  return { targetComputed, resistanceNotice };
}

function applyElusive(targetEffectData, target, targetComputed, targetConditions) {
  if (target?.type !== 'player' || !targetComputed) return;
  const hasElusive = [
    ...(targetComputed.actions || []),
    ...(targetComputed.bonusActions || []),
    ...(targetComputed.reactions || []),
    ...(targetComputed.specialActions || [])
  ].some(a => a.name === 'Elusive');
  const isIncapacitated = targetConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c));
  if (hasElusive && !isIncapacitated) {
    targetEffectData.noAdvantageAgainst = true;
  }
}

function applyProtectionFromEvilPenalty(targetEffectData, target, campaignName, getAttackerCreature) {
  if (!isProtectionFromEvilAndGoodActive(target?.name, campaignName)) return;
  const attackerCreature = getAttackerCreature();
  if (attackerCreature && isCreatureWarded(resolveCreatureType(attackerCreature), target?.name, campaignName)) {
    targetEffectData.targetDisadvantageCount = (targetEffectData.targetDisadvantageCount || 0) + 1;
  }
}

function resolveTargetGridPos(mapData, target, attackerPlaced) {
  const targetPlayer = mapData.players?.find(p => p.name === target.name);
  if (targetPlayer) return { gridX: targetPlayer.gridX, gridY: targetPlayer.gridY };
  if (!mapData.placedItems?.length) return null;
  const targetNpc = getNearestPlacedItem(mapData.placedItems, target.name, attackerPlaced ? { gridX: attackerPlaced.gridX, gridY: attackerPlaced.gridY } : null);
  return targetNpc ? { gridX: targetNpc.gridX, gridY: targetNpc.gridY } : null;
}

const RANGE_MODE_HANDLERS = {
  disadvantage: (state, reason) => {
    state.rangeForcedMode = 'disadvantage';
    state.rangeReason = reason;
  },
  miss: (state, reason) => {
    state.isAutoMiss = true;
    state.rangeReason = reason;
  },
};

function computeMapRangeState(mapData, target, monsterName, attackRange) {
  const state = { isAutoMiss: false, rangeReason: null, rangeForcedMode: null };
  if (!mapData || !target) return state;
  const attackerPlaced = (mapData.placedItems || []).find(i => i.name === monsterName) || null;
  const targetPos = resolveTargetGridPos(mapData, target, attackerPlaced);
  if (!attackerPlaced || !targetPos) return state;
  const distanceFt = getDistanceFeet(
    { gridX: attackerPlaced.gridX, gridY: attackerPlaced.gridY },
    targetPos
  );
  const rangeResult = computeRangeEffect(attackRange, distanceFt);
  const handler = RANGE_MODE_HANDLERS[rangeResult.mode];
  if (handler) handler(state, rangeResult.reason);
  return state;
}

const NO_COVER = { coverAcBonus: 0, coverLevel: null, coverReason: null };

function computeBulwarkCover(target, characters) {
  for (const player of characters) {
    if (!getRuntimeValue(player.name, 'bulwarkOfForceActive')) continue;
    const bulwarkTargets = getRuntimeValue(player.name, 'bulwarkOfForceTargets') || [];
    if (bulwarkTargets.includes(target?.name)) {
      return { coverAcBonus: 2, coverLevel: 'half', coverReason: 'Bulwark of Force' };
    }
  }
  return null;
}

function computeSanctuaryCover(target, characters, campaignName) {
  for (const player of characters) {
    const sanctuaryCreatures = getRuntimeValue(player.name, 'naturesSanctuaryCreatures', campaignName) || [];
    if (sanctuaryCreatures.includes(target.name)) {
      return { coverAcBonus: 2, coverLevel: 'half', coverReason: 'Nature\'s Sanctuary' };
    }
  }
  return null;
}

function hasPassiveNamed(playerStats, passiveName) {
  return Boolean(playerStats?.automation?.passives?.some(p => p.name === passiveName));
}

function findPlacedPlayer(mapData, name) {
  return mapData.players?.find(p => p.name === name) || null;
}

function computeSmiteCover(target, characters, mapData, campaignName) {
  for (const player of characters) {
    if (!getRuntimeValue(player.name, 'smiteOfProtectionActive', campaignName)) continue;
    if (!hasPassiveNamed(player.computedStats, 'Aura of Protection')) continue;
    const paladinPos = findPlacedPlayer(mapData, player.name);
    const targetPlayer = findPlacedPlayer(mapData, target.name);
    if (!paladinPos || !targetPlayer) continue;
    const auraRange = hasPassiveNamed(player.computedStats, 'Aura Expansion') ? 30 : 10;
    if (isDistanceInRange(getDistanceFeet(paladinPos, targetPlayer), auraRange)) {
      return { coverAcBonus: 2, coverLevel: 'half', coverReason: 'Smite of Protection' };
    }
  }
  return null;
}

function computeCoverState(isAutoMiss, target, characters, mapData, campaignName) {
  if (isAutoMiss) return NO_COVER;
  if (characters) {
    const bulwark = computeBulwarkCover(target, characters);
    if (bulwark) return bulwark;
  }
  if (characters && target) {
    const sanctuary = computeSanctuaryCover(target, characters, campaignName);
    if (sanctuary) return sanctuary;
  }
  if (characters && target && mapData) {
    const smite = computeSmiteCover(target, characters, mapData, campaignName);
    if (smite) return smite;
  }
  return NO_COVER;
}

function resolveForcedMode(forcedMode, rangeForcedMode) {
  if (rangeForcedMode) return rangeForcedMode;
  return forcedMode !== 'normal' ? forcedMode : undefined;
}

function buildAutoDamageOptions(action, name) {
  return {
    autoDamageFormula: extractDamageDiceFromDescription(action?.description, action?.damage_dice_primary) || null,
    autoDamageName: name,
    autoDamageSecondaryFormula: action?.damage_dice_secondary || null,
    autoDamageSecondaryName: name,
    autoDamageSecondaryDamageType: action?.damage_type_secondary ? formatDamageTypes([action.damage_type_secondary]) : null,
    hitClause: buildHitConditionClause(action),
  };
}

function buildSaveOptions(action) {
  return {
    saveDc: action?.save_dc || null,
    saveType: action?.save_type ? toAbbr(action.save_type) : null,
    dcSuccess: action?.save_dc != null ? 'half' : null,
    saveConditions: extractConditionsFromSaveEffect(action?.save_effect),
  };
}

// CLA-324: spell-origin marker for monster spell attacks (against_spell gates).
function isSpellOriginAction(action) {
  return action?.spell_attack_bonus != null
    || action?.spell_save_dc != null
    || /spell attack/i.test(action?.description || '');
}

function buildAttackRollOptions(v) {
  return {
    damageType: formatDamageTypes(v.primaryDamageType),
    damageTypeChoices: getDamageTypeChoices(v.action),
    resistanceNotice: v.resistanceNotice,
    forcedMode: resolveForcedMode(v.forcedMode, v.rangeForcedMode),
    isMelee: v.isMelee,
    isAutoCrit: v.isAutoCrit,
    isAutoMiss: v.isAutoMiss,
    rangeReason: v.rangeReason,
    coverAcBonus: v.coverAcBonus,
    coverLevel: v.coverLevel,
    coverReason: v.coverReason,
    ...buildAutoDamageOptions(v.action, v.name),
    targetName: v.target?.name,
    attackerName: v.monsterName,
    grazeDamage: v.grazeDamage,
    grazeAbilityMod: v.grazeAbilityMod,
    grazeAbilityName: 'STR',
    ...buildSaveOptions(v.action),
    isSpellDamage: isSpellOriginAction(v.action),
    chargeBonusOffer: buildChargeBonusOffer(v.action, v.name),
  };
}

function resolveAttackRange(action) {
  if (action?.reach) return rangeToFeet(action.reach);
  if (action?.range) return rangeToFeet(action.range);
  return 30;
}

function extractConditionKeys(creature) {
  return (creature?.conditions || []).map(c => c.key);
}

function resolveTargetSaveModifiers(target, targetComputed) {
  if (target?.type === 'player') return targetComputed?.saveModifiers;
  return target?.saveModifiers || [];
}

function resolveAttackerActionBlock(attackerConditions, monsterTargetEffects, campaignName, monsterName, actionName) {
  const cloudActionBlock = monsterTargetEffects.some(te => te.effect === 'no_action_and_bonus_action');
  if (!attackerConditions.some(c => CONDITIONS_THAT_CANNOT_ACT.has(c)) && !cloudActionBlock) return false;
  if (cloudActionBlock) {
    blockStinkingCloudAction(campaignName, monsterName, actionName);
  }
  return true;
}

function buildTargetEffectData({ target, targetComputed, targetConditions, targetSaveModifiers, allTargetEffects, campaignName, getAttackerCreature }) {
  const targetRiderForTarget = allTargetEffects.filter(te => te.target === target?.name);
  const targetEffectData = computeConditionEffects({ conditions: targetConditions, saveModifiers: targetSaveModifiers, targetEffects: targetRiderForTarget });
  applyElusive(targetEffectData, target, targetComputed, targetConditions);
  applyProtectionFromEvilPenalty(targetEffectData, target, campaignName, getAttackerCreature);
  return targetEffectData;
}

function hasPassiveRule(computedStats, effect) {
  return computedStats?.automation?.passives?.some(p => p.type === 'passive_rule' && p.effect === effect);
}

function hasMonsterPassive(monsterCharacter, effect) {
  return hasPassiveRule(monsterCharacter?.computedStats, effect);
}

function resolveCurrentAllies(storedAllies, monsterName) {
  return Array.isArray(storedAllies) && storedAllies.length > 0 ? storedAllies : [monsterName];
}

function computeShieldOfFaithBonus(activeBuffs) {
  return Array.isArray(activeBuffs) && activeBuffs.some(b => b.effect === 'shield_of_faith') ? 2 : 0;
}

function blockStinkingCloudAction(campaignName, monsterName, name) {
  addEntry(campaignName, {
    type: 'automation blocked',
    characterName: monsterName,
    abilityName: name,
    description: `${monsterName} is Poisoned by Stinking Cloud and can't take an Action or Bonus Action — ${name} refused.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[MonsterCardModal] Error:', e); });
}

// MA-0014: never die silently on an unparseable damage formula — log the refusal.
function logBlockedDamageRoll(campaignName, monsterName, name, formula) {
  console.error(`[MonsterCardModal] Unparseable damage formula for ${monsterName} — ${name}: "${formula}"`);
  addEntry(campaignName, {
    type: 'automation blocked',
    characterName: monsterName,
    abilityName: name,
    description: `${monsterName} ${name}: damage formula "${formula}" could not be rolled — GM adjudicate manually.`,
    timestamp: Date.now(),
  }).catch((e) => { console.error('[MonsterCardModal] Error logging blocked damage roll:', e); });
}

function hasRayOfEnfeebleOn(targetEffects, monsterName) {
  return targetEffects?.some(te => te.target === monsterName && te.effect === 'ray_of_enfeeble_debuff');
}

function rayDisadvantageContext(applies) {
  return applies ? { forcedMode: 'disadvantage' } : undefined;
}

function monsterSpellcastingMod(monster) {
  return Number(monster?.ability_score_modifiers?.wis) || 0;
}

async function resolveGatedSpellLevel(lastAttack) {
  if (!lastAttack) return 0;
  if (lastAttack.spellLevel != null) return Number(lastAttack.spellLevel) || 0;
  if (lastAttack.overchannelSpellLevel != null) return Number(lastAttack.overchannelSpellLevel) || 0;
  if (lastAttack.isCantrip === true) return 0;
  const spell = await findMonsterSpell(lastAttack.attackName);
  return spell?.level || 0;
}

async function findMonsterSpell(spellName) {
  const fiveESpells = await loadSpells('5e');
  const found = fiveESpells.find(s => s.name === spellName);
  if (found) return found;
  const spells2024 = await loadSpells('2024');
  return spells2024.find(s => s.name === spellName) || null;
}

// MA-0012: advisory cast logs print the row's authored save_dc/save_type
// (e.g. Aberrant Cultist "spell save DC 15, Wisdom") even when the spell's
// own spells.json entry carries no structured dc.
function buildMonsterSpellCastLog({ monsterName, spellName, spell, action, usesNote }) {
  const saveAbility = spell?.dc?.dc_type || action?.save_type || null;
  const saveNote = action?.save_dc != null ? ` (spell save DC ${action.save_dc}${saveAbility ? `, ${saveAbility}` : ''})` : '';
  const concentrationNote = spell?.concentration ? ` Concentration (${spell.duration || 'up to 1 minute'}).` : '';
  return `${monsterName} casts ${spellName} via Spellcasting${saveNote}.${concentrationNote}${usesNote || ''} Spell effect is recorded; GM-enforced for monsters.`;
}

function buildMonsterSpellCastEntry({ monsterName, spellName, spell, action, usesNote }) {
  return {
    type: 'ability_use',
    characterName: monsterName,
    abilityName: spellName,
    description: buildMonsterSpellCastLog({ monsterName, spellName, spell, action, usesNote }),
    timestamp: Date.now(),
  };
}

function spellUsesGate(monsterName, action, spellName) {
  const usesMax = extractSpellcastingSpellUses(action.description)[spellName] ?? null;
  const storedUses = getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY) || {};
  const used = Number(storedUses[spellName]) || 0;
  return { usesMax, used, storedUses, exhausted: usesMax != null && used >= usesMax };
}

// MA-0020: N/Day ability save rows (Aboleth Dominate Mind 2/Day) gate at
// click — exhausted means refusal popup + <slug>_refused log, zero save
// prompts. Spell-cast rows already paid their uses in handleSpellCast
// (MA-0005) so spellInfo rows skip this gate.
function resolveAbilityUsesGate({ action, spellInfo, monsterName, campaignName, setPopupHtml }) {
  const usesGate = spellInfo ? null : monsterAbilitySaveUsesGate(action, getRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY));
  if (!usesGate?.exhausted) return { refused: false, usesGate };
  setPopupHtml(buildAbilitySaveRefusalPopup({ monsterName, useKey: usesGate.useKey, maxUses: usesGate.maxUses }));
  addEntry(campaignName, buildAbilitySaveRefusalLog({ monsterName, useKey: usesGate.useKey, maxUses: usesGate.maxUses }))
    .catch((e) => { console.error('[MonsterCardModal] Error logging ability uses refusal:', e); });
  return { refused: true, usesGate: null };
}

function buildAbilitySaveRollContext({ monsterName, target, spellName, action, saveType, dcSuccess, saveDamageFormula, saveConditions, usesGate, prerequisite, getDamageTypesForAction }) {
  const primaryDamageType = getDamageTypesForAction(action)[0] || null;
  return {
    attackerName: monsterName,
    targetName: target?.name,
    actionName: spellName || action.name,
    spellName,
    saveDc: action.save_dc,
    saveType,
    dcSuccess,
    autoDamageFormula: saveDamageFormula,
    autoDamageDamageType: saveDamageFormula && primaryDamageType ? formatDamageTypes([primaryDamageType]) : null,
    autoDamageName: spellName || action.name,
    saveConditions,
    isSpellDamage: !!spellName,
    consumeMemoriesClause: !!prerequisite,
    // MA-0020: spend marker lands at prompt-confirm (saveProcessing); the
    // until-clause rides the condition meta as a GM-enforced durationNote.
    monsterAbilityUse: usesGate ? { useKey: usesGate.useKey, maxUses: usesGate.maxUses, actionName: spellName || action.name } : undefined,
    conditionDurationNote: extractConditionDurationNote(action?.save_effect),
  };
}

function buildMonsterSpellRefusalEntry({ monsterName, spellName, usesMax }) {
  return {
    type: 'automation blocked',
    characterName: monsterName,
    abilityName: spellName,
    description: `${monsterName} has already cast ${spellName} today (${usesMax}/Day) — ${spellName} refused. Uses reset at a long rest; GM-enforced for monsters.`,
    timestamp: Date.now(),
  };
}

function MonsterAttackPopup({ popupHtml, campaignName, monsterName, setPopupHtml, onQuickRoll, onChargeBonus, onChargeBonusDecline }) {
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <AttackResultPopup
        popupHtml={popupHtml}
        onClose={() => setPopupHtml(null)}
        campaignName={campaignName}
        attackerName={monsterName}
        setPopupHtml={setPopupHtml}
        onQuickRoll={popupHtml.waitingForPlayerSave ? () => onQuickRoll(popupHtml.promptId, popupHtml.targetName, popupHtml.saveType, popupHtml.saveDc) : undefined}
        onChargeBonus={onChargeBonus}
        onChargeBonusDecline={onChargeBonusDecline}
      />
    </div>
  );
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
  const currentAllies = resolveCurrentAllies(storedAllies, monsterName);
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
  const speedyOpportunityDisadvantage = hasMonsterPassive(monsterCharacter, 'opportunity_attacks_disadvantage');
  const speedyDifficultTerrainIgnore = hasMonsterPassive(monsterCharacter, 'ignore_difficult_terrain_on_dash');
  const monsterActiveBuffs = getRuntimeValue(monsterName, 'activeBuffs') || [];
  const shieldOfFaithBonus = computeShieldOfFaithBonus(monsterActiveBuffs);
  const monsterSpellUses = useRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY, campaignName);
  const monsterReactionUses = useRuntimeValue(monsterName, MONSTER_REACTION_USES_KEY, campaignName);
  // MA-0021: legendary uses map + round+turn latch subscription (header
  // counter reads used/max; the latch gates one-expend-per-turn server-side).
  const monsterLegendaryUses = useRuntimeValue(monsterName, 'monsterLegendaryUses', campaignName);

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
            if (autoDamage.hitClause) {
              context.hitClause = autoDamage.hitClause;
            }
            rollDamage({ name: autoDamage.name, formula: autoDamage.formula, total: result.total, rolls: result.rolls, modifier: result.modifier, context: context });
          } else {
            logBlockedDamageRoll(campaignName, monsterName, autoDamage.name || monsterName, autoDamage.formula);
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
    if (psychicStrikePreconditionFailed(name, target, allTargetEffects)) return;

    const primaryDamageType = action?.damage_type_primary ? [action.damage_type_primary] : [];
    const attackRange = resolveAttackRange(action);
    const isMeleeAttack = attackRange <= 5;

    const { grazeDamage, grazeAbilityMod } = computeGrazeSettings(isMeleeAttack, monsterCharacter);
    const { targetComputed, resistanceNotice } = resolveTargetDefense(target, creatures, primaryDamageType);

    const attackerConditions = extractConditionKeys(getAttackerCreature());
    const targetConditions = extractConditionKeys(target);

    const targetSaveModifiers = resolveTargetSaveModifiers(target, targetComputed);

    const attackerEffects = computeConditionEffects({ conditions: attackerConditions, saveModifiers: targetSaveModifiers, targetEffects: monsterTargetEffects, attackerSenses: monsterSensesArray })
    if (resolveAttackerActionBlock(attackerConditions, monsterTargetEffects, campaignName, monsterName, name)) return;

    const targetEffectData = buildTargetEffectData({ target, targetComputed, targetConditions, targetSaveModifiers, allTargetEffects, campaignName, getAttackerCreature });

    const effectiveBonus = bonus + (targetEffectData.riderAttackBonus || 0);

    const forcedMode = combineAttackModes(attackerEffects, targetEffectData, attackRange, target?.name);

    const isMelee = attackRange <= 5
    const isAutoCrit = isMelee && targetEffectData.autoCritWithin5ft

    const { isAutoMiss, rangeReason, rangeForcedMode } = computeMapRangeState(mapData, target, monsterName, attackRange);
    const { coverAcBonus, coverLevel, coverReason } = computeCoverState(isAutoMiss, target, characters, mapData, campaignName);

    rollAttack(name, effectiveBonus, buildAttackRollOptions({
      action,
      name,
      target,
      monsterName,
      primaryDamageType,
      resistanceNotice,
      forcedMode,
      rangeForcedMode,
      isMelee,
      isAutoCrit,
      isAutoMiss,
      rangeReason,
      coverAcBonus,
      coverLevel,
      coverReason,
      grazeDamage,
      grazeAbilityMod,
    }));
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
      rollDamage({ name: name, formula: formula, total: result.total, rolls: result.rolls, modifier: result.modifier, context: context });
    } else {
      logBlockedDamageRoll(campaignName, monsterName, name, formula);
    }
  };

  const handleAbilityCheck = (abbr, mod) => {
    const fullName = abilityNameMap[abbr] || abbr.toUpperCase();
    const context = rayDisadvantageContext(abbr === 'str' && hasRayOfEnfeebleOn(monsterTargetEffects, monsterName));
    rollAbilityCheck(fullName, mod, context);
  };

  const handleSaveThrow = (ability, mod) => rollSavingThrow(saveAbilityAbbr(ability), mod);

  const handleSkillCheck = (name, mod) => {
    const context = rayDisadvantageContext(name === 'Athletics' && hasRayOfEnfeebleOn(monsterTargetEffects, monsterName));
    rollSkillCheck(name, mod, context);
  };

  const handleInitiative = (bonus) => rollInitiative(bonus);

  // Block-save half-on-success is the app-wide dcSuccess convention (MV-20);
  // spell rows carry their own authored dc_success.
  function resolveBlockSaveDcSuccess(spellInfo, action) {
    if (spellInfo) return spellInfo.dcSuccess || null;
    return action.save_dc != null ? 'half' : null;
  }

  const handleSaveRoll = useCallback((action, saveDamageFormula, saveConditions, spellInfo) => {
    const target = getTarget();
    const gate = evaluateTargetPrerequisiteGate({ action, target, monsterName, campaignName, getRuntimeValue });
    if (!gate.satisfied) {
      setPopupHtml(gate.popupHtml);
      addEntry(campaignName, gate.refusalLog)
        .catch((e) => { console.error('[MonsterCardModal] Error logging prerequisite refusal:', e); });
      return;
    }
    const prerequisite = gate.prerequisite;
    const spellName = spellInfo?.spellName || null;
    const saveType = spellInfo?.saveType || action.save_type;
    const dcSuccess = resolveBlockSaveDcSuccess(spellInfo, action);
    const { refused, usesGate } = resolveAbilityUsesGate({ action, spellInfo, monsterName, campaignName, setPopupHtml });
    if (refused) return;
    console.debug(`[saveDebug] MonsterCardModal.handleSaveRoll`, {
      monsterName, actionName: spellName || action.name, saveDc: action.save_dc, saveType,
      target: target ? { name: target.name, type: target.type } : null,
      creaturesAvailable: Array.isArray(creatures),
    });
    const saveMod = getSaveModifierForSaveType(saveType, target, characters, creatures);
    rollSavingThrow(saveAbilityAbbr(saveType), saveMod, buildAbilitySaveRollContext({
      monsterName, target, spellName, action, saveType, dcSuccess, saveDamageFormula, saveConditions, usesGate, prerequisite, getDamageTypesForAction,
    }));
  }, [getTarget, characters, creatures, rollSavingThrow, monsterName, getDamageTypesForAction, campaignName, setPopupHtml]);

  const handleSpellCast = useCallback(async (action, spellName) => {
    const gate = spellUsesGate(monsterName, action, spellName);
    if (gate.exhausted) {
      await addEntry(campaignName, buildMonsterSpellRefusalEntry({ monsterName, spellName, usesMax: gate.usesMax }))
        .catch((e) => { console.error('[MonsterCardModal] Error logging monster spell refusal:', e); });
      return;
    }
    const spell = await findMonsterSpell(spellName);
    if (!spell) {
      console.error(`[MonsterCardModal] Spell '${spellName}' not found in spells.json (5e or 2024)`);
    }
    let usesNote = null;
    if (gate.usesMax != null) {
      usesNote = ` ${gate.usesMax}/Day use spent — ${gate.usesMax - gate.used - 1} remaining today (resets at a long rest, GM-enforced for monsters).`;
      await setRuntimeValue(monsterName, MONSTER_SPELL_USES_KEY, { ...gate.storedUses, [spellName]: gate.used + 1 }, campaignName);
      await addEntry(campaignName, {
        type: 'ability_use',
        characterName: monsterName,
        abilityName: spellName,
        description: `${monsterName} casts ${spellName} via Spellcasting.${usesNote}`,
        timestamp: Date.now(),
      }).catch((e) => { console.error('[MonsterCardModal] Error logging monster spell use spend:', e); });
    }
    if (spellHasDamage(spell)) {
      const dcSuccess = spell?.dc?.dc_success === 'none' ? 'none' : 'half';
      handleSaveRoll(action, spellDamageFormulaAtBaseLevel(spell), extractConditionsFromSaveEffect(spell?.save_effect), {
        spellName, saveType: spell?.dc?.dc_type || action.save_type, dcSuccess,
      });
      return;
    }
    // CLA-325 advisory model (GM-enforced for monsters): a non-damage utility spell
    // (e.g. Gust of Wind) records a spell-named cast + concentration marker and logs it;
    // there is no wind-line/zone engine consumer, so the effect is adjudicated by the GM.
    await addEntry(campaignName, buildMonsterSpellCastEntry({ monsterName, spellName, spell, action, usesNote }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging monster spell cast:', e); });
  }, [campaignName, monsterName, handleSaveRoll]);

  // MA-0006: gated monster reactions (Feather Fall 1/Day) — consumer of the
  // CLA-315 campaign lastAttack `trigger:'falling'` seam on the monster-card
  // path. Refusals log <effect>_refused and spend nothing; a successful use
  // spends 1/day with an ability_use log. Fall-damage negation is an
  // advisory record (GM-enforced for monsters, CLA-325 precedent — the app
  // has no fall-damage pipeline).
  // MA-0013: Counterspell (2/Day) routes through the same helper — gates on a
  // spell-origin campaign lastAttack by a PC attacker, resolves the CLA-322
  // check (level <3 auto; ≥3 d20+WIS vs DC 10+level) and stamps the triggering
  // cast resolved so the same cast can't be double-countered.
  const spellAbilityMod = monsterSpellcastingMod(monster);

  const handleGatedReaction = useCallback(async (action) => {
    if (!getGatedMonsterReaction(action)) return;
    await resolveMonsterGatedReaction({
      action,
      monsterName,
      campaignName,
      deps: { resolveSpellLevel: resolveGatedSpellLevel, spellAbilityMod },
    });
  }, [campaignName, monsterName, spellAbilityMod]);

  // MA-0021: legendary-row gated click — expend 1 use (round+turn latch,
  // refusal popup + legendary_use_refused zero-spend log) then resolve the
  // row's own mechanic as today (numeric chips roll via the existing
  // handlers, MA-0014 chip gate intact; non-numeric rows log the advisory).
  const handleLegendaryRow = (action) => resolveLegendaryRow({
    action, monsterName, monster, campaignName, setPopupHtml, handleAttack, handleSaveRoll, handleDamage,
  });

  // MA-0007: GM-adjudicated charge-damage clause (monsters.json conditional_damage).
  // Grant: roll the clause dice, apply as its own damage roll + hp_change, log the
  // clause. Decline: base damage only, logged. Base "Done" still applies the primary
  // formula in both cases. No offer is rendered on misses (gated in DiceRollResult).
  const resolveChargeBonus = useCallback(async (decision) => {
    const offer = popupHtml?.chargeBonusOffer;
    if (!offer || popupHtml?.chargeBonusResolved) return;
    const attackPopupSnapshot = popupHtml;
    if (decision === 'granted') {
      const target = getTarget();
      const wasCrit = Boolean(attackPopupSnapshot.isCrit || attackPopupSnapshot.isAutoCrit);
      const result = wasCrit ? rollExpressionDoubled(offer.formula) : rollExpression(offer.formula);
      if (!result) {
        console.error('[MonsterCardModal] Charge bonus roll failed for formula', offer.formula);
        return;
      }
      await rollDamage({
        name: `${offer.attackName} — Charge Bonus`,
        formula: offer.formula,
        total: result.total,
        rolls: result.rolls,
        modifier: result.modifier,
        context: { damageType: offer.damageType, targetName: target?.name, attackerName: monsterName, isAutoCrit: wasCrit },
      });
      await addEntry(campaignName, buildChargeBonusGrantLog({ monsterName, offer, total: result.total }))
        .catch((e) => { console.error('[MonsterCardModal] Error logging charge bonus grant:', e); });
      setPopupHtml({ ...attackPopupSnapshot, chargeBonusResolved: 'granted' });
      return;
    }
    await addEntry(campaignName, buildChargeBonusDeclineLog({ monsterName, offer }))
      .catch((e) => { console.error('[MonsterCardModal] Error logging charge bonus decline:', e); });
    setPopupHtml({ ...attackPopupSnapshot, chargeBonusResolved: 'declined' });
  }, [popupHtml, getTarget, rollDamage, setPopupHtml, campaignName, monsterName]);

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
        handleSpellCast={handleSpellCast}
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
        monsterSpellUses={monsterSpellUses}
        monsterReactionUses={monsterReactionUses}
        monsterLegendaryUses={monsterLegendaryUses}
        handleGatedReaction={handleGatedReaction}
        handleLegendaryRow={handleLegendaryRow}
      />
      {popupHtml && (
        <MonsterAttackPopup
          popupHtml={popupHtml}
          campaignName={campaignName}
          monsterName={monsterName}
          setPopupHtml={setPopupHtml}
          onQuickRoll={handleQuickRollWithEvasion}
          onChargeBonus={() => resolveChargeBonus('granted')}
          onChargeBonusDecline={() => resolveChargeBonus('declined')}
        />
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
