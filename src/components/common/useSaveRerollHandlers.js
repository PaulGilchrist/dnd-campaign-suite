import { useCallback } from 'react';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { createFanaticalFocusHandler, createDisciplinedSurvivorHandler, createGuardedMindHandler, createLivingLegendHandler, createIndomitableHandler } from './savePromptHandlers.js';

// Reroll button handlers for SavePromptModal: each guards on availability,
// marks the reroll as used, spends its resource, then delegates to the
// feature handler factory in savePromptHandlers.js.
export function useSaveRerollHandlers({
  campaignName, characters, activeMapName, current, setRerollUsedForSave, submitSaveResult, availability,
}) {
  const {
    fanaticalFocusAvailable, rageDamageBonus, currentFocusPoints,
    disciplinedSurvivorAvailable, livingLegendAvailable, guardedMindAvailable,
    indomitableAvailable, indomitableUses, indomitableMaxUses, indomitableRerollBonus,
  } = availability;

  const handleFanaticalFocus = useCallback(async () => {
    if (!fanaticalFocusAvailable || !current) return;
    setRerollUsedForSave(true);
    setRuntimeValue(current.targetName, 'fanaticalFocusUsed', true, campaignName);
    const handler = createFanaticalFocusHandler({ campaignName, characters, activeMapName, current, rageDamageBonus, fanaticalFocusAvailable, setRerollUsedForSave, submitSaveResult });
    await handler();
  }, [fanaticalFocusAvailable, rageDamageBonus, current, campaignName, characters, activeMapName, submitSaveResult, setRerollUsedForSave]);

  const handleDisciplinedSurvivor = useCallback(async () => {
    if (!disciplinedSurvivorAvailable || !current) return;
    setRerollUsedForSave(true);
    setRuntimeValue(current.targetName, 'focusPoints', currentFocusPoints - 1, campaignName);
    const handler = createDisciplinedSurvivorHandler({ campaignName, current, currentFocusPoints, disciplinedSurvivorAvailable, setRerollUsedForSave, submitSaveResult });
    await handler();
  }, [disciplinedSurvivorAvailable, currentFocusPoints, current, campaignName, submitSaveResult, setRerollUsedForSave]);

  const handleIndomitable = useCallback(async () => {
    if (!indomitableAvailable || !current) return;
    setRerollUsedForSave(true);
    const handler = createIndomitableHandler({ campaignName, characters, activeMapName, current, indomitableAvailable, currentUses: indomitableUses, maxUses: indomitableMaxUses, rerollBonus: indomitableRerollBonus, setRerollUsedForSave, submitSaveResult });
    await handler();
  }, [indomitableAvailable, indomitableUses, indomitableMaxUses, indomitableRerollBonus, current, campaignName, characters, activeMapName, submitSaveResult, setRerollUsedForSave]);

  const handleLivingLegend = useCallback(async () => {
    const handler = createLivingLegendHandler({ campaignName, characters, activeMapName, current, livingLegendAvailable, setRerollUsedForSave, submitSaveResult });
    await handler();
  }, [campaignName, characters, activeMapName, current, livingLegendAvailable, submitSaveResult, setRerollUsedForSave]);

  const handleGuardedMind = useCallback(async () => {
    if (!guardedMindAvailable || !current) return;
    setRerollUsedForSave(true);
    setRuntimeValue(current.targetName, '_guardedMind_usedRest', 'rest', campaignName);
    const handler = createGuardedMindHandler({ campaignName, current, guardedMindAvailable, setRerollUsedForSave, submitSaveResult });
    await handler();
  }, [guardedMindAvailable, current, campaignName, submitSaveResult, setRerollUsedForSave]);

  return {
    handleFanaticalFocus,
    handleDisciplinedSurvivor,
    handleIndomitable,
    handleLivingLegend,
    handleGuardedMind,
  };
}
