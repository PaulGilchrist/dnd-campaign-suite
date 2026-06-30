import { hitTestOverlay } from '../../../models/SpellOverlay.js';
import { rollSaveForCreature, computeDamageAfterSave, applyDamageToTarget } from './applyDamage.js';
import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getCoronaSaveDisadvantage } from '../../combat/auras/coronaAuraUtils.js';

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

export function processAoeNpcs(combatSummary, affected, rawDamage, damageType, saveDc, saveType, dcSuccess, campaignName, attackerName, characters) {
  const results = [];
  for (const { creature } of affected) {
    if (creature.type !== 'npc') continue;
    let disadvantage = false;
    const coronaResult = getCoronaSaveDisadvantage({
      targetName: creature.name,
      campaignName,
      damageType,
      skipRangeCheck: true,
    });
    if (coronaResult.disadvantage) {
      disadvantage = true;
    }
    const saveResult = rollSaveForCreature(creature, saveType, saveDc, disadvantage);
    const isSoulstitchProtected = hasSoulstitchProtection(creature.name, attackerName, campaignName);
    const finalDamage = isSoulstitchProtected ? 0 : computeDamageAfterSave(rawDamage, saveResult.success, dcSuccess);
    const applyResult = applyDamageToTarget(combatSummary, creature.name, finalDamage, [damageType], campaignName, characters, false, attackerName);
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

export function sendAoePlayerSaves(affected, rawDamage, damageType, saveDc, saveType, dcSuccess, campaignName, spellName, attackerName, rolls, formula) {
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
    const disadvantage = coronaResult.disadvantage || false;

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
