import { hitTestOverlay } from '../../../models/SpellOverlay.js';
import { rollSaveForCreature, computeDamageAfterSave, applyDamageToTarget } from './applyDamage.js';
import { sendSavePrompt } from '../../combat/conditions/savePromptService.js';
import utils from '../../ui/utils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

  console.log('[getAffectedCreatures] posMap keys:', [...posMap.keys()], 'creature names:', combatSummary.creatures.map(c => c.name));
  const affected = [];
  for (const creature of combatSummary.creatures) {
    const pos = posMap.get(creature.name);
    if (!pos) { console.log('[getAffectedCreatures] no pos for:', creature.name); continue; }
    if (hitTestOverlay(overlay, pos.gridX, pos.gridY)) {
      affected.push({ creature, gridX: pos.gridX, gridY: pos.gridY });
    } else {
      console.log('[getAffectedCreatures] hitTest miss for:', creature.name, 'at', pos.gridX, pos.gridY);
    }
  }
  console.log('[getAffectedCreatures] affected:', affected.length);
  return affected;
}

export function processAoeNpcs(combatSummary, affected, rawDamage, damageType, saveDc, saveType, dcSuccess, campaignName, attackerName, characters) {
  const results = [];
  for (const { creature } of affected) {
    if (creature.type !== 'npc') continue;
    const saveResult = rollSaveForCreature(creature, saveType, saveDc);
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
