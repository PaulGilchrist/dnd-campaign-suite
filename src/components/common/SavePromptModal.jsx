import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import utils from '../../services/ui/utils.js';
import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import { sendSaveResult, clearSavePrompt } from '../../services/combat/conditions/savePromptService.js';
import Subscriber from './Subscriber.jsx';
import { getSaveDisadvantage, getHolyAuraSaveAdvantage, getHolyNimbusSaveAdvantage } from './savePromptUtils.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getAbilitySaveBonus } from '../../services/combat/conditions/conditionUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getPendingSavePrompt } from '../../services/combat/auras/pendingSaveRegistry.js';
import { addEntry } from '../../services/ui/logService.js';
import { normalizeSaveType } from '../../services/rules/combat/applyDamage.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import storage from '../../services/ui/storage.js';
import './SavePromptModal.css';
import { getPendingPopupSetter } from '../../services/combat/auras/pendingPopupRegistry.js';
import { isCircleOfPowerActive } from '../../services/automation/handlers/buffs/circleOfPowerHandler.js';
import { hasBuffEffect } from '../../services/automation/common/buffToggle.js';
import { useSaveRerollHandlers } from './useSaveRerollHandlers.js';
import { evaluateAutoExpression } from '../../services/combat/automation/automationService.js';

const GUARDED_MIND_SAVE_TYPES = ['Intelligence', 'Wisdom', 'Charisma', 'INT', 'WIS', 'CHA'];

function hasShareableEvasionFor(current, characters) {
  if (current.dcSuccess !== 'half') return false;
  const normalizedSaveType = normalizeSaveType(current.saveType);
  return (characters || []).some(c => {
    if (utils.getName(c.name) === utils.getName(current.targetName)) return false;
    const ev = c?.computedStats?.evasionEffects;
    return ev?.some(ef => ef.saveType === normalizedSaveType && ef.shareable && ef.shareRange >= 5);
  });
}

// Reads active conditions once and answers whether the target (or its own
// feature) grants evasion for this save. Shared by roll logic and the note UI.
function getEvasionContext(current, characters, campaignName) {
  const targetConditions = getRuntimeValue(current.targetName, 'activeConditions', campaignName) || [];
  const isIncapacitated = targetConditions.some(c => String(c).toLowerCase() === 'incapacitated');
  const targetChar = (characters || []).find(c => utils.getName(c.name) === utils.getName(current.targetName));
  const ownEvasion = targetChar?.computedStats?.evasionEffects;
  const normalizedSaveType = normalizeSaveType(current.saveType);
  const hasOwnEvasion = !isIncapacitated && ownEvasion?.some(ef => ef.saveType === normalizedSaveType);
  return { isIncapacitated, hasOwnEvasion };
}

function resolveTargetSaveBonus(current, characters, campaignName) {
  let saveBonus = 0;
  let saveModifiers = null;
  let activeConditions = [];
  let character = null;
  try {
    character = (characters || []).find(c => {
      const name = typeof c === 'string' ? c : c.name;
      return name && utils.getName(name) === utils.getName(current.targetName);
    });
    if (character && typeof character !== 'string') {
      saveBonus = getAbilitySaveBonus(character.computedStats || character, current.saveType);
      saveModifiers = character.saveModifiers || character.computedStats?.saveModifiers;
      activeConditions = getRuntimeValue(current.targetName, 'activeConditions') || [];
    }
  } catch { /* ignore */ }

  if (!character) {
    const combatSummary = getCombatSummary(campaignName);
    const creature = combatSummary?.creatures?.find(
      c => utils.getName(c.name) === utils.getName(current.targetName)
    );
    if (creature) {
      saveBonus = creature.saveBonuses?.[current.saveType?.toLowerCase()] ?? 0;
    }
  }

  return { saveBonus, saveModifiers, activeConditions };
}

function modifierListGrantsAdvantage(current, saveModifiers, activeConditions, campaignName) {
  const conditionSet = new Set(activeConditions);
  for (const mod of saveModifiers) {
    if (mod.target !== 'saving_throw' || mod.effect !== 'advantage') continue;
    if (mod.condition === 'against_spell') {
      // CLA-324: against_spell advantage only on saves against spells — spell-origin is
      // identifiable from the prompt flag (monster-card save attacks, spell save-damage
      // prompts) or a spell-save-owned campaign lastAttack from the spell pipeline.
      const lastAttackOrigin = getRuntimeValue('campaign', 'lastAttack', campaignName) || {};
      const spellOrigin = current.isSpellDamage === true ||
        (lastAttackOrigin.rollType === 'spell-save' && (!current.attackerName || lastAttackOrigin.attackerName === current.attackerName));
      if (spellOrigin) return true;
    }
    if (mod.condition && conditionSet.has(mod.condition)) return true;
    if (mod.saveType && current.condition && mod.condition === current.condition) return true;
  }
  return false;
}

