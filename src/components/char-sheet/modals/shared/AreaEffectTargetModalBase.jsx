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

function shapeOverlayCovers({ shape, gridX, gridY, targetPos, rangeFeet, coneAngle, widthFt }) {
  const tempOverlay = createOverlay(shape, gridX, gridY, 0, {
    radiusFt: rangeFeet,
    sizeFt: rangeFeet,
    distanceFt: rangeFeet,
    coneAngle: coneAngle || 53,
    widthFt: widthFt || 5,
  });
  return hitTestOverlay(tempOverlay, targetPos.gridX, targetPos.gridY);
}

// #171 clone consolidation (fix#227 house pattern, sibling AOEConditionModal.jsx:15-33):
// four get*Blocked useCallback clones proved byte-identical under effect-name normalization —
// single genuine axis is the te.effect name literal. One core, four effect keys looped.
const TRAP_BLOCKING_EFFECTS = ['forcecage', 'maze', 'banishment', 'imprisonment'];

function trapEffectBlocksAttack(effects, effectName, attackerName, targetName) {
  if (!Array.isArray(effects) || effects.length === 0) return false;
  const attackerTrapped = effects.some(te => te.effect === effectName && te.target === attackerName);
  const targetTrapped = effects.some(te => te.effect === effectName && te.target === targetName);
  if (!attackerTrapped && !targetTrapped) return false;
  if (!attackerTrapped || !targetTrapped) return true;
  const attackerSources = effects
    .filter(te => te.effect === effectName && te.target === attackerName)
    .map(te => te.source);
  return !effects.some(te => te.effect === effectName && te.target === targetName && attackerSources.includes(te.source));
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

  const eligibleTargets = useMemo(() => {
    if (!combatSummary?.creatures) return [];
    return combatSummary.creatures.filter(c => {
      if (!includeCaster && c.name === attackerName) return false;
      if (turnUndead && !isTurnUndeadValidTarget(c, monsters)) return false;
      if (attackerName && c.name) {
        const effects = getRuntimeValue('campaign', 'targetEffects') || [];
        if (TRAP_BLOCKING_EFFECTS.some(effectName => trapEffectBlocksAttack(effects, effectName, attackerName, c.name))) return false;
      }
      if (!mapData || !attackerPos) return true;
      const targetPos = findTargetGridPosition(mapData, c.name);
      if (!targetPos) return true;
      if (canUseShapeOverlay(shape, attackerGridX, attackerGridY)) {
        return shapeOverlayCovers({ shape, gridX: attackerGridX, gridY: attackerGridY, targetPos, rangeFeet, coneAngle, widthFt });
      }
      return isDistanceInRange(getDistanceFeet(attackerPos, { gridX: targetPos.gridX, gridY: targetPos.gridY }), rangeFeet);
    });
  }, [combatSummary, attackerName, mapData, attackerPos, rangeFeet, turnUndead, monsters, shape, coneAngle, widthFt, attackerGridX, attackerGridY, includeCaster]);

  const toggleTarget = useCallback((name) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); }
      else if (next.size < maxTargets) { next.add(name); }
      return next;
    });
  }, [maxTargets]);

  // Overlay consumers shadow the base selection with extraState.selected
  // (spread onto ctxRef below — the same merged value renderBody/renderActions
  // consume). Consult that effective value here: the base's own `selected`
  // stays empty forever on those lanes, so reading it made
  // `results.length >= selected.size` trivially true and flipped allResolved
  // on the setProcessing(true) flush — committing empty-result summaries
  // (#226 zero-row race).
  const effectiveSelected = 'selected' in extraState ? extraState.selected : selected;
  const allResolved = processing && pendingPrompts.length === 0 && results.length >= effectiveSelected.size;

  useEffect(() => {
    if (onAllResolved && allResolved) {
      onAllResolved({ results, selected: effectiveSelected, processing, pendingPrompts });
    }
  }, [allResolved, onAllResolved, results, effectiveSelected, processing, pendingPrompts]);

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
    <div className="sp-overlay">
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
