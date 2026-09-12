import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { getDistanceFeet } from '../../../../services/rules/combat/rangeValidation.js';
import { isDistanceInRange } from '../../../../services/rules/combat/rangeCheck.js';
import { isApplyBusy, setApplyBusy } from './areaEffectModalInstances.js';
import { createOverlay, hitTestOverlay } from '../../../../models/SpellOverlay.js';
import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';

// CLA-303: Turn Undead target validity — dead creatures are invalid; trust the
// monsterType joined onto combatSummary first, then fall back to a suffix-strip
// monsters.json lookup ("Skeleton 1" -> "Skeleton") for legacy combatSummaries.
function isTurnUndeadValidTarget(c, monsters) {
  if ((c.currentHp ?? 1) <= 0) return false;
  if (c.monsterType) return String(c.monsterType).toLowerCase() === 'undead';
  const baseName = (c.name || '').replace(/\s+\d+$/, '');
  const monster = Array.isArray(monsters) ? monsters.find(m => m.name?.toLowerCase() === baseName.toLowerCase()) : undefined;
  if (!monster || String(monster.type).toLowerCase() !== 'undead') return false;
  return true;
}

function findTargetGridPosition(mapData, name) {
  return mapData.players?.find(p => p.name === name) || mapData.placedItems?.find(i => i.name === name);
}

function canUseShapeOverlay(shape, gridX, gridY) {
  return !!shape && gridX != null && gridY != null;
}

function shapeOverlayCovers(shape, gridX, gridY, targetPos, rangeFeet, coneAngle, widthFt) {
  const tempOverlay = createOverlay(shape, gridX, gridY, 0, {
    radiusFt: rangeFeet,
    sizeFt: rangeFeet,
    distanceFt: rangeFeet,
    coneAngle: coneAngle || 53,
    widthFt: widthFt || 5,
  });
  return hitTestOverlay(tempOverlay, targetPos.gridX, targetPos.gridY);
}