function isDodgeDexAdvantage(current, campaignName) {
  const targetActiveBuffs = getRuntimeValue(current?.targetName, 'activeBuffs', campaignName) || [];
  const isDodgeActive = Array.isArray(targetActiveBuffs) && targetActiveBuffs.some(b => b.effect === 'dodge');
  const isDexSave = (current.saveType || '').toUpperCase() === 'DEX';
  return isDodgeActive && isDexSave;
}

function isBeaconOfHopeAdvantage(current, characters) {
  const targetCharForBeacon = (characters || []).find(c => utils.getName(c.name) === utils.getName(current.targetName));
  return !!targetCharForBeacon?.targetEffects?.some(te => te.effect === 'beacon_of_hope') && (current.saveType || '').toUpperCase() === 'WIS';
}

function computeSaveAdvantage({ current, campaignName, hasDisadvantage, saveModifiers, activeConditions, characters }) {
  if (current.advantage) return true;
  if (hasDisadvantage) return false;
  if (saveModifiers && saveModifiers.length > 0 && modifierListGrantsAdvantage(current, saveModifiers, activeConditions, campaignName)) return true;
  // Dodge: advantage on Dexterity saving throws only
  if (isDodgeDexAdvantage(current, campaignName)) return true;
  // CLA-394 Zealous Presence: blanket advantage on saving throws (buff effect
  // advantage_attacks_and_saves) — mirrors the Dodge block shape.
  if (hasBuffEffect(current?.targetName, 'advantage_attacks_and_saves', campaignName)) return true;
  // Beacon of Hope: advantage on Wisdom saving throws
  if (isBeaconOfHopeAdvantage(current, characters)) return true;
  // Circle of Power: blanket advantage on saving throws
  if (isCircleOfPowerActive(current.targetName, campaignName)) return true;
  // Holy Aura: advantage on all saving throws for warded targets
  if (getHolyAuraSaveAdvantage(current, campaignName)) return true;
  // Source-restricted save advantage (e.g. Holy Nimbus: advantage against Fiends/Undead for allies)
  return !!getHolyNimbusSaveAdvantage(current, characters, campaignName);
}

function consumeCosmicOmen(campaignName) {
  const cosmicOmenPendingRaw = getRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus');
  if (cosmicOmenPendingRaw) {
    try {
      const pending = JSON.parse(cosmicOmenPendingRaw);
      if (pending && typeof pending.value === 'number' && pending.value > 0) {
        const isWeal = pending.type === 'Weal';
        const bonus = isWeal ? pending.value : -pending.value;
        const detail = `(${bonus} from ${pending.type})`;
        setRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus', null, campaignName, true);
        return { bonus, detail };
      }
    } catch (_e) { /* ignore */ }
  }
  return { bonus: 0, detail: '' };
}

// Rolls 1d4 only when at least one matching targetEffect exists for the target.
function rollEffectDie(allTargetEffects, targetName, effect) {
  if (!targetName) return null;
  if (allTargetEffects.filter(te => te.target === targetName && te.effect === effect).length === 0) return null;
  return rollExpression('1d4');
}

// Bane/bless effect dice for the target and its attacker. Rolls in the same
// order as the original inline block: target bane, attacker bane, target bless.
function rollEffectDieContributions(allTargetEffects, current) {
  const baneSaveDie = rollEffectDie(allTargetEffects, current.targetName, 'bane_penalty');
  const baneAttackerDie = current.attackerName ? rollEffectDie(allTargetEffects, current.attackerName, 'bane_penalty') : null;
  const blessSaveDie = rollEffectDie(allTargetEffects, current.targetName, 'bless_bonus');
  return {
    baneSaveRoll: baneSaveDie ? baneSaveDie.total : null,
    baneSavePenalty: baneSaveDie ? -baneSaveDie.total : 0,
    baneAttackerBonus: baneAttackerDie ? baneAttackerDie.total : 0,
    baneAttackerRoll: baneAttackerDie ? baneAttackerDie.total : null,
    blessSaveBonus: blessSaveDie ? blessSaveDie.total : 0,
    blessSaveRoll: blessSaveDie ? blessSaveDie.total : null,
  };
}

function findWardingBondSaveBonus(current, campaignName) {
  const targetBuffs = getRuntimeValue(current.targetName, 'activeBuffs', campaignName);
  const targetActiveBuffs = Array.isArray(targetBuffs) ? targetBuffs : [];
  const wardingBondBuff = targetActiveBuffs.find(b => b.effect === 'warding_bond' && b.saveBonus);
  return wardingBondBuff ? wardingBondBuff.saveBonus : 0;
}

