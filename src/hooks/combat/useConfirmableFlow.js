import { useState, useCallback, useRef } from 'react'
import { addEntry } from '../../services/ui/logService.js'

export function useConfirmableFlow(playerStats, campaignName) {
  const [pendingOps, setPendingOps] = useState({});
  const pendingOpsRef = useRef(pendingOps);
  pendingOpsRef.current = pendingOps;

  const setPending = useCallback((type, data) => {
    setPendingOps(prev => ({ ...prev, [type]: data }));
  }, []);

  const getPending = useCallback((type) => pendingOps[type] || null, [pendingOps]);

  const createConfirmHandler = useCallback((type, applyFn) => {
    return async (result) => {
      const pending = pendingOpsRef.current[type];
      if (!pending) return;

      setPendingOps(prev => {
        const next = { ...prev };
        delete next[type];
        return next;
      });

      addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        spellName: pending.spellName,
        spellLevel: pending.spellLevel || 0,
        castingTime: pending.castingTime,
        metamagic: [],
        spCost: 0,
        timestamp: Date.now(),
      });

      if (applyFn) {
        await applyFn(pending, result);
      }
    };
  }, [playerStats, campaignName]);

  const createSkipHandler = useCallback((type) => {
    return () => {
      const pending = pendingOpsRef.current[type];
      if (!pending) return;

      setPendingOps(prev => {
        const next = { ...prev };
        delete next[type];
        return next;
      });

      addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        spellName: pending.spellName,
        spellLevel: pending.spellLevel || 0,
        castingTime: pending.castingTime,
        metamagic: [],
        spCost: 0,
        timestamp: Date.now(),
      });
    };
  }, [playerStats, campaignName]);

  const clearPending = useCallback((type) => {
    setPendingOps(prev => {
      if (!(type in prev)) return prev;
      const next = { ...prev };
      delete next[type];
      return next;
    });
  }, []);

  return {
    setPending,
    getPending,
    createConfirmHandler,
    createSkipHandler,
    clearPending,
    hasPending: Object.keys(pendingOps).length > 0,
  };
}