function AreaEffectTargetModalBase({
  combatSummary,
  attackerName,
  attackerPos,
  saveDc,
  campaignName,
  mapData,
  monsters,
  featureName,
  saveType,
  rangeFeet,
  onClose,
  characters,
  icon = 'fa-solid fa-dice-d20',
  handleApplyOverride,
  handleSaveResultOverride,
  extraState = {},
  onAllResolved,
  renderBody,
  renderActions,
  turnUndead = false,
  shape,
  coneAngle,
  widthFt,
  attackerGridX,
  attackerGridY,
  includeCaster = false,
  maxTargets = Infinity,
}) {
  const [selected, setSelected] = useState(new Set());
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [pendingPrompts, setPendingPrompts] = useState([]);

  const getForcecageBlocked = useCallback((targetName) => {
    if (!attackerName || !targetName) return false;
    const forcecageEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    if (!Array.isArray(forcecageEffects) || forcecageEffects.length === 0) return false;

    const attackerTrapped = forcecageEffects.some(te => te.effect === 'forcecage' && te.target === attackerName);
    const targetTrapped = forcecageEffects.some(te => te.effect === 'forcecage' && te.target === targetName);

    if (!attackerTrapped && !targetTrapped) return false;
    if (attackerTrapped && targetTrapped) {
      const attackerSources = forcecageEffects
        .filter(te => te.effect === 'forcecage' && te.target === attackerName)
        .map(te => te.source);
      return !forcecageEffects.some(te => te.effect === 'forcecage' && te.target === targetName && attackerSources.includes(te.source));
    }
    return true;
  }, [attackerName]);

  const getMazeBlocked = useCallback((targetName) => {
    if (!attackerName || !targetName) return false;
    const mazeEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    if (!Array.isArray(mazeEffects) || mazeEffects.length === 0) return false;

    const attackerTrapped = mazeEffects.some(te => te.effect === 'maze' && te.target === attackerName);
    const targetTrapped = mazeEffects.some(te => te.effect === 'maze' && te.target === targetName);

    if (!attackerTrapped && !targetTrapped) return false;
    if (attackerTrapped && targetTrapped) {
      const attackerSources = mazeEffects
        .filter(te => te.effect === 'maze' && te.target === attackerName)
        .map(te => te.source);
      return !mazeEffects.some(te => te.effect === 'maze' && te.target === targetName && attackerSources.includes(te.source));
    }
    return true;
  }, [attackerName]);

  const getBanishmentBlocked = useCallback((targetName) => {
    if (!attackerName || !targetName) return false;
    const banishmentEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    if (!Array.isArray(banishmentEffects) || banishmentEffects.length === 0) return false;

    const attackerTrapped = banishmentEffects.some(te => te.effect === 'banishment' && te.target === attackerName);
    const targetTrapped = banishmentEffects.some(te => te.effect === 'banishment' && te.target === targetName);

    if (!attackerTrapped && !targetTrapped) return false;
    if (attackerTrapped && targetTrapped) {
      const attackerSources = banishmentEffects
        .filter(te => te.effect === 'banishment' && te.target === attackerName)
        .map(te => te.source);
      return !banishmentEffects.some(te => te.effect === 'banishment' && te.target === targetName && attackerSources.includes(te.source));
    }
    return true;
  }, [attackerName]);

  const getImprisonmentBlocked = useCallback((targetName) => {
    if (!attackerName || !targetName) return false;
    const imprisonmentEffects = getRuntimeValue('campaign', 'targetEffects') || [];
    if (!Array.isArray(imprisonmentEffects) || imprisonmentEffects.length === 0) return false;

    const attackerTrapped = imprisonmentEffects.some(te => te.effect === 'imprisonment' && te.target === attackerName);
    const targetTrapped = imprisonmentEffects.some(te => te.effect === 'imprisonment' && te.target === targetName);

    if (!attackerTrapped && !targetTrapped) return false;
    if (attackerTrapped && targetTrapped) {
      const attackerSources = imprisonmentEffects
        .filter(te => te.effect === 'imprisonment' && te.target === attackerName)
        .map(te => te.source);
      return !imprisonmentEffects.some(te => te.effect === 'imprisonment' && te.target === targetName && attackerSources.includes(te.source));
    }
    return true;
  }, [attackerName]);

  const eligibleTargets = useMemo(() => {
    if (!combatSummary?.creatures) return [];
    return combatSummary.creatures.filter(c => {
      if (!includeCaster && c.name === attackerName) return false;
      if (turnUndead && !isTurnUndeadValidTarget(c, monsters)) return false;
      if (getForcecageBlocked(c.name)) return false;
      if (getMazeBlocked(c.name)) return false;
      if (getBanishmentBlocked(c.name)) return false;
      if (getImprisonmentBlocked(c.name)) return false;
      if (!mapData || !attackerPos) return true;
      const targetPos = findTargetGridPosition(mapData, c.name);
      if (!targetPos) return true;
      if (canUseShapeOverlay(shape, attackerGridX, attackerGridY)) {
        return shapeOverlayCovers(shape, attackerGridX, attackerGridY, targetPos, rangeFeet, coneAngle, widthFt);
      }
      return isDistanceInRange(getDistanceFeet(attackerPos, { gridX: targetPos.gridX, gridY: targetPos.gridY }), rangeFeet);
    });
  }, [combatSummary, attackerName, mapData, attackerPos, rangeFeet, turnUndead, monsters, shape, coneAngle, widthFt, attackerGridX, attackerGridY, includeCaster, getForcecageBlocked, getMazeBlocked, getBanishmentBlocked, getImprisonmentBlocked]);

  const toggleTarget = useCallback((name) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); }
      else if (next.size < maxTargets) { next.add(name); }
      return next;
    });
  }, [maxTargets]);

  const allResolved = processing && pendingPrompts.length === 0 && results.length >= selected.size;

  useEffect(() => {
    if (onAllResolved && allResolved) {
      onAllResolved({ results, selected, processing, pendingPrompts });
    }
  }, [allResolved, onAllResolved, results, selected, processing, pendingPrompts]);

  const handleApplyOverrideRef = useRef(() => {});
  // eslint-disable-next-line server-first/no-local-game-state
  const handleSaveResultOverrideRef = useRef(() => {});

  handleApplyOverrideRef.current = handleApplyOverride || (() => {});
  handleSaveResultOverrideRef.current = handleSaveResultOverride || (() => {});

  const ctxRef = useRef({
    processing: false, allResolved: false, selected: new Set(), eligibleTargets: [],
    results: [], pendingPrompts: [], toggleTarget: () => {},
    handleApply: () => {}, handleSaveResult: () => {},
    saveType, saveDc, rangeFeet, featureName, maxTargets,
    combatSummary, attackerName, campaignName, mapData, onClose, characters,
    setSelected, setProcessing, setResults, setPendingPrompts,
  });

  const handleApply = useCallback(() => {
    if (isApplyBusy()) return;
    setApplyBusy(true);
    handleApplyOverrideRef.current(ctxRef.current);
  }, []);

  const handleSaveResult = useCallback((event) => {
    handleSaveResultOverrideRef.current(event, ctxRef.current);
  }, []);

  ctxRef.current = {
    processing, allResolved, selected, eligibleTargets,
    results, pendingPrompts, toggleTarget,
    handleApply, handleSaveResult,
    saveType, saveDc, rangeFeet, featureName, maxTargets,
    combatSummary, attackerName, campaignName, mapData, onClose, characters,
    setSelected, setProcessing, setResults, setPendingPrompts,
    ...extraState,
  };

  useEffect(() => {
    if (!processing) return;
    window.addEventListener('save-result', handleSaveResult);
    return () => window.removeEventListener('save-result', handleSaveResult);
  }, [processing, handleSaveResult]);

  useEffect(() => {
    if (processing) return;
    setApplyBusy(false);
  }, [processing]);

  const ctx = ctxRef.current;

  return (
    <div className="sp-overlay" onClick={(e) => {
      if (e.target.closest('.sp-modal')) return;
      onClose?.();
    }}>
      <div className="sp-modal">
        <div className="sp-header">
          <i className={icon}></i> {featureName}
        </div>
        <div className="sp-body">
          {renderBody ? renderBody(ctx) : null}
        </div>
        <div className="sp-actions">
          {renderActions ? renderActions(ctx) : null}
        </div>
      </div>
    </div>
  );
}

export default AreaEffectTargetModalBase;