function buildBonusDetail({ auraBonusStr, cosmicOmenDetail, baneSaveRoll, baneAttackerRoll, blessSaveRoll, wardingBondSaveBonus }) {
  const bonusDetailParts = [auraBonusStr, cosmicOmenDetail];
  if (baneSaveRoll) {
    bonusDetailParts.push(`-${baneSaveRoll} [Bane]`);
  }
  if (baneAttackerRoll) {
    bonusDetailParts.push(`+${baneAttackerRoll} [Bane]`);
  }
  if (blessSaveRoll) {
    bonusDetailParts.push(`+${blessSaveRoll} [Bless]`);
  }
  if (wardingBondSaveBonus > 0) {
    bonusDetailParts.push(`+${wardingBondSaveBonus} [Warding Bond]`);
  }
  return bonusDetailParts.filter(Boolean).join(' ') || undefined;
}

function buildSaveDamageFields(current) {
  const rawDamage = current.rawDamage || 0;
  const damageType = current.damageType || null;
  return {
    damageFormula: current.damageFormula || null,
    attackName: current.sourceName || current.name || null,
    damageType,
    rawDamage,
    primaryDamage: rawDamage,
    primaryDamageType: damageType,
    actualDamage: rawDamage,
    damageApplied: rawDamage > 0,
  };
}

function buildSecondaryDamageFields(current) {
  if (!current.secondaryFormula) return {};
  return {
    secondaryFormula: current.secondaryFormula,
    secondaryDamageType: current.secondaryDamageType || null,
    secondaryRawDamage: current.secondaryRawDamage || 0,
    secondaryTotal: current.secondaryRawDamage || 0,
  };
}

function buildLastAttackData(current, { finalRoll, roll1, roll2, saveBonus, auraBonus, cosmicOmenAppliedBonus, total, success }) {
  return {
    attackerName: current.attackerName || current.targetName,
    targetName: current.targetName,
    d20: finalRoll,
    d20Rolls: [roll1, roll2],
    bonus: saveBonus + auraBonus + cosmicOmenAppliedBonus,
    total,
    rollType: 'save',
    saveType: current.saveType || null,
    saveDc: current.saveDc,
    saveResult: success ? 'success' : 'failure',
    saveConditions: current.condition ? [current.condition] : [],
    ...buildSaveDamageFields(current),
    ...buildSecondaryDamageFields(current),
    timestamp: Date.now(),
  };
}

// Full save-roll resolution: evasion, advantage/disadvantage, dice, and all
// bonus contributions (aura, cosmic omen, bane, bless, warding bond).
async function computeSaveRollOutcome({ current, characters, campaignName, activeMapName, hasSelectedEvasion, forceRollTo20 }) {
  const { saveBonus, saveModifiers, activeConditions } = resolveTargetSaveBonus(current, characters, campaignName);

  const aura = await computeAuraBonus({ targetName: current.targetName, characters, campaignName, activeMapName, allCreatures: getCombatSummary(campaignName)?.creatures });
  const auraBonus = aura.bonus;

  const { isIncapacitated, hasOwnEvasion } = getEvasionContext(current, characters, campaignName);
  const hasEvasion = hasOwnEvasion || (!hasOwnEvasion && !isIncapacitated && hasSelectedEvasion) || isCircleOfPowerActive(current.targetName, campaignName);

  const hasDisadvantage = getSaveDisadvantage(current, campaignName);
  const hasAdvantage = computeSaveAdvantage({ current, campaignName, hasDisadvantage, saveModifiers, activeConditions, characters });

  const roll1 = forceRollTo20 ? 20 : rollD20();
  const roll2 = (hasDisadvantage || hasAdvantage) ? rollD20() : roll1;
  const finalRoll = hasDisadvantage ? Math.min(roll1, roll2) : hasAdvantage ? Math.max(roll1, roll2) : roll1;
  const { bonus: cosmicOmenAppliedBonus, detail: cosmicOmenDetail } = consumeCosmicOmen(campaignName);

  // Bane (target + attacker) and bless effect dice, then Warding Bond flat bonus.
  const { baneSaveRoll, baneSavePenalty, baneAttackerBonus, baneAttackerRoll, blessSaveBonus, blessSaveRoll } =
    rollEffectDieContributions(getRuntimeValue('campaign', 'targetEffects') || [], current);

  // Warding Bond: +1 flat bonus to saving throws
  const wardingBondSaveBonus = findWardingBondSaveBonus(current, campaignName);

  const total = finalRoll + saveBonus + auraBonus + cosmicOmenAppliedBonus + baneSavePenalty + blessSaveBonus + baneAttackerBonus + wardingBondSaveBonus;
  const success = total >= current.saveDc;
  const auraBonusStr = auraBonus > 0 ? `(+${auraBonus} aura${aura.sourceName ? ' from ' + aura.sourceName : ''})` : undefined;
  const bonusDetail = buildBonusDetail({ auraBonusStr, cosmicOmenDetail, baneSaveRoll, baneAttackerRoll, blessSaveRoll, wardingBondSaveBonus });
  const rollMode = hasDisadvantage ? 'disadvantage' : hasAdvantage ? 'advantage' : 'normal';
  const saveBonusTotal = saveBonus + auraBonus + cosmicOmenAppliedBonus + baneSavePenalty + blessSaveBonus + baneAttackerBonus + wardingBondSaveBonus;

  return {
    hasEvasion, finalRoll, roll1, roll2, saveBonus, auraBonus, cosmicOmenAppliedBonus, total, success,
    result: { success, roll: finalRoll, total, saveBonus: saveBonusTotal, bonusDetail, rawRolls: [roll1, roll2], mode: rollMode, baneRoll: baneSaveRoll, blessRoll: blessSaveRoll, baneAttackerRoll: baneAttackerRoll },
  };
}

