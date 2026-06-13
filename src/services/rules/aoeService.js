import { hitTestOverlay } from '../../models/SpellOverlay.js';
import { rollSaveForCreature, computeDamageAfterSave, applyDamageToTarget } from './applyDamage.js';
import { sendSavePrompt } from '../combat/savePromptService.js';
import utils from '../ui/utils.js';

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

export function processAoeNpcs(combatSummary, affected, rawDamage, damageType, saveDc, saveType, dcSuccess, campaignName, attackerName) {
  const results = [];
  for (const { creature } of affected) {
    if (creature.type !== 'npc') continue;
    const saveResult = rollSaveForCreature(creature, saveType, saveDc);
    const finalDamage = computeDamageAfterSave(rawDamage, saveResult.success, dcSuccess);
    const applyResult = applyDamageToTarget(combatSummary, creature.name, finalDamage, [damageType], campaignName, null, false, attackerName);
    results.push({
      creatureName: creature.name,
      saveSuccess: saveResult.success,
      saveRoll: saveResult.roll,
      saveBonus: saveResult.bonus,
      finalDamage: applyResult?.finalDamage ?? finalDamage,
      newHp: applyResult?.newHp,
      damageReduced: applyResult?.damageReduced,
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
    });
  }
  return pendingList;
}
