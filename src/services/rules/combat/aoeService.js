import { hitTestOverlay } from '../../../models/SpellOverlay.js';
import { rollSaveForCreature, applyDamageToTarget, computeDamageAfterEvasion, hasEvasionForSave, normalizeSaveType } from './applyDamage.js';
import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCoronaSaveDisadvantage } from '../../combat/auras/coronaAuraUtils.js';
import { isCircleOfPowerActive } from '../../automation/handlers/buffs/circleOfPowerHandler.js';

function hasSoulstitchProtection(targetName, attackerName, campaignName) {
    if (!attackerName) return false;
    const key = `_${attackerName.replace(/\s+/g, '_')}_Soulstitch_Spells_active`;
    const stored = getRuntimeValue(attackerName, key, campaignName);
    return Array.isArray(stored) && stored.includes(targetName);
}

export function getAffectedCreatures(overlay, players, placedItems, combatSummary) {
  if (!overlay || !combatSummary?.creatures) return [];

  const posMap = new Map();
  for (const p of players || []) {
    posMap.set(p.name, { gridX: p.gridX, gridY: p.gridY });
  }
  for (const item of placedItems || []) {
    if (item.type === 'npc' && item.name) {
      posMap.set(item.name, { gridX: item.gridX, gridY: item.gridY });
    }
  }

  const affected = [];
  for (const creature of combatSummary.creatures) {
    const pos = posMap.get(creature.name);
    if (!pos) continue;
    if (hitTestOverlay(overlay, pos.gridX, pos.gridY)) {
      affected.push({ creature, gridX: pos.gridX, gridY: pos.gridY });
    }
  }
  return affected;
}

function resolveNpcSaveDisadvantage(creature, campaignName, damageType, heightenTarget) {
  const coronaResult = getCoronaSaveDisadvantage({
    targetName: creature.name,
    campaignName,
    damageType,
    skipRangeCheck: true,
  });
  if (coronaResult.disadvantage) return true;
  if (heightenTarget && creature.name === heightenTarget) return true;
  const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
  const idx = targetEffects.findIndex(te => te.target === creature.name && te.effect === 'disadvantage_on_next_save');
  if (idx !== -1) {
    targetEffects.splice(idx, 1);
    setRuntimeValue('campaign', 'targetEffects', [...targetEffects], campaignName);
    return true;
  }
  return false;
}

export function processAoeNpcs({ combatSummary, affected, rawDamage, damageType, saveDc, saveType, dcSuccess, campaignName, attackerName, characters, heightenTarget }) {
  const results = [];
  for (const { creature } of affected) {
    if (creature.type !== 'npc') continue;
    const disadvantage = resolveNpcSaveDisadvantage(creature, campaignName, damageType, heightenTarget);
    const advantage = isCircleOfPowerActive(creature.name, campaignName);
    const saveResult = rollSaveForCreature(creature, saveType, saveDc, disadvantage, advantage);
    const isSoulstitchProtected = hasSoulstitchProtection(creature.name, attackerName, campaignName);
    const evasionEffects = creature.evasionEffects || [];
    const hasEvasion = hasEvasionForSave(evasionEffects, normalizeSaveType(saveType));
    const finalDamage = isSoulstitchProtected ? 0 : computeDamageAfterEvasion(rawDamage, saveResult.success, dcSuccess, hasEvasion);
    const applyResult = applyDamageToTarget(combatSummary, creature.name, finalDamage, [damageType], campaignName, characters, { ignoreResistance: false, attackerName: attackerName });
    results.push({
      creatureName: creature.name,
      saveSuccess: isSoulstitchProtected ? true : saveResult.success,
      saveRoll: saveResult.roll,
      saveBonus: saveResult.bonus,
      finalDamage: applyResult?.finalDamage ?? finalDamage,
      newHp: applyResult?.newHp,
      damageReduced: applyResult?.damageReduced,
      soulstitchProtected: isSoulstitchProtected,
    });
  }
  return results;
}

export function sendAoePlayerSaves({ affected, rawDamage, damageType, saveDc, saveType, dcSuccess, campaignName, spellName, attackerName, formula, heightenTarget }) {
  const pendingList = [];
  for (const { creature } of affected) {
    if (creature.type !== 'player') continue;
    const promptId = utils.guid();
    pendingList.push({
      promptId,
      targetName: creature.name,
      creature,
     });

    const coronaResult = getCoronaSaveDisadvantage({
      targetName: creature.name,
      campaignName,
      damageType,
      skipRangeCheck: true,
    });
    const heightenDisadvantage = !!(heightenTarget && creature.name === heightenTarget);
    const targetEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    const hasRiderDisadvantage = targetEffects.some(te => te.target === creature.name && te.effect === 'disadvantage_on_next_save');
    const disadvantage = coronaResult.disadvantage || heightenDisadvantage || hasRiderDisadvantage;

    sendSavePrompt(campaignName, {
      promptId,
      targetName: creature.name,
      saveType,
      saveDc,
      dcSuccess,
      damageFormula: formula,
      damageType,
      sourceName: spellName,
      sourceAttackerName: attackerName,
      rawDamage,
      disadvantage,
    });
  }
  return pendingList;
}