function buildResultDispatchDetail(campaignName, current, result, saveBonus, rawRolls, rollMode, evasionActive) {
  return {
    promptId: current.promptId,
    targetName: current.targetName,
    saveType: current.saveType,
    saveDc: current.saveDc,
    success: result.success,
    roll: result.roll,
    total: result.total,
    saveBonus,
    bonusDetail: result.bonusDetail,
    rawDamage: current.rawDamage,
    dcSuccess: current.dcSuccess,
    rawRolls,
    mode: rollMode,
    evasionActive,
  };
}

function computePromptDisplayState(current, campaignName) {
  return {
    abilityLabel: current ? (current.saveType || '').toUpperCase() : '',
    promptHasDisadvantage: current ? getSaveDisadvantage(current, campaignName) : false,
    promptHasAdvantage: current ? (!!current.advantage || getHolyAuraSaveAdvantage(current, campaignName)) : false,
  };
}

function findTargetCharacter(current, characters) {
  if (!current) return null;
  return (characters || []).find(c => {
    const name = typeof c === 'string' ? c : c.name;
    return name && utils.getName(name) === utils.getName(current.targetName);
  }) || null;
}

function appendSavePrompt(prev, event, prefix) {
  if (prev.some(p => p.promptId === event.data.promptId)) return prev;
  const { sourceAttackerName, attackerName: eventDataAttackerName, targetName: dataTargetName, ...restData } = event.data;
  const targetName = dataTargetName || event.key.slice(prefix.length) || null;
  const newPrompt = { targetName, attackerName: eventDataAttackerName || sourceAttackerName, ...restData };

  console.debug(`[saveDebug] SavePromptModal.handleEvent SSE prompt received`, { promptId: newPrompt.promptId, targetName: newPrompt.targetName, sourceName: newPrompt.sourceName, saveType: newPrompt.saveType, saveDc: newPrompt.saveDc, keys: Object.keys(newPrompt) });
  return [...prev, newPrompt];
}

// Shared submit path for Dismiss/Done with a resolved result.
function submitResultAndClear(campaignName, current, result, { includeBaneRoll, evasionActive, sendExtra, advance }) {
  const saveBonus = result.saveBonus;
  const rollMode = result.mode || 'normal';
  const rawRolls = result.rawRolls || [result.roll];

  sendSaveResult(campaignName, current.targetName, {
    promptId: current.promptId,
    success: result.success,
    roll: result.roll,
    total: result.total,
    saveBonus,
    rawRolls,
    mode: rollMode,
    bonusDetail: result.bonusDetail,
    ...sendExtra,
  });

  window.dispatchEvent(new CustomEvent('save-result', {
    detail: {
      ...buildResultDispatchDetail(campaignName, current, result, saveBonus, rawRolls, rollMode, evasionActive),
      ...(includeBaneRoll ? { baneRoll: result.baneRoll } : {}),
    },
  }));

  clearSavePrompt(campaignName, current.targetName);
  advance();
}

function applyRerollToCombatSummary(campaignName, { roll, rawRolls, saveBonus, total, saveType, saveDc, success, condition, secondaryFormula, secondaryDamageType, secondaryRawDamage }) {
  const cs = getCombatSummary(campaignName);
  if (!cs) return;
  cs.lastAttack = {
    ...cs.lastAttack, d20: roll, d20Rolls: rawRolls, bonus: saveBonus, total,
    saveType: saveType || null, saveDc, saveResult: success ? 'success' : 'failure',
    saveConditions: condition ? [condition] : [], timestamp: Date.now(),
    ...(secondaryFormula ? {
      secondaryFormula, secondaryDamageType: secondaryDamageType || null,
      secondaryRawDamage: secondaryRawDamage || 0, secondaryTotal: secondaryRawDamage || 0,
    } : {}),
  };
  storage.set('combatSummary', cs, campaignName);
}

function restoreHpAfterSuccessfulReroll(campaignName, { targetName, rawDamage, dcSuccess, healingName, healingNote }) {
  const lastAttack = getRuntimeValue('campaign', 'lastAttack', campaignName);
  const actualDamageApplied = lastAttack?.finalDamage ?? lastAttack?.primaryDamage ?? rawDamage;
  const damageToRestore = dcSuccess === 'half' ? Math.ceil(actualDamageApplied / 2) : actualDamageApplied;
  const currentHp = getRuntimeValue(targetName, 'hitPoints', campaignName);
  const maxHp = getRuntimeValue(targetName, 'maxHitPoints', campaignName) ?? (currentHp + actualDamageApplied);
  const restoredHp = Math.min(maxHp, (currentHp ?? 0) + damageToRestore);
  setRuntimeValue(targetName, 'hitPoints', restoredHp, campaignName);

  addEntry(campaignName, {
    type: 'roll', characterName: targetName, rollType: 'healing',
    name: healingName || 'Save Reroll', rolls: [], total: damageToRestore,
    modifier: 0, damageType: null, targetName, finalDamage: null,
    note: healingNote || 'save_reroll_hp_restore', timestamp: Date.now(),
  }).catch((e) => { console.error('[SavePromptModal] Error logging HP restore:', e); });
}

