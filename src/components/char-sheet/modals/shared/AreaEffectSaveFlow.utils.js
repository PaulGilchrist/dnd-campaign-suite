import { useEffect, useCallback, useMemo } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { logConditionApplied } from './saveResultLogging.js';

// Shared save-flow building blocks for the condition AoE modals
// (Fear, Hypnotic Pattern, Tasha's Hideous Laughter, Calm Emotions).
// Only byte-identical or constant-parameterized logic lives here; every
// spell-specific rule (condition application, notes, refusals) stays in
// the modal that owns it.

export function useCarefulSpellSelection(metamagicCareful, casterName) {
  const isCarefulSpell = metamagicCareful || false;
  const allyList = isCarefulSpell ? getAllyList(casterName) : null;
  const isCarefulAlly = useCallback((name) => allyList ? allyList.includes(name) : false, [allyList]);
  return { isCarefulSpell, isCarefulAlly };
}

export function usePendingPromptsCleanup(setPendingPrompts) {
  useEffect(() => {
    return () => {
      setPendingPrompts([]);
    };
  }, [setPendingPrompts]);
}

export function useSaveResultListener(pendingPrompts, handleSaveResult) {
  useEffect(() => {
    if (pendingPrompts.length === 0) return;
    const handleSaveEvent = (event) => {
      handleSaveResult(event);
    };
    window.addEventListener('save-result', handleSaveEvent);
    return () => window.removeEventListener('save-result', handleSaveEvent);
  }, [pendingPrompts.length, handleSaveResult]);
}

export function useCarefulEligibleTargets(combatSummary, isCarefulSpell, isCarefulAlly) {
  return useMemo(() => {
    if (!combatSummary?.creatures) return [];
    return combatSummary.creatures
      .map(c => ({
        ...c,
        carefulSpellProtected: isCarefulSpell && isCarefulAlly(c.name),
      }));
  }, [combatSummary, isCarefulSpell, isCarefulAlly]);
}

export function mapCreatureTargets(eligibleTargets) {
  return eligibleTargets.map(c => ({
    name: c.name,
    type: c.type,
    currentHp: c.currentHp,
    maxHp: c.maxHp,
    carefulSpellProtected: c.carefulSpellProtected,
  }));
}

export function rollNpcSave(target, saveType, saveDc, disadvantage) {
  const saveBonus = target?.saveBonuses?.[saveType.toLowerCase()] ?? 0;
  const saveRoll = disadvantage ? Math.min(Math.floor(Math.random() * 20) + 1, Math.floor(Math.random() * 20) + 1) : Math.floor(Math.random() * 20) + 1;
  const saveTotal = saveRoll + saveBonus;
  const success = saveTotal >= saveDc;
  return { saveBonus, saveRoll, saveTotal, success };
}

export function buildCarefulPlayerSaveResult(targetName) {
  return { targetName, success: true, roll: null, total: 0, saveBonus: 0, conditionApplied: false };
}

export function issuePlayerSavePrompt(campaignName, { targetName, saveType, saveDc, casterName, payloadExtra }) {
  const promptId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  sendSavePrompt(campaignName, {
    promptId,
    targetName,
    saveType: saveType,
    saveDc: saveDc,
    sourceName: casterName,
    ...payloadExtra,
  });

  const existingPrompts = Array.from(getRuntimeValue('campaign', 'pendingSaveListenerPrompts') || []);
  existingPrompts.push(promptId);
  setRuntimeValue('campaign', 'pendingSaveListenerPrompts', existingPrompts, campaignName);

  return { promptId, targetName };
}

export function logAbilityUseSelection(campaignName, { casterName, abilityName, targetCount, saveDc, saveType, logPrefix }) {
  return addEntry(campaignName, {
    type: 'ability_use',
    characterName: casterName,
    abilityName,
    description: `${abilityName}: Selecting ${targetCount} target(s) for save (DC ${saveDc} ${saveType})`,
    timestamp: Date.now(),
  }).catch((e) => { console.error(`${logPrefix} Error logging feature use:`, e); });
}

// Always renders "rolled r + b = t" (bonus shown even when 0) — the
// save-result text these AoE spell modals log for rolled NPC saves.
function npcSaveResultDescription({ targetName, saveType, saveDc, success, roll, total, saveBonus, suffix = '' }) {
  const outcome = success ? 'succeeded on' : 'failed';
  return `${targetName} ${outcome} ${saveType} save (DC ${saveDc}, rolled ${roll} + ${saveBonus} = ${total})${suffix}`;
}

