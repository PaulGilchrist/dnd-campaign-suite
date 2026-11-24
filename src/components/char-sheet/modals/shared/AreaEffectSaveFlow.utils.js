import { useEffect, useCallback, useMemo } from 'react';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { sendSavePrompt } from '../../../../services/combat/conditions/savePromptService.js';
import { addEntry } from '../../../../services/ui/logService.js';
import { getAllyList } from '../../../../hooks/useAllySelection.js';
import { storeSpellLastAttack, addTargetResult } from '../../../../services/automation/common/damageRollback.js';
import { normalizeSaveType } from '../../../../services/rules/combat/applyDamage.js';
import { registerLiveSaveListener, unregisterLiveSaveListener } from '../../../../services/automation/common/savePrompt.js';
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
    // Live-consumer registration (bug-aoe-live-save-stamped-reload-lapse):
    // while THIS listener is mounted the queue's prompts have a same-page
    // consumer, so the SavePromptModal Done seam's resolveConsumerlessSavePrompt
    // check must no-op instead of stamping a phantom save_lapsed pair beside
    // the damage this very listener applies. Deps key on the array (not just
    // its length) so a drain/unmount cleans the settled ids and a re-render
    // re-marks the survivors — the createSaveListener registry discipline,
    // scoped to the listener lifetime.
    const promptIds = pendingPrompts.map(p => p.promptId).filter(Boolean);
    promptIds.forEach(registerLiveSaveListener);
    const handleSaveEvent = (event) => {
      handleSaveResult(event);
    };
    window.addEventListener('save-result', handleSaveEvent);
    return () => {
      promptIds.forEach(unregisterLiveSaveListener);
      window.removeEventListener('save-result', handleSaveEvent);
    };
  }, [pendingPrompts, handleSaveResult]);
}

// Dismiss hygiene (save-dismissed sweep family, 2026-11-05): mirrors
// useSaveResultListener for the queue's un-rolled Dismiss broadcast. A modal
// parked on pendingPrompts must drain the dismissed prompt too, or its
// "Resolving saves… / Waiting for save roll…" view freezes with no buttons
// (divine-spark-dismiss softlock shape). Consumers gate themselves on
// pendingPrompts membership, so a save-dismissed for a different promptId is
// inert (guid-gating doctrine, playbook §66).
export function useSaveDismissedListener(pendingPrompts, handleSaveDismissed) {
  useEffect(() => {
    if (pendingPrompts.length === 0) return;
    // Same live-consumer registration as useSaveResultListener above — the
    // un-rolled Dismiss seam consults resolveConsumerlessSavePrompt too, so
    // the registry must stay marked while either listener owns the queue.
    const promptIds = pendingPrompts.map(p => p.promptId).filter(Boolean);
    promptIds.forEach(registerLiveSaveListener);
    const handleDismissedEvent = (event) => {
      handleSaveDismissed(event);
    };
    window.addEventListener('save-dismissed', handleDismissedEvent);
    return () => {
      promptIds.forEach(unregisterLiveSaveListener);
      window.removeEventListener('save-dismissed', handleDismissedEvent);
    };
  }, [pendingPrompts, handleSaveDismissed]);
}

// Neutral result row for a dismissed prompt: renders as an honest
// "dismissed — unaffected" line (every renderer that shows this row branches
// on `dismissed`), and counts toward the base's `results.length >= selected`
// all-resolved gate so the modal drains instead of stranding.
export function dismissedNoEffectResult(targetName) {
  return { targetName, success: true, dismissed: true, roll: null, total: 0, saveBonus: 0, conditionApplied: false };
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
  const saveBonus = target?.saveBonuses?.[normalizeSaveType(saveType).toLowerCase()] ?? 0;
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

  const existingPrompts = Array.from(getRuntimeValue('campaign', 'pendingSaveListenerPrompts', campaignName) || []); // fix#339 (#1520-family): read/write symmetric channel vocabulary per fix#153/#198 — reader is arity-2 (useRuntimeState.js:63), scope = SSE-mirrored active-campaign store until #1520
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

// Results-face save annotations must self-reconcile: these per-target rows used
// to print ONLY the raw d20 ("(rolled 10)"), so a Saved face could show a number
// below the DC it announced — the engine adjudicates on the HIDDEN total
// (d20 + save bonus) (live-captured Burning Hands: "Saved — takes 12 Fire damage
// (rolled 10, halved)" against DC 17). Rows now print the same equation the
// save_result log rows carry (npcSaveResultDescription above always shows
// "rolled r + b = t") plus the adjudicated DC, mirroring the standing
// ClairvoyantCombatantModal/HurlThroughHellModal result copy
// ("rolled R + B = T vs DC D"). Shared by SaveAttackAoeModal and
// ElementalAttunementModal result faces.
export function saveEquationText({ roll, saveBonus, total }, saveDc) {
  return `rolled ${roll ?? 0} + ${saveBonus ?? 0} = ${total ?? 0} vs DC ${saveDc}`;
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