// Reroll submit path: posts the rerolled result, logs it, updates combat
// summary, restores HP on success, and clears the prompt.
function createSubmitSaveResult(campaignName, setPrompts) {
  return (saveData) => {
    const {
      promptId, targetName, success, roll, total, saveBonus, rawRolls, mode, bonusDetail,
      saveType, saveDc, sourceName, damageFormula, damageType, rawDamage, dcSuccess,
      note, healingName, healingNote,
    } = saveData;

    sendSaveResult(campaignName, targetName, {
      promptId, success, roll, total, saveBonus, rawRolls, mode, bonusDetail,
    });
    setPrompts(prev => prev.map((p, i) =>
      i === 0
        ? { ...p, result: { success, roll, total, saveBonus, bonusDetail, rawRolls, mode } }
        : p
    ));

    addEntry(campaignName, {
      type: 'roll', rollType: 'save-damage', name: sourceName || 'Unknown',
      formula: damageFormula || '', rolls: [roll], total,
      modifier: saveBonus, damageType: damageType || null, targetName,
      saveType: saveType || null, saveDc, saveResult: success ? 'success' : 'failure',
      saveRoll: roll, saveBonus, saveRawRolls: rawRolls, finalDamage: null,
      note: note || 'save_reroll', timestamp: Date.now(),
    }).catch((e) => { console.error('[SavePromptModal] Error logging reroll:', e); });

    applyRerollToCombatSummary(campaignName, saveData);

    if (success && rawDamage > 0) {
      restoreHpAfterSuccessfulReroll(campaignName, { targetName, rawDamage, dcSuccess, healingName, healingNote });
    }

    clearSavePrompt(campaignName, targetName);
  };
}

function isRaging(activeBuffs) {
  return Array.isArray(activeBuffs) && activeBuffs.some(b => b.damageBonusExpression);
}

function resolveCurrentFocusPoints(current, targetCharacter, campaignName) {
  const targetClassLevel = targetCharacter?.class?.class_levels?.[(targetCharacter.level || 1) - 1] || {};
  const maxFocusPoints = targetClassLevel.focus_points || 0;
  return current ? Number(getRuntimeValue(current.targetName, 'focusPoints', campaignName) ?? maxFocusPoints) : 0;
}

function findGuardedMindAction(targetCharacter) {
  return (targetCharacter?.computedStats?.automation?.specialActions || []).find(
    a => a.type === 'auto_reroll' && a.effect === 'override_fail_to_success' && a.oncePer === 'short_or_long_rest'
  );
}

// Indomitable (Fighter lv9+): reroll a failed save with a +fighter level bonus,
// tracked via runtime `indomitableUses` (recharged on a Long Rest).
function resolveIndomitableReroll(targetCharacter) {
  const modifiers = targetCharacter?.saveModifiers || targetCharacter?.computedStats?.saveModifiers || [];
  const modifier = modifiers.find(
    m => m.effect === 'reroll' && m.target === 'saving_throw' && (m.source === 'Indomitable' || /fighter_level/i.test(m.bonusExpression || ''))
  );
  const featureLevel = targetCharacter?.level ?? targetCharacter?.computedStats?.level ?? 0;
  const maxUses = featureLevel >= 17 ? 3 : featureLevel >= 13 ? 2 : 1;
  const rerollBonus = modifier
    ? (evaluateAutoExpression(modifier.bonusExpression || '0', { level: featureLevel }) || featureLevel)
    : 0;
  return { modifier, maxUses, rerollBonus };
}