export function logNpcSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success, roll, total, saveBonus, logPrefix, suffix = '' }) {
  return addEntry(campaignName, {
    type: 'save_result',
    characterName: casterName,
    targetName,
    saveDc,
    saveType,
    success,
    roll,
    total,
    saveBonus,
    description: npcSaveResultDescription({ targetName, saveType, saveDc, success, roll, total, saveBonus, suffix }),
    timestamp: Date.now(),
  }).catch((e) => { console.error(`${logPrefix} Error logging save result:`, e); });
}

export function logCarefulSpellProtectedSave(campaignName, { casterName, targetName, saveDc, saveType, roll, total, saveBonus, logPrefix }) {
  return addEntry(campaignName, {
    type: 'save_result',
    characterName: casterName,
    targetName,
    saveDc,
    saveType,
    success: true,
    roll,
    total,
    saveBonus,
    description: npcSaveResultDescription({ targetName, saveType, saveDc, success: true, roll, total, saveBonus, suffix: ' — Careful Spell protected' }),
    timestamp: Date.now(),
  }).catch((e) => { console.error(`${logPrefix} Error logging save result:`, e); });
}

export async function logConditionsFromSave(campaignName, { targetName, conditionNames, dc, ability, sourceName, logPrefix }) {
  for (const condition of conditionNames) {
    await addEntry(campaignName, {
      type: 'condition',
      action: 'applied',
      characterName: targetName,
      condition,
      dc,
      ability,
      sourceName,
      timestamp: Date.now(),
    }).catch((e) => { console.error(`${logPrefix} Error logging condition:`, e); });
  }
}

export async function resolveNpcCarefulSave(campaignName, { casterName, targetName, saveDc, saveType, roll, total, saveBonus, logPrefix }) {
  await logCarefulSpellProtectedSave(campaignName, { casterName, targetName, saveDc, saveType, roll, total, saveBonus, logPrefix });
  addTargetResult(campaignName, {
    targetName,
    saveResult: 'success',
    roll,
    total,
    conditions: [],
    appliedDamage: 0,
  });
  return { targetName, success: true, roll, total, saveBonus, conditionApplied: false };
}

export async function resolveNpcSaveSuccess(campaignName, { casterName, targetName, saveDc, saveType, roll, total, saveBonus, logPrefix }) {
  await logNpcSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: true, roll, total, saveBonus, logPrefix });
  addTargetResult(campaignName, {
    targetName,
    saveResult: 'success',
    roll,
    total,
    conditions: [],
    appliedDamage: 0,
  });
  return { targetName, success: true, roll, total, saveBonus, conditionApplied: false };
}

export async function resolveNpcSaveFailure(campaignName, {
  casterName, targetName, saveDc, saveType, roll, total, saveBonus, logPrefix,
  applyConditions, conditionNames, failSummary, conditions,
}) {
  applyConditions(targetName, campaignName);
  await logConditionsFromSave(campaignName, { targetName, conditionNames, dc: saveDc, ability: saveType, sourceName: casterName, logPrefix });
  await logNpcSaveResultEntry(campaignName, { casterName, targetName, saveDc, saveType, success: false, roll, total, saveBonus, logPrefix });
  await logConditionApplied(campaignName, { targetName, ...failSummary, logPrefix });
  addTargetResult(campaignName, {
    targetName,
    saveResult: 'failure',
    roll,
    total,
    conditions,
    appliedDamage: 0,
  });
  return { targetName, success: false, roll, total, saveBonus, conditionApplied: true };
}

export function resolveAllSavesPreamble(campaignName, { casterName, spellName, saveType, saveDc, combatSummary }) {
  if (!combatSummary) return null;
  storeSpellLastAttack(campaignName, {
    casterName,
    spellName,
    saveType,
    saveDc,
    attackScope: 'aoe',
  });
  return { results: [], prompts: [] };
}

export function dropPendingPrompt(setPendingPrompts, promptId, onClose) {
  setPendingPrompts(prev => {
    const updated = prev.filter(p => p.promptId !== promptId);
    if (updated.length === 0) {
      setTimeout(() => onClose(), 500);
    }
    return updated;
  });
}
