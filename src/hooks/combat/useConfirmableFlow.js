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

  const createConfirmHandler = useCallback((type, applyFn, getTargets) => {
    return async (result) => {
      const pending = pendingOpsRef.current[type];
      if (!pending) return;

      setPendingOps(prev => {
        const next = { ...prev };
        delete next[type];
        return next;
      });

      const targets = getTargets ? getTargets(pending, result) : null;
      addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        targetName: targets?.[0] || null,
        targets: targets,
        spellName: pending.spellName,
        spellLevel: pending.spellLevel || 0,
        castingTime: pending.castingTime,
        timestamp: Date.now(),
      }).catch(() => {});

      if (applyFn) {
        await applyFn(pending, result);
      }
    };
  }, [playerStats, campaignName]);

  const createSkipHandler = useCallback((type, getTargets) => {
    return () => {
      const pending = pendingOpsRef.current[type];
      if (!pending) return;

      setPendingOps(prev => {
        const next = { ...prev };
        delete next[type];
        return next;
      });

      const targets = getTargets ? getTargets(pending, {}) : null;
      addEntry(campaignName, {
        type: 'spell',
        characterName: playerStats.name,
        targetName: targets?.[0] || null,
        targets: targets,
        spellName: pending.spellName,
        spellLevel: pending.spellLevel || 0,
        castingTime: pending.castingTime,
        timestamp: Date.now(),
      }).catch(() => {});
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