function computeRerollAvailability(current, targetCharacter, campaignName) {
  const fanaticalFocusUsed = current ? getRuntimeValue(current.targetName, 'fanaticalFocusUsed', campaignName) : false;
  const isRagingForSave = isRaging(getRuntimeValue(current?.targetName, 'activeBuffs', campaignName) || []);
  const livingLegendActive = current ? getRuntimeValue(current.targetName, 'livingLegendActive', campaignName) === true : false;
  const indomitableUses = current ? Number(getRuntimeValue(current?.targetName, 'indomitableUses', campaignName) ?? 0) : 0;
  const currentFocusPoints = resolveCurrentFocusPoints(current, targetCharacter, campaignName);
  const guardedMindUsed = current ? getRuntimeValue(current.targetName, '_guardedMind_usedRest', campaignName) : false;

  const guardedMindSpecialAction = findGuardedMindAction(targetCharacter);
  const isValidSaveType = !!current && GUARDED_MIND_SAVE_TYPES.includes(current.saveType);
  const indomitable = resolveIndomitableReroll(targetCharacter);

  return {
    fanaticalFocusAvailable: isRagingForSave && !fanaticalFocusUsed,
    currentFocusPoints,
    disciplinedSurvivorAvailable: !fanaticalFocusUsed && currentFocusPoints > 0,
    livingLegendAvailable: livingLegendActive && !fanaticalFocusUsed && indomitableUses < 1,
    guardedMindAvailable: !guardedMindUsed && !!guardedMindSpecialAction && isValidSaveType,
    indomitableAvailable: !!indomitable.modifier && indomitableUses < indomitable.maxUses,
    indomitableUses,
    indomitableMaxUses: indomitable.maxUses,
    indomitableRerollBonus: indomitable.rerollBonus,
  };
}

function EvasionNote({ current, characters, campaignName }) {
  const { isIncapacitated, hasOwnEvasion } = getEvasionContext(current, characters, campaignName);
  const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && hasShareableEvasionFor(current, characters);
  const hasEvasion = hasOwnEvasion || hasSharedEvasion || isCircleOfPowerActive(current.targetName, campaignName);
  return hasEvasion
    ? <p className="sp-note sp-evasion">Evasion: No damage on success, half damage on failure</p>
    : <p className="sp-note">Half damage on successful save</p>;
}

function rollBreakdownText(result) {
  const hasDoubleRoll = result.mode !== 'normal' && Array.isArray(result.rawRolls) && result.rawRolls.length === 2;
  const rolls = hasDoubleRoll ? `${result.rawRolls[0]}, ${result.rawRolls[1]}` : result.roll;
  const bonusDetail = result.bonusDetail ? ` ${result.bonusDetail}` : '';
  const modeLabel = result.mode === 'advantage' ? ' (Advantage)' : result.mode === 'disadvantage' ? ' (Disadvantage)' : '';
  return `d20 (${rolls}) + ${result.saveBonus}${bonusDetail}${modeLabel}`;
}

const REROLL_BUTTONS = [
  { key: 'fanaticalFocusAvailable', handler: 'fanaticalFocus', icon: 'fa-rotate', label: (a) => `Reroll Save (+${a.rageDamageBonus})` },
  { key: 'indomitableAvailable', handler: 'indomitable', icon: 'fa-rotate', label: (a) => `Indomitable (+${a.indomitableRerollBonus})` },
  { key: 'disciplinedSurvivorAvailable', handler: 'disciplinedSurvivor', icon: 'fa-rotate', label: () => 'Reroll Save (1 Focus Point)' },
  { key: 'livingLegendAvailable', handler: 'livingLegend', icon: 'fa-rotate', label: () => 'Reroll Save' },
  { key: 'guardedMindAvailable', handler: 'guardedMind', icon: 'fa-shield-halved', label: () => 'Guarded Mind' },
];

function SaveResultPanel({ current, rerollUsedForSave, availability, handlers }) {
  const result = current.result;
  const showReroll = !result.success && !rerollUsedForSave;
  return (
    <div className={`sp-result ${result.success ? 'sp-result-success' : 'sp-result-fail'}`}>
      <p className="sp-result-label">{result.success ? 'SAVE SUCCESS' : 'SAVE FAILURE'}</p>
      <p className="sp-result-total">Total: <strong>{result.total}</strong> vs DC {current.saveDc}</p>
      <p className="sp-result-breakdown">{rollBreakdownText(result)}</p>
      {showReroll && REROLL_BUTTONS.filter(b => availability[b.key]).map(b => (
        <button key={b.key} className="sp-stroke-btn" onClick={handlers[b.handler]} type="button">
          <i className={`fa-solid ${b.icon}`}></i> {b.label(availability)}
        </button>
      ))}
    </div>
  );
}

function withToggledAlly(selection, targetName) {
  const currentSelection = selection?.selectedAllies || [];
  return {
    selectedAllies: currentSelection.includes(targetName)
      ? currentSelection.filter(n => n !== targetName)
      : [...currentSelection, targetName],
  };
}

