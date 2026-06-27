import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { getDistanceFeet } from '../../../../services/rules/combat/rangeValidation.js';

function AreaEffectTargetModalBase({
  combatSummary,
  attackerName,
  attackerPos,
  saveDc,
  campaignName,
  mapData,
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
}) {
  const [selected, setSelected] = useState(new Set());
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [pendingPrompts, setPendingPrompts] = useState([]);

  const eligibleTargets = useMemo(() => {
    if (!combatSummary?.creatures) return [];
    return combatSummary.creatures.filter(c => {
      if (c.name === attackerName) return false;
      if (!mapData || !attackerPos) return true;
      const targetPos = mapData.players?.find(p => p.name === c.name) || mapData.placedItems?.find(i => i.name === c.name);
      if (!targetPos) return true;
      const dist = getDistanceFeet(attackerPos, { gridX: targetPos.gridX, gridY: targetPos.gridY });
      return dist != null && dist <= rangeFeet;
    });
  }, [combatSummary, attackerName, mapData, attackerPos, rangeFeet]);

  const toggleTarget = useCallback((name) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) { next.delete(name); } else { next.add(name); }
      return next;
    });
  }, []);

  const allResolved = processing && pendingPrompts.length === 0 && results.length >= selected.size;

  useEffect(() => {
    if (onAllResolved && allResolved) {
      onAllResolved({ results, selected, processing, pendingPrompts });
    }
  }, [allResolved, onAllResolved, results, selected, processing, pendingPrompts]);

  const handleApplyOverrideRef = useRef(() => {});
  const handleSaveResultOverrideRef = useRef(() => {});

  handleApplyOverrideRef.current = handleApplyOverride || (() => {});
  handleSaveResultOverrideRef.current = handleSaveResultOverride || (() => {});

  const ctxRef = useRef({
    processing: false, allResolved: false, selected: new Set(), eligibleTargets: [],
    results: [], pendingPrompts: [], toggleTarget: () => {},
    handleApply: () => {}, handleSaveResult: () => {},
    saveType, saveDc, rangeFeet, featureName,
    combatSummary, attackerName, campaignName, mapData, onClose, characters,
    setSelected, setProcessing, setResults, setPendingPrompts,
  });

  const handleApply = useCallback(() => {
    handleApplyOverrideRef.current(ctxRef.current);
  }, []);

  const handleSaveResult = useCallback((event) => {
    handleSaveResultOverrideRef.current(event, ctxRef.current);
  }, []);

  ctxRef.current = {
    processing, allResolved, selected, eligibleTargets,
    results, pendingPrompts, toggleTarget,
    handleApply, handleSaveResult,
    saveType, saveDc, rangeFeet, featureName,
    combatSummary, attackerName, campaignName, mapData, onClose, characters,
    setSelected, setProcessing, setResults, setPendingPrompts,
    ...extraState,
  };

  useEffect(() => {
    if (!processing) return;
    window.addEventListener('save-result', handleSaveResult);
    return () => window.removeEventListener('save-result', handleSaveResult);
  }, [processing, handleSaveResult]);

  const ctx = ctxRef.current;

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-modal" onClick={e => e.stopPropagation()}>
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