function EvasionSelectionOverlay({ prompts, evasionSelection, onSelectionChange, onConfirm, onSkip }) {
  const selected = evasionSelection?.selectedAllies || [];
  return (
    <div className="sp-overlay sp-overlay--evasion" onClick={(e) => {
      if (e.target.closest('.sp-modal')) return;
      onSkip?.();
    }}>
      <div className="sp-modal">
        <div className="sp-header">
          <i className="fa-solid fa-shield-halved"></i> Leading Evasion — Choose Allies
        </div>
        <div className="sp-body">
          <p>Which of the following creatures making this save should benefit from <strong>Leading Evasion</strong>?</p>
          <p className="sp-note">Select all allies within 5 feet of the Bard. On a successful save, selected allies take no damage. On a failure, they take half damage.</p>
          <div className="secondary-target-list">
            {prompts.map((prompt, i) => (
              <label
                key={i}
                className={`secondary-target-row ${selected.includes(prompt.targetName) ? 'secondary-target-selected' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectionChange(withToggledAlly(evasionSelection, prompt.targetName));
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(prompt.targetName)}
                  onChange={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="secondary-target-name">
                  <strong>{prompt.targetName}</strong>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="sp-actions">
          <button
            className="sp-roll-btn"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(selected);
            }}
            disabled={selected.length === 0}
            type="button"
          >
            <i className="fa-solid fa-shield-halved"></i> Apply Evasion ({selected.length})
          </button>
          <button className="sp-dismiss-btn" onClick={(e) => {
            e.stopPropagation();
            onSkip();
          }} type="button">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function SavePromptDialog({
  current, prompts, dimmed, characters, campaignName, display, hasResult,
  rerollUsedForSave, rerollAvailability, handlers,
}) {
  const { abilityLabel, promptHasDisadvantage, promptHasAdvantage } = display;
  const queueCount = prompts.length;
  return (
    <div className={`sp-overlay${dimmed ? ' sp-overlay--dimmed' : ''}`} onClick={(e) => {
      if (e.target.closest('.sp-modal')) return;
      handlers.dismiss?.();
    }}>
      <div className="sp-modal">
        <div className="sp-header">
          <i className="fa-solid fa-shield-halved"></i> Saving Throw Required
          {queueCount > 1 && (
            <span className="sp-queue-info"> ({prompts.findIndex(p => p.promptId === current.promptId) + 1} of {queueCount})</span>
          )}
        </div>
        <div className="sp-body">
          <p><strong>{current.targetName}</strong> must make a <strong>{abilityLabel}</strong> saving throw.{promptHasAdvantage ? <span className="sp-advantage-badge"> (Advantage)</span> : ''}{promptHasDisadvantage ? <span className="sp-disadvantage-badge"> (Disadvantage)</span> : ''}</p>
          <p className="sp-dc">DC {current.saveDc}</p>
          {current.dcSuccess === 'half' && (
            <EvasionNote current={current} characters={characters} campaignName={campaignName} />
          )}
          {current.dcSuccess === 'none' && <p className="sp-note">No damage on successful save</p>}
          {current.sourceName && <p className="sp-source">Source: {current.sourceName}</p>}
          {hasResult && (
            <SaveResultPanel
              current={current}
              rerollUsedForSave={rerollUsedForSave}
              availability={rerollAvailability}
              handlers={{
                fanaticalFocus: handlers.fanaticalFocus,
                indomitable: handlers.indomitable,
                disciplinedSurvivor: handlers.disciplinedSurvivor,
                livingLegend: handlers.livingLegend,
                guardedMind: handlers.guardedMind,
              }}
            />
          )}
        </div>
        <div className="sp-actions">
          {!hasResult ? (
            <>
              <button className="sp-roll-btn" onClick={handlers.rollSave} type="button">
                <i className="fa-solid fa-dice-d20"></i> Roll Save
              </button>
              <button className="sp-dismiss-btn" onClick={handlers.dismiss} type="button">
                Dismiss
              </button>
            </>
          )               : (
            <button className="sp-roll-btn" onClick={handlers.done} type="button">
              {queueCount > 1 ? 'Next Save' : 'Done'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SavePromptModal({ campaignName, characters, activeMapName }) {
  const [prompts, setPrompts] = useState([]);
  const [evasionSelection, setEvasionSelection] = useState(null);
  const [rerollUsedForSave, setRerollUsedForSave] = useState(false);
  const [lastEvasionState, setLastEvasionState] = useState(false);
  const forceRollTo20Ref = useRef(false);
  const selectedAlliesRef = useRef(new Set());

  const current = prompts.length > 0 ? prompts[0] : null;

  const hasShareableEvasion = !current ? false : hasShareableEvasionFor(current, characters);

  const evasionTriggeredIdsRef = useRef(new Set());

  useEffect(() => {
    if (current && hasShareableEvasion && !evasionTriggeredIdsRef.current.has(current.promptId)) {
      evasionTriggeredIdsRef.current.add(current.promptId);
      setEvasionSelection({ selectedAllies: [] });
    }
  }, [current, hasShareableEvasion]);

  const advance = useCallback(() => {
    setPrompts(prev => prev.slice(1));
  }, []);

  const handleEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-savePrompt-`;
    if (!event.key.startsWith(prefix)) return;
    setPrompts(prev => appendSavePrompt(prev, event, prefix));
   }, [campaignName]);

  const handleClearedEvent = useCallback((event) => {
    if (!event.key || event.data == null) return;
    const prefix = `change-${campaignName}-savePromptCleared-`;
    if (!event.key.startsWith(prefix)) return;
    if (!event.data?.promptId) return;
    getPendingSavePrompt(event.data.promptId);
    getPendingPopupSetter(event.data.promptId);
    setPrompts(prev => prev.filter(p => p.promptId !== event.data.promptId));
  }, [campaignName]);

  const handleDismiss = useCallback(() => {
    if (!current) return;
    if (current.result) {
      submitResultAndClear(campaignName, current, current.result, { includeBaneRoll: false, evasionActive: lastEvasionState, advance });
      return;
    }
    clearSavePrompt(campaignName, current.targetName);
    advance();
  }, [campaignName, current, lastEvasionState, advance]);

  const handleRollSave = useCallback(async () => {
    if (!current) return;

    const { hasEvasion, ...roll } = await computeSaveRollOutcome({
      current, characters, campaignName, activeMapName,
      hasSelectedEvasion: selectedAlliesRef.current.has(current.targetName),
      forceRollTo20: forceRollTo20Ref.current,
    });
    setLastEvasionState(hasEvasion);

    const cs = getCombatSummary(campaignName);
    if (cs) {
      storage.set('lastAttack', buildLastAttackData(current, roll), campaignName);
    }

    setPrompts(prev => prev.map((p, i) =>
      i === 0 ? { ...p, result: roll.result } : p
    ));

    forceRollTo20Ref.current = false;
  }, [campaignName, current, characters, activeMapName, selectedAlliesRef]);

  const handleDone = useCallback(() => {
    if (!current) return;
    const result = current.result;
    if (!result) {
      advance();
      return;
    }
    submitResultAndClear(campaignName, current, result, {
      includeBaneRoll: true,
      evasionActive: lastEvasionState,
      sendExtra: { baneRoll: result.baneRoll },
      advance,
    });
  }, [campaignName, current, lastEvasionState, advance]);

  const handleEvasionConfirm = useCallback((selectedNames) => {
    selectedAlliesRef.current = new Set(selectedNames);
    setEvasionSelection(null);
  }, []);

  const handleEvasionSkip = useCallback(() => {
    selectedAlliesRef.current = new Set();
    setEvasionSelection(null);
  }, []);

  const { abilityLabel, promptHasDisadvantage, promptHasAdvantage } = computePromptDisplayState(current, campaignName);
  const hasResult = current?.result != null;

  useEffect(() => {
    setRerollUsedForSave(false);
  }, [current?.promptId]);

  const targetCharacter = findTargetCharacter(current, characters);

  const rageDamageBonus = targetCharacter?.class?.class_levels?.[(targetCharacter.level || 1) - 1]?.rage_damage ?? 2;
  const {
    fanaticalFocusAvailable, currentFocusPoints, disciplinedSurvivorAvailable,
    livingLegendAvailable, guardedMindAvailable, indomitableAvailable,
    indomitableUses, indomitableMaxUses, indomitableRerollBonus,
  } = computeRerollAvailability(current, targetCharacter, campaignName);

  const submitSaveResult = useMemo(() => createSubmitSaveResult(campaignName, setPrompts), [campaignName]);

  const rerollAvailability = {
    fanaticalFocusAvailable,
    rageDamageBonus,
    currentFocusPoints,
    indomitableAvailable,
    indomitableUses,
    indomitableMaxUses,
    indomitableRerollBonus,
    disciplinedSurvivorAvailable,
    livingLegendAvailable,
    guardedMindAvailable,
  };

  const {
    handleFanaticalFocus, handleDisciplinedSurvivor, handleIndomitable,
    handleLivingLegend, handleGuardedMind,
  } = useSaveRerollHandlers({ campaignName, characters, activeMapName, current, setRerollUsedForSave, submitSaveResult, availability: rerollAvailability });

  return (
    <>
      {typeof EventSource !== 'undefined' && (
        <Subscriber
          campaignName={campaignName}
          handleEvent={(event) => {
            handleEvent(event);
            handleClearedEvent(event);
          }}
        />
      )}
      {current && (
        <SavePromptDialog
          current={current}
          prompts={prompts}
          dimmed={evasionSelection !== null}
          characters={characters}
          campaignName={campaignName}
          display={{ abilityLabel, promptHasDisadvantage, promptHasAdvantage }}
          hasResult={hasResult}
          rerollUsedForSave={rerollUsedForSave}
          rerollAvailability={rerollAvailability}
          handlers={{
            rollSave: handleRollSave,
            dismiss: handleDismiss,
            done: handleDone,
            fanaticalFocus: handleFanaticalFocus,
            indomitable: handleIndomitable,
            disciplinedSurvivor: handleDisciplinedSurvivor,
            livingLegend: handleLivingLegend,
            guardedMind: handleGuardedMind,
          }}
        />
      )}
      {evasionSelection !== null && (
        <EvasionSelectionOverlay
          prompts={prompts}
          evasionSelection={evasionSelection}
          onSelectionChange={setEvasionSelection}
          onConfirm={handleEvasionConfirm}
          onSkip={handleEvasionSkip}
        />
      )}
    </>
  );
}

export default SavePromptModal;
